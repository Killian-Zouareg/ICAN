<template>
  <div class="patch-notes">
    <div class="pn-header">
      <button @click="$router.back()" class="back-btn">&larr; Retour</button>
      <h1 class="pn-title">Patch Notes</h1>
    </div>

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
</template>

<script setup>
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
    version: '1.6.3',
    date: '28 mars 2026',
    title: 'Fix persistance de session',
    tag: 'hotfix',
    changes: [
      { type: 'fixed', text: 'La session n\'est plus détruite après une période d\'inactivité — le refresh token est préservé même si le token d\'accès expire' },
      { type: 'improved', text: 'Supabase gère maintenant le renouvellement automatique des tokens en arrière-plan via onAuthStateChange' },
      { type: 'fixed', text: 'Suppression de l\'appel signOut() agressif qui détruisait les sessions récupérables lors d\'un échec de refresh temporaire' },
    ],
  },
  {
    version: '1.6.2',
    date: '28 mars 2026',
    title: 'Fix erreurs 500 RLS groupes',
    tag: 'hotfix',
    changes: [
      { type: 'fixed', text: 'Correction des erreurs 500 sur les requêtes messages causées par une récursion infinie dans les policies RLS des groupes' },
      { type: 'fixed', text: 'Nouvelle fonction helper my_conversation_ids() en SECURITY DEFINER pour éviter les boucles RLS' },
      { type: 'improved', text: 'Gestion d\'erreurs sur le polling DM — les erreurs réseau ne bloquent plus l\'interface' },
    ],
  },
  {
    version: '1.6.1',
    date: '28 mars 2026',
    title: 'Fix likes multi-profils',
    tag: 'hotfix',
    changes: [
      { type: 'fixed', text: 'Les likes ne sont plus partagés entre tous les profils d\'un même compte — chaque profil a ses propres likes' },
      { type: 'fixed', text: 'Le compteur de likes se met correctement à jour lors du unlike' },
      { type: 'fixed', text: 'Les likes de commentaires et les reposts respectent aussi le profil actif' },
    ],
  },
  {
    version: '1.6.0',
    date: '28 mars 2026',
    title: 'Groupes de discussion',
    tag: 'minor',
    changes: [
      { type: 'new', text: 'Conversations de groupe dans le widget DM — discutez à plusieurs en temps réel' },
      { type: 'new', text: 'Création de groupe : nom personnalisé, recherche et ajout de membres (minimum 2)' },
      { type: 'new', text: 'Affichage du nom de l\'expéditeur dans les bulles de messages de groupe' },
      { type: 'new', text: 'Badge compteur de membres dans l\'en-tête des conversations de groupe' },
      { type: 'improved', text: 'Liste de conversations unifiée : DMs et groupes triés par dernière activité' },
      { type: 'improved', text: 'Avatars de groupe distincts pour différencier les conversations 1-à-1 des groupes' },
    ],
  },
  {
    version: '1.5.1',
    date: '28 mars 2026',
    title: 'Switcher profils amélioré',
    tag: 'minor',
    changes: [
      { type: 'improved', text: 'Ajout d’un scroll interne à la liste des profils dans le switcher lorsque la hauteur dépasse 700px.' },
      { type: 'new', text: 'Ajout d’une barre de recherche dynamique pour filtrer les profils par identifiant ou username dans le switcher.' },
      { type: 'improved', text: 'Scrollbar interne du switcher stylisée pour correspondre à l’identité visuelle du site.' },
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
.patch-notes {
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
  min-height: calc(100vh - 52px);
}

.pn-header {
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
}

.back-btn:hover {
  text-decoration: underline;
}

.pn-title {
  font-size: 1.15rem;
  margin: 0;
}

.pn-list {
  padding: 0;
}

.pn-entry {
  padding: 1.25rem 1rem;
  border-bottom: 1px solid var(--border);
}

.pn-entry:last-child {
  border-bottom: none;
}

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

.pn-tag.major {
  background: var(--accent);
  color: white;
}

.pn-tag.minor {
  background: var(--repost);
  color: white;
}

.pn-tag.hotfix {
  background: var(--danger);
  color: white;
}

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

.pn-change.new .pn-change-badge {
  background: rgba(29, 161, 242, 0.15);
  color: var(--accent);
}

.pn-change.improved .pn-change-badge {
  background: rgba(23, 191, 99, 0.15);
  color: var(--repost);
}

.pn-change.fixed .pn-change-badge {
  background: rgba(224, 36, 94, 0.15);
  color: var(--danger);
}

.pn-change.changed .pn-change-badge {
  background: rgba(255, 173, 31, 0.15);
  color: #ffad1f;
}

.pn-change.removed .pn-change-badge {
  background: rgba(136, 153, 166, 0.15);
  color: var(--text-secondary);
}

.pn-change.security .pn-change-badge {
  background: rgba(121, 75, 196, 0.15);
  color: #794bc4;
}
</style>
