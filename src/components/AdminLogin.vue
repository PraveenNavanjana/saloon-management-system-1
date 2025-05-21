<template>
  <div class="admin-login-root">
    <div class="admin-login-container">
      <div class="admin-login">
        <h2>Admin Login</h2>
        <form @submit.prevent="login">
          <div class="form-group">
            <label for="admin-username">Username:</label>
            <input id="admin-username" v-model="username" required />
          </div>
          
          <div class="form-group">
            <label for="admin-password">Password:</label>
            <input id="admin-password" type="password" v-model="password" required />
          </div>
          
          <button type="submit" class="login-btn">Login</button>
          <div v-if="loginError" class="error">{{ loginError }}</div>
        </form>
        
        <div class="back-to-home">
          <router-link to="/" class="home-link">
            <i class="fas fa-arrow-left"></i> Back to homepage
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const username = ref('')
const password = ref('')
const loginError = ref('')

// For demo purposes - in production, these would be stored securely
const ADMIN_USERNAME = 'admin'
const ADMIN_PASSWORD = 'admin123'

function login() {
  if (username.value === ADMIN_USERNAME && password.value === ADMIN_PASSWORD) {
    // Set authentication token in localStorage
    localStorage.setItem('adminLoggedIn', 'true')
    
    // Redirect to admin dashboard
    router.push('/admin')
  } else {
    loginError.value = 'Invalid username or password'
  }
}
</script>

<style scoped>
.admin-login-root {
  min-height: 100vh;
  width: 100%;
  background: var(--background-main);
  display: flex;
  flex-direction: column;
  position: relative;
}

.admin-login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 2rem;
  background: #f8f9fa;
}

.admin-login {
  background: var(--background-card);
  border-radius: 12px;
  padding: 3rem;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12);
  text-align: center;
  border: 1px solid var(--border-color);
  box-sizing: border-box;
}

.admin-login h2 {
  margin-top: 0;
  margin-bottom: 2.5rem;
  color: var(--text-heading);
  font-size: 2rem;
  position: relative;
  display: inline-block;
}

.admin-login h2:after {
  content: '';
  position: absolute;
  width: 60%;
  height: 4px;
  background: var(--primary-color);
  bottom: -12px;
  left: 20%;
  border-radius: 4px;
}

.admin-login .form-group {
  margin-bottom: 2rem;
  text-align: left;
}

.admin-login label {
  display: block;
  margin-bottom: 0.75rem;
  font-weight: 500;
  color: var(--text-primary);
  font-size: 1.1rem;
}

.admin-login input {
  width: 100%;
  padding: 1rem 1.25rem;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--background-surface);
  color: var(--text-primary);
  font-size: 1.1rem;
  transition: all 0.2s ease;
  box-sizing: border-box;
  max-width: 100%;
}

.admin-login input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(231, 76, 60, 0.15);
  outline: none;
}

.login-btn {
  background: var(--primary-color);
  color: white;
  border: none;
  width: 100%;
  padding: 1rem;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  margin-top: 1.5rem;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.login-btn:hover {
  background: var(--primary-hover);
  transform: translateY(-3px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
}

.login-btn:active {
  transform: translateY(0);
}

.error {
  color: var(--danger-color);
  margin-top: 1.5rem;
  text-align: center;
  font-size: 1rem;
  padding: 0.75rem;
  background-color: rgba(231, 76, 60, 0.1);
  border-radius: 6px;
}

.back-to-home {
  margin-top: 2rem;
  text-align: center;
}

.home-link {
  color: var(--primary-color);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
  font-size: 0.95rem;
}

.home-link:hover {
  text-decoration: underline;
}
</style>
