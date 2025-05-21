import { createRouter, createWebHistory } from 'vue-router'
import HelloWorld from './components/HelloWorld.vue'
import AdminPage from './components/AdminPage.vue'
import AdminSettings from './components/AdminSettings.vue'
import AdminLogin from './components/AdminLogin.vue'

const routes = [
  { path: '/', component: HelloWorld },
  { 
    path: '/admin-login', 
    component: AdminLogin,
    meta: { allowAnonymous: true }
  },
  { 
    path: '/admin', 
    component: AdminPage,
    meta: { requiresAdmin: true }
  },
  { 
    path: '/admin-settings', 
    component: AdminSettings, 
    meta: { requiresAdmin: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Add navigation guard to check authentication
router.beforeEach((to, from, next) => {
  const isLoggedIn = localStorage.getItem('adminLoggedIn') === 'true'
  
  if (to.meta.requiresAdmin && !isLoggedIn) {
    // Redirect to login page if trying to access admin pages without auth
    next('/admin-login')
  } else {
    next()
  }
})

export default router
