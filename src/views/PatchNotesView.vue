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
        <p class="hl-intro-sub">Chaque grande fonctionnalit&eacute; qui a façonn&eacute; le r&eacute;seau, du premier post aux groupes DM.</p>
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
    version: '3.2.0',
    date: '7 avril 2026',
    icon: '\u{2709}',
    color: '#1da1f2',
    title: 'Messages redesign\u00e9s style X',
    description: 'La page Messages adopte un layout 2 colonnes inspir\u00e9 de X/Twitter ! Liste des conversations \u00e0 gauche avec apercu du dernier message, indicateur non-lu et timestamp. Conversation active \u00e0 droite. Les notifications et badges se mettent \u00e0 jour instantan\u00e9ment.',
    tags: ['Messages', 'UI', 'Twitter-style', 'Split-view'],
  },
  {
    version: '3.1.0',
    date: '5 avril 2026',
    icon: '\u{1F4CD}',
    color: '#f39c12',
    title: 'Mentions de lieux sur la carte',
    description: 'Liez vos posts aux lieux de la carte d\'Allentown ! Tapez < dans un post pour mentionner un lieu avec autocompl\u00e9tion. Les mentions s\'affichent en dor\u00e9 et redirigent vers la carte. Chaque lieu affiche d\u00e9sormais les 5 derniers posts qui le mentionnent.',
    tags: ['Carte', 'Mentions', 'Lieux', 'Immersion', 'JDR'],
  },
  {
    version: '3.0.0',
    date: '5 avril 2026',
    icon: '\u{1F9D9}',
    color: '#9b59b6',
    title: 'iCHARACTER \u2014 Fiches Personnage',
    description: 'Chaque profil poss\u00e8de d\u00e9sormais sa fiche personnage compl\u00e8te ! Photo, identit\u00e9 (nom, pr\u00e9nom, nationalit\u00e9, sexe, lieu et date de naissance) et 5 comp\u00e9tences (Charisme, Intelligence, Force, Vigueur, Mobilit\u00e9) visualis\u00e9es sur un radar chart pentagone SVG interactif. Inventaire d\'objets avec \u00e9mojis. Modifiez votre fiche, consultez celles des autres.',
    tags: ['Fiche perso', 'Stats', 'Inventaire', 'Radar chart', 'JDR'],
  },
  {
    version: '3.0.0',
    date: '5 avril 2026',
    icon: '\u{1F3E6}',
    color: '#2ecc71',
    title: 'iBANK \u2014 Syst\u00e8me bancaire',
    description: 'Un syst\u00e8me bancaire complet pour l\u2019univers du JDR ! Chaque profil a un compte en dollars avec solde, transferts entre joueurs, historique des transactions et une section admin pour cr\u00e9diter ou d\u00e9biter librement les comptes.',
    tags: ['Banque', 'Transferts', 'Dollars', 'Admin', '\u00c9conomie'],
  },
  {
    version: '2.16.0',
    date: '4 avril 2026',
    icon: '\u{1F5FA}',
    color: '#1da1f2',
    title: 'Carte interactive d\'Allentown',
    description: 'Explorez la ville d\'Allentown directement depuis l\'app ! Carte sombre interactive avec les lieux cl\u00e9s de l\'univers : maisons des h\u00e9ros, lyc\u00e9e, QG, repaires de vilains... Les admins peuvent ajouter et g\u00e9rer les emplacements, chaque lieu peut \u00eatre li\u00e9 \u00e0 un personnage.',
    tags: ['Carte', 'Immersion', 'Leaflet', 'Lieux', 'Admin'],
  },
  {
    version: '2.15.0',
    date: '4 avril 2026',
    icon: '\u2B50',
    color: '#FFD700',
    title: 'R\u00f4le Hero',
    description: 'Nouveau r\u00f4le Hero attribu\u00e9 par les admins ! Les Heroes ont des posts ultra-distincts avec bordure anim\u00e9e d\u00e9grad\u00e9e, effet glow et badge \u00e9toile. Chaque Hero peut personnaliser ses couleurs depuis les param\u00e8tres.',
    tags: ['Hero', 'R\u00f4le', 'Personnalisation', 'Admin', 'Animation'],
  },
  {
    version: '2.10.0',
    date: '1 avril 2026',
    icon: '✏️',
    color: '#9b59b6',
    title: 'Citations (Quote Tweets)',
    description: 'Citez n\'importe quel post ou commentaire avec votre propre texte, comme sur Twitter. Le contenu original s\'affiche en embed dans votre publication.',
    tags: ['Citations', 'Reposts', 'Commentaires', 'Embed'],
  },
  {
    version: '2.7.1',
    date: '30 mars 2026',
    title: 'Pictogrammes & animations des commentaires',
    tag: 'patch',
    changes: [
      { type: 'improved', text: 'Nouveaux pictogrammes SVG pour les boutons Répondre et Like dans les commentaires, avec animation de clic.' },
      { type: 'fixed', text: 'Alignement et rendu parfaits des icônes dans CommentCard.' },
    ],
  },
  {
    version: '2.7.0',
    date: '30 mars 2026',
    icon: '#\uFE0F\u20E3',
    color: '#3498db',
    title: 'Tendances par hashtags',
    description: 'Les tendances fonctionnent d\u00e9sormais avec des #hashtags. Le panneau lat\u00e9ral est scrollable et le widget DM repositionn\u00e9 pour ne plus g\u00eaner les utilisateurs actifs.',
    tags: ['Hashtags', 'Tendances', 'UI', 'Scroll'],
  },
  {
    version: '2.6.0',
    date: '30 mars 2026',
    icon: '\u{1F514}',
    color: '#e74c3c',
    title: 'Notifications redesign\u00e9es',
    description: 'Syst\u00e8me de notifications enti\u00e8rement repens\u00e9 : onglets par profil avec badge individuel, filtres par type (likes, commentaires, reposts), indicateur de profil destinataire, et design am\u00e9lior\u00e9.',
    tags: ['Multi-profils', 'Filtres', 'Notifications', 'Redesign'],
  },
  {
    version: '2.5.0',
    date: '28 mars 2026',
    icon: '\u{1F6E1}',
    color: '#e74c3c',
    title: 'Audit de s\u00e9curit\u00e9',
    description: 'Corrections majeures : suppression des cl\u00e9s expos\u00e9es, protection XSS, validation des entr\u00e9es, politique CSP, et s\u00e9curisation des requ\u00eates.',
    tags: ['S\u00e9curit\u00e9', 'XSS', 'CSP', 'Validation'],
  },
  {
    version: '2.4.0',
    date: '28 mars 2026',
    icon: '\u{2705}',
    color: '#1da1f2',
    title: 'Certification Admin',
    description: 'Les comptes administrateurs sont d\u00e9sormais identifi\u00e9s par un badge certifi\u00e9 bleu \u00e0 c\u00f4t\u00e9 de leur nom. Leurs posts sont subtilement mis en avant avec une bordure et un fond color\u00e9.',
    tags: ['Badge certifi\u00e9', 'Posts admin', 'Highlight'],
  },
  {
    version: '2.3.0',
    date: '28 mars 2026',
    icon: '\u{1F4DD}',
    color: '#2ecc71',
    title: 'Bio & Visionneuse avatar',
    description: 'Ajoutez une bio \u00e0 votre profil pour vous pr\u00e9senter en quelques mots. Cliquez sur la photo de profil pour l\'afficher en grand dans une lightbox \u00e9l\u00e9gante.',
    tags: ['Bio', 'Lightbox avatar', 'Profil'],
  },
  {
    version: '2.2.0',
    date: '28 mars 2026',
    icon: '\u{1F50D}',
    color: '#3498db',
    title: 'Recherche & Tendances',
    description: 'Nouvelle page de recherche pour trouver des profils et des posts. Panneau lat\u00e9ral droit avec les mots-cl\u00e9s tendances et les utilisateurs les plus actifs de la semaine.',
    tags: ['Recherche', 'Tendances', 'Utilisateurs actifs', 'Panneau lat\u00e9ral'],
  },
  {
    version: '2.1.0',
    date: '28 mars 2026',
    icon: '\u{2702}',
    color: '#9b59b6',
    title: 'Sidebar & Recadrage avatar',
    description: 'Nouvelle navigation lat\u00e9rale inspir\u00e9e de Twitter avec acc\u00e8s rapide au Feed, Messages, Profil, Param\u00e8tres et Admin. Recadrage interactif de la photo de profil avec zoom et d\u00e9placement.',
    tags: ['Sidebar', 'Crop avatar', 'Navigation', 'Mobile'],
  },
  {
    version: '2.0.0',
    date: '28 mars 2026',
    icon: '\u{1F6E1}',
    color: '#e74c3c',
    title: 'Panel Administrateur',
    description: 'Un tableau de bord complet pour les admins : statistiques en temps r\u00e9el, gestion des utilisateurs, bans temporaires, mod\u00e9ration des commentaires, et surveillance de toutes les conversations priv\u00e9es.',
    tags: ['Admin', 'Mod\u00e9ration', 'Bans temporaires', 'Surveillance DM'],
  },
  {
    version: '1.9.0',
    date: '28 mars 2026',
    icon: '\u{1F3A8}',
    color: '#1da1f2',
    title: 'Profil inspir\u00e9 de Twitter',
    description: 'Page de profil enti\u00e8rement redesign\u00e9e : banni\u00e8re gradient, avatar en overlay, statistiques, 4 onglets (Posts, Reposts, J\'aime, M\u00e9dias) et grille m\u00e9dia d\u00e9di\u00e9e.',
    tags: ['Redesign profil', 'Grille m\u00e9dias', 'Onglets', 'Twitter-style'],
  },
  {
    version: '1.8.0',
    date: '28 mars 2026',
    icon: '\u{1F514}',
    color: '#e74c3c',
    title: 'Notifications & Discord',
    description: 'Soyez alert\u00e9 en temps r\u00e9el : cloche de notifications in-app pour les likes, commentaires, r\u00e9ponses et reposts. Chaque nouveau post est aussi envoy\u00e9 automatiquement sur Discord via webhook.',
    tags: ['Notifications in-app', 'Webhook Discord', 'Temps r\u00e9el'],
  },
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
    version: '3.2.0',
    date: '7 avril 2026',
    title: 'Refonte Messages style X + fix notifications',
    tag: 'minor',
    changes: [
      { type: 'new', text: 'Page Messages en layout 2 colonnes : liste des conversations \u00e0 gauche, conversation active \u00e0 droite' },
      { type: 'new', text: 'Chaque conversation affiche le dernier message, le timestamp et un indicateur non-lu' },
      { type: 'new', text: 'Badge de messages non-lus par profil dans le switcher' },
      { type: 'improved', text: 'Les notifications et badges se mettent \u00e0 jour instantan\u00e9ment (optimistic updates)' },
      { type: 'improved', text: 'La sidebar \u00e9coute les changements de lecture pour rafra\u00eechir le badge imm\u00e9diatement' },
      { type: 'fixed', text: 'Correction du nom de table conversation_participants \u2192 conversation_members (erreur 404)' },
      { type: 'fixed', text: 'Les badges de notifications et messages se chargent correctement d\u00e8s le d\u00e9marrage' },
    ],
  },
  {
    version: '3.1.1',
    date: '6 avril 2026',
    title: 'Fix compteurs ghost & notifications',
    tag: 'hotfix',
    changes: [
      { type: 'fixed', text: 'Les compteurs de likes/commentaires/reposts ghost s\'affichent de nouveau correctement sur les posts' },
      { type: 'fixed', text: 'Les notifications n\'apparaissent plus en double dans la cloche (fix race condition realtime + contrainte unique DB)' },
      { type: 'fixed', text: 'Le badge messages non-lus ne compte plus les messages de conversations auxquelles on ne participe pas' },
    ],
  },
  {
    version: '3.1.0',
    date: '5 avril 2026',
    title: 'Mentions de lieux (<Lieu>)',
    tag: 'minor',
    changes: [
      { type: 'new', text: 'Mention de lieux dans les posts : tapez < pour ouvrir l\'autocompl\u00e9tion des lieux de la carte' },
      { type: 'new', text: 'Les mentions de lieux s\'affichent en dor\u00e9 avec un \u{1F4CD} et redirigent vers la carte au clic' },
      { type: 'new', text: 'Panel de d\u00e9tail sur la carte : section "Posts r\u00e9cents" avec les 5 derniers posts mentionnant le lieu' },
      { type: 'new', text: 'Navigation automatique vers un lieu depuis un lien de mention (centrage + s\u00e9lection)' },
      { type: 'improved', text: 'Le composant MentionInput g\u00e8re d\u00e9sormais deux modes : @ pour les utilisateurs, < pour les lieux' },
      { type: 'improved', text: 'Recherche de lieux instantan\u00e9e (filtrage client-side, pas de requ\u00eate serveur)' },
    ],
  },
  {
    version: '3.0.0',
    date: '5 avril 2026',
    title: 'iCHARACTER & iBANK',
    tag: 'major',
    changes: [
      { type: 'new', text: 'Onglet iCHARACTER : fiche compl\u00e8te avec photo, identit\u00e9 (nom, pr\u00e9nom, nationalit\u00e9, sexe, lieu/date de naissance)' },
      { type: 'new', text: '5 comp\u00e9tences : Charisme, Intelligence, Force, Vigueur, Mobilit\u00e9 (0-5)' },
      { type: 'new', text: 'Radar chart pentagone SVG avec 3 niveaux concentriques et animation' },
      { type: 'new', text: 'Inventaire d\'objets avec \u00e9mojis, nom, description et quantit\u00e9' },
      { type: 'new', text: 'Mode \u00e9dition pour le propri\u00e9taire, mode lecture pour les autres' },
      { type: 'new', text: 'Upload de photo personnage (bucket Supabase d\u00e9di\u00e9)' },
      { type: 'new', text: 'Onglet iBANK : compte en dollars ($) par profil avec solde affich\u00e9 en grand' },
      { type: 'new', text: 'Transfert d\u2019argent entre profils avec recherche de destinataire et note optionnelle' },
      { type: 'new', text: 'Historique des transactions color\u00e9 (vert = re\u00e7u, rouge = envoy\u00e9)' },
      { type: 'new', text: 'Section admin : cr\u00e9dit/d\u00e9bit libre sur n\u2019importe quel compte (MJ)' },
      { type: 'new', text: 'Transferts atomiques s\u00e9curis\u00e9s via RPC Supabase' },
      { type: 'new', text: 'Rate limiting sur les transferts (5 par minute)' },
      { type: 'new', text: 'Liens iCHARACTER et iBANK ajout\u00e9s dans la sidebar et le menu mobile' },
    ],
  },
  {
    version: '2.16.0',
    date: '4 avril 2026',
    title: 'Carte interactive d\'Allentown',
    tag: 'minor',
    changes: [
      { type: 'new', text: 'Carte interactive sombre de la ville d\'Allentown avec tuiles CartoDB Dark Matter' },
      { type: 'new', text: '10 cat\u00e9gories de lieux : R\u00e9sidence, \u00c9cole, Lieu cl\u00e9, QG, Zone dangereuse, Commerce, H\u00f4pital, Police, Repaire de vilain, Autre' },
      { type: 'new', text: 'Markers custom avec emojis, couleurs par cat\u00e9gorie et effet glow lumineux' },
      { type: 'new', text: 'Panel lat\u00e9ral de d\u00e9tail avec image, description et profil li\u00e9 cliquable' },
      { type: 'new', text: 'Mode ajout admin : cliquer sur la carte pour placer un nouveau lieu' },
      { type: 'new', text: 'Upload d\'images pour chaque lieu (bucket Supabase d\u00e9di\u00e9)' },
      { type: 'new', text: 'Liaison optionnelle d\'un lieu \u00e0 un personnage (@username)' },
      { type: 'new', text: 'Filtres par cat\u00e9gorie avec chips scrollables' },
      { type: 'new', text: 'Lien "Carte" dans la sidebar et le menu mobile' },
      { type: 'improved', text: 'Overlay vignette cin\u00e9matique et contr\u00f4les de zoom int\u00e9gr\u00e9s au th\u00e8me sombre' },
    ],
  },
  {
    version: '2.15.1',
    date: '4 avril 2026',
    title: 'Hero dans les posts cit\u00e9s + corrections',
    tag: 'patch',
    changes: [
      { type: 'new', text: 'Le style Hero (bordure anim\u00e9e, glow, badge \u00e9toile) s\'affiche aussi dans les posts et commentaires cit\u00e9s' },
      { type: 'improved', text: 'Les donn\u00e9es Hero (is_hero, couleurs) sont maintenant r\u00e9cup\u00e9r\u00e9es pour les auteurs de commentaires cit\u00e9s' },
      { type: 'fix', text: 'L\'enrichissement des posts originaux (reposts/citations) inclut d\u00e9sormais les champs Hero' },
    ],
  },
  {
    version: '2.15.0',
    date: '4 avril 2026',
    title: 'R\u00f4le Hero \u2014 posts super-highlight personnalisables',
    tag: 'minor',
    changes: [
      { type: 'new', text: 'Nouveau r\u00f4le "Hero" avec bordure anim\u00e9e d\u00e9grad\u00e9e, effet glow et fond teint\u00e9 sur les posts' },
      { type: 'new', text: 'Badge \u00e9toile dor\u00e9 \u00e0 c\u00f4t\u00e9 du nom des Heroes dans les posts et le feed' },
      { type: 'new', text: 'Nom d\'affichage en d\u00e9grad\u00e9 avec les couleurs personnalis\u00e9es du Hero' },
      { type: 'new', text: 'Personnalisation des couleurs Hero (primaire + secondaire) depuis les param\u00e8tres avec aper\u00e7u en direct' },
      { type: 'new', text: 'Badge "Hero" sur les profils avec banni\u00e8re color\u00e9e et halo lumineux autour de l\'avatar' },
      { type: 'new', text: 'Bouton toggle Hero dans le panel admin pour attribuer/retirer le r\u00f4le' },
      { type: 'new', text: 'Tag Hero visible dans la recherche de profils' },
    ],
  },
  {
    version: '2.14.0',
    date: '2 avril 2026',
    title: '@Mentions + notifications',
    tag: 'minor',
    changes: [
      { type: 'new', text: 'Mentionner quelqu\'un avec @username dans un post ou commentaire' },
      { type: 'new', text: 'Autocomplete en tapant @ — affiche les profils correspondants' },
      { type: 'new', text: 'Les @mentions sont cliquables et redirigent vers le profil' },
      { type: 'new', text: 'Notification envoyée à la personne mentionnée' },
      { type: 'new', text: 'Triggers SQL pour les notifications de likes, commentaires, reposts et mentions' },
      { type: 'fix', text: 'Correction des notifications qui n\'étaient jamais créées (triggers manquants)' },
    ],
  },
  {
    version: '2.13.0',
    date: '2 avril 2026',
    title: 'Compteurs virtuels + images DM principal',
    tag: 'minor',
    changes: [
      { type: 'new', text: 'Compteurs virtuels illimités (likes, commentaires, reposts) — l\'admin peut mettre des millions sans générer de données' },
      { type: 'new', text: 'Envoi et affichage d\'images dans l\'onglet principal des messages (pas seulement le widget)' },
      { type: 'improved', text: 'Le masquage de conversations persiste entre les sessions mais se réinitialise quand un nouveau message arrive' },
      { type: 'fix', text: 'Correction du chargement des conversations cassé par la requête conversation_hidden' },
    ],
  },
  {
    version: '2.12.0',
    date: '1 avril 2026',
    title: 'Masquage de conversations + images DM widget',
    tag: 'minor',
    changes: [
      { type: 'new', text: 'Bouton × au survol de chaque conversation pour la masquer (page Messages et widget flottant)' },
      { type: 'new', text: 'La conversation masquée disparaît de l\'interface sans être supprimée pour l\'autre personne' },
      { type: 'improved', text: 'Les images étaient déjà envoyables depuis le widget flottant — le bucket dm-images est maintenant documenté' },
    ],
  },
  {
    version: '2.11.0',
    date: '1 avril 2026',
    title: 'Suppression de messages DM',
    tag: 'minor',
    changes: [
      { type: 'new', text: 'Bouton supprimer visible au survol de ses propres messages' },
      { type: 'new', text: 'Les admins peuvent supprimer n\'importe quel message' },
      { type: 'improved', text: 'Suppression instantanée sans rechargement de la conversation' },
    ],
  },
  {
    version: '2.10.0',
    date: '1 avril 2026',
    title: 'Citations de posts et commentaires',
    tag: 'major',
    changes: [
      { type: 'new', text: 'Le bouton Repost est désormais un menu déroulant avec "Repost" et "Citer"' },
      { type: 'new', text: 'Citer un post ouvre un compositeur avec aperçu du post original intégré' },
      { type: 'new', text: 'Citer un commentaire depuis sa page de post intègre le commentaire dans un nouveau post' },
      { type: 'new', text: 'Les posts cités affichent un embed du post ou commentaire original, cliquable' },
      { type: 'new', text: 'Support des images dans les posts de citation' },
    ],
  },
  {
    version: '2.9.0',
    date: '1 avril 2026',
    title: 'Engagement Ghost (Admin)',
    tag: 'major',
    changes: [
      { type: 'new', text: 'Les admins peuvent booster artificiellement les likes, reposts et commentaires d\'un post (bouton ⚡)' },
      { type: 'new', text: 'Génération de faux profils américains aléatoires avec noms réalistes' },
      { type: 'new', text: '7 humeurs disponibles pour les faux commentaires : joyeux, en colère, triste, excité, choqué, indifférent, amoureux' },
      { type: 'new', text: 'Dataset de phrases authentiques par humeur en français' },
      { type: 'new', text: 'Les faux profils sont consultables via leur page profil dédiée' },
      { type: 'new', text: 'Bouton "Tout effacer" pour réinitialiser l\'engagement ghost d\'un post' },
      { type: 'improved', text: 'Les faux comptes apparaissent dans la liste des likes et les commentaires de façon indiscernable' },
    ],
  },
  {
    version: '2.8.0',
    date: '1 avril 2026',
    title: 'Images dans les commentaires',
    tag: 'minor',
    changes: [
      { type: 'new', text: 'Possibilité d\'ajouter une image (JPG, PNG, GIF, WebP) à un commentaire ou une réponse' },
      { type: 'new', text: 'Prévisualisation de l\'image avant envoi avec suppression possible' },
      { type: 'new', text: 'Affichage de l\'image dans le commentaire, cliquable pour ouvrir en grand' },
      { type: 'improved', text: 'Les commentaires peuvent désormais contenir uniquement une image (sans texte obligatoire)' },
    ],
  },
  {
    version: '2.7.0',
    date: '30 mars 2026',
    title: 'Tendances par hashtags & ajustements UI',
    tag: 'minor',
    changes: [
      { type: 'changed', text: 'Les tendances sont d\u00e9sormais bas\u00e9es sur les #hashtags au lieu de la fr\u00e9quence de mots' },
      { type: 'new', text: 'Liste des hashtags scrollable dans le panneau lat\u00e9ral (max 15 tendances)' },
      { type: 'improved', text: 'Hashtags affich\u00e9s en bleu accent avec compteur de posts' },
      { type: 'fixed', text: 'Widget DM repositionn\u00e9 pour ne plus chevaucher le panneau utilisateurs actifs' },
      { type: 'improved', text: 'Tendances inline sur mobile mises \u00e0 jour avec le syst\u00e8me hashtag' },
    ],
  },
  {
    version: '2.6.0',
    date: '30 mars 2026',
    title: 'Notifications multi-profils & filtres',
    tag: 'major',
    changes: [
      { type: 'new', text: 'Onglets par profil dans le panneau de notifications avec badge non-lus individuel' },
      { type: 'new', text: 'Filtres par type : Tout / Likes / Commentaires / Reposts' },
      { type: 'new', text: 'Indicateur du profil destinataire sur chaque notification (multi-comptes)' },
      { type: 'new', text: 'Ic\u00f4nes color\u00e9es par type : rouge (like), bleu (commentaire), vert (reply/repost)' },
      { type: 'new', text: 'Point bleu non-lu \u00e0 droite de chaque notification' },
      { type: 'improved', text: '"Tout lire" marque uniquement les notifications du profil s\u00e9lectionn\u00e9' },
      { type: 'improved', text: 'Design SVG pour la cloche + panneau \u00e9largi (400px) avec meilleur responsive mobile' },
      { type: 'new', text: 'Switcher de comptes ajout\u00e9 sur la navigation mobile' },
    ],
  },
  {
    version: '2.4.1',
    date: '29 mars 2026',
    title: 'Boutons d\'action modernisés',
    tag: 'patch',
    changes: [
      { type: 'improve', text: 'Nouveaux pictogrammes SVG pour les boutons Commenter, Repost et Like, avec animation de clic.' },
      { type: 'fix', text: 'Correction de l\'alignement de l\'icône cœur (like) pour éviter qu\'elle soit coupée à droite.' },
      { type: 'improve', text: 'Icône Repost du badge harmonisée avec celle du bouton.' },
    ],
  },
  {
    version: '2.4.0',
    date: '28 mars 2026',
    title: 'Certification Admin & Posts highlight\u00e9s',
    tag: 'minor',
    changes: [
      { type: 'new', text: 'Badge certifi\u00e9 bleu (checkmark) \u00e0 c\u00f4t\u00e9 du nom des admins dans chaque post' },
      { type: 'new', text: 'Nom des admins affich\u00e9 en couleur accent (bleu) dans les posts' },
      { type: 'new', text: 'Posts des admins mis en avant : bordure bleue \u00e0 gauche et fond l\u00e9g\u00e8rement teint\u00e9' },
    ],
  },
  {
    version: '2.3.0',
    date: '28 mars 2026',
    title: 'Bio & Visionneuse avatar',
    tag: 'minor',
    changes: [
      { type: 'new', text: 'Champ bio dans les param\u00e8tres du profil (160 caract\u00e8res max) avec compteur' },
      { type: 'new', text: 'Bio affich\u00e9e sur la page de profil sous le nom d\'utilisateur' },
      { type: 'new', text: 'Lightbox avatar : cliquez sur la photo de profil pour l\'afficher en grand (300px, circulaire)' },
      { type: 'improved', text: 'Animation d\'ouverture fluide avec backdrop blur sur la lightbox' },
    ],
  },
  {
    version: '2.2.0',
    date: '28 mars 2026',
    title: 'Recherche & Tendances',
    tag: 'major',
    changes: [
      { type: 'new', text: 'Page de recherche avec onglets Tout / Profils / Posts et recherche d\u00e9bounc\u00e9e' },
      { type: 'new', text: 'Mise en surbrillance des termes recherch\u00e9s dans les r\u00e9sultats' },
      { type: 'new', text: 'Panneau lat\u00e9ral droit : mots-cl\u00e9s tendances extraits des posts r\u00e9cents (7 jours)' },
      { type: 'new', text: 'Section utilisateurs les plus actifs de la semaine' },
      { type: 'new', text: 'Lien Recherche ajout\u00e9 dans la sidebar et la navigation mobile' },
      { type: 'improved', text: 'Layout 3 colonnes sur grand \u00e9cran : sidebar + contenu + tendances' },
      { type: 'fixed', text: 'Navigation entre tendances sans rechargement — watch sur le param\u00e8tre URL' },
      { type: 'improved', text: 'Tendances et utilisateurs actifs affich\u00e9s directement dans la page recherche sur mobile' },
    ],
  },
  {
    version: '2.1.0',
    date: '28 mars 2026',
    title: 'Sidebar navigation & Recadrage avatar',
    tag: 'major',
    changes: [
      { type: 'new', text: 'Barre lat\u00e9rale fixe avec navigation : Feed, Messages, Profil, Param\u00e8tres, Patch Notes, Admin' },
      { type: 'new', text: 'Navigation mobile en barre inf\u00e9rieure sur petits \u00e9crans' },
      { type: 'new', text: 'Switcher de profil int\u00e9gr\u00e9 dans la sidebar avec recherche' },
      { type: 'new', text: 'Badge compteur de messages non-lus dans la sidebar' },
      { type: 'new', text: 'Recadrage interactif de la photo de profil : zoom, d\u00e9placement, aper\u00e7u circulaire' },
      { type: 'improved', text: 'Header simplifi\u00e9 — navigation d\u00e9plac\u00e9e dans la sidebar' },
    ],
  },
  {
    version: '2.0.0',
    date: '28 mars 2026',
    title: 'Panel Administrateur',
    tag: 'major',
    changes: [
      { type: 'new', text: 'Dashboard avec statistiques globales : comptes, profils, posts, likes, commentaires, messages, reposts, conversations' },
      { type: 'new', text: 'Gestion des utilisateurs : liste compl\u00e8te, recherche, toggle admin, suppression de profils' },
      { type: 'new', text: 'Mod\u00e9ration des posts : parcourir, rechercher et supprimer n\'importe quel post' },
      { type: 'new', text: 'Surveillance des conversations : voir toutes les conversations priv\u00e9es et lire tous les messages' },
      { type: 'new', text: 'Mod\u00e9ration des commentaires : parcourir, rechercher et supprimer des commentaires' },
      { type: 'new', text: 'Fil d\'activit\u00e9 r\u00e9cente : derniers posts, commentaires et likes en temps r\u00e9el' },
      { type: 'new', text: 'Bans temporaires : 15min, 30min, 1h, 3h, 6h, 12h, 24h, 3j, 7j ou dur\u00e9e personnalis\u00e9e' },
      { type: 'new', text: 'Banni\u00e8re d\'avertissement pour les profils bannis — actions bloqu\u00e9es (posts, likes, commentaires, DMs)' },
      { type: 'security', text: 'Route prot\u00e9g\u00e9e par guard admin — acc\u00e8s refus\u00e9 aux non-admins' },
      { type: 'improved', text: 'Lien admin visible uniquement pour les admins dans le header' },
    ],
  },
  {
    version: '1.9.0',
    date: '28 mars 2026',
    title: 'Profil redesign\u00e9 style Twitter',
    tag: 'major',
    changes: [
      { type: 'new', text: 'Banni\u00e8re gradient en haut du profil avec avatar 120px en overlay' },
      { type: 'new', text: '4 onglets de contenu : Posts, Reposts, J\'aime, M\u00e9dias avec lazy-loading' },
      { type: 'new', text: 'Grille m\u00e9dia (3 colonnes) affichant toutes les images post\u00e9es par l\'utilisateur' },
      { type: 'new', text: 'Statistiques du profil : nombre de posts et de likes re\u00e7us' },
      { type: 'improved', text: 'Bouton DM int\u00e9gr\u00e9 directement sur le profil des autres utilisateurs' },
      { type: 'improved', text: 'Design responsive adapt\u00e9 mobile et desktop' },
    ],
  },
  {
    version: '1.8.0',
    date: '28 mars 2026',
    title: 'Notifications in-app & Discord',
    tag: 'major',
    changes: [
      { type: 'new', text: 'Cloche de notifications dans le header avec badge compteur de non-lues' },
      { type: 'new', text: 'Notifications automatiques pour : likes, commentaires, r\u00e9ponses aux commentaires, reposts' },
      { type: 'new', text: 'Panel d\u00e9roulant avec liste des notifications, avatar de l\'acteur et lien vers le post' },
      { type: 'new', text: 'Bouton "Tout lire" pour marquer toutes les notifications comme lues' },
      { type: 'new', text: 'Webhook Discord : chaque nouveau post est automatiquement envoy\u00e9 dans un salon Discord' },
      { type: 'improved', text: 'Triggers SQL serveur pour g\u00e9n\u00e9rer les notifications — aucune action c\u00f4t\u00e9 client' },
    ],
  },
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
  min-height: calc(100vh - var(--header-height));
  padding-bottom: var(--page-bottom-padding);
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
