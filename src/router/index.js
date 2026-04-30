import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    name: 'Feed',
    component: () => import('../views/FeedView.vue'),
  },
  {
    path: '/post/:id',
    name: 'PostDetail',
    component: () => import('../views/PostDetailView.vue'),
  },
  {
    path: '/user/:username',
    name: 'Profile',
    component: () => import('../views/ProfileView.vue'),
  },
  {
    path: '/messages',
    name: 'Messages',
    component: () => import('../views/MessagesView.vue'),
  },
  {
    path: '/messages/:id',
    name: 'Conversation',
    component: () => import('../views/MessagesView.vue'),
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/SettingsView.vue'),
  },
  {
    path: '/patch-notes',
    name: 'PatchNotes',
    component: () => import('../views/PatchNotesView.vue'),
  },
  {
    path: '/search',
    name: 'Search',
    component: () => import('../views/SearchView.vue'),
  },
  {
    path: '/map',
    name: 'Map',
    component: () => import('../views/MapView.vue'),
  },
  {
    path: '/character/:username',
    name: 'Character',
    component: () => import('../views/CharacterView.vue'),
  },
  {
    path: '/bank',
    name: 'Bank',
    component: () => import('../views/BankView.vue'),
  },
  {
    path: '/wiki',
    name: 'Wiki',
    component: () => import('../views/WikiView.vue'),
  },
  {
    path: '/wiki/:id',
    name: 'WikiHero',
    component: () => import('../views/WikiHeroView.vue'),
  },
  {
    path: '/igames',
    name: 'iGames',
    component: () => import('../views/IGamesView.vue'),
  },
  {
    path: '/igames/arena',
    name: 'iArena',
    component: () => import('../views/ArenaView.vue'),
  },
  {
    path: '/igames/territory',
    name: 'Territory',
    component: () => import('../views/TerritoryView.vue'),
  },
  {
    path: '/game',
    name: 'Hub3D',
    component: () => import('../views/GameView.vue'),
  },
  {
    path: '/wiki/articles',
    name: 'WikiArticles',
    component: () => import('../views/WikiArticlesView.vue'),
  },
  {
    path: '/wiki/article/:slug',
    name: 'WikiArticleDetail',
    component: () => import('../views/WikiArticleDetailView.vue'),
  },
  {
    path: '/anonym',
    name: 'Anonym',
    component: () => import('../views/AnonymView.vue'),
  },
  {
    path: '/live',
    name: 'AllentownLive',
    component: () => import('../views/AllentownLiveView.vue'),
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('../views/AdminView.vue'),
    meta: { admin: true },
  },
  {
    path: '/ghost/:id',
    name: 'GhostProfile',
    component: () => import('../views/GhostProfileView.vue'),
  },
]

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // Wait for auth init to complete before making routing decisions
  if (auth.loading) {
    await new Promise((resolve) => {
      const stop = setInterval(() => {
        if (!auth.loading) { clearInterval(stop); resolve() }
      }, 50)
      // Safety timeout — don't block forever
      setTimeout(() => { clearInterval(stop); resolve() }, 5000)
    })
  }

  if (!to.meta.public && !auth.isAuthenticated) {
    return '/login'
  }
  if (to.meta.admin && !auth.isAdmin) {
    return '/'
  }
  if (to.path === '/login' && auth.isAuthenticated) {
    return '/'
  }
})

// When a new deploy changes chunk hashes, old cached index.js tries to load
// chunks that no longer exist → 404. Detect this and force a full reload.
router.onError((error) => {
  if (
    error.message.includes('Failed to fetch dynamically imported module') ||
    error.message.includes('Importing a module script failed') ||
    error.message.includes('error loading dynamically imported module')
  ) {
    window.location.reload()
  }
})

export default router
