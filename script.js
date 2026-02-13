let socket;
let mediaRecorder = null;
let chunksVocal = [];
let recaptchaWidgetId = null;

window.onRecaptchaLoaded = function () {
  const popup = document.getElementById("popup");
  if (popup && popup.style.display !== "none") {
    if (typeof grecaptcha !== "undefined" && grecaptcha.ready) {
      grecaptcha.ready(afficherRecaptcha);
    } else {
      afficherRecaptcha();
    }
  }
};

window.onload = function () {
  const savedPseudo = localStorage.getItem("pseudo");
  if (savedPseudo) {
    const input = document.getElementById("monInput");
    if (input) input.value = savedPseudo;
  }

  document.getElementById("popup").style.display = "flex";

  if (typeof grecaptcha !== "undefined" && grecaptcha.ready) {
    grecaptcha.ready(function () {
      afficherRecaptcha();
    });
  } else {
    afficherRecaptcha();
  }

  connecterWebSocket();

  const inputMessage = document.getElementById("inputMessage");
  if (inputMessage) {
    inputMessage.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        envoyerMessage();
      }
    });
  }
};

async function validerPseudo() {
  const input = document.getElementById("monInput");
  const errorEl = document.getElementById("pseudoError");
  const pseudo = input.value;

  if (errorEl) {
    errorEl.textContent = "";
  }

  if (pseudo.trim() === "") {
    if (errorEl) {
      errorEl.textContent = "Veuillez entrer un pseudo.";
    } else {
      alert("Veuillez entrer un pseudo !");
    }
    return;
  }

  const recaptchaToken = getRecaptchaToken();
  const siteKey = (window.RECAPTCHA_SITE_KEY || "").trim();
  if (siteKey && !recaptchaToken) {
    if (errorEl) {
      errorEl.textContent = "Veuillez valider le reCAPTCHA.";
    } else {
      alert("Veuillez valider le reCAPTCHA.");
    }
    return;
  }

  try {
    const response = await fetch("/check-pseudo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pseudo, recaptchaToken }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = data.error || "Erreur serveur";
      if (errorEl) {
        errorEl.textContent = msg;
      } else {
        alert(msg);
      }
      return;
    }
    if (!data.available) {
      if (errorEl) {
        errorEl.textContent =
          "Ce pseudo est déjà utilisé, choisis-en un autre.";
      } else {
        alert("Ce pseudo est déjà utilisé, choisis-en un autre.");
      }
      return;
    }
  } catch (e) {
    console.error("Erreur lors de la vérification du pseudo", e);
    if (errorEl) {
      errorEl.textContent = "Erreur de connexion au serveur.";
    }
    return;
  }

  const oldPseudo = localStorage.getItem("pseudo");
  localStorage.setItem("pseudo", pseudo);

  afficherPseudo(pseudo);

  document.getElementById("popup").style.display = "none";

  if (socket && socket.readyState === WebSocket.OPEN) {
    if (oldPseudo && oldPseudo !== pseudo) {
      socket.send(JSON.stringify({ type: "changePseudo", oldPseudo, newPseudo: pseudo }));
    } else {
      socket.send(JSON.stringify({ type: "join", pseudo }));
    }
  }

  resetRecaptcha();
}

function afficherRecaptcha() {
  const container = document.getElementById("recaptcha-container");
  const btn = document.getElementById("btnValider");
  const siteKey = (window.RECAPTCHA_SITE_KEY || "").trim();

  if (!container || !siteKey) {
    if (btn) btn.disabled = false;
    return;
  }

  if (container.innerHTML.trim() !== "") return;

  if (typeof grecaptcha === "undefined") {
    setTimeout(afficherRecaptcha, 100);
    return;
  }

  try {
    recaptchaWidgetId = grecaptcha.render(container, {
      sitekey: siteKey,
      callback: function () {
        const b = document.getElementById("btnValider");
        if (b) b.disabled = false;
      },
    });
  } catch (e) {
    console.error("Erreur reCAPTCHA:", e);
    if (btn) btn.disabled = false;
  }
}

function initialiserRecaptcha() {
  if (typeof grecaptcha !== "undefined" && grecaptcha.ready) {
    grecaptcha.ready(afficherRecaptcha);
  } else {
    afficherRecaptcha();
  }
}

function resetRecaptcha() {
  const container = document.getElementById("recaptcha-container");
  const btn = document.getElementById("btnValider");
  const siteKey = (window.RECAPTCHA_SITE_KEY || "").trim();

  if (container) container.innerHTML = "";
  recaptchaWidgetId = null;
  if (btn && siteKey) btn.disabled = true;
}

function getRecaptchaToken() {
  if (typeof grecaptcha === "undefined" || recaptchaWidgetId == null) return "";
  return grecaptcha.getResponse(recaptchaWidgetId) || "";
}

function afficherPseudo(pseudo) {
  document.getElementById("pseudoAffichage").textContent =
    "Votre pseudo est : " + pseudo;
}

function ouvrirPopupPseudo() {
  const popup = document.getElementById("popup");
  const input = document.getElementById("monInput");

  input.value = "";
  const err = document.getElementById("pseudoError");
  if (err) err.textContent = "";

  popup.style.display = "flex";

  resetRecaptcha();
  initialiserRecaptcha();
}

async function inviter() {
  const url = window.location.href;
  const titre = "Rejoins le chat";
  const texte = "Viens discuter avec moi sur le chat !";

  if (navigator.share) {
    try {
      await navigator.share({
        title: titre,
        text: texte,
        url: url,
      });
    } catch (e) {
      if (e.name !== "AbortError") {
        copierLienEtAlerter(url);
      }
    }
  } else {
    copierLienEtAlerter(url);
  }
}

function copierLienEtAlerter(url) {
  navigator.clipboard
    .writeText(url)
    .then(() => {
      alert("Lien copié ! Colle-le où tu veux pour inviter quelqu'un.");
    })
    .catch(() => {
      prompt("Copie ce lien pour inviter quelqu'un :", url);
    });
}

async function envoyerMessage() {
  const pseudo = localStorage.getItem("pseudo");
  if (!pseudo) {
    alert("Veuillez d'abord entrer votre pseudo !");
    return;
  }

  const input = document.getElementById("inputMessage");
  const texte = input.value.trim();

  if (texte === "") {
    return;
  }

  input.value = "";

  try {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      alert("Connexion au chat non disponible.");
      return;
    }

    socket.send(JSON.stringify({ pseudo, texte }));
  } catch (e) {
    console.error("Erreur lors de l'envoi du message au serveur", e);
  }
}

function toggleVocal() {
  const btn = document.getElementById("btnVocal");
  if (!btn) return;

  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    btn.textContent = "Vocal";
    btn.classList.remove("recording");
    return;
  }

  const pseudo = localStorage.getItem("pseudo");
  if (!pseudo) {
    alert("Veuillez d'abord entrer votre pseudo !");
    return;
  }
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    alert("Connexion au chat non disponible.");
    return;
  }

  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      chunksVocal = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksVocal.push(e.data);
      };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksVocal, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result.split(",")[1];
          if (base64) {
            socket.send(JSON.stringify({ pseudo, audio: base64 }));
          }
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorder.start();
      btn.textContent = "Arrêter";
      btn.classList.add("recording");
    })
    .catch((err) => {
      console.error("Micro non disponible", err);
      alert("Accès au micro refusé ou non disponible.");
    });
}

function afficherListeMessages(liste) {
  const zone = document.getElementById("messages");
  zone.innerHTML = "";
  for (const msg of liste) {
    if (msg.system) {
      ajouterMessageSystem(msg);
    } else if (msg.audio) {
      ajouterMessageVocal(msg.pseudo, msg.audio, msg.date);
    } else {
      ajouterMessage(msg.pseudo, msg.texte || "", msg.date);
    }
  }
}

function ajouterMessageSystem(msg) {
  const zone = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = "message message-system";
  const pseudoLocal = localStorage.getItem("pseudo");
  let texte;
  if (msg.oldPseudo != null) {
    if (pseudoLocal && msg.pseudo === pseudoLocal) {
      texte = "Vous avez modifié votre pseudo en " + msg.pseudo;
    } else {
      texte = msg.texte;
    }
  } else {
    if (pseudoLocal && msg.pseudo === pseudoLocal) {
      texte = "Vous avez rejoint le Chat";
    } else {
      texte = msg.texte;
    }
  }
  const heure = formaterHeureFrance(msg.date);
  div.innerHTML = escapeHtml(texte) + (heure ? ' <span class="heure">' + heure + "</span>" : "");
  zone.appendChild(div);
  zone.scrollTop = zone.scrollHeight;
}

function ajouterMessage(pseudo, texte, date) {
  const zone = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = "message";

  const pseudoLocal = localStorage.getItem("pseudo");
  if (pseudoLocal && pseudo === pseudoLocal) {
    div.classList.add("message-me");
  } else {
    div.classList.add("message-other");
  }

  const heure = formaterHeureFrance(date);
  const heureHtml = heure ? ' <span class="heure">' + heure + "</span>" : "";
  div.innerHTML =
    '<span class="auteur">' + pseudo + heureHtml + "</span><br>" + escapeHtml(texte);
  zone.appendChild(div);
  zone.scrollTop = zone.scrollHeight;
}

function ajouterMessageVocal(pseudo, audioBase64, date) {
  const zone = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = "message message-vocal";

  const pseudoLocal = localStorage.getItem("pseudo");
  if (pseudoLocal && pseudo === pseudoLocal) {
    div.classList.add("message-me");
  } else {
    div.classList.add("message-other");
  }

  const span = document.createElement("span");
  span.className = "auteur";
  span.textContent = pseudo;
  div.appendChild(span);
  const heure = formaterHeureFrance(date);
  if (heure) {
    const spanHeure = document.createElement("span");
    spanHeure.className = "heure";
    spanHeure.textContent = " " + heure;
    div.appendChild(spanHeure);
  }
  div.appendChild(document.createElement("br"));

  const audio = document.createElement("audio");
  audio.controls = true;
  audio.preload = "metadata";
  audio.src = "data:audio/webm;base64," + audioBase64;
  div.appendChild(audio);
  zone.appendChild(div);
  zone.scrollTop = zone.scrollHeight;
}

function escapeHtml(texte) {
  const div = document.createElement("div");
  div.textContent = texte;
  return div.innerHTML;
}

function formaterHeureFrance(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function connecterWebSocket() {
  const protocole = location.protocol === "https:" ? "wss" : "ws";
  const url = `${protocole}://${location.host}/ws`;

  socket = new WebSocket(url);

  socket.onopen = function () {
    console.log("Connecté au serveur de chat (WebSocket).");
  };

  socket.onmessage = function (event) {
    try {
      const data = JSON.parse(event.data);

      if (data.type === "history" && Array.isArray(data.messages)) {
        afficherListeMessages(data.messages);
      } else if (data.type === "message" && data.message) {
        const msg = data.message;
        if (msg.system) {
          ajouterMessageSystem(msg);
        } else if (msg.audio) {
          ajouterMessageVocal(msg.pseudo, msg.audio, msg.date);
        } else {
          ajouterMessage(msg.pseudo, msg.texte || "", msg.date);
        }
      }
    } catch (e) {
      console.error("Erreur lors du traitement d'un message WebSocket", e);
    }
  };

  socket.onclose = function () {
    console.log("Déconnecté du serveur de chat.");
  };

  socket.onerror = function (err) {
    console.error("Erreur WebSocket", err);
  };
}
