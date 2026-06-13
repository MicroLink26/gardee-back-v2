# Gardee Backend

API REST pour la marketplace Gardee — connecte des propriétaires avec des jardiniers professionnels.

**Stack** : Node.js 20 · Express · TypeScript · MongoDB (Mongoose) · Jest

**Production** : `https://site--gardee-backend--fg6zdpvl2w9z.code.run/api`  
**CI** : GitHub Actions (tsc + 268 tests + build) — Northflank déploie automatiquement à chaque push sur `master`

---

## Démarrage rapide

```bash
cp .env.example .env   # remplir les variables
npm install
npm run dev            # hot-reload via tsx watch
```

## Commandes

```bash
npm run dev       # serveur de développement
npm run build     # compile TypeScript → dist/
npm start         # lance dist/index.js
npx tsc --noEmit  # type-check seul
npm test          # jest --runInBand (tests unitaires)
```

## Variables d'environnement

| Variable | Description | Requis |
|---|---|---|
| `MONGO_URL` | Chaîne de connexion MongoDB Atlas | ✅ |
| `JWT_ACCESS_SECRET` | Clé de signature des access tokens (≥32 chars) | ✅ |
| `JWT_REFRESH_SECRET` | Clé de signature des refresh tokens (différente) | ✅ |
| `ACCESS_TTL_MINUTES` | Durée des access tokens (défaut : 15) | |
| `REFRESH_TTL_DAYS` | Durée des refresh tokens (défaut : 30) | |
| `MAIL_USER` | Adresse SMTP OVH | ✅ |
| `MAIL_PASS` | Mot de passe SMTP | ✅ |
| `MAIL_FROM` | Expéditeur affiché | |
| `CLOUDINARY_CLOUD_NAME` | Identifiant Cloudinary (photos de profil) | ✅ |
| `CLOUDINARY_API_KEY` | Clé API Cloudinary | ✅ |
| `CLOUDINARY_API_SECRET` | Secret API Cloudinary | ✅ |
| `APP_URL` | URL du dashboard (`https://account.gardee.fr`) | ✅ |
| `FRONT_URL` | URL du site public (`https://gardee.fr`) | ✅ |
| `CRON_SECRET` | Token protégeant `GET /cron/daily` | ✅ |
| `NOMINATIM_USER_AGENT` | User-Agent pour l'API Nominatim (géocodage) | ✅ |
| `NOMINATIM_EMAIL` | Email de contact Nominatim | ✅ |
| `RESEND_COOLDOWN_MS` | Délai minimum entre deux renvois d'email (ms) | |

---

## Architecture

```
src/
├── app.ts                  # Express : CORS, helmet, morgan, middlewares, routes
├── index.ts                # Point d'entrée : connecte DB, démarre le serveur
├── config/
│   ├── db.ts               # Connexion Mongoose
│   └── mailer.ts           # Transport nodemailer OVH SMTP
├── models/                 # Schémas Mongoose avec validateurs
│   ├── User.ts
│   ├── Prestataire.ts      # Profil prestataire (1-1 avec User)
│   ├── ServiceRequest.ts   # Demandes + messages + labels + avis
│   ├── Category.ts
│   ├── Contact.ts
│   ├── PushSubscription.ts
│   ├── RefreshToken.ts
│   └── PasswordReset.ts
├── controllers/            # Logique métier
├── routes/                 # Déclaration des routes et rate limiting
├── middlewares/
│   ├── auth.ts             # isConnected / isStaff / isAdmin / isPrestataire
│   └── errorHandler.ts     # Gestionnaire d'erreurs global
├── services/
│   ├── emailService.ts     # Tous les emails transactionnels
│   ├── cronService.ts      # Géocodage, rappels, emails d'avis
│   └── pushService.ts      # Notifications Web Push (VAPID)
├── utils/
│   ├── validation.ts       # validateEmail / validateTextField / validatePassword
│   ├── rateLimiter.ts      # Limiteurs express-rate-limit par cas d'usage
│   └── logger.ts           # Logging structuré
└── types/
    └── index.ts            # AuthRequest, UserRole, RequestStatus, PaginatedResult
```

### Authentification

- **Access token** JWT 15 min — header `Authorization: Bearer <token>`
- **Refresh token** 30 jours — cookie `httpOnly` `refreshToken`
- Rotation : chaque appel à `POST /api/auth/refresh` émet un nouveau refresh token et invalide l'ancien (table `RefreshToken`)
- Middlewares : `isConnected` → `isPrestataire` → `isStaff` → `isAdmin` (hiérarchiques)

### Machine d'états des demandes

```
email_pending ──► client_confirmed ──► sent_to_provider
                                             │
                                    provider_proposed ◄──► client_accepted
                                             │
                                        scheduled ──► completed
                                             │
                                    refused / cancelled
```

### Sécurité

- **Validation** : chaque endpoint valide les entrées (champs requis, longueurs, types) via `src/utils/validation.ts` avant toute opération DB
- **Rate limiting** par type d'action : `registerLimiter` (3/h), `loginLimiter` (10/15min), `sendMessageLimiter` (20/min), `createRequestLimiter` (5/h)…
- **Schémas Mongoose** : `maxlength`/`min`/`max` sur tous les champs exposés — défense en profondeur côté storage
- **Logging structuré** : erreurs loguées avec contexte (userId, requestId) via `logMessageActionError`

---

## Référence API

Base URL : `/api`  
Format de réponse :
- Succès : `{ ok: true, ...data }` ou `{ items, total, page, pageSize }` (liste paginée)
- Erreur : `{ error: "message en français" }`

### Auth — `/api/auth`

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/login` | — | Connexion email + mot de passe |
| POST | `/register` | — | Inscription (prestataire) |
| POST | `/logout` | — | Révoque le refresh token |
| POST | `/refresh` | cookie | Renouvelle l'access token |
| GET | `/me` | ✅ | Profil de l'utilisateur connecté |
| GET | `/roles` | ✅ | Rôles disponibles |
| GET | `/check-email` | — | Vérifie si un email est déjà pris |
| POST | `/verify-email` | — | Vérifie le code reçu par email |
| POST | `/resend-verification` | — | Renvoie le code de vérification |
| POST | `/forgot-password` | — | Envoie un lien de réinitialisation |
| POST | `/reset-password` | — | Réinitialise le mot de passe |
| PUT | `/change-password` | ✅ | Change le mot de passe |

### Utilisateurs — `/api/users`

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/register/client` | — | Inscription client |
| GET | `/me` | ✅ | Profil client connecté |
| PUT | `/me` | ✅ | Met à jour le profil |

### Prestataires — `/api/prestataires`

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/register` | — | Inscription prestataire |
| GET | `/search` | — | Recherche avec filtres (prestation, ville, géo, tarif) |
| GET | `/ranking` | — | Classement par note |
| GET | `/all-ids` | — | Tous les IDs (pour le prérendu SSR des fiches) |
| GET | `/:id` | — | Profil public |
| GET | `/:id/reviews` | — | Avis approuvés |
| POST | `/me` | prestataire | Crée le profil prestataire |
| PUT | `/me` | prestataire | Met à jour le profil |
| DELETE | `/me` | prestataire | Supprime le profil |

### Demandes — `/api/requests`

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/` | — | Crée une demande (guest ou connecté) |
| GET | `/mine` | prestataire | Demandes reçues par le prestataire |
| GET | `/mine/client` | ✅ | Demandes du client connecté |
| GET | `/confirm` | token | Confirme l'email du client (guest) |
| POST | `/resend` | token | Renvoie le lien de confirmation |
| GET | `/proposal/accept` | token | Accepte un créneau proposé (email) |
| GET | `/proposal/refuse` | token | Refuse un créneau proposé (email) |
| PATCH | `/:id/archive` | ✅ | Archive une demande |
| PATCH | `/:id/unarchive` | ✅ | Désarchive |
| PATCH | `/:id/provider/propose` | prestataire | Propose un créneau |
| POST | `/:id/provider/accept` | prestataire | Accepte |
| POST | `/:id/provider/refuse` | prestataire | Refuse |
| POST | `/:id/provider/cancel` | prestataire | Annule |
| POST | `/:id/client/accept-proposal` | ✅ | Client accepte le créneau |
| POST | `/:id/complete` | prestataire | Marque comme terminé |
| GET | `/labels` | ✅ | Labels disponibles |
| POST | `/:id/labels/add` | ✅ | Ajoute un label |
| POST | `/:id/labels/remove` | ✅ | Retire un label |

### Messages — `/api/requests` (suite)

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/messages/threads` | prestataire | Liste des fils de discussion |
| GET | `/messages/client-threads` | ✅ | Fils du client connecté |
| GET | `/messages/thread` | token | Fil d'un client guest |
| GET | `/messages/search` | token | Recherche dans les messages (guest) |
| GET | `/:id/messages` | prestataire | Messages d'une demande |
| GET | `/:id/messages/search` | prestataire | Recherche dans une demande |
| POST | `/:id/message` | prestataire | Envoie un message |
| POST | `/:id/client/message` | ✅ | Répond (client connecté) |
| POST | `/messages/reply` | token | Répond (client guest) |
| POST | `/:id/messages/edit` | ✅ | Modifie un message |
| POST | `/:id/messages/delete` | ✅ | Supprime (soft) un message |
| POST | `/:id/messages/pin` | prestataire | Épingle un message |
| POST | `/:id/messages/unpin` | prestataire | Désépingle |
| POST | `/:id/messages/react` | prestataire | Réaction emoji |
| POST | `/messages/react` | token | Réaction (guest) |
| POST | `/:id/messages/mark-read` | prestataire | Marque comme lu |
| POST | `/messages/read-by-token` | token | Marque comme lu (guest) |
| POST | `/:id/messages/forward` | ✅ | Transfère vers une autre demande |
| GET | `/:id/messages/forward-targets` | ✅ | Cibles de transfert disponibles |

### Avis — `/api/reviews`

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/validate` | token | Valide le token d'avis |
| POST | `/submit` | token | Soumet un avis (notes 1-5 + commentaire) |

### Administration — `/api/admin`

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/users` | staff | Liste des utilisateurs |
| GET | `/pending` | staff | Prestataires en attente de validation |
| GET | `/reviews/pending` | staff | Avis en attente de modération |
| GET | `/insights` | staff | Statistiques générales |
| PUT | `/prestataires/:id/validate` | staff | Valide un prestataire |
| PUT | `/prestataires/:id/reject` | staff | Rejette avec motif |
| PUT | `/reviews/:id/approve` | staff | Approuve un avis |
| PUT | `/reviews/:id/reject` | staff | Rejette un avis |
| PATCH | `/roles/:id` | admin | Change le rôle d'un utilisateur |
| DELETE | `/users/:id` | admin | Supprime un compte |
| POST | `/ping-shown/:userId` | staff | Marque le ping de rejet comme vu |

### Autres

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/categories` | — | Liste des catégories de prestations |
| POST | `/api/categories` | staff | Crée une catégorie |
| DELETE | `/api/categories/:id` | staff | Supprime une catégorie |
| POST | `/api/contact` | — | Formulaire de contact |
| GET | `/api/push/vapid-public-key` | — | Clé publique VAPID |
| POST | `/api/push/subscribe` | ✅ | Abonne aux notifications push |
| DELETE | `/api/push/subscribe` | ✅ | Désabonne |
| GET | `/cron/daily` | token CRON_SECRET | Déclenche les tâches planifiées |

---

## Tests

```bash
npm test                                    # tous les tests
npx jest tests/src/controllers --no-coverage  # un dossier
npx jest src/controllers/__tests__/authController.test.ts --no-coverage  # un fichier
```

Les tests mockent les modèles Mongoose (`jest.mock('../models/...')`) — aucune base de données n'est requise. La suite tourne en ~10s.
