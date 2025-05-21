<template>
  <div class="admin-root">
    <nav class="admin-navbar">
      <span class="navbar-title">Saloon Admin</span>
      <div class="navbar-links">
        <router-link to="/admin-settings" class="nav-link">Settings</router-link>
        <button @click="logout" class="logout-btn">Logout</button>
      </div>
    </nav>
    
    <div class="admin-dashboard full-width">
      <div class="calendar-section">
        <div v-if="loading" class="loading-indicator">Loading bookings...</div>
        <div v-else>
          <div v-if="bookings.length === 0" class="empty-calendar">No bookings found.</div>
          <BookingCalendar 
            v-else 
            :bookings="bookings"
            :initialOffset="calendarWeekOffset" 
            @booking-clicked="openEventModal" 
            @prev-week="handleWeekChange" 
            @next-week="handleWeekChange" 
          />
        </div>
      </div>
    </div>
    
    <div v-if="showEventModal" class="event-modal-overlay" @click.self="closeEventModal">
      <div class="event-modal">
        <h3>Edit Booking</h3>
        
        <div class="customer-info-section">
          <h4><i class="fas fa-user"></i> Customer Information</h4>
          
          <div class="form-field">
            <label>Name:</label>
            <input v-model="modalEvent.title" placeholder="Customer Name" />
          </div>
          
          <div class="form-field">
            <label>Contact Number:</label>
            <input type="tel" v-model="modalEvent.description" placeholder="Contact Number" />
          </div>
          
          <div class="form-field">
            <label>Email:</label>
            <input type="email" v-model="modalEvent.email" placeholder="Email Address" />
          </div>
        </div>
        
        <div class="appointment-details-section">
          <h4><i class="fas fa-calendar-alt"></i> Appointment Details</h4>
          
          <div class="form-field">
            <label>Date:</label>
            <input v-model="modalEvent.date" type="date" />
          </div>
          
          <div class="activities-section">
            <h4><i class="fas fa-list"></i> Services</h4>
            
            <div v-for="(act, idx) in modalEvent.activities" :key="idx" class="activity-edit-row">
              <div class="activity-main-info">
                <div class="activity-field">
                  <label>Service:</label>
                  <input v-model="act.activity" placeholder="Activity" />
                </div>
                
                <div class="activity-time">
                  <label>Time:</label>
                  <div class="time-inputs">
                    <input v-model="act.startHour" class="time-input" /> :
                    <input v-model="act.startMinute" class="time-input" /> -
                    <input v-model="act.endHour" class="time-input" /> :
                    <input v-model="act.endMinute" class="time-input" />
                  </div>
                </div>
              </div>
              
              <div class="barber-section">
                <label>Barber:</label>
                <div class="barber-select-container">
                  <select v-model="act.barber" @change="handleBarberChange(act)">
                    <option v-for="barber in availableBarbers" :key="barber.name" :value="barber.name">{{ barber.name }}</option>
                    <option v-if="act.barber && !availableBarbers.some(b => b.name === act.barber)" :value="act.barber">{{ act.barber }} (add new)</option>
                  </select>
                  <input 
                    v-if="act.barber && !availableBarbers.some(b => b.name === act.barber)" 
                    v-model="act.barber" 
                    placeholder="New barber name" 
                    class="new-barber-input"
                    @blur="addNewBarber(act.barber)" 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="modal-actions">
          <button @click="saveEventEdits" class="save-btn">
            <i class="fas fa-save"></i> Save
          </button>
          <button @click="deleteEvent(modalEvent.id)" class="delete-btn">
            <i class="fas fa-trash"></i> Delete
          </button>
          <button @click="closeEventModal" class="cancel-btn">
            <i class="fas fa-times"></i> Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore'
import { initializeApp } from 'firebase/app'
import { useRouter } from 'vue-router'
import firebaseConfig from '../firebaseConfig'
import BookingCalendar from './BookingCalendar.vue'

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const router = useRouter()

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

// Keep the calendarWeekOffset for other components to use
const calendarWeekOffset = ref(0)

let refreshInterval = null

function startAutoRefresh() {
  if (refreshInterval) clearInterval(refreshInterval)
  refreshInterval = setInterval(() => {
    fetchBookings()
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

onMounted(() => {
  fetchBookings()
  startAutoRefresh()
  loadBarbers()
})

function logout() {
  localStorage.removeItem('adminLoggedIn')
  router.push('/admin-login')
}

// Improved fetchBookings function to ensure consistent date format
async function fetchBookings() {
  loading.value = true;
  try {
    const querySnapshot = await getDocs(collection(db, 'events'));
    // Process each booking to ensure consistent date format
    bookings.value = querySnapshot.docs.map(doc => {
      const data = doc.data();
      
      // Keep date exactly as stored, without any transformation
      return { 
        id: doc.id, 
        ...data,
        // Ensure date is present with proper fallback
        date: data.date || ''
      };
    });
    
    console.log('Fetched bookings:', bookings.value.length, 'First booking date example:', bookings.value[0]?.date);
  } catch (error) {
    console.error('Error fetching bookings:', error);
  } finally {
    loading.value = false;
  }
}

// Fix the handleWeekChange function to properly update the offset
function handleWeekChange(newOffset) {
  console.log("Admin handling week change to:", newOffset);
  calendarWeekOffset.value = newOffset;
  fetchBookings();
}

// Add a watch to refresh bookings when week changes
watch(calendarWeekOffset, () => {
  fetchBookings();
});

// Handle booking details display
function openEventModal(event) {
  modalEvent.value = JSON.parse(JSON.stringify(event));
  console.log('Opening booking details:', modalEvent.value);
  showEventModal.value = true;
}

function closeEventModal() {
  showEventModal.value = false
  modalEvent.value = null
}

async function saveEventEdits() {
  if (!modalEvent.value) return;
  
  // Log the date before saving for debugging
  console.log('Saving booking with date:', modalEvent.value.date);
  
  const eventRef = doc(db, 'events', modalEvent.value.id);
  
  await updateDoc(eventRef, {
    title: modalEvent.value.title,
    description: modalEvent.value.description,
    email: modalEvent.value.email, 
    date: modalEvent.value.date, // Keep the date exactly as is
    activities: modalEvent.value.activities
  });
  
  await fetchBookings();
  closeEventModal();
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

// Removing fullscreen toggle functionality since calendar is now always full screen
// const isFullScreenCalendar = ref(false)
// function toggleFullScreen() {
//   isFullScreenCalendar.value = !isFullScreenCalendar.value
// }

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
  padding: 2rem;
  background: #f8f9fa;
}

.admin-login {
  background: var(--background-card);
  border-radius: 12px;
  padding: 3rem;
  width: 100%;
  max-width: 500px;  /* Increased from 400px */
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12);
  text-align: center;
  border: 1px solid var(--border-color);
  box-sizing: border-box;
}

.admin-login h2 {
  margin-top: 0;
  margin-bottom: 2.5rem;  /* Increased from 2rem */
  color: var(--text-heading);
  font-size: 2rem;  /* Increased from 1.75rem */
  position: relative;
  display: inline-block;
}

.admin-login h2:after {
  content: '';
  position: absolute;
  width: 60%;  /* Increased from 50% */
  height: 4px;  /* Increased from 3px */
  background: var(--primary-color);
  bottom: -12px;  /* Adjusted from -10px */
  left: 20%;
  border-radius: 4px;
}

.admin-login .form-group {
  margin-bottom: 2rem;  /* Increased from 1.5rem */
  text-align: left;
}

.admin-login label {
  display: block;
  margin-bottom: 0.75rem;  /* Increased from 0.5rem */
  font-weight: 500;
  color: var(--text-primary);
  font-size: 1.1rem;  /* Increased from default */
}

.admin-login input {
  width: 100%;
  padding: 1rem 1.25rem;  /* Increased from 0.75rem 1rem */
  border-radius: 8px;  /* Increased from 6px */
  border: 1px solid var(--border-color);
  background: var(--background-surface);
  color: var(--text-primary);
  font-size: 1.1rem;  /* Increased from 1rem */
  transition: all 0.2s ease;
  box-sizing: border-box;
  max-width: 100%;
}

.admin-login input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(231, 76, 60, 0.15);  /* Slightly more visible */
  outline: none;
}

.login-btn {
  background: var(--primary-color);
  color: white;
  border: none;
  width: 100%;
  padding: 1rem;  /* Increased from 0.85rem */
  border-radius: 8px;  /* Increased from 6px */
  font-size: 1.1rem;  /* Increased from 1rem */
  font-weight: 600;
  cursor: pointer;
  margin-top: 1.5rem;  /* Increased from 1rem */
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);  /* Increased from 0 4px 6px rgba(0, 0, 0, 0.1) */
}

.login-btn:hover {
  background: var(--primary-hover);
  transform: translateY(-3px);  /* Increased from -2px */
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);  /* Increased from 0 6px 12px rgba(0, 0, 0, 0.15) */
}

.login-btn:active {
  transform: translateY(0);
}

.error {
  color: var(--danger-color);
  margin-top: 1.5rem;  /* Increased from 1rem */
  text-align: center;
  font-size: 1rem;  /* Increased from 0.9rem */
  padding: 0.75rem;  /* Increased from 0.5rem */
  background-color: rgba(231, 76, 60, 0.1);
  border-radius: 6px;  /* Increased from 4px */
}

/* Updated admin dashboard styles - light theme */
.admin-dashboard {
  width: 100%;
  max-width: 100%;
  margin: 64px 0 0;
  padding: 0;
  background: #ffffff;
  border-radius: 0;
  box-shadow: none;
}

.admin-dashboard.full-width {
  max-width: 100%;
  width: 100%;
  margin: 4rem 0 0;
  padding: 0;
  background: transparent;
  border-radius: 0;
  box-shadow: none;
}

.calendar-section {
  height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
}

/* Remove calendar header controls since we're using full-screen mode */
.calendar-header-controls {
  display: none;
}

/* Loading indicator and empty calendar message styling - light theme */
.loading-indicator,
.empty-calendar {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 0;
  color: var(--text-muted);
  font-style: italic;
  height: calc(100vh - 64px);
  background: #ffffff;
}

.event-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.event-modal {
  background: var(--background-card);
  color: var(--text-primary);
  border-radius: 12px;
  padding: 2rem;
  width: 650px;
  max-width: 95vw;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.event-modal h3 {
  margin-top: 0;
  margin-bottom: 1.5rem;
  color: var(--primary-color);
  font-size: 1.5rem;
  position: relative;
  display: inline-block;
}

.event-modal h3:after {
  content: '';
  position: absolute;
  width: 50%;
  height: 3px;
  background: var(--primary-color);
  bottom: -8px;
  left: 25%;
  border-radius: 2px;
}

.customer-info-section,
.appointment-details-section,
.activities-section {
  background: var(--background-surface);
  border-radius: 8px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
  border: 1px solid var(--border-color);
}

.customer-info-section h4,
.appointment-details-section h4,
.activities-section h4 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0;
  margin-bottom: 1rem;
  color: var(--text-heading);
  font-size: 1.1rem;
}

.form-field {
  margin-bottom: 1rem;
}

.form-field label {
  display: block;
  font-weight: 500;
  margin-bottom: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.form-field input {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--background-card);
  color: var(--text-primary);
  font-size: 1rem;
  box-sizing: border-box;
}

.activity-edit-row {
  background: var(--background-card);
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1rem;
  border: 1px solid var(--border-color);
}

.activity-main-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.activity-time {
  display: flex;
  flex-direction: column;
}

.time-inputs {
  display: flex;
  align-items: center;
  gap: 4px;
}

.time-input {
  width: 40px;
  padding: 0.5rem;
  text-align: center;
  border-radius: 4px;
  border: 1px solid var(--border-color);
}

.barber-section {
  margin-top: 0.5rem;
}

.barber-select-container {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.barber-select-container select {
  flex-grow: 1;
  padding: 0.6rem;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  background: var(--background-card);
}

.new-barber-input {
  flex-basis: 150px;
  padding: 0.6rem;
  border-radius: 4px;
  border: 1px solid var(--primary-color);
  background: var(--background-card);
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 2rem;
  justify-content: flex-end;
}

.modal-actions button {
  padding: 0.75rem 1.25rem;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
}

.save-btn {
  background: var(--primary-color);
  color: white;
  border: none;
}

.save-btn:hover {
  background: var(--primary-hover);
  transform: translateY(-2px);
}

.delete-btn {
  background: var(--danger-color);
  color: white;
  border: none;
}

.delete-btn:hover {
  background: #d32f2f;
  transform: translateY(-2px);
}

.cancel-btn {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.cancel-btn:hover {
  background: var(--background-surface);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .activity-main-info {
    grid-template-columns: 1fr;
  }
  
  .modal-actions {
    flex-direction: column;
  }
  
  .modal-actions button {
    width: 100%;
    justify-content: center;
  }
}
</style>
