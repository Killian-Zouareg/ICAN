<template>
  <div class="updates-page">
    <div class="up-header">
      <button @click="$router.back()" class="back-btn">&larr; Retour</button>
      <div class="up-tabs">
        <button class="up-tab" :class="{ active: tab === 'highlights' }" @click="tab = 'highlights'">Highlights</button>
        <button class="up-tab" :class="{ active: tab === 'patchnotes' }" @click="tab = 'patchnotes'">Patch Notes</button>
      </div>
    </div>

    <!-- ============ HIGHLIGHTS TIMELINE ============ -->
    <div v-if="tab === 'highlights'" class="hl-container">
      <div class="hl-intro">
        <h2 class="hl-intro-title">L'histoire d'iCAN</h2>
        <p class="hl-intro-sub">Chaque grande fonctionnalit&eacute; qui a faonn&eacute; le r&eacute;seau, du premier post aux groupes DM.</p>
      </div>

      <div class="hl-timeline">
        <div class="hl-line"></div>

        <div
          v-for="(item, i) in highlights"
          :key="i"
          class="hl-item"
          :class="{ right: i % 2 === 1 }"
        >
          <div class="hl-dot" :style="{ background: item.color }"></div>
          <div class="hl-card">
            <div class="hl-card-icon" :style="{ background: item.color + '20', color: item.color }">{{ item.icon }}</div>
            <div class="hl-card-content">
              <span class="hl-card-version">v{{ item.version }}</span>
              <span class="hl-card-date">{{ item.date }}</span>
              <h3 class="hl-card-title">{{ item.title }}</h3>
              <p class="hl-card-desc">{{ item.description }}</p>
              <div class="hl-card-tags">
                <span v-for="(tag, j) in item.tags" :key="j" class="hl-tag" :style="{ background: item.color + '20', color: item.color }">{{ tag }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="hl-item hl-start">
          <div class="hl-dot" style="background: var(--accent)"></div>
          <div class="hl-card hl-card-start">
            <div class="hl-card-icon" style="background: rgba(29, 161, 242, 0.2); color: var(--accent)">&#x1F680;</div>
            <div class="hl-card-content">
              <h3 class="hl-card-title">Le d&eacute;but de l'aventure</h3>
              <p class="hl-card-desc">Premi&egrave;re ligne de code d'iCAN. Un r&eacute;seau social pour les proches, sans algorithme, sans pub.</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ============ PATCH NOTES ============ -->
    <div v-if="tab === 'patchnotes'" class="pn-container">
      <div class="pn-list">
        <div v-for="patch in patches" :key="patch.version" class="pn-entry">
          <div class="pn-entry-header">
            <span class="pn-version">v{{ patch.version }}</span>
            <span class="pn-date">{{ patch.date }}</span>
            <span v-if="patch.tag" class="pn-tag" :class="patch.tag">{{ tagLabels[patch.tag] }}</span>
          </div>
          <h3 class="pn-entry-title">{{ patch.title }}</h3>
          <ul class="pn-changes">
            <li v-for="(change, i) in patch.changes" :key="i" class="pn-change" :class="change.type">
              <span class="pn-change-badge">{{ changeBadges[change.type] }}</span>
              <span>{{ change.text }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const tab = ref('highlights')

// ============ HIGHLIGHTS ============
const highlights = [
  {
    version: '1.6.0',
    date: '28 mars 2026',
    icon: '\u{1F465}',
    color: '#9b59b6',
    title: 'Groupes de discussion',
    description: 'Cr\u00e9ez des conversations de groupe avec vos amis. Nommez le groupe, ajoutez des membres et discutez \u00e0 plusieurs en temps r\u00e9el directement depuis le widget DM.',
    tags: ['Groupe DM', 'Multi-membres', 'Recherche de membres'],
  },
  {
    version: '1.5.0',
    date: '28 mars 2026',
    icon: '\u{1F5BC}',
    color: '#e67e22',
    title: 'Images en DM & Patch Notes',
    description: 'Envoyez des photos dans vos conversations priv\u00e9es. Pr\u00e9visualisation avant envoi, support JPG/PNG/GIF/WebP. Plus une toute nouvelle page de suivi des mises \u00e0 jour.',
    tags: ['Photos DM', 'Pr\u00e9visualisation', 'Patch Notes'],
  },
  {
    version: '1.4.0',
    date: '28 mars 2026',
    icon: '\u{1F6E1}',
    color: '#794bc4',
    title: 'S\u00e9curit\u00e9 & Qualit\u00e9 de vie',
    description: 'Rate limiting anti-spam sur toutes les actions, validation des uploads, liste des likers sur chaque post, et bouton refresh d\u00e9plac\u00e9 en haut du feed.',
    tags: ['Anti-spam', 'Rate limit', 'Liste des likes'],
  },
  {
    version: '1.3.0',
    date: '28 mars 2026',
    icon: '\u{2709}',
    color: '#1da1f2',
    title: 'Widget DM & Images dans les posts',
    description: 'Un widget de messagerie flottant en bas \u00e0 gauche, inspir\u00e9 de X/Twitter. Plus besoin de quitter la page pour discuter. Publiez aussi des images avec vos posts.',
    tags: ['Widget flottant', 'Photos posts', 'Badge non-lus'],
  },
  {
    version: '1.2.0',
    date: '28 mars 2026',
    icon: '\u{1F4AC}',
    color: '#e0245e',
    title: 'Refonte commentaires & reposts',
    description: 'Commentaires enti\u00e8rement repens\u00e9s : likes, r\u00e9ponses imbriqu\u00e9es avec fil visuel, avatars. Les reposts affichent maintenant le contenu original avec toggle.',
    tags: ['R\u00e9ponses imbriqu\u00e9es', 'Likes commentaires', 'Reposts am\u00e9lior\u00e9s'],
  },
  {
    version: '1.1.0',
    date: '27 mars 2026',
    icon: '\u{1F464}',
    color: '#17bf63',
    title: 'Multi-profils & Param\u00e8tres',
    description: 'Un seul compte, plusieurs identit\u00e9s. Cr\u00e9ez des alias, changez de profil en un clic, personnalisez avatar et pseudo pour chacun.',
    tags: ['Multi-profils', 'Switcher', 'Avatars', 'Param\u00e8tres'],
  },
  {
    version: '1.0.0',
    date: '27 mars 2026',
    icon: '\u{2B50}',
    color: '#ffad1f',
    title: 'Lancement d\'iCAN',
    description: 'Le r\u00e9seau social pour 10\u201350 amis. Feed de posts, likes, reposts, commentaires, messages directs, authentification, th\u00e8me sombre et d\u00e9ploiement GitHub Pages.',
    tags: ['Feed', 'Likes', 'DM', 'Auth', 'D\u00e9ploiement'],
  },
]

// ============ PATCH NOTES ============
const tagLabels = {
  major: 'MAJEUR',
  minor: 'MINEUR',
  hotfix: 'HOTFIX',
}

const changeBadges = {
  new: 'NOUVEAU',
  improved: 'AM\u00c9LIOR\u00c9',
  fixed: 'CORRIG\u00c9',
  changed: 'MODIFI\u00c9',
  removed: 'RETIR\u00c9',
  security: 'S\u00c9CURIT\u00c9',
}

const patches = [
  {
    version: '1.7.0',
    date: '28 mars 2026',
    title: 'Page Highlights & Timeline',
    tag: 'minor',
    changes: [
      { type: 'new', text: 'Nouvel onglet "Highlights" avec timeline visuelle des grandes fonctionnalit\u00e9s d\'iCAN' },
      { type: 'new', text: 'Design timeline altern\u00e9 gauche/droite avec cartes color\u00e9es, ic\u00f4nes et tags' },
      { type: 'improved', text: 'Navigation par onglets entre Highlights et Patch Notes' },
    ],
  },
  {
    version: '1.6.4',
    date: '28 mars 2026',
    title: 'Fix \u00e9cran bleu, cache & cr\u00e9ation de groupe',
    tag: 'hotfix',
    changes: [
      { type: 'fixed', text: 'L\'application se monte imm\u00e9diatement au lieu d\'attendre la fin de l\'initialisation auth \u2014 plus d\'\u00e9cran bleu vide au refresh' },
      { type: 'fixed', text: 'Timeout de s\u00e9curit\u00e9 de 5s sur l\'init auth pour d\u00e9bloquer l\'app si Supabase ne r\u00e9pond pas' },
      { type: 'fixed', text: 'Le router attend la fin de l\'init auth avant de d\u00e9cider de rediriger vers le login' },
      { type: 'fixed', text: 'Correction de l\'erreur 403 lors de la cr\u00e9ation d\'un groupe \u2014 utilisation d\'une fonction RPC atomique (create_group_conversation)' },
      { type: 'improved', text: 'Meta tags anti-cache pour \u00e9viter les versions p\u00e9rim\u00e9es apr\u00e8s d\u00e9ploiement' },
      { type: 'improved', text: 'Protection contre les d\u00e9connexions fant\u00f4mes : v\u00e9rification de la session avant logout automatique' },
    ],
  },
  {
    version: '1.6.3',
    date: '28 mars 2026',
    title: 'Fix persistance de session',
    tag: 'hotfix',
    changes: [
      { type: 'fixed', text: 'La session n\'est plus d\u00e9truite apr\u00e8s une p\u00e9riode d\'inactivit\u00e9 \u2014 le refresh token est pr\u00e9serv\u00e9 m\u00eame si le token d\'acc\u00e8s expire' },
      { type: 'improved', text: 'Supabase g\u00e8re maintenant le renouvellement automatique des tokens en arri\u00e8re-plan via onAuthStateChange' },
      { type: 'fixed', text: 'Suppression de l\'appel signOut() agressif qui d\u00e9truisait les sessions r\u00e9cup\u00e9rables lors d\'un \u00e9chec de refresh temporaire' },
    ],
  },
  {
    version: '1.6.2',
    date: '28 mars 2026',
    title: 'Fix erreurs 500 RLS groupes',
    tag: 'hotfix',
    changes: [
      { type: 'fixed', text: 'Correction des erreurs 500 sur les requ\u00eates messages caus\u00e9es par une r\u00e9cursion infinie dans les policies RLS des groupes' },
      { type: 'fixed', text: 'Nouvelle fonction helper my_conversation_ids() en SECURITY DEFINER pour \u00e9viter les boucles RLS' },
      { type: 'improved', text: 'Gestion d\'erreurs sur le polling DM \u2014 les erreurs r\u00e9seau ne bloquent plus l\'interface' },
    ],
  },
  {
    version: '1.6.1',
    date: '28 mars 2026',
    title: 'Fix likes multi-profils',
    tag: 'hotfix',
    changes: [
      { type: 'fixed', text: 'Les likes ne sont plus partag\u00e9s entre tous les profils d\'un m\u00eame compte \u2014 chaque profil a ses propres likes' },
      { type: 'fixed', text: 'Le compteur de likes se met correctement \u00e0 jour lors du unlike' },
      { type: 'fixed', text: 'Les likes de commentaires et les reposts respectent aussi le profil actif' },
    ],
  },
  {
    version: '1.6.0',
    date: '28 mars 2026',
    title: 'Groupes de discussion',
    tag: 'minor',
    changes: [
      { type: 'new', text: 'Conversations de groupe dans le widget DM \u2014 discutez \u00e0 plusieurs en temps r\u00e9el' },
      { type: 'new', text: 'Cr\u00e9ation de groupe : nom personnalis\u00e9, recherche et ajout de membres (minimum 2)' },
      { type: 'new', text: 'Affichage du nom de l\'exp\u00e9diteur dans les bulles de messages de groupe' },
      { type: 'new', text: 'Badge compteur de membres dans l\'en-t\u00eate des conversations de groupe' },
      { type: 'improved', text: 'Liste de conversations unifi\u00e9e : DMs et groupes tri\u00e9s par derni\u00e8re activit\u00e9' },
      { type: 'improved', text: 'Avatars de groupe distincts pour diff\u00e9rencier les conversations 1-\u00e0-1 des groupes' },
    ],
  },
  {
    version: '1.5.1',
    date: '28 mars 2026',
    title: 'Switcher profils am\u00e9lior\u00e9',
    tag: 'minor',
    changes: [
      { type: 'improved', text: 'Ajout d\u2019un scroll interne \u00e0 la liste des profils dans le switcher lorsque la hauteur d\u00e9passe 700px.' },
      { type: 'new', text: 'Ajout d\u2019une barre de recherche dynamique pour filtrer les profils par identifiant ou username dans le switcher.' },
      { type: 'improved', text: 'Scrollbar interne du switcher stylis\u00e9e pour correspondre \u00e0 l\u2019identit\u00e9 visuelle du site.' },
    ],
  },
  {
    version: '1.5.0',
    date: '28 mars 2026',
    title: 'Images en DM & Patch Notes',
    tag: 'minor',
    changes: [
      { type: 'new', text: 'Envoi d\'images dans les messages directs (JPG, PNG, GIF, WebP, max 5 Mo)' },
      { type: 'new', text: 'Pr\u00e9visualisation de l\'image avant envoi dans le widget DM' },
      { type: 'new', text: 'Page Patch Notes pour suivre les mises \u00e0 jour du site' },
      { type: 'improved', text: 'Aper\u00e7u "\ud83d\uddbc\ufe0f Image" dans la liste des conversations pour les messages sans texte' },
    ],
  },
  {
    version: '1.4.0',
    date: '28 mars 2026',
    title: 'S\u00e9curit\u00e9 & Qualit\u00e9 de vie',
    tag: 'minor',
    changes: [
      { type: 'new', text: 'Liste des personnes ayant lik\u00e9 un post (cliquable sur la page du post)' },
      { type: 'new', text: 'Bouton rafra\u00eechir d\u00e9plac\u00e9 en haut du feed avec header sticky "Accueil"' },
      { type: 'security', text: 'Rate limiting anti-spam : posts (5/min), commentaires (10/min), messages (20/min), likes (30/min)' },
      { type: 'security', text: 'Validation des uploads c\u00f4t\u00e9 store : type MIME + taille v\u00e9rifi\u00e9s' },
      { type: 'fixed', text: 'Persistance de connexion am\u00e9lior\u00e9e \u2014 la session survit au rafra\u00eechissement de page' },
    ],
  },
  {
    version: '1.3.0',
    date: '28 mars 2026',
    title: 'Widget DM & Images dans les posts',
    tag: 'major',
    changes: [
      { type: 'new', text: 'Widget DM flottant en bas \u00e0 gauche (style X/Twitter) \u2014 messagerie sans quitter la page' },
      { type: 'new', text: 'Recherche de conversations et cr\u00e9ation de nouvelles conversations depuis le widget' },
      { type: 'new', text: 'Publication d\'images avec les posts (bouton image dans le composeur)' },
      { type: 'new', text: 'Pr\u00e9visualisation avant publication avec suppression possible' },
      { type: 'new', text: 'Affichage des images dans le feed et les pages de d\u00e9tail' },
      { type: 'changed', text: 'Le lien "Messages" retir\u00e9 de la navigation \u2014 remplac\u00e9 par le widget' },
      { type: 'improved', text: 'Badge non-lus en temps r\u00e9el sur le widget DM' },
      { type: 'improved', text: 'Point bleu sur les conversations non lues' },
    ],
  },
  {
    version: '1.2.0',
    date: '28 mars 2026',
    title: 'Refonte des commentaires & reposts',
    tag: 'major',
    changes: [
      { type: 'new', text: 'Likes sur les commentaires (coeur rouge quand lik\u00e9)' },
      { type: 'new', text: 'R\u00e9ponses imbriqu\u00e9es aux commentaires avec fil visuel' },
      { type: 'new', text: 'Avatars et photos de profil sur chaque commentaire' },
      { type: 'new', text: 'Indicateur "En r\u00e9ponse \u00e0 @username" sur les r\u00e9ponses' },
      { type: 'new', text: 'Header "Commentaires" avec badge compteur' },
      { type: 'improved', text: 'Refonte compl\u00e8te de l\'affichage des reposts \u2014 contenu original visible' },
      { type: 'improved', text: 'Toggle repost (annulation possible, bouton vert quand repost\u00e9)' },
      { type: 'improved', text: 'Protection : impossible de reposter son propre post' },
      { type: 'fixed', text: 'Les compteurs de likes/reposts/commentaires pointent vers le post original' },
      { type: 'fixed', text: 'Le badge repost affiche correctement le nom du reposteur' },
    ],
  },
  {
    version: '1.1.0',
    date: '27 mars 2026',
    title: 'Multi-profils & Param\u00e8tres',
    tag: 'major',
    changes: [
      { type: 'new', text: 'Plusieurs profils par compte \u2014 switch entre alias pour poster sous diff\u00e9rentes identit\u00e9s' },
      { type: 'new', text: 'Page param\u00e8tres : gestion des profils, avatar, pseudo, nom d\'affichage' },
      { type: 'new', text: 'Upload de photo de profil (bucket Supabase Storage)' },
      { type: 'new', text: 'S\u00e9lecteur de profil dans le header avec dropdown' },
      { type: 'new', text: 'Composant UserAvatar r\u00e9utilisable (image ou initiale)' },
      { type: 'changed', text: 'Architecture BDD : profiles.owner_id (N:1) au lieu de profiles.id = auth.uid (1:1)' },
      { type: 'improved', text: 'Persistance du profil actif dans localStorage' },
    ],
  },
  {
    version: '1.0.0',
    date: '27 mars 2026',
    title: 'Lancement initial',
    tag: 'major',
    changes: [
      { type: 'new', text: 'Feed de posts avec cr\u00e9ation, suppression (auteur + admin)' },
      { type: 'new', text: 'Syst\u00e8me de likes (toggle)' },
      { type: 'new', text: 'Reposts' },
      { type: 'new', text: 'Commentaires sur les posts' },
      { type: 'new', text: 'Messages directs (DM) entre utilisateurs' },
      { type: 'new', text: 'Authentification par email/mot de passe (Supabase Auth)' },
      { type: 'new', text: 'Compte admin avec pouvoirs de mod\u00e9ration' },
      { type: 'new', text: 'Profils utilisateurs avec page d\u00e9di\u00e9e' },
      { type: 'new', text: 'D\u00e9ploiement automatique GitHub Pages via GitHub Actions' },
      { type: 'new', text: 'Th\u00e8me sombre inspir\u00e9 de Twitter/X' },
    ],
  },
]
</script>

<style scoped>
.updates-page {
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
  min-height: calc(100vh - 52px);
}

/* ============ HEADER & TABS ============ */
.up-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
  position: sticky;
  top: 52px;
  z-index: 5;
}

.back-btn {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 0.9rem;
  flex-shrink: 0;
}
.back-btn:hover { text-decoration: underline; }

.up-tabs {
  display: flex;
  gap: 0;
  background: var(--bg-primary);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border);
}

.up-tab {
  padding: 0.4rem 1.1rem;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.up-tab:hover { color: var(--text-primary); background: var(--bg-hover); }
.up-tab.active {
  background: var(--accent);
  color: white;
}

/* ============ HIGHLIGHTS TIMELINE ============ */
.hl-container {
  padding: 0;
}

.hl-intro {
  text-align: center;
  padding: 2.5rem 1.5rem 1.5rem;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(180deg, rgba(29, 161, 242, 0.06) 0%, transparent 100%);
}

.hl-intro-title {
  font-size: 1.6rem;
  font-weight: 800;
  margin: 0 0 0.4rem;
  background: linear-gradient(135deg, var(--accent), #9b59b6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hl-intro-sub {
  font-size: 0.92rem;
  color: var(--text-secondary);
  max-width: 400px;
  margin: 0 auto;
  line-height: 1.5;
}

.hl-timeline {
  position: relative;
  padding: 2rem 1rem 3rem;
  max-width: 700px;
  margin: 0 auto;
}

.hl-line {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(180deg, var(--accent), var(--border) 90%, transparent);
  transform: translateX(-50%);
}

.hl-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  margin-bottom: 2rem;
  padding-right: calc(50% + 24px);
}

.hl-item.right {
  padding-right: 0;
  padding-left: calc(50% + 24px);
  flex-direction: row-reverse;
}

.hl-item.hl-start {
  padding-right: 0;
  padding-left: 0;
  justify-content: center;
  margin-bottom: 0;
}

.hl-dot {
  position: absolute;
  left: 50%;
  top: 18px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  transform: translateX(-50%);
  z-index: 2;
  border: 3px solid var(--bg-primary);
  box-shadow: 0 0 0 2px var(--border);
}

.hl-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 1.1rem;
  width: 100%;
  transition: transform 0.2s, box-shadow 0.2s;
  display: flex;
  gap: 0.9rem;
  align-items: flex-start;
}

.hl-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
}

.hl-card-start {
  max-width: 320px;
  margin: 0 auto;
  opacity: 0.7;
  border-style: dashed;
}

.hl-card-icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  flex-shrink: 0;
}

.hl-card-content {
  flex: 1;
  min-width: 0;
}

.hl-card-version {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--accent);
  margin-right: 0.5rem;
}

.hl-card-date {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.hl-card-title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0.25rem 0 0.35rem;
  line-height: 1.3;
}

.hl-card-desc {
  font-size: 0.83rem;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0 0 0.5rem;
}

.hl-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.hl-tag {
  font-size: 0.68rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
  white-space: nowrap;
}

/* ============ PATCH NOTES ============ */
.pn-container {
  padding: 0;
}

.pn-list { padding: 0; }

.pn-entry {
  padding: 1.25rem 1rem;
  border-bottom: 1px solid var(--border);
}
.pn-entry:last-child { border-bottom: none; }

.pn-entry-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.4rem;
}

.pn-version {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--accent);
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.pn-date {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.pn-tag {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 8px;
  border-radius: 4px;
}
.pn-tag.major { background: var(--accent); color: white; }
.pn-tag.minor { background: var(--repost); color: white; }
.pn-tag.hotfix { background: var(--danger); color: white; }

.pn-entry-title {
  font-size: 1.05rem;
  margin: 0 0 0.6rem;
  font-weight: 600;
}

.pn-changes {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.pn-change {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.88rem;
  line-height: 1.4;
}

.pn-change-badge {
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  padding: 1px 6px;
  border-radius: 3px;
  white-space: nowrap;
  margin-top: 2px;
  flex-shrink: 0;
}

.pn-change.new .pn-change-badge { background: rgba(29, 161, 242, 0.15); color: var(--accent); }
.pn-change.improved .pn-change-badge { background: rgba(23, 191, 99, 0.15); color: var(--repost); }
.pn-change.fixed .pn-change-badge { background: rgba(224, 36, 94, 0.15); color: var(--danger); }
.pn-change.changed .pn-change-badge { background: rgba(255, 173, 31, 0.15); color: #ffad1f; }
.pn-change.removed .pn-change-badge { background: rgba(136, 153, 166, 0.15); color: var(--text-secondary); }
.pn-change.security .pn-change-badge { background: rgba(121, 75, 196, 0.15); color: #794bc4; }

/* ============ RESPONSIVE ============ */
@media (max-width: 600px) {
  .hl-line { left: 20px; }
  .hl-dot { left: 20px; }
  .hl-item,
  .hl-item.right {
    padding-left: 48px;
    padding-right: 0;
    flex-direction: row;
  }
  .hl-item.hl-start {
    padding-left: 48px;
    justify-content: flex-start;
  }
  .hl-card-start { margin: 0; }
  .hl-intro-title { font-size: 1.3rem; }
}
</style>
