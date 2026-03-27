# Ican - Documentation du code

## Architecture générale

Ican est un Twitter-like simplifié construit avec :
- **Vue 3** + **Vite** pour le frontend
- **Supabase** pour le backend (auth, base de données PostgreSQL, API REST auto-générée)
- **GitHub Pages** pour l'hébergement

L'application est une SPA (Single Page Application). Il n'y a pas de serveur backend custom : le frontend communique directement avec Supabase via son SDK JavaScript.

```
src/
  lib/            → Utilitaires (client Supabase, helpers)
  stores/         → Pinia stores (état global)
  components/     → Composants réutilisables
  views/          → Pages (liées au routeur)
  router/         → Configuration des routes
  assets/         → CSS global
```

---

## Fichiers utilitaires (`src/lib/`)

### `supabase.js`
Initialise et exporte le client Supabase. Lit les variables d'environnement `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` depuis le fichier `.env`.

### `time.js`
Fonction `timeAgo(dateString)` qui convertit une date ISO en texte relatif français ("il y a 5min", "il y a 2h", "il y a 3j"). Utilisée dans les posts, commentaires et messages.

---

## Stores Pinia (`src/stores/`)

### `auth.js` — Authentification
Gère l'état de connexion de l'utilisateur.

**État :**
- `user` — L'objet utilisateur Supabase Auth (ou null)
- `profile` — Le profil depuis la table `profiles` (username, display_name, is_admin)
- `loading` — `true` pendant le chargement initial de la session

**Computed :**
- `isAdmin` — `true` si le profil a `is_admin === true`
- `isAuthenticated` — `true` si l'utilisateur est connecté

**Actions :**
- `signUp(email, password, username, displayName)` — Inscription. Le username et display_name sont passés via `options.data` pour que le trigger SQL puisse créer le profil automatiquement.
- `signIn(email, password)` — Connexion
- `signOut()` — Déconnexion
- `fetchProfile()` — Récupère le profil depuis la table `profiles`
- `init()` — Écoute les changements d'état auth via `onAuthStateChange`. Appelé une seule fois au démarrage dans `main.js`.

### `posts.js` — Posts, likes, reposts, commentaires
Gère tout ce qui touche aux posts.

**État :**
- `posts` — Liste des posts affichés (feed ou profil)
- `loading` — Indicateur de chargement
- `userLikes` — `Set` des IDs de posts likés par l'utilisateur courant

**Actions :**
- `fetchFeed()` — Récupère les 50 derniers posts via la vue SQL `posts_with_stats`
- `fetchUserPosts(userId)` — Récupère les posts d'un utilisateur spécifique
- `createPost(content)` — Crée un nouveau post
- `deletePost(postId)` — Supprime un post (RLS vérifie que c'est l'auteur ou un admin)
- `toggleLike(postId)` — Ajoute ou retire un like. Met à jour le compteur localement pour un feedback instantané.
- `repost(postId)` — Crée un repost (un post avec `repost_of` pointant vers le post original)
- `fetchComments(postId)` — Récupère les commentaires d'un post avec le profil de l'auteur
- `addComment(postId, content)` — Ajoute un commentaire
- `deleteComment(commentId)` — Supprime un commentaire
- `hasLiked(postId)` — Vérifie si l'utilisateur courant a liké un post

**Optimisation :** Les likes de l'utilisateur sont récupérés en une seule requête pour tous les posts visibles (batch fetch), au lieu d'une requête par post.

### `messages.js` — Messages directs (DMs)
Gère les conversations et messages privés.

**État :**
- `conversations` — Liste des conversations avec le profil de l'autre utilisateur
- `currentMessages` — Messages de la conversation ouverte
- `loading` — Indicateur de chargement

**Actions :**
- `fetchConversations()` — Récupère toutes les conversations de l'utilisateur, avec les profils des deux participants
- `fetchMessages(conversationId)` — Récupère les messages d'une conversation
- `sendMessage(conversationId, content)` — Envoie un message et met à jour `updated_at` de la conversation
- `getOrCreateConversation(otherUserId)` — Trouve ou crée une conversation entre l'utilisateur courant et un autre. Les IDs sont ordonnés (user1_id < user2_id) pour éviter les doublons.
- `markAsRead(conversationId)` — Marque tous les messages non-lus de l'autre utilisateur comme lus

---

## Composants (`src/components/`)

### `AppHeader.vue`
Barre de navigation sticky en haut. Affiche :
- Le logo "Ican" (lien vers le feed)
- Liens : Feed, Messages (avec badge de messages non-lus), Profil
- Bouton de déconnexion

Le compteur de messages non-lus est actualisé par polling toutes les 15 secondes.

### `PostCard.vue`
Composant principal pour afficher un post. Gère :
- L'affichage de l'avatar (initiale du nom), nom, @username, timestamp relatif
- Le contenu du post (ou du post original en cas de repost)
- Les boutons d'action : commenter, reposter, liker, supprimer
- Le badge "X a reposté" pour les reposts
- Le bouton supprimer est visible uniquement pour l'auteur et les admins

Un clic sur le post navigue vers la page de détail (`PostDetailView`).

### `PostComposer.vue`
Formulaire de création de post. Textarea avec compteur de caractères (max 500). Soumission via bouton ou Ctrl+Enter.

### `CommentList.vue`
Liste des commentaires sous un post. Chaque commentaire affiche le profil de l'auteur, le texte, le timestamp, et un bouton supprimer (pour l'auteur ou l'admin).

### `CommentForm.vue`
Input en ligne pour ajouter un commentaire. Émet l'événement `submit` vers le parent.

### `ConversationList.vue`
Liste des conversations DM. Chaque élément affiche l'avatar et le nom de l'autre participant. Clic = navigation vers la conversation.

### `MessageBubble.vue`
Bulle de message individuel. Alignée à gauche (message reçu) ou à droite avec fond bleu (message envoyé). Affiche le timestamp relatif.

### `MessageInput.vue`
Input d'envoi de message en bas de la conversation.

---

## Vues (`src/views/`)

### `LoginView.vue`
Page de connexion/inscription. Deux onglets : "Connexion" et "Inscription".
- Connexion : email + mot de passe
- Inscription : username + display_name (optionnel) + email + mot de passe
- Affiche les erreurs de Supabase Auth

### `FeedView.vue`
Page d'accueil. Affiche le `PostComposer` en haut, puis la liste des posts (`PostCard`). Bouton "Rafraîchir" en bas.

### `PostDetailView.vue`
Page de détail d'un post. Affiche le post complet, le formulaire de commentaire, et la liste des commentaires.

### `ProfileView.vue`
Page de profil utilisateur. Affiche :
- Avatar, nom, @username, badge admin si applicable
- Bouton "Envoyer un message" (sauf sur son propre profil)
- Liste des posts de l'utilisateur

### `MessagesView.vue`
Liste de toutes les conversations DM de l'utilisateur.

### `ConversationView.vue`
Fil de discussion avec un utilisateur. Les messages sont actualisés par polling toutes les 10 secondes. Scroll automatique vers le bas à chaque chargement.

---

## Routeur (`src/router/index.js`)

Utilise le **hash mode** (`createWebHashHistory`) pour compatibilité GitHub Pages.

**Routes :**
| Route | Vue | Description |
|-------|-----|-------------|
| `/#/` | FeedView | Feed principal |
| `/#/login` | LoginView | Connexion/inscription |
| `/#/post/:id` | PostDetailView | Détail d'un post |
| `/#/user/:username` | ProfileView | Profil utilisateur |
| `/#/messages` | MessagesView | Liste des conversations |
| `/#/messages/:id` | ConversationView | Conversation DM |

**Guard d'authentification :** Toutes les routes sauf `/login` nécessitent d'être connecté. Si l'utilisateur n'est pas connecté, il est redirigé vers `/login`.

---

## Point d'entrée (`src/main.js`)

1. Crée l'app Vue
2. Installe Pinia (state management)
3. Installe Vue Router
4. Initialise le store auth (écoute les changements de session Supabase)
5. Monte l'app

---

## CSS (`src/assets/main.css`)

Thème sombre inspiré de Twitter. Variables CSS :
- `--bg-primary` / `--bg-secondary` — Fonds
- `--text-primary` / `--text-secondary` — Textes
- `--accent` — Bleu Ican (#1da1f2)
- `--border` — Bordures
- `--danger` — Rouge (likes, suppression)
- `--success` / `--repost` — Vert (reposts)

Pas de framework CSS. Chaque composant a ses styles en `<style scoped>`.

---

## Flux de données

### Authentification
```
Utilisateur → LoginView → auth.signIn() → Supabase Auth
                                          ↓
                        onAuthStateChange → fetchProfile() → profile en mémoire
```

### Création d'un post
```
PostComposer → postsStore.createPost() → Supabase INSERT posts
                                         ↓
                            fetchFeed() → Supabase SELECT posts_with_stats
                                         ↓
                            posts[] mis à jour → PostCard re-rendu
```

### Like
```
PostCard → postsStore.toggleLike() → Supabase INSERT/DELETE likes
                                     ↓
                      userLikes Set mis à jour + compteur local modifié
                                     ↓
                      PostCard re-rendu instantanément (pas de re-fetch)
```

### DM
```
ProfileView → messagesStore.getOrCreateConversation() → Supabase SELECT/INSERT conversations
                                                        ↓
                                       navigation vers /messages/:id
                                                        ↓
ConversationView → fetchMessages() → affichage + markAsRead()
                   polling 10s → re-fetch messages
```
