import { createRouter, createWebHistory } from 'vue-router'
import HelloWorld from './components/HelloWorld.vue'
import AdminPage from './components/AdminPage.vue'
import AdminSettings from './components/AdminSettings.vue'

const routes = [
  { path: '/', component: HelloWorld },
  { path: '/admin', component: AdminPage },
  { path: '/admin-settings', component: AdminSettings }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
