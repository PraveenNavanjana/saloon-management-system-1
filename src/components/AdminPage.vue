<template>
  <div class="admin-root">
    <nav class="admin-navbar">
      <span class="navbar-title">Saloon Admin</span>
      <div class="navbar-links">
        <router-link v-if="isLoggedIn" to="/admin-settings" class="nav-link">Settings</router-link>
        <button v-if="isLoggedIn" @click="logout" class="logout-btn">Logout</button>
      </div>
    </nav>
    
    <div class="admin-login-container" v-if="!isLoggedIn">
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
      </div>
    </div>
    
    <div v-else class="admin-dashboard">
      <div class="calendar-section">
        <h3>All Bookings Calendar</h3>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <button @click="goToPrevWeek" style="background:#23293a; color:#fff; border:none; border-radius:4px; padding:0.5rem 1rem;">&lt; Prev Week</button>
          <span style="color:#90caf9; font-weight:600;">Week of {{ getCurrentWeekDates()[0].toLocaleDateString() }}</span>
          <button @click="goToNextWeek" style="background:#23293a; color:#fff; border:none; border-radius:4px; padding:0.5rem 1rem;">Next Week &gt;</button>
        </div>
        <div v-if="loading">Loading bookings...</div>
        <div v-else>
          <div v-if="bookings.length === 0" class="empty-calendar">No bookings found.</div>
          <div v-else class="google-calendar-week">
            <div class="calendar-header">
              <div class="calendar-cell time-header"></div>
              <div v-for="day in weekDays" :key="day" class="calendar-cell day-header">{{ day }}</div>
            </div>
            <div v-for="slot in slots" :key="slot" class="calendar-row">
              <div class="calendar-cell time-header" :class="{ 'current-time': slot === getCurrentTime().slice(0,5) }">
                {{ slot }}
                <span v-if="slot === getCurrentTime().slice(0,5)" class="current-time-indicator">&larr; Now</span>
              </div>
              <div v-for="day in weekDays" :key="day + '-' + slot" class="calendar-cell">
                <div v-for="event in getEventsForDayAndSlot(day, slot)" :key="event.id + '-' + slot" class="calendar-event-block" @click="openEventModal(event)">
                  <div class="event-title">{{ event.title }}</div>
                  <div class="event-description">{{ event.description }}</div>
                  <ul class="event-activities">
                    <li v-for="(act, idx) in event.activities" :key="idx">
                      <span class="activity-name">{{ act.activity }}</span>
                      <span class="activity-time">{{ act.startHour }}:{{ act.startMinute }} - {{ act.endHour }}:{{ act.endMinute }}</span>
                      <span v-if="act.barber" style="color:#42b983; margin-left:1rem;">Barber: {{ act.barber }}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-if="showEventModal" class="event-modal-overlay" @click.self="closeEventModal">
      <div class="event-modal">
        <h3>Edit Booking</h3>
        <label>Title:<input v-model="modalEvent.title" /></label>
        <label>Description:<textarea v-model="modalEvent.description"></textarea></label>
        <label>Date:<input v-model="modalEvent.date" type="date" /></label>
        <div v-for="(act, idx) in modalEvent.activities" :key="idx" class="modal-activity-edit">
          <input v-model="act.activity" placeholder="Activity" />
          <input v-model="act.startHour" style="width:40px;" />:<input v-model="act.startMinute" style="width:40px;" />
          -
          <input v-model="act.endHour" style="width:40px;" />:<input v-model="act.endMinute" style="width:40px;" />
          <select v-model="act.barber" style="margin-left:0.5rem;" @change="handleBarberChange(act)">
            <option v-for="barber in availableBarbers" :key="barber.name" :value="barber.name">{{ barber.name }}</option>
            <option v-if="act.barber && !availableBarbers.some(b => b.name === act.barber)" :value="act.barber">{{ act.barber }} (add new)</option>
          </select>
          <input v-if="act.barber && !availableBarbers.some(b => b.name === act.barber)" v-model="act.barber" placeholder="New barber name" style="margin-left:0.5rem; width:120px;" @blur="addNewBarber(act.barber)" />
        </div>
        <div class="modal-actions">
          <button @click="saveEventEdits">Save</button>
          <button @click="deleteEvent(modalEvent.id)" style="background:#c00;">Delete</button>
          <button @click="closeEventModal">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore'
import { initializeApp } from 'firebase/app'
import { useRouter } from 'vue-router'
import firebaseConfig from '../firebaseConfig'

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const router = useRouter()

const username = ref('')
const password = ref('')
const isLoggedIn = ref(false)
const loginError = ref('')
const bookings = ref([])
const loading = ref(false)
const showEventModal = ref(false)
const modalEvent = ref(null)

const openTime = ref('09:00')
const closeTime = ref('20:00')
const adminActivities = ref([
  { name: 'Haircut', duration: 30, price: 20 },
  { name: 'Hair Coloring', duration: 60, price: 50 },
  { name: 'Facial', duration: 45, price: 35 },
  { name: 'Manicure', duration: 40, price: 25 },
  { name: 'Pedicure', duration: 50, price: 30 },
  { name: 'Massage', duration: 60, price: 60 },
])

const adminBarbers = ref([])

async function loadBarbers() {
  // Try localStorage first
  const b = localStorage.getItem('saloonBarbers')
  if (b) adminBarbers.value = JSON.parse(b)
  // Try Firestore
  const settingsDoc = await getDocs(collection(db, 'settings'))
  const docSnap = settingsDoc.docs.find(d => d.id === 'saloon')
  if (docSnap && docSnap.data().barbers) {
    adminBarbers.value = docSnap.data().barbers
  }
  // Ensure all barbers have 'available' property
  for (const barber of adminBarbers.value) {
    if (typeof barber.available === 'undefined') barber.available = true
  }
}

const availableBarbers = computed(() => adminBarbers.value.filter(b => b.available))

const calendarWeekOffset = ref(0)

function getCurrentWeekDates() {
  const today = new Date()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay() + (calendarWeekOffset.value * 7))
  const weekDates = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    weekDates.push(d)
  }
  return weekDates
}

function goToPrevWeek() {
  calendarWeekOffset.value--
}
function goToNextWeek() {
  calendarWeekOffset.value++
}

let refreshInterval = null

function startAutoRefresh() {
  if (refreshInterval) clearInterval(refreshInterval)
  refreshInterval = setInterval(() => {
    if (isLoggedIn.value) fetchBookings()
  }, 300000) // 5 minutes
}

function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
}

async function saveAdminSettings() {
  localStorage.setItem('saloonOpenTime', openTime.value)
  localStorage.setItem('saloonCloseTime', closeTime.value)
  localStorage.setItem('saloonActivities', JSON.stringify(adminActivities.value))
  // Save to Firestore as well
  await setDoc(doc(db, 'settings', 'saloon'), {
    openTime: openTime.value,
    closeTime: closeTime.value,
    activities: JSON.parse(JSON.stringify(adminActivities.value))
  })
}

async function loadAdminSettings() {
  // Load from localStorage first
  const o = localStorage.getItem('saloonOpenTime')
  const c = localStorage.getItem('saloonCloseTime')
  const a = localStorage.getItem('saloonActivities')
  if (o) openTime.value = o
  if (c) closeTime.value = c
  if (a) adminActivities.value = JSON.parse(a)
  // Load from Firestore (overrides local)
  const settingsDoc = await getDocs(collection(db, 'settings'))
  const docSnap = settingsDoc.docs.find(d => d.id === 'saloon')
  if (docSnap) {
    const data = docSnap.data()
    openTime.value = data.openTime
    closeTime.value = data.closeTime
    // Ensure price is present for all activities
    adminActivities.value = data.activities.map(act => ({ ...act, price: act.price ?? 0 }))
  }
}

const ADMIN_USERNAME = 'admin'
const ADMIN_PASSWORD = 'admin123' // For demo only. Use env vars in production.

// Week days and hours for calendar
const weekDays = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
]

// 30-min slots for calendar (dynamic from openTime to closeTime)
function getSlots() {
  const [openHour, openMinute] = openTime.value.split(':').map(Number);
  const [closeHour, closeMinute] = closeTime.value.split(':').map(Number);
  const slots = [];
  let h = openHour, m = openMinute;
  while (h < closeHour || (h === closeHour && m < closeMinute)) {
    slots.push(h.toString().padStart(2, '0') + ':' + m.toString().padStart(2, '0'));
    m += 30;
    if (m >= 60) { h++; m = 0; }
  }
  return slots;
}
const slots = getSlots();

// Helper: get current time in HH:mm format
function getCurrentTime() {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, '0');
  const m = now.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

// Helper: get events for a given day and hour
function getEventsForDayAndHour(day, hour) {
  // Find the date for this week day
  const today = new Date()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay())
  const dayIdx = weekDays.indexOf(day)
  const date = new Date(startOfWeek)
  date.setDate(startOfWeek.getDate() + dayIdx)
  const dateStr = date.toISOString().slice(0, 10)
  // Return events for this date and hour
  return bookings.value.filter(event => {
    if (event.date !== dateStr) return false
    // Check if any activity overlaps with this hour
    return event.activities.some(act => {
      const actStart = parseInt(act.startHour)
      return actStart === parseInt(hour)
    })
  })
}

// Helper: get events for a given day and slot
function getEventsForDayAndSlot(day, slot) {
  // Use week offset for correct week
  const weekDates = getCurrentWeekDates()
  const dayIdx = weekDays.indexOf(day)
  const dateStr = weekDates[dayIdx].toISOString().slice(0, 10)
  const [slotHour, slotMinute] = slot.split(':');
  return bookings.value.filter(event => {
    if (event.date !== dateStr) return false;
    return event.activities.some(act => {
      const actStart = parseInt(act.startHour) * 60 + parseInt(act.startMinute);
      const actEnd = parseInt(act.endHour) * 60 + parseInt(act.endMinute);
      const slotStart = parseInt(slotHour) * 60 + parseInt(slotMinute);
      const slotEnd = slotStart + 30;
      return actStart < slotEnd && actEnd > slotStart;
    });
  });
}

onMounted(() => {
  if (localStorage.getItem('adminLoggedIn') === 'true') {
    isLoggedIn.value = true
    fetchBookings()
    startAutoRefresh()
  } else {
    loadAdminSettings()
  }
  loadBarbers()
})

function login() {
  if (username.value === ADMIN_USERNAME && password.value === ADMIN_PASSWORD) {
    isLoggedIn.value = true
    loginError.value = ''
    localStorage.setItem('adminLoggedIn', 'true')
    fetchBookings()
    startAutoRefresh()
  } else {
    loginError.value = 'Invalid username or password.'
  }
}

function logout() {
  isLoggedIn.value = false
  username.value = ''
  password.value = ''
  bookings.value = []
  localStorage.removeItem('adminLoggedIn')
  stopAutoRefresh()
  router.push('/')
}

async function fetchBookings() {
  loading.value = true
  const querySnapshot = await getDocs(collection(db, 'events'))
  bookings.value = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  loading.value = false
}

function openEventModal(event) {
  modalEvent.value = JSON.parse(JSON.stringify(event))
  showEventModal.value = true
}

function closeEventModal() {
  showEventModal.value = false
  modalEvent.value = null
}

async function saveEventEdits() {
  if (!modalEvent.value) return
  const eventRef = doc(db, 'events', modalEvent.value.id)
  await updateDoc(eventRef, {
    title: modalEvent.value.title,
    description: modalEvent.value.description,
    date: modalEvent.value.date,
    activities: modalEvent.value.activities
  })
  await fetchBookings()
  closeEventModal()
}

async function deleteEvent(id) {
  if (!confirm('Are you sure you want to delete this event?')) return
  await deleteDoc(doc(db, 'events', id))
  await fetchBookings()
  closeEventModal()
}

function handleBarberChange(act) {
  if (!availableBarbers.value.some(b => b.name === act.barber)) {
    console.log(`New barber selected: ${act.barber}`);
    // Additional logic can be added here if needed
  }
}

function addNewBarber(name) {
  if (!name || adminBarbers.value.some(b => b.name === name)) return;
  adminBarbers.value.push({ name, available: true });
  localStorage.setItem('saloonBarbers', JSON.stringify(adminBarbers.value));
}

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped>
.admin-root {
  min-height: 100vh;
  width: 100%;
  background: var(--background-main);
  display: flex;
  flex-direction: column;
  position: relative;
}

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

.logout-btn {
  background: transparent;
  border: 1px solid var(--primary-color);
  color: var(--primary-color);
  padding: 0.4rem 0.75rem;
  border-radius: 4px;
  font-size: 0.9rem;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s;
}

.logout-btn:hover {
  background: var(--primary-color);
  color: var(--text-heading);
}

.admin-login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 1rem;
}

.admin-login {
  background: var(--background-card);
  border-radius: 8px;
  padding: 2rem;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  text-align: center;
}

.admin-login h2 {
  margin-top: 0;
  margin-bottom: 1.5rem;
  color: var(--text-heading);
  font-size: 1.75rem;
}

.admin-login .form-group {
  margin-bottom: 1.25rem;
  text-align: left;
}

.admin-login label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--text-primary);
}

.admin-login input {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--background-surface);
  color: var(--text-primary);
  font-size: 1rem;
  transition: all 0.2s ease;
}

.admin-login input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(255, 111, 97, 0.2);
  outline: none;
}

.login-btn {
  background: var(--primary-color);
  color: var(--text-heading);
  border: none;
  width: 100%;
  padding: 0.75rem;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  margin-top: 0.5rem;
  transition: all 0.2s ease;
}

.login-btn:hover {
  background: var(--primary-hover);
  transform: translateY(-2px);
}

.error {
  color: var(--danger-color);
  margin-top: 1rem;
  text-align: center;
  font-size: 0.9rem;
}

/* Keep existing styles for admin dashboard */
.admin-dashboard {
  max-width: 1200px;
  margin: 4.5rem auto 0 auto;
  background: var(--background-card);
  border-radius: 8px;
  padding: 2rem;
  color: var(--text-primary);
  box-shadow: var(--card-shadow);
}

.calendar-section h3 {
  color: var(--text-heading);
  margin-bottom: 1.5rem;
}

.empty-calendar {
  color: var(--text-muted);
  font-style: italic;
  padding: 1rem 0;
}

.google-calendar-week {
  display: grid;
  grid-template-columns: 80px repeat(7, 1fr);
  border: 1px solid var(--border-color);
  background: var(--background-surface);
  border-radius: 8px;
  overflow-x: auto;
}

.calendar-cell {
  border-bottom: 1px solid var(--border-color);
  border-right: 1px solid var(--border-color);
  min-height: 48px;
  padding: 2px 4px;
  background: var(--background-surface);
}

.time-header {
  background: var(--background-card);
  color: var(--text-muted);
  font-weight: bold;
  text-align: right;
  border-right: 1px solid var(--border-color);
}

.day-header {
  background: var(--background-card);
  color: var(--primary-color);
  font-weight: bold;
  text-align: center;
  border-bottom: 2px solid var(--primary-color);
}

.calendar-event-block {
  background: var(--primary-color);
  color: var(--text-heading);
  border-radius: 4px;
  margin: 2px 0;
  padding: 2px 6px;
  font-size: 0.95em;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  transition: all 0.2s;
}

.calendar-event-block:hover {
  background: var(--primary-hover);
  transform: translateY(-2px);
}

.event-title {
  font-weight: bold;
}

.event-description {
  font-size: 0.9rem;
}

.event-activities {
  list-style: none;
  padding: 0;
  margin: 0;
}

.event-activities li {
  margin-bottom: 0.25rem;
}

.activity-name {
  font-weight: 500;
  color: var(--accent-color);
}

.activity-time {
  margin-left: 0.5rem;
  color: var(--text-secondary);
}

.event-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.event-modal {
  background: var(--background-card);
  color: var(--text-primary);
  border-radius: 8px;
  padding: 2rem;
  min-width: 350px;
  max-width: 95vw;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);
}

.event-modal h3 {
  margin-top: 0;
  color: var(--primary-color);
}

.event-modal label {
  display: block;
  margin: 1rem 0 0.5rem 0;
  color: var(--text-primary);
}

.event-modal input, .event-modal textarea {
  width: 100%;
  margin-bottom: 0.5rem;
  padding: 0.4rem;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  background: var(--background-surface);
  color: var(--text-primary);
  font-size: 1rem;
}

.modal-activity-edit {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.5rem;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
}

.modal-actions button {
  background: var(--primary-color);
  color: var(--text-heading);
  border: none;
  padding: 0.5rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}

.modal-actions button[style*='background:#c00'] {
  background: var(--danger-color) !important;
}

.current-time {
  background: var(--success-color) !important;
  color: var(--text-heading) !important;
  font-weight: bold;
  position: relative;
}

.current-time-indicator {
  color: var(--accent-color);
  font-size: 0.95em;
  margin-left: 0.5em;
}

/* Add responsive styles for smaller screens */
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
  
  .nav-link, .logout-btn {
    padding: 0.3rem 0.5rem;
    font-size: 0.85rem;
  }
}
</style>
