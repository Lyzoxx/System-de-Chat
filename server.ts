type Message = {
  id: number;
  pseudo: string;
  texte?: string;
  audio?: string;
  system?: boolean;
  oldPseudo?: string;
};

const messages: Message[] = [];
let nextId = 1;
const pseudos = new Set<string>();

const server = Bun.serve({
  port: 3000,

  async fetch(req, server) {
    const url = new URL(req.url);

    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req);
      if (upgraded) {
        return undefined;
      }
      return new Response("Échec de la connexion WebSocket", { status: 500 });
    }

    if (url.pathname === "/message" && req.method === "POST") {
      const data = (await req.json()) as { pseudo?: string; texte?: string };
      const pseudo = typeof data.pseudo === "string" ? data.pseudo : "Inconnu";
      const texte = typeof data.texte === "string" ? data.texte : "";

      const message: Message = {
        id: nextId++,
        pseudo,
        texte,
      };
      messages.push(message);
      if (pseudo !== "Inconnu") {
        pseudos.add(pseudo);
      }

      console.log(`[MESSAGE] ${pseudo}: ${texte}`);

      return new Response("Message reçu par le serveur");
    }

    if (url.pathname === "/check-pseudo" && req.method === "GET") {
      const pseudo = url.searchParams.get("pseudo") ?? "";
      const exists = pseudos.has(pseudo);

      if (!exists && pseudo.trim() !== "") {
        pseudos.add(pseudo);
      }

      return new Response(
        JSON.stringify({
          available: !exists,
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (url.pathname === "/messages" && req.method === "GET") {
      return new Response(JSON.stringify(messages), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/style.css") {
      return new Response(Bun.file("style.css"), {
        headers: { "Content-Type": "text/css" },
      });
    }
    if (url.pathname === "/script.js") {
      return new Response(Bun.file("script.js"), {
        headers: { "Content-Type": "application/javascript" },
      });
    }

    return new Response(Bun.file("index.html"), {
      headers: { "Content-Type": "text/html" },
    });
  },

  websocket: {
    open(ws) {
      ws.subscribe("chat");

      ws.send(
        JSON.stringify({
          type: "history",
          messages,
        }),
      );
    },

    message(ws, data) {
      try {
        const payload = JSON.parse(String(data)) as {
          type?: string;
          pseudo?: string;
          oldPseudo?: string;
          newPseudo?: string;
          texte?: string;
          audio?: string;
        };

        if (payload.type === "changePseudo" && typeof payload.newPseudo === "string" && typeof payload.oldPseudo === "string") {
          const oldPseudo = payload.oldPseudo.trim();
          const newPseudo = payload.newPseudo.trim() || "Inconnu";
          const message: Message = {
            id: nextId++,
            pseudo: newPseudo,
            oldPseudo,
            texte: oldPseudo + " a modifié son pseudo en " + newPseudo,
            system: true,
          };
          messages.push(message);
          pseudos.delete(oldPseudo);
          pseudos.add(newPseudo);
          console.log(`[CHANGE PSEUDO] ${oldPseudo} → ${newPseudo}`);
          server.publish(
            "chat",
            JSON.stringify({ type: "message", message }),
          );
          return;
        }

        if (payload.type === "join" && typeof payload.pseudo === "string") {
          const pseudo = payload.pseudo.trim() || "Inconnu";
          const message: Message = {
            id: nextId++,
            pseudo,
            texte: pseudo + " a rejoint",
            system: true,
          };
          messages.push(message);
          console.log(`[JOIN] ${pseudo}`);
          server.publish(
            "chat",
            JSON.stringify({ type: "message", message }),
          );
          return;
        }

        const pseudo =
          typeof payload.pseudo === "string" ? payload.pseudo : "Inconnu";

        if (typeof payload.audio === "string" && payload.audio.length > 0) {
          const message: Message = {
            id: nextId++,
            pseudo,
            audio: payload.audio,
          };
          messages.push(message);
          console.log(`[WS VOCAL] ${pseudo}`);
          server.publish(
            "chat",
            JSON.stringify({ type: "message", message }),
          );
          return;
        }

        const texte = typeof payload.texte === "string" ? payload.texte : "";
        const message: Message = {
          id: nextId++,
          pseudo,
          texte
        };


        console.log(`[WS MESSAGE] ${pseudo}: ${message.texte}`);
        messages.push(message);

        server.publish(
          "chat",
          JSON.stringify({ type: "message", message }),
        );
      } catch (e) {
        console.error("Erreur WebSocket message:", e);
      }
    },
  },
});

console.log("Serveur lancé sur http://localhost:3000");

