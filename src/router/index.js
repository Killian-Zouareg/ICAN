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
    component: () => import('../views/ConversationView.vue'),
  },
]

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.isAuthenticated) {
    return '/login'
  }
  if (to.path === '/login' && auth.isAuthenticated) {
    return '/'
  }
})

export default router
