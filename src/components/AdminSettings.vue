<template>
  <div class="admin-settings-root">
    <nav class="admin-navbar">
      <span class="navbar-title">Saloon Admin</span>
      <div class="navbar-links">
        <router-link to="/admin" class="nav-link">Dashboard</router-link>
        <router-link to="/admin-settings" class="nav-link">Settings</router-link>
      </div>
    </nav>
    <div class="admin-settings">
      <h3>Saloon Settings</h3>
      <form @submit.prevent="saveAdminSettings" class="settings-form">
        <div class="form-group">
          <label for="open-time">Open Time:</label>
          <input id="open-time" type="time" v-model="openTime" required />
        </div>
        
        <div class="form-group">
          <label for="close-time">Close Time:</label>
          <input id="close-time" type="time" v-model="closeTime" required />
        </div>
        
        <div class="form-group">
          <label for="currency-select">Preferred Currency:</label>
          <select id="currency-select" v-model="currency">
            <option v-for="opt in currencyOptions" :key="opt.code" :value="opt.code">
              {{ opt.code }} ({{ opt.symbol }})
            </option>
          </select>
        </div>
        
        <div class="section-heading">
          <h4>Activities and Price (Global):</h4>
          <div class="activities-settings">
            <div v-for="(act, idx) in adminActivities" :key="idx" class="activity-row">
              <input 
                v-model="act.name" 
                placeholder="Activity Name" 
                class="activity-name-input" 
              />
              <input 
                v-model.number="act.price" 
                type="number" 
                min="0" 
                class="activity-price-input" 
                placeholder="Price" 
              />
              <button 
                type="button" 
                @click="adminActivities.splice(idx,1)" 
                v-if="adminActivities.length > 1"
                class="remove-btn"
              >
                Remove
              </button>
            </div>
            <button type="button" @click="adminActivities.push({ name: '', price: 0 })" class="add-btn">
              Add Activity
            </button>
          </div>
        </div>
        
        <div class="section-heading">
          <h4>Barbers and Their Activities:</h4>
          <div class="barbers-settings">
            <div v-for="(barber, bIdx) in adminBarbers" :key="bIdx" class="barber-row">
              <div class="barber-header">
                <input 
                  v-model="barber.name" 
                  placeholder="Barber Name" 
                  class="barber-name-input" 
                />
                <button 
                  type="button" 
                  @click="adminBarbers.splice(bIdx,1)" 
                  class="remove-barber-btn"
                >
                  Remove Barber
                </button>
              </div>
              
              <div v-for="(act, aIdx) in barber.activities" :key="aIdx" class="barber-activity-row">
                <select v-model="act.name" class="activity-select">
                  <option value="" disabled>Select Activity</option>
                  <option v-for="opt in adminActivities" :key="opt.name" :value="opt.name">
                    {{ opt.name }}
                  </option>
                </select>
                <input 
                  v-model.number="act.duration" 
                  type="number" 
                  min="1" 
                  class="duration-input" 
                  placeholder="Duration (min)" 
                />
                <button 
                  type="button" 
                  @click="barber.activities.splice(aIdx,1)" 
                  v-if="barber.activities.length > 1"
                  class="remove-btn"
                >
                  Remove
                </button>
              </div>
              <button 
                type="button" 
                @click="barber.activities.push({ name: '', duration: 30 })" 
                class="add-activity-btn"
              >
                Add Activity
              </button>
            </div>
            <button 
              type="button" 
              @click="adminBarbers.push({ name: '', activities: [{ name: '', duration: 30 }] })" 
              class="add-btn"
            >
              Add Barber
            </button>
          </div>
        </div>
        
        <button type="submit" class="save-btn">Save Settings</button>
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
  width: 100%;
  background: var(--background-main);
  display: flex;
  flex-direction: column;
}

/* Navbar styles maintained from the previous update */
.admin-navbar {
  width: 100%;
  height: 64px;
  background: var(--background-card);
  color: var(--text-heading);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2rem;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  box-sizing: border-box;
}

.navbar-title {
  font-size: 1.5rem;
  font-weight: bold;
  letter-spacing: 0.5px;
  color: var(--primary-color);
}

.navbar-links {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-left: auto;
}

.nav-link {
  color: var(--text-primary);
  text-decoration: none;
  transition: color 0.2s;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  white-space: nowrap;
}

.nav-link:hover {
  color: var(--primary-color);
  background: rgba(255, 111, 97, 0.1);
}

/* Settings form styles - updated */
.admin-settings {
  background: var(--background-card);
  border-radius: 8px;
  padding: 2rem;
  margin: 5.5rem auto 2rem;
  color: var(--text-primary);
  box-shadow: var(--card-shadow);
  max-width: 800px;
  width: 100%;
  box-sizing: border-box;
}

.admin-settings h3 {
  color: var(--primary-color);
  margin-bottom: 1.5rem;
  text-align: center;
  font-size: 1.75rem;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--text-primary);
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 0.6rem 0.75rem;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--background-surface);
  color: var(--text-primary);
  font-size: 0.95rem;
}

/* Section headings */
.section-heading {
  margin-top: 1.5rem;
  margin-bottom: 1rem;
  border-top: 1px solid var(--border-color);
  padding-top: 1.5rem;
}

.section-heading h4 {
  color: var(--secondary-color);
  font-weight: 600;
  margin-bottom: 1rem;
  font-size: 1.1rem;
}

/* Activities section */
.activities-settings {
  margin-bottom: 1.5rem;
}

.activity-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.activity-name-input {
  flex: 2;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  background: var(--background-surface);
  color: var(--text-primary);
}

.activity-price-input {
  flex: 1;
  max-width: 80px;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  background: var(--background-surface);
  color: var(--text-primary);
}

/* Barbers section */
.barbers-settings {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.barber-row {
  background: var(--background-surface);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.barber-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.barber-name-input {
  flex: 2;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  background: var(--background-surface);
  color: var(--text-primary);
  max-width: 200px;
}

.barber-activity-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.activity-select {
  flex: 2;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  background: var(--background-surface);
  color: var(--text-primary);
  min-width: 120px;
}

.duration-input {
  flex: 1;
  max-width: 100px;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  background: var(--background-surface);
  color: var(--text-primary);
}

/* Buttons */
.add-btn, 
.save-btn {
  background: var(--primary-color);
  color: var(--text-heading);
  border: none;
  border-radius: 6px;
  padding: 0.75rem 1.25rem;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s;
  display: block;
  margin-top: 1rem;
  font-weight: 500;
}

.add-btn {
  width: fit-content;
}

.save-btn {
  margin: 2rem auto 0;
  padding: 0.8rem 2rem;
  font-size: 1rem;
  font-weight: 600;
  min-width: 200px;
}

.add-activity-btn {
  background: var(--secondary-color);
  color: var(--text-heading);
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  align-self: flex-start;
}

.remove-btn {
  background: var(--background-card);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.remove-barber-btn {
  background: var(--danger-color);
  color: var(--text-heading);
  border: none;
  border-radius: 4px;
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.add-btn:hover,
.save-btn:hover {
  background: var(--primary-hover);
  transform: translateY(-2px);
}

.add-activity-btn:hover {
  background: var(--secondary-hover);
  transform: translateY(-1px);
}

.remove-btn:hover {
  background: var(--border-color);
}

.remove-barber-btn:hover {
  opacity: 0.9;
}

/* Style for selects */
select {
  appearance: none;
  background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23E0E0E0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 14px;
  padding-right: 2rem;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .admin-settings {
    padding: 1.5rem;
    margin: 5rem 1rem 1.5rem;
  }
  
  .barber-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
  
  .barber-name-input {
    max-width: 100%;
  }
  
  .remove-barber-btn {
    align-self: flex-end;
  }
}

@media (max-width: 576px) {
  .admin-navbar {
    padding: 0 1rem;
  }
  
  .navbar-title {
    font-size: 1.2rem;
  }
  
  .navbar-links {
    gap: 0.5rem;
  }
  
  .nav-link {
    padding: 0.3rem 0.5rem;
    font-size: 0.85rem;
  }
  
  .activity-row, 
  .barber-activity-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .activity-name-input,
  .activity-price-input,
  .activity-select,
  .duration-input {
    width: 100%;
    max-width: 100%;
  }
  
  .remove-btn {
    align-self: flex-end;
  }
}
</style>
