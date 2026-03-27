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
   - Copie cette URL entière → c'est ta `VITE_SUPABASE_URL` https://enlvlqidrbmsxbdtgwgw.supabase.co

   **Bloc "Project API keys"** (juste en dessous) :
   - Il y a deux clés listées : `anon public` et `service_role secret`
   - Clique sur le bouton **copier** (icône à droite) à côté de la clé **`anon public`** → c'est ta `VITE_SUPABASE_ANON_KEY` 

eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVubHZscWlkcmJtc3hiZHRnd2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjU4MzQsImV4cCI6MjA5MDIwMTgzNH0.rgpsd7YRsY6jwNaAQEDH2NuLGlDCLcPWQ40RCEs_I0Y

   - **Ne copie PAS** la clé `service_role secret` — celle-ci ne doit jamais être exposée dans le frontend

---

## 2. Créer les tables

Va dans **SQL Editor** (menu de gauche) et exécute le SQL suivant en une seule fois :

```sql
-- =============================================
-- TABLE: profiles
-- =============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- TABLE: posts
-- =============================================
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '' CHECK (char_length(content) <= 500),
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
-- TABLE: comments
-- =============================================
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 300),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- TABLE: conversations
-- =============================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user1_id, user2_id),
  CHECK (user1_id < user2_id)
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
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_read ON messages(read) WHERE read = false;

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
-- Crée automatiquement un profil quand un utilisateur s'inscrit
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
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
-- RLS: profiles
-- =============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated users"
  ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- =============================================
-- RLS: posts
-- =============================================
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Posts viewable by authenticated users"
  ON posts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create posts"
  ON posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors and admins can delete posts"
  ON posts FOR DELETE TO authenticated
  USING (
    auth.uid() = author_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- =============================================
-- RLS: likes
-- =============================================
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Likes viewable by authenticated users"
  ON likes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can like"
  ON likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own likes"
  ON likes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- =============================================
-- RLS: comments
-- =============================================
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments viewable by authenticated users"
  ON comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can comment"
  ON comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors and admins can delete comments"
  ON comments FOR DELETE TO authenticated
  USING (
    auth.uid() = author_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- =============================================
-- RLS: conversations
-- =============================================
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their conversations"
  ON conversations FOR SELECT TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Authenticated users can create conversations"
  ON conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

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
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  );

CREATE POLICY "Participants can send messages"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  );

CREATE POLICY "Recipients can mark messages as read"
  ON messages FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  );

-- =============================================
-- RLS: conversations (UPDATE pour updated_at)
-- =============================================
CREATE POLICY "Participants can update conversation timestamp"
  ON conversations FOR UPDATE TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);
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
- Policy definition : `(bucket_id = 'avatars') AND ((storage.foldername(name))[1] = (auth.uid())::text)`

**Policy 3 — Mise à jour par l'utilisateur :**
- Name : `Users can update their avatar`
- Allowed operation : `UPDATE`
- Target roles : `authenticated`
- Policy definition : `(bucket_id = 'avatars') AND ((storage.foldername(name))[1] = (auth.uid())::text)`

Ces policies font en sorte que chaque utilisateur ne peut uploader/modifier que dans son propre dossier (nommé avec son UUID).

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

## 10. Désactiver les inscriptions (optionnel)

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
