let socket;
let mediaRecorder = null;
let chunksVocal = [];

window.onload = function () {
  const pseudo = localStorage.getItem("pseudo");
  if (pseudo) {
    afficherPseudo(pseudo);
    document.getElementById("popup").style.display = "none";
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

  try {
    const response = await fetch(
      "/check-pseudo?pseudo=" + encodeURIComponent(pseudo),
    );
    if (response.ok) {
      const data = await response.json();
      if (!data.available) {
        if (errorEl) {
          errorEl.textContent =
            "Ce pseudo est déjà utilisé, choisis-en un autre.";
        } else {
          alert("Ce pseudo est déjà utilisé, choisis-en un autre.");
        }
        return;
      }
    }
  } catch (e) {
    console.error("Erreur lors de la vérification du pseudo", e);
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
}

function afficherPseudo(pseudo) {
  document.getElementById("pseudoAffichage").textContent =
    "Votre pseudo est : " + pseudo;
}

function ouvrirPopupPseudo() {
  const popup = document.getElementById("popup");
  const input = document.getElementById("monInput");

  input.value = "";

  popup.style.display = "flex";
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
      ajouterMessageVocal(msg.pseudo, msg.audio);
    } else {
      ajouterMessage(msg.pseudo, msg.texte || "");
    }
  }
}

function ajouterMessageSystem(msg) {
  const zone = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = "message message-system";
  const pseudoLocal = localStorage.getItem("pseudo");
  if (msg.oldPseudo != null) {
    if (pseudoLocal && msg.pseudo === pseudoLocal) {
      div.textContent = "Vous avez modifié votre pseudo en " + msg.pseudo;
    } else {
      div.textContent = msg.texte;
    }
  } else {
    if (pseudoLocal && msg.pseudo === pseudoLocal) {
      div.textContent = "Vous avez rejoint le Chat";
    } else {
      div.textContent = msg.texte;
    }
  }
  zone.appendChild(div);
  zone.scrollTop = zone.scrollHeight;
}

function ajouterMessage(pseudo, texte) {
  const zone = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = "message";

  const pseudoLocal = localStorage.getItem("pseudo");
  if (pseudoLocal && pseudo === pseudoLocal) {
    div.classList.add("message-me");
  } else {
    div.classList.add("message-other");
  }

  div.innerHTML =
    '<span class="auteur">' + pseudo + "</span><br>" + escapeHtml(texte);
  zone.appendChild(div);
  zone.scrollTop = zone.scrollHeight;
}

function ajouterMessageVocal(pseudo, audioBase64) {
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

function connecterWebSocket() {
  const protocole = location.protocol === "https:" ? "wss" : "ws";
  const url = `${protocole}://${location.host}/ws`;

  socket = new WebSocket(url);

  socket.onopen = function () {
    console.log("Connecté au serveur de chat (WebSocket).");
    const pseudo = localStorage.getItem("pseudo");
    if (pseudo) {
      socket.send(JSON.stringify({ type: "join", pseudo }));
    }
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
          ajouterMessageVocal(msg.pseudo, msg.audio);
        } else {
          ajouterMessage(msg.pseudo, msg.texte || "");
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
