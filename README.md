# system-chat

Chat local avec WebSocket, reCAPTCHA et persistance du pseudo (token).

## Installation des dépendances

```bash
bun install
```

## Lancer le serveur

```bash
bun run server.ts
```

## Conteneur (Podman ou Docker)

**Construire l’image :**

```bash
podman build -t system-chat .
```

*(Avec Docker : `docker build -t system-chat .`)*

**Lancer le conteneur :**

Avec un fichier `.env` (recommandé) :

```bash
# Copie le modèle et adapte les valeurs
cp .env.example .env

podman run --rm -p 3001:3001 --env-file .env system-chat
```

*(Avec Docker : `docker run --rm -p 3001:3001 --env-file .env system-chat`)*

Ou en passant les variables à la main :

```bash
podman run --rm -p 3001:3001 -e RECAPTCHA_SITE_KEY=ta_cle_site -e RECAPTCHA_SECRET_KEY=ta_cle_secrete system-chat
```

Le serveur est accessible sur http://localhost:3001.

## reCAPTCHA

Le reCAPTCHA s’affiche dans le popup et **bloque** le bouton Valider tant qu’il n’est pas complété.

### Clés de test (mode démo)

```bash
RECAPTCHA_SECRET_KEY=6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe bun run server.ts
```

### Sortir du mode test (reCAPTCHA en phase de test)

Les clés par défaut sont des **clés de test Google** qui affichent « phase de test ». Pour un reCAPTCHA normal :

1. Va sur [reCAPTCHA Admin](https://www.google.com/recaptcha/admin/create)
2. Choisis **reCAPTCHA v2** > **Case à cocher**
3. Ajoute tes domaines (ex. `localhost` pour le dev, ton domaine pour la prod)
4. Récupère ta **clé site (publique)** et ta **clé secrète**
5. Mets les deux dans ton `.env` :

```
RECAPTCHA_SITE_KEY=ta_cle_site_publique
RECAPTCHA_SECRET_KEY=ta_cle_secrete
```

6. Redémarre le serveur

La clé site est servie dynamiquement par le serveur depuis les variables d'environnement.

---

*Projet initialisé avec `bun init`. [Bun](https://bun.com) est un runtime JavaScript tout-en-un.*
