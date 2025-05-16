import { createRouter, createWebHistory } from 'vue-router'
import HelloWorld from './components/HelloWorld.vue'
import AdminPage from './components/AdminPage.vue'

const routes = [
  { path: '/', component: HelloWorld },
  { path: '/admin', component: AdminPage }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
