let socket;

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

  localStorage.setItem("pseudo", pseudo);

  afficherPseudo(pseudo);

  document.getElementById("popup").style.display = "none";
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

function afficherListeMessages(liste) {
  const zone = document.getElementById("messages");
  zone.innerHTML = "";
  for (const msg of liste) {
    ajouterMessage(msg.pseudo, msg.texte);
  }
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
  };

  socket.onmessage = function (event) {
    try {
      const data = JSON.parse(event.data);

      if (data.type === "history" && Array.isArray(data.messages)) {
        afficherListeMessages(data.messages);
      } else if (data.type === "message" && data.message) {
        ajouterMessage(data.message.pseudo, data.message.texte);
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
