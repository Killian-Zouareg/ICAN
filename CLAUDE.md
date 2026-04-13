# CLAUDE.md — Guide du projet iCAN

Réseau social fictif style X/Twitter pour JDR, basé sur Vue 3 + Supabase.

---

## Stack technique

| Outil | Version |
|---|---|
| Vue 3 (Composition API, `<script setup>`) | ^3.5 |
| Vite | ^8.0 |
| Pinia | ^3.0 |
| Vue Router (hash mode `#/`) | ^5.0 |
| Supabase (auth + DB + storage) | ^2.100 |
| Leaflet + leaflet.heat | ^1.9 / ^0.2 |

**Variables d'env requises (`.env`) :**
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

---

## Structure `src/`

```
src/
├── assets/main.css        — CSS global + variables CSS
├── main.js                — bootstrap app, init auth
├── App.vue                — layout racine (AppHeader + RouterView)
├── router/index.js        — routes (voir ci-dessous)
├── stores/                — Pinia stores
├── views/                 — pages (+ fichier .css séparé par page)
├── components/            — composants (+ fichier .css séparé)
└── lib/                   — utilitaires
```

> **Convention CSS :** chaque `.vue` > ~80 lignes de styles a son fichier `.css` séparé
> importé via `<style scoped src="./Fichier.css">`. Ne pas réinliner le CSS.

---

## Routes (`src/router/index.js`)

| Path | Nom | Composant | Guard |
|---|---|---|---|
| `/login` | Login | LoginView | public |
| `/` | Feed | FeedView | auth |
| `/post/:id` | PostDetail | PostDetailView | auth |
| `/user/:username` | Profile | ProfileView | auth |
| `/messages` | Messages | MessagesView | auth |
| `/messages/:id` | Conversation | MessagesView | auth |
| `/settings` | Settings | SettingsView | auth |
| `/patch-notes` | PatchNotes | PatchNotesView | auth |
| `/search` | Search | SearchView | auth |
| `/map` | Map | MapView | auth |
| `/character/:username` | Character | CharacterView | auth |
| `/bank` | Bank | BankView | auth |
| `/wiki` | Wiki | WikiView | auth |
| `/wiki/:id` | WikiHero | WikiHeroView | auth |
| `/admin` | Admin | AdminView | **admin only** |
| `/ghost/:id` | GhostProfile | GhostProfileView | auth |

---

## Stores (`src/stores/`)

### `auth.js` — `useAuthStore`
- **State :** `user`, `activeProfile`, `profiles[]`
- **Computed :** `isAuthenticated`, `isAdmin`, `isHero`, `isBanned`, `bannedUntil`, `profile`
- **Actions :** `init()`, `signIn()`, `signUp()`, `signOut()`, `fetchProfiles()`, `switchProfile()`, `createProfile()`, `deleteProfile()`, `updateProfile()`, `uploadAvatar()`, `refreshActiveProfile()`, `checkBan()`

### `posts.js` — `usePostsStore`
- **State :** `posts[]`, `loading`, `userLikes` (Set), `userReposts` (Set)
- **Actions :** `fetchFeed()`, `fetchUserPosts()`, `createPost()`, `deletePost()`, `toggleLike()`, `toggleRepost()`, `fetchComments()`, `hasReposted()`
- Posts enrichis avec profil auteur, original repost/quote, commentaires imbriqués

### `mapLocations.js` — `useMapLocationsStore`
- **State :** `locations[]`, `selectedLocation`, `filterCategory`, `locationPosts[]`, `zones[]`, `loading*`
- **Computed :** `filteredLocations` (filtre par `filterCategory`)
- **Const :** `CATEGORIES` — 10 catégories avec `{ label, color, emoji }`
- **Actions :** `fetchLocations()`, `createLocation()`, `updateLocation()`, `deleteLocation()`, `uploadLocationImage()`, `fetchRecentLocationPosts()`, `selectLocation()`, `clearSelection()`, `fetchZones()`, `createZone()`, `deleteZone()`

### `messages.js` — `useMessagesStore`
- **State :** `conversations[]`, `currentMessages[]`, `loading`
- **Actions :** `fetchConversations()`, `fetchMessages(convId)`, `sendMessage()`, `findOrCreateConversation(otherProfileId)`

### `bank.js` — `useBankStore`
- **State :** `account`, `transactions[]`, `loading`, `sending`
- **Actions :** `fetchAccount()`, `fetchTransactions()`, `transfer()` (RPC), `adminAdjustBalance()` (RPC), `spend()` (RPC)

### `character.js` — `useCharacterStore`
- **State :** `sheet`, `loading`, `saving`
- **Actions :** `fetchSheet(profileId)`, `saveSheet()`, `uploadPhoto()`

### `wiki.js` — `useWikiStore`
- **State :** `heroes[]`, `currentHero`, `loading`, `saving`
- **Actions :** `fetchAll()`, `fetchOne(id)`, `create(data)`, `update(id, data)`, `remove(id)`, `uploadPhoto(id, file)`

### `ghostEngagement.js` — `useGhostEngagementStore`
- Gestion des profils fantômes (PNJ) et de leurs interactions automatisées

---

## Vues (`src/views/`)

| Fichier | Description |
|---|---|
| `FeedView.vue` | Fil d'actualité principal avec PostComposer |
| `ProfileView.vue` | Profil utilisateur + posts + lien fiche iCHARACTER |
| `MapView.vue` | Carte Leaflet interactive — clustering, zones, filtres |
| `MessagesView.vue` | DM style X/Twitter — split-view conversations |
| `CharacterView.vue` | Fiche personnage JDR — stats radar chart, inventaire |
| `BankView.vue` | Compte bancaire fictif, transactions, virements |
| `WikiView.vue` | iWiki — vitrine héros/vilains (particules, 3D hover) + répertoire |
| `WikiHeroView.vue` | Fiche héros immersive plein écran (canvas particules, stats, pouvoirs, relations) |
| `AdminView.vue` | Modération, gestion utilisateurs/lieux/zones |
| `SearchView.vue` | Recherche posts, profils, lieux |
| `PostDetailView.vue` | Post individuel + fil de commentaires |
| `SettingsView.vue` | Paramètres profil, avatar, bio, couleurs héros |
| `PatchNotesView.vue` | Historique des versions — **à mettre à jour après chaque feature** |
| `LoginView.vue` | Auth (connexion / inscription) |
| `GhostProfileView.vue` | Profil PNJ fantôme avec interactions simulées |
| `ConversationView.vue` | Vue conversation individuelle (mobile) |

---

## Composants (`src/components/`)

| Fichier | Description |
|---|---|
| `PostCard.vue` | Carte post (like, repost, commentaire, quote, image) |
| `PostComposer.vue` | Éditeur de post avec mentions `@`, lieux `<`, images |
| `QuoteComposer.vue` | Compositeur de quote-post |
| `CommentCard.vue` / `CommentForm.vue` / `CommentList.vue` | Système de commentaires |
| `QuotedPostEmbed.vue` / `QuotedCommentEmbed.vue` | Embeds de posts/commentaires quotés |
| `SidebarNav.vue` | Navigation gauche (desktop) |
| `MobileNav.vue` | Navigation bas (mobile) |
| `AppHeader.vue` | Header top avec titre de page |
| `TrendingPanel.vue` | Panneau tendances (droite, desktop) |
| `NotificationBell.vue` | Cloche notifications avec badge temps-réel |
| `UserAvatar.vue` | Avatar avec fallback initiales |
| `StatsRadarChart.vue` | Radar chart SVG pour stats personnage |
| `DmWidget.vue` | Widget DM flottant |
| `ConversationList.vue` | Liste des conversations |
| `MessageBubble.vue` / `MessageInput.vue` | Bulles et saisie de messages |
| `NewConversation.vue` | Modal nouvelle conversation |
| `MentionInput.vue` | Input avec autocomplétion `@mentions` |
| `ImageCropper.vue` | Recadrage d'image avant upload |
| `GhostEngagementModal.vue` | Modal interactions profils fantômes |

---

## Utilitaires (`src/lib/`)

| Fichier | Description |
|---|---|
| `supabase.js` | Client Supabase (utilise `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`) |
| `time.js` | `timeAgo(date)` — formatage relatif (ex: "il y a 3 min") |
| `formatCount.js` | `formatCount(n)` — formatage compact (ex: 1200 → "1.2k") |
| `locationMentions.js` | `extractLocationIds(content, locations)` — extrait les `<NomLieu>` d'un post |
| `mentionRenderer.js` | Rendu HTML des mentions `@username` et `<lieu>` |
| `rateLimit.js` | `checkRateLimit(action)` — anti-spam côté client |
| `ghostData.js` | Données statiques des profils PNJ fantômes |

---

## Composables (`src/composables/`)

| Fichier | Description |
|---|---|
| `useRealtimeSubscription.js` | Subscribe/unsubscribe aux changements Supabase Realtime avec auto-cleanup |

---

## Supabase Realtime

L'app utilise Supabase Realtime (WebSocket) pour les mises à jour en direct :

| Table | Event | Utilisé dans | Comportement |
|---|---|---|---|
| `notifications` | INSERT | NotificationBell.vue | Badge notification temps-réel |
| `messages` | INSERT | MessagesView.vue, DmWidget.vue | Messages instantanés (polling 30s fallback) |
| `posts` | INSERT/DELETE | FeedView.vue | Banner "X nouveaux posts" style Twitter |
| `comments` | INSERT | PostDetailView.vue | Commentaires en direct |

**Pattern :** utiliser `useRealtimeSubscription()` — voir `src/composables/useRealtimeSubscription.js`

---

## Tables Supabase

```
profiles              — utilisateurs (id, username, display_name, avatar_url, is_admin, is_hero, bio, banned_until, ...)
posts                 — posts bruts
posts_with_stats      — vue enrichie (likes_count, reposts_count, comments_count, ...)
likes / comment_likes — relations like
comments              — commentaires de posts
conversations         — conversations DM (user1_id, user2_id)
messages              — messages DM
conversation_members  — membres (multi-profils)
conversation_hidden   — conversations masquées
notifications         — notifications temps-réel
map_locations         — lieux carte (id, name, category, lat, lng, image_url, linked_profile_id)
map_zones             — zones polygones (id, name, zone_type, coordinates[])
bank_accounts         — comptes bancaires (profile_id, balance)
bank_transactions     — historique transactions
character_sheets      — fiches personnage (profile_id, stats JSON, inventory JSON)
inventory_items       — objets inventaire
avatars               — storage bucket avatars
ghost_profiles        — profils PNJ fantômes
ghost_likes / ghost_comments — interactions PNJ
wiki_heroes             — fiches wiki héros/vilains (name, alias, side, powers[], stats, story, allies[], enemies[], featured)
```

**RPCs Supabase utilisées :**
- `transfer_money` — virement entre comptes
- `admin_adjust_balance` — ajustement admin
- `spend_money` — dépense

---

## Variables CSS globales (`src/assets/main.css`)

```css
--bg-primary: #15202b       /* fond principal */
--bg-secondary: #192734     /* fond secondaire (cards, panels) */
--bg-hover: #1e2d3d         /* survol */
--border: #38444d           /* bordures */
--text-primary: #e1e8ed     /* texte principal */
--text-secondary: #8899a6   /* texte secondaire / muted */
--accent: #1da1f2           /* bleu Twitter */
--accent-hover: #1a91da
--danger: #e0245e           /* rouge (delete, danger) */
--success: #17bf63          /* vert (repost, succès) */
--repost: #17bf63
--hero-primary: #FFD700     /* or (profils héros) */
--hero-secondary: #FF6B00
--hero-glow: rgba(255,215,0,0.25)
--header-height: 48px
--mobile-nav-height: 48px
```

---

## Règles importantes

1. **PatchNotesView.vue** — toujours ajouter une entrée après chaque feature/fix (highlights + patches)
2. **CSS séparé** — ne jamais réinliner du CSS dans un `.vue` qui a déjà un `.css` associé
3. **Pas de `leaflet.markercluster`** — clustering implémenté en custom dans `MapView.vue`
4. **Admin guard** — vérifier `auth.isAdmin` pour toute action d'administration
5. **Rate limiting** — utiliser `checkRateLimit(action)` avant les actions sensibles (post, like, transfer, upload)
6. **Images** — max 5MB, types autorisés : jpeg/png/gif/webp

---

## MapView — notes spécifiques

- Carte Leaflet centrée sur Allentown, PA `[40.6084, -75.4902]`, zoom 14
- Tiles : CartoDB Voyager avec filtre CSS `brightness(0.7) contrast(1.2) saturate(0.6)`
- Clustering custom : `computeClusters()` — seuil 50px, expand au hover en éventail
- 10 catégories : `residence, school, landmark, hq, danger, shop, hospital, police, villain, other`
- Navigation URL : `?location=NomDuLieu` — fly to + sélection automatique
- Heatmap : `leaflet.heat` basée sur le nombre de posts par lieu
