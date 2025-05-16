<template>
  <div class="admin-root">
    <nav class="admin-navbar">
      <span class="navbar-title">Saloon Admin</span>
      <button v-if="isLoggedIn" @click="logout">Logout</button>
    </nav>
    <div class="admin-login" v-if="!isLoggedIn">
      <h2>Admin Login</h2>
      <form @submit.prevent="login">
        <label for="admin-username">Username:</label>
        <input id="admin-username" v-model="username" required />
        <label for="admin-password">Password:</label>
        <input id="admin-password" type="password" v-model="password" required />
        <button type="submit">Login</button>
        <div v-if="loginError" class="error">{{ loginError }}</div>
      </form>
    </div>
    <div v-else class="admin-dashboard">
      <div class="calendar-section">
        <h3>All Bookings Calendar</h3>
        <div v-if="loading">Loading bookings...</div>
        <div v-else>
          <div v-if="bookings.length === 0" class="empty-calendar">No bookings found.</div>
          <div v-else class="google-calendar-week">
            <div class="calendar-header">
              <div class="calendar-cell time-header"></div>
              <div v-for="day in weekDays" :key="day" class="calendar-cell day-header">{{ day }}</div>
            </div>
            <div v-for="slot in slots" :key="slot" class="calendar-row">
              <div class="calendar-cell time-header">{{ slot }}</div>
              <div v-for="day in weekDays" :key="day + '-' + slot" class="calendar-cell">
                <div v-for="event in getEventsForDayAndSlot(day, slot)" :key="event.id + '-' + slot" class="calendar-event-block" @click="openEventModal(event)">
                  <div class="event-title">{{ event.title }}</div>
                  <div class="event-description">{{ event.description }}</div>
                  <ul class="event-activities">
                    <li v-for="(act, idx) in event.activities" :key="idx">
                      <span class="activity-name">{{ act.activity }}</span>
                      <span class="activity-time">{{ act.startHour }}:{{ act.startMinute }} - {{ act.endHour }}:{{ act.endMinute }}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="admin-settings">
        <h3>Saloon Settings</h3>
        <form @submit.prevent="saveAdminSettings" class="settings-form">
          <label>Open Time:
            <input type="time" v-model="openTime" required />
          </label>
          <label>Close Time:
            <input type="time" v-model="closeTime" required />
          </label>
          <div class="activities-settings">
            <label>Activities &amp; Duration (minutes):</label>
            <div v-for="(act, idx) in adminActivities" :key="idx" class="activity-row">
              <input v-model="act.name" placeholder="Activity Name" style="width: 140px;" />
              <input v-model.number="act.duration" type="number" min="1" style="width: 80px;" />
              <button type="button" @click="adminActivities.splice(idx,1)" v-if="adminActivities.length > 1">Remove</button>
            </div>
            <button type="button" @click="adminActivities.push({ name: '', duration: 30 })">Add Activity</button>
          </div>
          <button type="submit" style="margin-top:1rem;">Save Settings</button>
        </form>
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
import { ref, onMounted } from 'vue'
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore'
import { initializeApp } from 'firebase/app'
import firebaseConfig from '../firebaseConfig'

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

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
  { name: 'Haircut', duration: 30 },
  { name: 'Hair Coloring', duration: 60 },
  { name: 'Facial', duration: 45 },
  { name: 'Manicure', duration: 40 },
  { name: 'Pedicure', duration: 50 },
  { name: 'Massage', duration: 60 },
])

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
    adminActivities.value = data.activities
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
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const dayIdx = weekDays.indexOf(day);
  const date = new Date(startOfWeek);
  date.setDate(startOfWeek.getDate() + dayIdx);
  const dateStr = date.toISOString().slice(0, 10);
  const [slotHour, slotMinute] = slot.split(':');
  // Return events for this date and slot
  return bookings.value.filter(event => {
    if (event.date !== dateStr) return false;
    // Check if any activity overlaps with this slot
    return event.activities.some(act => {
      const actStart = parseInt(act.startHour) * 60 + parseInt(act.startMinute);
      const actEnd = parseInt(act.endHour) * 60 + parseInt(act.endMinute);
      const slotStart = parseInt(slotHour) * 60 + parseInt(slotMinute);
      const slotEnd = slotStart + 30;
      // Overlap if activity starts before slot ends and ends after slot starts
      return actStart < slotEnd && actEnd > slotStart;
    });
  });
}

function login() {
  if (username.value === ADMIN_USERNAME && password.value === ADMIN_PASSWORD) {
    isLoggedIn.value = true
    loginError.value = ''
    fetchBookings()
  } else {
    loginError.value = 'Invalid username or password.'
  }
}

function logout() {
  isLoggedIn.value = false
  username.value = ''
  password.value = ''
  bookings.value = []
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

onMounted(() => {
  loadAdminSettings()
  if (isLoggedIn.value) fetchBookings()
})
</script>

<style scoped>
.admin-root {
  min-height: 100vh;
  width: 100vw;
  background: #181818;
  display: flex;
  flex-direction: column;
}

.admin-navbar {
  width: 1500px;
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

.admin-login, .admin-dashboard {
  max-width: 1200px;
  margin: 4.5rem auto 0 auto;
  background: #181818;
  border-radius: 8px;
  padding: 2rem;
  color: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.admin-login label, .admin-dashboard label {
  display: block;
  margin-top: 1rem;
}

.admin-login input {
  width: 100%;
  padding: 0.5rem;
  margin-top: 0.25rem;
  border-radius: 4px;
  border: 1px solid #ccc;
  margin-bottom: 1rem;
}

.admin-login button {
  background: #1976d2;
  color: #fff;
  border: none;
  padding: 0.5rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

.admin-login .error {
  color: #ff5252;
  margin-top: 0.5rem;
}

.calendar-section {
  margin-top: 2rem;
}

.empty-calendar {
  color: #aaa;
  font-style: italic;
  padding: 1rem 0;
}

.google-calendar-week {
  display: grid;
  grid-template-columns: 80px repeat(7, 1fr);
  border: 1px solid #333;
  background: #222;
  border-radius: 8px;
  overflow-x: auto;
}

.calendar-header {
  display: contents;
}

.calendar-row {
  display: contents;
}

.calendar-cell {
  border-bottom: 1px solid #333;
  border-right: 1px solid #333;
  min-height: 48px;
  padding: 2px 4px;
  background: #23293a;
}

.time-header {
  background: #181818;
  color: #90caf9;
  font-weight: bold;
  text-align: right;
  border-right: 1px solid #333;
}

.day-header {
  background: #181818;
  color: #90caf9;
  font-weight: bold;
  text-align: center;
  border-bottom: 2px solid #42b983;
}

.calendar-event-block {
  background: #42b983;
  color: #fff;
  border-radius: 4px;
  margin: 2px 0;
  padding: 2px 6px;
  font-size: 0.95em;
  box-shadow: 0 1px 4px rgba(25, 118, 210, 0.08);
  cursor: pointer;
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
}

.activity-time {
  margin-left: 0.5rem;
}

.event-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.event-modal {
  background: #23293a;
  color: #fff;
  border-radius: 8px;
  padding: 2rem;
  min-width: 350px;
  max-width: 95vw;
  box-shadow: 0 4px 24px rgba(0,0,0,0.25);
}

.event-modal h3 {
  margin-top: 0;
  color: #42b983;
}

.event-modal label {
  display: block;
  margin: 1rem 0 0.5rem 0;
}

.event-modal input, .event-modal textarea {
  width: 100%;
  margin-bottom: 0.5rem;
  padding: 0.4rem;
  border-radius: 4px;
  border: 1px solid #ccc;
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
  background: #1976d2;
  color: #fff;
  border: none;
  padding: 0.5rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}

.modal-actions button[style*='background:#c00'] {
  background: #c00 !important;
}

.admin-settings {
  background: #23293a;
  border-radius: 8px;
  padding: 1.5rem 2rem;
  margin-bottom: 2rem;
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
