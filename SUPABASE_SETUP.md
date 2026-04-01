# Guide de configuration — Supabase & GitHub Pages

Ce guide explique pas à pas comment configurer Supabase et déployer Ican sur GitHub Pages.

---

## 1. Créer un projet Supabase

1. Va sur [supabase.com](https://supabase.com) et crée un compte (gratuit)
2. Clique sur **"New Project"**
3. Choisis un nom (ex: `ican`), un mot de passe pour la base de données, et la région la plus proche de toi
4. Attends que le projet soit prêt (~2 minutes)

### Récupérer les clés

5. Une fois le projet créé, tu arrives sur le **tableau de bord** du projet
6. Dans le menu de gauche, clique sur l'icône **engrenage** (tout en bas) pour aller dans **Project Settings**
7. Dans le sous-menu qui apparaît à gauche, clique sur **API** (sous la section "Configuration")
8. Tu vas voir deux blocs d'informations sur cette page :

   **Bloc "Project URL"** (en haut) :
   - Tu verras une URL du type `https://abcdefghij.supabase.co`
   - Copie cette URL entière → c'est ta `VITE_SUPABASE_URL`

   **Bloc "Project API keys"** (juste en dessous) :
   - Il y a deux clés listées : `anon public` et `service_role secret`
   - Clique sur le bouton **copier** (icône à droite) à côté de la clé **`anon public`** → c'est ta `VITE_SUPABASE_ANON_KEY`

   - **Ne copie PAS** la clé `service_role secret` — celle-ci ne doit jamais être exposée dans le frontend

---

## 2. Créer les tables

Va dans **SQL Editor** (menu de gauche) et exécute le SQL suivant en une seule fois :

```sql
-- =============================================
-- TABLE: profiles
-- Un compte (auth.users) peut avoir plusieurs profils (alias)
-- =============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profiles_owner_id ON profiles(owner_id);

-- =============================================
-- TABLE: posts
-- =============================================
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '' CHECK (char_length(content) <= 500),
  image_url TEXT,
  repost_of UUID REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- TABLE: likes
-- =============================================
CREATE TABLE likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- =============================================
-- TABLE: comments (avec r&eacute;ponses imbriqu&eacute;es)
-- =============================================
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 300),
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- GHOST ENGAGEMENT (admin roleplay feature)
-- =============================================
CREATE TABLE ghost_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ghost_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  ghost_profile_id UUID NOT NULL REFERENCES ghost_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ghost_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  ghost_profile_id UUID NOT NULL REFERENCES ghost_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  mood TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE posts ADD COLUMN ghost_repost_count INT DEFAULT 0;
ALTER TABLE posts ADD COLUMN quote_of UUID REFERENCES posts(id) ON DELETE SET NULL;
ALTER TABLE posts ADD COLUMN quote_comment_id UUID REFERENCES comments(id) ON DELETE SET NULL;

-- ⚠️ IMPORTANT : après chaque ALTER TABLE, il faut recréer la vue posts_with_stats
-- car PostgreSQL résout p.* à la création de la vue (les nouvelles colonnes ne sont pas incluses automatiquement).
-- Relancer ce bloc à chaque fois qu'une colonne est ajoutée à posts.
DROP VIEW IF EXISTS posts_with_stats;
CREATE VIEW posts_with_stats AS
SELECT
  p.*,
  pr.username,
  pr.display_name,
  pr.avatar_url,
  (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id)
    + (SELECT COUNT(*) FROM ghost_likes gl WHERE gl.post_id = p.id) AS like_count,
  (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id)
    + (SELECT COUNT(*) FROM ghost_comments gc WHERE gc.post_id = p.id) AS comment_count,
  (SELECT COUNT(*) FROM posts r WHERE r.repost_of = p.id)
    + COALESCE(p.ghost_repost_count, 0) AS repost_count
FROM posts p
JOIN profiles pr ON p.author_id = pr.id;

-- RLS pour ghost_profiles
CREATE POLICY "Authenticated can view ghost profiles" ON ghost_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert ghost profiles" ON ghost_profiles FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE owner_id = auth.uid() AND is_admin = true));
CREATE POLICY "Admins can delete ghost profiles" ON ghost_profiles FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE owner_id = auth.uid() AND is_admin = true));

-- RLS pour ghost_likes
CREATE POLICY "Authenticated can view ghost likes" ON ghost_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert ghost likes" ON ghost_likes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE owner_id = auth.uid() AND is_admin = true));
CREATE POLICY "Admins can delete ghost likes" ON ghost_likes FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE owner_id = auth.uid() AND is_admin = true));

-- RLS pour ghost_comments
CREATE POLICY "Authenticated can view ghost comments" ON ghost_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert ghost comments" ON ghost_comments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE owner_id = auth.uid() AND is_admin = true));
CREATE POLICY "Admins can delete ghost comments" ON ghost_comments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE owner_id = auth.uid() AND is_admin = true));

ALTER TABLE ghost_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghost_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghost_comments ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TABLE: comment_likes
-- =============================================
CREATE TABLE comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, comment_id)
);

-- =============================================
-- TABLE: conversations (1-on-1 et groupes)
-- =============================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  user2_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  is_group BOOLEAN DEFAULT false,
  group_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user1_id, user2_id),
  CHECK (
    (is_group = true AND user1_id IS NULL AND user2_id IS NULL)
    OR (is_group = false AND user1_id IS NOT NULL AND user2_id IS NOT NULL AND user1_id < user2_id)
  )
);

-- =============================================
-- TABLE: conversation_members (membres des groupes)
-- =============================================
CREATE TABLE conversation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(conversation_id, profile_id)
);

-- =============================================
-- TABLE: notifications
-- =============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'reply', 'repost')),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- TABLE: messages
-- =============================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 1000),
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- INDEX
-- =============================================
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_author_id ON posts(author_id);
CREATE INDEX idx_likes_post_id ON likes(post_id);
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_parent_id ON comments(parent_id);
CREATE INDEX idx_comment_likes_comment_id ON comment_likes(comment_id);
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, read, created_at DESC);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_read ON messages(read) WHERE read = false;
CREATE INDEX idx_conversation_members_conv ON conversation_members(conversation_id);
CREATE INDEX idx_conversation_members_profile ON conversation_members(profile_id);

-- =============================================
-- VUE: posts_with_stats
-- =============================================
CREATE VIEW posts_with_stats AS
SELECT
  p.*,
  pr.username,
  pr.display_name,
  pr.avatar_url,
  (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
  (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
  (SELECT COUNT(*) FROM posts r WHERE r.repost_of = p.id) AS repost_count
FROM posts p
JOIN profiles pr ON p.author_id = pr.id;
```

---

## 3. Configurer le trigger auto-profil

Toujours dans le **SQL Editor**, exécute ce SQL :

```sql
-- Crée automatiquement un premier profil quand un utilisateur s'inscrit
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (owner_id, username, display_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## 4. Activer la sécurité (Row Level Security)

Exécute ce SQL dans le **SQL Editor** :

```sql
-- =============================================
-- Helper: fonction pour récupérer les IDs des profils de l'utilisateur
-- =============================================
CREATE OR REPLACE FUNCTION my_profile_ids()
RETURNS SETOF UUID AS $$
  SELECT id FROM profiles WHERE owner_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================
-- RLS: profiles
-- =============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated users"
  ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own profiles"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own profiles"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own profiles"
  ON profiles FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

-- =============================================
-- RLS: posts
-- =============================================
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Posts viewable by authenticated users"
  ON posts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create posts with their profiles"
  ON posts FOR INSERT TO authenticated
  WITH CHECK (author_id IN (SELECT my_profile_ids()));

CREATE POLICY "Authors and admins can delete posts"
  ON posts FOR DELETE TO authenticated
  USING (
    author_id IN (SELECT my_profile_ids())
    OR EXISTS (SELECT 1 FROM profiles WHERE owner_id = auth.uid() AND is_admin = true)
  );

-- =============================================
-- RLS: likes
-- =============================================
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Likes viewable by authenticated users"
  ON likes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can like with their profiles"
  ON likes FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT my_profile_ids()));

CREATE POLICY "Users can remove own likes"
  ON likes FOR DELETE TO authenticated
  USING (user_id IN (SELECT my_profile_ids()));

-- =============================================
-- RLS: comments
-- =============================================
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments viewable by authenticated users"
  ON comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can comment with their profiles"
  ON comments FOR INSERT TO authenticated
  WITH CHECK (author_id IN (SELECT my_profile_ids()));

CREATE POLICY "Authors and admins can delete comments"
  ON comments FOR DELETE TO authenticated
  USING (
    author_id IN (SELECT my_profile_ids())
    OR EXISTS (SELECT 1 FROM profiles WHERE owner_id = auth.uid() AND is_admin = true)
  );

-- =============================================
-- RLS: comment_likes
-- =============================================
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comment likes viewable by authenticated users"
  ON comment_likes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can like comments with their profiles"
  ON comment_likes FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT my_profile_ids()));

CREATE POLICY "Users can remove own comment likes"
  ON comment_likes FOR DELETE TO authenticated
  USING (user_id IN (SELECT my_profile_ids()));

-- =============================================
-- RLS: conversations (1-on-1 + groupes)
-- =============================================
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their conversations"
  ON conversations FOR SELECT TO authenticated
  USING (
    user1_id IN (SELECT my_profile_ids())
    OR user2_id IN (SELECT my_profile_ids())
    OR (is_group = true AND id IN (SELECT my_conversation_ids()))
  );

CREATE POLICY "Users can create conversations with their profiles"
  ON conversations FOR INSERT TO authenticated
  WITH CHECK (
    user1_id IN (SELECT my_profile_ids())
    OR user2_id IN (SELECT my_profile_ids())
    OR is_group = true
  );

CREATE POLICY "Participants can update conversation timestamp"
  ON conversations FOR UPDATE TO authenticated
  USING (
    user1_id IN (SELECT my_profile_ids())
    OR user2_id IN (SELECT my_profile_ids())
    OR (is_group = true AND id IN (SELECT my_conversation_ids()))
  );

-- =============================================
-- Helper: IDs des conversations de groupe de l'utilisateur
-- =============================================
CREATE OR REPLACE FUNCTION my_conversation_ids()
RETURNS SETOF UUID AS $$
  SELECT conversation_id FROM conversation_members WHERE profile_id IN (SELECT my_profile_ids());
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================
-- RLS: conversation_members
-- =============================================
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view group memberships"
  ON conversation_members FOR SELECT TO authenticated
  USING (conversation_id IN (SELECT my_conversation_ids()));

CREATE POLICY "Users can add members to their groups"
  ON conversation_members FOR INSERT TO authenticated
  WITH CHECK (
    profile_id IN (SELECT my_profile_ids())
    OR conversation_id IN (SELECT my_conversation_ids())
  );

-- =============================================
-- RLS: messages
-- =============================================
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view conversation messages"
  ON messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
      AND (
        c.user1_id IN (SELECT my_profile_ids())
        OR c.user2_id IN (SELECT my_profile_ids())
        OR (c.is_group = true AND c.id IN (SELECT my_conversation_ids()))
      )
    )
  );

CREATE POLICY "Participants can send messages"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id IN (SELECT my_profile_ids())
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
      AND (
        c.user1_id IN (SELECT my_profile_ids())
        OR c.user2_id IN (SELECT my_profile_ids())
        OR (c.is_group = true AND c.id IN (SELECT my_conversation_ids()))
      )
    )
  );

CREATE POLICY "Recipients can mark messages as read"
  ON messages FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
      AND (
        c.user1_id IN (SELECT my_profile_ids())
        OR c.user2_id IN (SELECT my_profile_ids())
        OR (c.is_group = true AND c.id IN (SELECT my_conversation_ids()))
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
      AND (
        c.user1_id IN (SELECT my_profile_ids())
        OR c.user2_id IN (SELECT my_profile_ids())
        OR (c.is_group = true AND c.id IN (SELECT my_conversation_ids()))
      )
    )
  );

CREATE POLICY "Senders and admins can delete messages"
  ON messages FOR DELETE TO authenticated
  USING (
    sender_id IN (SELECT my_profile_ids())
    OR EXISTS (SELECT 1 FROM profiles WHERE owner_id = auth.uid() AND is_admin = true)
  );
```

---

## 5. Créer le bucket de stockage pour les avatars

Les photos de profil sont stockées dans Supabase Storage.

1. Va dans **Storage** (icône de dossier dans le menu de gauche)
2. Clique sur **"New bucket"**
3. Nom du bucket : `avatars`
4. Coche **"Public bucket"** (les avatars doivent être accessibles publiquement)
5. Clique **"Create bucket"**

### Ajouter les policies de storage

6. Clique sur le bucket `avatars` que tu viens de créer
7. Va dans l'onglet **"Policies"** (en haut)
8. Clique **"New policy"** puis **"For full customization"** et crée ces 3 policies :

**Policy 1 — Lecture publique :**
- Name : `Public read`
- Allowed operation : `SELECT`
- Target roles : laisser vide (public)
- Policy definition : `true`

**Policy 2 — Upload par l'utilisateur :**
- Name : `Users can upload their avatar`
- Allowed operation : `INSERT`
- Target roles : `authenticated`
- Policy definition : `(bucket_id = 'avatars') AND ((storage.foldername(name))[1] IN (SELECT p.id::text FROM profiles p WHERE p.owner_id = auth.uid()))`

**Policy 3 — Mise à jour par l'utilisateur :**
- Name : `Users can update their avatar`
- Allowed operation : `UPDATE`
- Target roles : `authenticated`
- Policy definition : `(bucket_id = 'avatars') AND ((storage.foldername(name))[1] IN (SELECT p.id::text FROM profiles p WHERE p.owner_id = auth.uid()))`

Ces policies font en sorte que chaque utilisateur ne peut uploader/modifier que dans les dossiers correspondant à ses profils.

### Bucket pour les images de posts

9. Clique sur **"New bucket"** (retour à la liste des buckets)
10. Nom du bucket : `post-images`
11. Coche **"Public bucket"**
12. Clique **"Create bucket"**
13. Clique sur le bucket `post-images`, va dans **"Policies"** et crée ces 3 policies :

**Policy 1 — Lecture publique :**
- Name : `Public read`
- Allowed operation : `SELECT`
- Target roles : laisser vide (public)
- Policy definition : `true`

**Policy 2 — Upload par l'utilisateur :**
- Name : `Users can upload post images`
- Allowed operation : `INSERT`
- Target roles : `authenticated`
- Policy definition : `(bucket_id = 'post-images') AND ((storage.foldername(name))[1] IN (SELECT p.id::text FROM profiles p WHERE p.owner_id = auth.uid()))`

**Policy 3 — Suppression par l'utilisateur :**
- Name : `Users can delete their post images`
- Allowed operation : `DELETE`
- Target roles : `authenticated`
- Policy definition : `(bucket_id = 'post-images') AND ((storage.foldername(name))[1] IN (SELECT p.id::text FROM profiles p WHERE p.owner_id = auth.uid()))`

Les images sont stockées dans un dossier nommé avec l'ID du profil, comme pour les avatars.

### Bucket pour les images de commentaires

14. Clique sur **"New bucket"** (retour à la liste des buckets)
15. Nom du bucket : `comment-images`
16. Coche **"Public bucket"**
17. Clique **"Create bucket"**
18. Clique sur le bucket `comment-images`, va dans **"Policies"** et crée ces 3 policies :

**Policy 1 — Lecture publique :**
- Name : `Public read`
- Allowed operation : `SELECT`
- Target roles : laisser vide (public)
- Policy definition : `true`

**Policy 2 — Upload par l'utilisateur :**
- Name : `Users can upload comment images`
- Allowed operation : `INSERT`
- Target roles : `authenticated`
- Policy definition : `(bucket_id = 'comment-images') AND ((storage.foldername(name))[1] IN (SELECT p.id::text FROM profiles p WHERE p.owner_id = auth.uid()))`

**Policy 3 — Suppression par l'utilisateur :**
- Name : `Users can delete their comment images`
- Allowed operation : `DELETE`
- Target roles : `authenticated`
- Policy definition : `(bucket_id = 'comment-images') AND ((storage.foldername(name))[1] IN (SELECT p.id::text FROM profiles p WHERE p.owner_id = auth.uid()))`

Les images sont stockées dans un dossier nommé avec l'ID du profil, comme pour les autres buckets.

### Bucket pour les images de DMs (`dm-images`)

Même configuration que `comment-images` : bucket public, policies identiques (remplace `comment-images` par `dm-images`).

```sql
-- TABLE: conversation_hidden
CREATE TABLE conversation_hidden (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (profile_id, conversation_id)
);

ALTER TABLE conversation_hidden ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their hidden conversations"
  ON conversation_hidden FOR SELECT TO authenticated
  USING (profile_id IN (SELECT my_profile_ids()));

CREATE POLICY "Users can hide conversations"
  ON conversation_hidden FOR INSERT TO authenticated
  WITH CHECK (profile_id IN (SELECT my_profile_ids()));

CREATE POLICY "Users can unhide conversations"
  ON conversation_hidden FOR DELETE TO authenticated
  USING (profile_id IN (SELECT my_profile_ids()));
```

---

## 6. Configurer l'authentification

1. Va dans **Authentication > Providers** (menu de gauche)
2. Vérifie que **Email** est activé
3. Va dans **Authentication > Settings**
4. **Désactive** "Enable email confirmations" (pour simplifier — tes amis n'auront pas à confirmer par email)
5. Dans **Site URL**, mets : `https://TON-USERNAME.github.io/ICAN/`
6. Dans **Redirect URLs**, ajoute : `https://TON-USERNAME.github.io/ICAN/`

---

## 7. Créer ton compte admin

1. Lance l'application localement (`npm run dev`) ou attends le déploiement
2. Inscris-toi avec ton compte
3. Va dans **Supabase Dashboard > Table Editor > profiles**
4. Trouve ta ligne et change `is_admin` de `false` à `true`
5. Sauvegarde
Tu pourras maintenant supprimer les posts et commentaires de tout le monde.

---

## 8. Configurer le fichier .env local

Crée un fichier `.env` à la racine du projet :

```
VITE_SUPABASE_URL=https://ton-projet.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Pour tester localement :
```bash
npm run dev
```

---

## 9. Déployer sur GitHub Pages

### Créer le repo GitHub

1. Va sur [github.com/new](https://github.com/new)
2. Crée un repo nommé `ICAN` (public ou privé)
3. Ne coche aucune option (pas de README, pas de .gitignore)

### Initialiser git et pousser

```bash
cd C:\Users\killi\Desktop\ICAN
git init
git add .
git commit -m "Initial commit - Ican app"
git branch -M main
git remote add origin https://github.com/TON-USERNAME/ICAN.git
git push -u origin main
```

### Configurer les secrets GitHub

1. Va dans **Settings > Secrets and variables > Actions** sur ton repo GitHub
2. Clique **"New repository secret"** et ajoute :
   - Nom : `VITE_SUPABASE_URL` — Valeur : ton URL Supabase
   - Nom : `VITE_SUPABASE_ANON_KEY` — Valeur : ta clé anon Supabase

### Activer GitHub Pages

1. Va dans **Settings > Pages** sur ton repo
2. Dans **Source**, sélectionne **"GitHub Actions"**
3. Le workflow `.github/workflows/deploy.yml` se déclenchera automatiquement à chaque push sur `main`

### Vérifier le déploiement

1. Va dans l'onglet **Actions** de ton repo pour voir le build
2. Une fois terminé, ton site sera disponible à : `https://TON-USERNAME.github.io/ICAN/`

---

## 10. Migration multi-profils (bases existantes uniquement)

**Si tu avais déjà Ican en production avant la mise à jour multi-profils**, exécute ce script dans le **SQL Editor** pour migrer ta base. Si c'est une installation fraîche, ignore cette section.

```sql
-- =============================================
-- MIGRATION: profiles.id → profiles.id (UUID propre) + owner_id
-- =============================================

-- 1. Supprimer la vue qui dépend de profiles
DROP VIEW IF EXISTS posts_with_stats;

-- 2. Supprimer toutes les policies RLS existantes
DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Posts viewable by authenticated users" ON posts;
DROP POLICY IF EXISTS "Authenticated users can create posts" ON posts;
DROP POLICY IF EXISTS "Authors and admins can delete posts" ON posts;
DROP POLICY IF EXISTS "Likes viewable by authenticated users" ON likes;
DROP POLICY IF EXISTS "Authenticated users can like" ON likes;
DROP POLICY IF EXISTS "Users can remove own likes" ON likes;
DROP POLICY IF EXISTS "Comments viewable by authenticated users" ON comments;
DROP POLICY IF EXISTS "Authenticated users can comment" ON comments;
DROP POLICY IF EXISTS "Authors and admins can delete comments" ON comments;
DROP POLICY IF EXISTS "Participants can view their conversations" ON conversations;
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Participants can update conversation timestamp" ON conversations;
DROP POLICY IF EXISTS "Participants can view conversation messages" ON messages;
DROP POLICY IF EXISTS "Participants can send messages" ON messages;
DROP POLICY IF EXISTS "Recipients can mark messages as read" ON messages;

-- 3. Supprimer l'ancien trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 4. Ajouter la colonne owner_id
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS owner_id UUID;

-- 5. Remplir owner_id avec l'ancien id (qui était = auth.users.id)
UPDATE profiles SET owner_id = id WHERE owner_id IS NULL;

-- 6. Rendre owner_id NOT NULL + FK
ALTER TABLE profiles ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_owner_id_fkey;
ALTER TABLE profiles ADD CONSTRAINT profiles_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 7. Supprimer TOUTES les FK et CHECK constraints qui référencent profiles.id
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_author_id_fkey;
ALTER TABLE likes DROP CONSTRAINT IF EXISTS likes_user_id_fkey;
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_author_id_fkey;
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_user1_id_fkey;
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_user2_id_fkey;
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_check;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;

-- 8. Supprimer l'ancienne FK profiles.id → auth.users et la PK
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE profiles DROP CONSTRAINT profiles_pkey;

-- 9. Donner un nouvel UUID à chaque profil et mettre à jour les références
CREATE TEMP TABLE profile_id_map AS
SELECT id AS old_id, gen_random_uuid() AS new_id FROM profiles;

-- Mettre à jour les IDs
UPDATE profiles SET id = m.new_id FROM profile_id_map m WHERE profiles.id = m.old_id;
UPDATE posts SET author_id = m.new_id FROM profile_id_map m WHERE posts.author_id = m.old_id;
UPDATE likes SET user_id = m.new_id FROM profile_id_map m WHERE likes.user_id = m.old_id;
UPDATE comments SET author_id = m.new_id FROM profile_id_map m WHERE comments.author_id = m.old_id;
UPDATE conversations SET user1_id = m.new_id FROM profile_id_map m WHERE conversations.user1_id = m.old_id;
UPDATE conversations SET user2_id = m.new_id FROM profile_id_map m WHERE conversations.user2_id = m.old_id;
UPDATE messages SET sender_id = m.new_id FROM profile_id_map m WHERE messages.sender_id = m.old_id;

-- Réordonner user1_id/user2_id pour respecter la contrainte user1_id < user2_id
UPDATE conversations
SET user1_id = LEAST(user1_id, user2_id),
    user2_id = GREATEST(user1_id, user2_id)
WHERE user1_id > user2_id;

-- Recréer la PK (avec le DEFAULT), les FK et la contrainte CHECK
ALTER TABLE profiles ADD PRIMARY KEY (id);
ALTER TABLE profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE posts ADD CONSTRAINT posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE likes ADD CONSTRAINT likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE comments ADD CONSTRAINT comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE conversations ADD CONSTRAINT conversations_user1_id_fkey FOREIGN KEY (user1_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE conversations ADD CONSTRAINT conversations_user2_id_fkey FOREIGN KEY (user2_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE messages ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE conversations ADD CONSTRAINT conversations_check CHECK (user1_id < user2_id);

-- 10. Ajouter l'index
CREATE INDEX IF NOT EXISTS idx_profiles_owner_id ON profiles(owner_id);

-- 11. Recréer la vue
CREATE VIEW posts_with_stats AS
SELECT
  p.*,
  pr.username,
  pr.display_name,
  pr.avatar_url,
  (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
  (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
  (SELECT COUNT(*) FROM posts r WHERE r.repost_of = p.id) AS repost_count
FROM posts p
JOIN profiles pr ON p.author_id = pr.id;

-- 12. Recréer le trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (owner_id, username, display_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 13. Recréer la fonction helper et toutes les policies RLS
-- (Copie-colle le SQL de la section 4 du setup)
```

**Après la migration**, copie-colle et exécute le SQL de la **section 4** (RLS) pour recréer toutes les policies.

---

## 11. Désactiver les inscriptions (optionnel)

Une fois que tous tes amis se sont inscrits :

1. Va dans **Supabase Dashboard > Authentication > Settings**
2. Désactive **"Enable sign ups"**
3. Plus personne ne pourra créer de compte, mais les comptes existants fonctionneront toujours

---

## Résumé des étapes

| # | Action | Où |
|---|--------|----|
| 1 | Créer le projet Supabase | supabase.com |
| 2 | Exécuter le SQL (tables) | Supabase SQL Editor |
| 3 | Exécuter le SQL (trigger) | Supabase SQL Editor |
| 4 | Exécuter le SQL (RLS) | Supabase SQL Editor |
| 5 | Créer le bucket avatars + policies | Supabase Storage |
| 6 | Configurer l'auth | Supabase Auth Settings |
| 7 | Créer ton compte et le passer admin | App + Supabase Table Editor |
| 8 | Créer le fichier .env | Local |
| 9 | Créer le repo GitHub + push | GitHub |
| 10 | Ajouter les secrets | GitHub Settings |
| 11 | Activer GitHub Pages | GitHub Settings > Pages |
