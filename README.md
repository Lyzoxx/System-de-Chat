# system-chat

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run server.ts
```

## reCAPTCHA

Le reCAPTCHA s'affiche dans le popup et **bloque** le bouton Valider tant qu'il n'est pas complété.

**Clés de test Google** (déjà configurées, toujours valides) :
- Lance le serveur avec :  
  `RECAPTCHA_SECRET_KEY=6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe bun run server.ts`

**Pour la production**, crée tes clés sur [reCAPTCHA Admin](https://www.google.com/recaptcha/admin/create) :
1. Choisis **reCAPTCHA v2** > **Case à cocher**
2. Dans `config.js` : remplace par ta **clé publique (site key)**
3. Lance avec ta **clé secrète** :  
   `RECAPTCHA_SECRET_KEY=ta_cle_secrete bun run server.ts`

This project was created using `bun init` in bun v1.3.9. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
