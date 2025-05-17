<template>
  <div class="admin-settings-root">
    <nav class="admin-navbar">
      <span class="navbar-title">Saloon Admin</span>
      <router-link to="/admin" class="nav-link">Dashboard</router-link>
      <router-link to="/admin-settings" class="nav-link">Settings</router-link>
    </nav>
    <div class="admin-settings">
      <h3>Saloon Settings</h3>
      <form @submit.prevent="saveAdminSettings" class="settings-form">
        <label>Open Time:
          <input type="time" v-model="openTime" required />
        </label>
        <label>Close Time:
          <input type="time" v-model="closeTime" required />
        </label>
        <label for="currency-select">Preferred Currency:</label>
        <select id="currency-select" v-model="currency" style="margin-bottom:1rem;">
          <option v-for="opt in currencyOptions" :key="opt.code" :value="opt.code">
            {{ opt.code }} ({{ opt.symbol }})
          </option>
        </select>
        <div class="activities-settings">
          <span style="font-weight:600;">Activities and Price (Global):</span>
          <div v-for="(act, idx) in adminActivities" :key="idx" class="activity-row">
            <input v-model="act.name" placeholder="Activity Name" style="width: 120px;" />
            <input v-model.number="act.price" type="number" min="0" style="width: 60px;" placeholder="Price" />
            <button type="button" @click="adminActivities.splice(idx,1)" v-if="adminActivities.length > 1">Remove</button>
          </div>
          <button type="button" @click="adminActivities.push({ name: '', price: 0 })">Add Activity</button>
        </div>
        <div class="barbers-settings" style="margin-bottom:2rem;">
          <span style="font-weight:600;">Barbers and Their Activities:</span>
          <div v-for="(barber, bIdx) in adminBarbers" :key="bIdx" class="barber-row" style="margin-bottom:1rem; border:1px solid #333; border-radius:6px; padding:1rem; background:#23293a;">
            <input v-model="barber.name" placeholder="Barber Name" style="width: 140px; margin-bottom:0.5rem;" />
            <div v-for="(act, aIdx) in barber.activities" :key="aIdx" class="barber-activity-row" style="display:flex; gap:0.5rem; align-items:center; margin-bottom:0.5rem;">
              <select v-model="act.name" style="width: 120px;">
                <option value="" disabled>Select Activity</option>
                <option v-for="opt in adminActivities" :key="opt.name" :value="opt.name">
                  {{ opt.name }}
                </option>
              </select>
              <input v-model.number="act.duration" type="number" min="1" style="width: 60px;" placeholder="Duration (min)" />
              <button type="button" @click="barber.activities.splice(aIdx,1)" v-if="barber.activities.length > 1">Remove</button>
            </div>
            <button type="button" @click="barber.activities.push({ name: '', duration: 30 })">Add Activity</button>
            <button type="button" @click="adminBarbers.splice(bIdx,1)" style="margin-left:1rem; background:#c00; color:#fff;">Remove Barber</button>
          </div>
          <button type="button" @click="adminBarbers.push({ name: '', activities: [{ name: '', duration: 30 }] })">Add Barber</button>
        </div>
        <button type="submit" style="margin-top:1rem;">Save Settings</button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore'
import { initializeApp } from 'firebase/app'
import firebaseConfig from '../firebaseConfig'

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

const openTime = ref('09:00')
const closeTime = ref('20:00')
const currency = ref('INR')
const currencySymbol = ref('₹')
const currencyOptions = [
  { code: 'INR', symbol: '₹' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'AUD', symbol: 'A$' },
  { code: 'CAD', symbol: 'C$' },
  { code: 'JPY', symbol: '¥' },
  { code: 'CNY', symbol: '¥' },
  { code: 'RUB', symbol: '₽' },
  { code: 'BRL', symbol: 'R$' },
  { code: 'LKR', symbol: 'Rs' }
]

const adminActivities = ref([
  { name: 'Haircut', price: 20 },
  { name: 'Hair Coloring', price: 50 },
  { name: 'Facial', price: 40 },
  { name: 'Manicure', price: 30 },
  { name: 'Pedicure', price: 35 },
  { name: 'Massage', price: 60 },
])

const adminBarbers = ref([
  { name: 'John', activities: [
    { name: 'Haircut', duration: 30 },
    { name: 'Facial', duration: 45 }
  ] },
  { name: 'Jane', activities: [
    { name: 'Hair Coloring', duration: 60 },
    { name: 'Manicure', duration: 40 }
  ] }
])

watch(currency, (val) => {
  const found = currencyOptions.find(opt => opt.code === val)
  currencySymbol.value = found ? found.symbol : '₹'
})

async function saveAdminSettings() {
  localStorage.setItem('saloonOpenTime', openTime.value)
  localStorage.setItem('saloonCloseTime', closeTime.value)
  localStorage.setItem('saloonActivities', JSON.stringify(adminActivities.value))
  localStorage.setItem('saloonCurrency', currency.value)
  localStorage.setItem('saloonBarbers', JSON.stringify(adminBarbers.value))
  await setDoc(doc(db, 'settings', 'saloon'), {
    openTime: openTime.value,
    closeTime: closeTime.value,
    activities: JSON.parse(JSON.stringify(adminActivities.value)),
    currency: currency.value,
    barbers: JSON.parse(JSON.stringify(adminBarbers.value))
  })
  alert('Settings saved!')
}

async function loadAdminSettings() {
  const o = localStorage.getItem('saloonOpenTime')
  const c = localStorage.getItem('saloonCloseTime')
  const a = localStorage.getItem('saloonActivities')
  const b = localStorage.getItem('saloonBarbers')
  const cur = localStorage.getItem('saloonCurrency')
  if (o) openTime.value = o
  if (c) closeTime.value = c
  if (a) adminActivities.value = JSON.parse(a)
  if (b) adminBarbers.value = JSON.parse(b)
  if (cur) currency.value = cur
  const settingsDoc = await getDocs(collection(db, 'settings'))
  const docSnap = settingsDoc.docs.find(d => d.id === 'saloon')
  if (docSnap) {
    const data = docSnap.data()
    openTime.value = data.openTime
    closeTime.value = data.closeTime
    adminActivities.value = data.activities
    if (data.barbers) adminBarbers.value = data.barbers
    if (data.currency) currency.value = data.currency
  }
}

onMounted(() => {
  loadAdminSettings()
})
</script>

<style scoped>
.admin-settings-root {
  min-height: 100vh;
  width: 100vw;
  background: #181818;
  display: flex;
  flex-direction: column;
}
.admin-navbar {
  width: 1300px;
  max-width: 100%;
  height: 56px;
  background: #23293a;
  color: #90caf9;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2rem;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.08);
}
.navbar-title {
  font-size: 1.3rem;
  font-weight: bold;
  letter-spacing: 1px;
}
.nav-link {
  color: #90caf9;
  text-decoration: none;
  margin-right: 1rem;
  font-size: 1rem;
  font-weight: 500;
  transition: color 0.2s;
}
.nav-link:hover {
  color: #42b983;
}
.admin-settings {
  background: #23293a;
  border-radius: 8px;
  padding: 1.5rem 2rem;
  margin: 4.5rem auto 2rem auto;
  color: #fff;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.08);
  max-width: 600px;
}
.settings-form label {
  display: block;
  margin-bottom: 1rem;
  font-weight: 500;
}
.activities-settings {
  margin-bottom: 1rem;
}
.activity-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.5rem;
}
.barbers-settings {
  margin-bottom: 2rem;
}
.barber-row {
  margin-bottom: 1rem;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 1rem;
  background: #23293a;
}
.barber-activity-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.5rem;
}
.settings-form input[type='time'],
.settings-form input[type='number'],
.settings-form input[type='text'] {
  padding: 0.3rem 0.5rem;
  border-radius: 4px;
  border: 1px solid #ccc;
  font-size: 1rem;
}
.settings-form button[type='button'] {
  background: #c00;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 0.25rem 0.75rem;
  cursor: pointer;
  font-size: 0.95rem;
  margin-left: 0.5rem;
}
.settings-form button[type='submit'] {
  background: #1976d2;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
}
</style>
