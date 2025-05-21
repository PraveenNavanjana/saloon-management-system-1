<template>
  <div class="admin-settings-root">
    <nav class="admin-navbar">
      <span class="navbar-title">Saloon Admin</span>
      <div class="navbar-links">
        <router-link to="/admin" class="nav-link">Dashboard</router-link>
        <router-link to="/admin-settings" class="nav-link">Settings</router-link>
      </div>
    </nav>
    <div class="admin-settings-container">
      <h2 class="page-title">Salon Management Settings</h2>
      
      <form @submit.prevent="saveAdminSettings" class="settings-grid">
        <!-- Business Hours Card -->
        <div class="settings-card">
          <div class="card-header">
            <h3><i class="far fa-clock"></i> Business Hours</h3>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label for="open-time">Opening Time:</label>
              <input id="open-time" type="time" v-model="openTime" required />
            </div>
            
            <div class="form-group">
              <label for="close-time">Closing Time:</label>
              <input id="close-time" type="time" v-model="closeTime" required />
            </div>
          </div>
        </div>
        
        <!-- Currency Settings Card -->
        <div class="settings-card">
          <div class="card-header">
            <h3><i class="fas fa-dollar-sign"></i> Currency Settings</h3>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label for="currency-select">Preferred Currency:</label>
              <select id="currency-select" v-model="currency">
                <option v-for="opt in currencyOptions" :key="opt.code" :value="opt.code">
                  {{ opt.code }} ({{ opt.symbol }})
                </option>
              </select>
            </div>
            <div class="currency-preview">
              <p>Preview: <span class="preview-currency">{{ currencySymbol }} 100.00</span></p>
            </div>
          </div>
        </div>
        
        <!-- Services & Prices Card -->
        <div class="settings-card wide-card">
          <div class="card-header">
            <h3><i class="fas fa-list-check"></i> Services & Prices</h3>
            <button type="button" @click="adminActivities.push({ name: '', price: 0 })" class="add-btn">
              <i class="fas fa-plus"></i> Add Service
            </button>
          </div>
          <div class="card-body">
            <div class="activity-grid">
              <div class="activity-header">
                <span>Service Name</span>
                <span>Price ({{ currencySymbol }})</span>
                <span></span>
              </div>
              <div v-for="(act, idx) in adminActivities" :key="idx" class="activity-row">
                <input 
                  v-model="act.name" 
                  placeholder="Service Name" 
                  class="activity-name-input" 
                />
                <input 
                  v-model.number="act.price" 
                  type="number" 
                  min="0" 
                  step="0.01"
                  class="activity-price-input" 
                  placeholder="Price" 
                />
                <button 
                  type="button" 
                  @click="adminActivities.splice(idx,1)" 
                  v-if="adminActivities.length > 1"
                  class="remove-btn"
                >
                  <i class="fas fa-trash-alt"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Staff Management Card -->
        <div class="settings-card wide-card">
          <div class="card-header">
            <h3><i class="fas fa-users"></i> Staff Management</h3>
            <button 
              type="button" 
              @click="adminBarbers.push({ name: '', activities: [{ name: '', duration: 30 }] })" 
              class="add-btn"
            >
              <i class="fas fa-user-plus"></i> Add Staff Member
            </button>
          </div>
          <div class="card-body">
            <div v-if="adminBarbers.length === 0" class="empty-state">
              No staff members added yet.
            </div>
            
            <div v-else class="barbers-grid">
              <div v-for="(barber, bIdx) in adminBarbers" :key="bIdx" class="barber-card">
                <div class="barber-header">
                  <div class="barber-name">
                    <input 
                      v-model="barber.name" 
                      placeholder="Staff Name" 
                      class="barber-name-input" 
                    />
                    <button 
                      type="button" 
                      @click="adminBarbers.splice(bIdx,1)" 
                      class="remove-barber-btn"
                    >
                      <i class="fas fa-trash-alt"></i>
                    </button>
                  </div>
                </div>
                
                <h4 class="services-title">Services Provided</h4>
                <div class="barber-services">
                  <div v-for="(act, aIdx) in barber.activities" :key="aIdx" class="service-item">
                    <div class="service-inputs">
                      <select v-model="act.name" class="activity-select">
                        <option value="" disabled>Select Service</option>
                        <option v-for="opt in adminActivities" :key="opt.name" :value="opt.name">
                          {{ opt.name }}
                        </option>
                      </select>
                      <div class="duration-container">
                        <input 
                          v-model.number="act.duration" 
                          type="number" 
                          min="1" 
                          class="duration-input" 
                          placeholder="Duration" 
                        />
                        <span class="duration-label">min</span>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      @click="barber.activities.splice(aIdx,1)" 
                      v-if="barber.activities.length > 1"
                      class="remove-service-btn"
                    >
                      <i class="fas fa-times"></i>
                    </button>
                  </div>
                  <button 
                    type="button" 
                    @click="barber.activities.push({ name: '', duration: 30 })" 
                    class="add-service-btn"
                  >
                    <i class="fas fa-plus-circle"></i> Add Service
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
      
      <!-- Fixed save button -->
      <div class="save-container">
        <button type="button" @click="saveAdminSettings" class="save-all-btn">
          <i class="fas fa-save"></i> Save All Settings
        </button>
      </div>
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
  
  try {
    await setDoc(doc(db, 'settings', 'saloon'), {
      openTime: openTime.value,
      closeTime: closeTime.value,
      activities: JSON.parse(JSON.stringify(adminActivities.value)),
      currency: currency.value,
      barbers: JSON.parse(JSON.stringify(adminBarbers.value))
    })
    
    // Show success message
    const successMsg = document.createElement('div')
    successMsg.className = 'save-success-message'
    successMsg.innerHTML = '<i class="fas fa-check-circle"></i> Settings saved successfully!'
    document.body.appendChild(successMsg)
    
    // Remove after 3 seconds
    setTimeout(() => {
      document.body.removeChild(successMsg)
    }, 3000)
  } catch (error) {
    console.error('Error saving settings:', error)
    alert('Error saving settings. Please try again.')
  }
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

/* New fullscreen settings container */
.admin-settings-container {
  width: 100%;
  padding: 2rem;
  margin-top: 64px;
  min-height: calc(100vh - 64px);
  box-sizing: border-box;
}

.page-title {
  color: var(--text-heading);
  font-size: 1.75rem;
  margin-bottom: 2rem;
  text-align: center;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 1.5rem;
  max-width: 1600px;
  margin: 0 auto;
}

.settings-card {
  background: var(--background-card);
  border-radius: 10px;
  box-shadow: var(--card-shadow);
  overflow: hidden;
  transition: all 0.3s ease;
  margin-bottom: 1rem;
  width: 100%;
  box-sizing: border-box;
}

.settings-card:hover {
  box-shadow: var(--card-hover-shadow);
  transform: translateY(-3px);
}

.wide-card {
  grid-column: 1 / -1;
}

.card-header {
  background: var(--background-surface);
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h3 {
  color: var(--text-heading);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.1rem;
}

.card-body {
  padding: 1.5rem;
  box-sizing: border-box; /* Ensure padding is included in width calculations */
}

/* Fix for form groups and inputs */
.form-group {
  margin-bottom: 1.5rem;
  width: 100%;
}

.form-group:last-child {
  margin-bottom: 0;
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
  max-width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--background-surface);
  color: var(--text-primary);
  font-size: 0.95rem;
  transition: all 0.2s;
  box-sizing: border-box; /* Critical fix for preventing overflow */
  margin: 0; /* Remove default margins */
}

/* Specific fix for the time inputs to match the screenshot */
input[type="time"] {
  display: block;
  width: 100%;
  margin-top: 8px;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: #ffffff;
  color: var(--text-primary);
  box-shadow: var(--card-shadow);
}

/* Currency preview */
.currency-preview {
  margin-top: 1rem;
  padding: 0.75rem;
  background: var(--background-surface);
  border-radius: 6px;
  text-align: center;
}

.preview-currency {
  font-weight: 600;
  color: var(--text-heading);
  font-size: 1.1rem;
}

/* Activity grid styles */
.activity-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.activity-header {
  display: grid;
  grid-template-columns: 1fr 120px 50px;
  gap: 1rem;
  font-weight: 600;
  color: var(--text-heading);
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-color);
}

.activity-row {
  display: grid;
  grid-template-columns: 1fr 120px 50px;
  gap: 1rem;
  align-items: center;
}

.activity-name-input {
  padding: 0.75rem 1rem;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--background-surface);
  color: var(--text-primary);
  width: 100%;
}

.activity-price-input {
  padding: 0.75rem 1rem;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--background-surface);
  color: var(--text-primary);
  width: 100%;
}

/* Staff management styles - fix for input overflow */
.barbers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.barber-card {
  background: var(--background-surface);
  border-radius: 8px;
  padding: 1.5rem;
  border: 1px solid var(--border-color);
  box-sizing: border-box;
  width: 100%;
  overflow: hidden; /* Prevent content from exceeding the container */
}

.barber-header {
  margin-bottom: 1rem;
}

.barber-name {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.barber-name-input {
  padding: 0.75rem 1rem;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--background-surface);
  color: var(--text-primary);
  flex-grow: 1;
  margin-right: 0.75rem;
  font-weight: 600;
  font-size: 1rem;
  width: calc(100% - 50px); /* Account for the delete button */
  box-sizing: border-box;
  max-width: 100%;
}

.services-title {
  margin-top: 1rem;
  margin-bottom: 0.75rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-weight: 500;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-color);
}

.barber-services {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.service-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  box-sizing: border-box;
  flex-wrap: wrap;
}

.service-inputs {
  display: flex;
  gap: 0.5rem;
  flex-grow: 1;
  width: calc(100% - 40px); /* Account for the remove button */
  box-sizing: border-box;
}

.activity-select {
  flex-grow: 1;
  flex-basis: 0;
  min-width: 0; /* Critical for preventing overflow */
  padding: 0.6rem 0.75rem;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--background-surface);
  color: var(--text-primary);
  box-sizing: border-box;
}

.duration-container {
  position: relative;
  width: 100px;
  min-width: 80px;
  flex-shrink: 0;
}

.duration-input {
  width: 100%;
  padding: 0.6rem 0.75rem;
  padding-right: 2.5rem;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--background-surface);
  color: var(--text-primary);
  box-sizing: border-box;
}

.duration-label {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-muted);
  font-style: italic;
  background: var(--background-surface);
  border-radius: 8px;
  border: 1px dashed var(--border-color);
}

/* Button styles */
.add-btn {
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 6px;
  padding: 0.6rem 1rem;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
}

.add-btn:hover {
  background: var(--primary-hover);
  transform: translateY(-1px);
}

.add-service-btn {
  background: var(--secondary-color);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.5rem;
  font-size: 0.8rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: max-content;
  margin-top: 0.5rem;
  transition: all 0.2s;
}

.add-service-btn:hover {
  background: var(--secondary-hover);
}

.remove-btn, .remove-service-btn {
  background: transparent;
  color: var(--danger-color);
  border: none;
  padding: 0.5rem;
  font-size: 0.9rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.remove-btn:hover, .remove-service-btn:hover {
  color: var(--danger-color);
  background: rgba(244, 67, 54, 0.1);
}

.remove-barber-btn {
  background: transparent;
  color: var(--danger-color);
  border: none;
  padding: 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.remove-barber-btn:hover {
  background: rgba(244, 67, 54, 0.1);
}

.save-container {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 10;
}

.save-all-btn {
  background: var(--success-color);
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  box-shadow: 0 4px 12px rgba(46, 204, 113, 0.25);
  transition: all 0.3s ease;
}

.save-all-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 16px rgba(46, 204, 113, 0.3);
}

.save-all-btn:active {
  transform: translateY(0);
}

/* Success message animation */
.save-success-message {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  background: var(--success-color);
  color: white;
  padding: 1rem 2rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: slideUp 0.3s ease-out, fadeOut 0.3s ease-out 2.7s forwards;
  z-index: 1000;
}

@keyframes slideUp {
  from {
    transform: translate(-50%, 50px);
    opacity: 0;
  }
  to {
    transform: translate(-50%, 0);
    opacity: 1;
  }
}

@keyframes fadeOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

/* Style for selects */
select {
  appearance: none;
  background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 1rem center;
  background-size: 14px;
  padding-right: 2.5rem;
}

/* Responsive styles */
@media (max-width: 768px) {
  .admin-settings-container {
    padding: 1rem;
  }
  
  .settings-grid {
    grid-template-columns: 1fr;
  }
  
  .card-body {
    padding: 1rem;
  }
  
  input[type="time"] {
    font-size: 0.9rem;
    padding: 0.6rem 0.8rem;
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
  
  .service-inputs {
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
  }
  
  .service-item {
    flex-wrap: wrap;
  }
  
  .duration-container {
    width: 100%;
  }
  
  .activity-select,
  .duration-input {
    width: 100%;
  }
  
  .remove-service-btn {
    margin-left: auto;
  }
}
</style>
