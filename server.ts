type Message = {
  id: number;
  pseudo: string;
  date?: string;
  texte?: string;
  audio?: string;
  system?: boolean;
  oldPseudo?: string;
};

const messages: Message[] = [];
let nextId = 1;
const pseudos = new Set<string>();
const pseudoToToken = new Map<string, string>();

const secret =
        process.env.RECAPTCHA_SECRET_KEY;

if (!secret) {
  throw new Error("RECAPTCHA_SECRET_KEY is not set");
}

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
        date: new Date().toISOString(),
        texte,
      };
      messages.push(message);
      if (pseudo !== "Inconnu") {
        pseudos.add(pseudo);
      }

      console.log(`[MESSAGE] ${pseudo}: ${texte}`);

      return new Response("Message reçu par le serveur");
    }

    if (url.pathname === "/check-pseudo" && req.method === "POST") {
      let data: { pseudo?: string; recaptchaToken?: string; clientToken?: string } = {};
      try {
        data = (await req.json()) as typeof data;
      } catch {
        return new Response(
          JSON.stringify({ available: false, error: "Requête invalide" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      const pseudo = typeof data.pseudo === "string" ? data.pseudo.trim() : "";
      const recaptchaToken =
        typeof data.recaptchaToken === "string" ? data.recaptchaToken : "";
      const clientToken =
        typeof data.clientToken === "string" ? data.clientToken : "";


      if (!recaptchaToken) {
        console.log("[CHECK-PSEUDO] reCAPTCHA manquant");
        return new Response(
          JSON.stringify({
            available: false,
            error: "Veuillez valider le reCAPTCHA",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const verifyRes = await fetch(
        "https://www.google.com/recaptcha/api/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            secret,
            response: recaptchaToken,
          }),
        },
      );
      const verifyData = (await verifyRes.json()) as {
        success?: boolean;
        "error-codes"?: string[];
      };

      if (verifyData.success !== true) {
        console.log("[CHECK-PSEUDO] reCAPTCHA invalide:", verifyData["error-codes"] || "inconnu");
        return new Response(
          JSON.stringify({ available: false, error: "reCAPTCHA invalide" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      console.log("[CHECK-PSEUDO] reCAPTCHA valide pour pseudo:", pseudo);

      const exists = pseudos.has(pseudo);
      const storedToken = pseudoToToken.get(pseudo);
      const isReconnect = exists && storedToken && storedToken === clientToken;

      if (isReconnect) {
        return new Response(
          JSON.stringify({ available: true, token: storedToken }),
          { headers: { "Content-Type": "application/json" } },
        );
      }

      if (exists) {
        return new Response(
          JSON.stringify({
            available: false,
            error: "Ce pseudo est déjà utilisé, choisis-en un autre.",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (pseudo !== "") {
        pseudos.add(pseudo);
        const token = crypto.randomUUID();
        pseudoToToken.set(pseudo, token);
        return new Response(
          JSON.stringify({ available: true, token }),
          { headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ available: false, error: "Pseudo requis" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
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
    if (url.pathname === "/config.js") {
      return new Response(Bun.file("config.js"), {
        headers: { "Content-Type": "application/javascript" },
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
            date: new Date().toISOString(),
            oldPseudo,
            texte: oldPseudo + " a modifié son pseudo en " + newPseudo,
            system: true,
          };
          messages.push(message);
          pseudos.delete(oldPseudo);
          pseudoToToken.delete(oldPseudo);
          pseudos.add(newPseudo);
          const newToken = crypto.randomUUID();
          pseudoToToken.set(newPseudo, newToken);
          ws.send(JSON.stringify({ type: "pseudoToken", token: newToken }));
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
            date: new Date().toISOString(),
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
            date: new Date().toISOString(),
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
          date: new Date().toISOString(),
          texte,
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

