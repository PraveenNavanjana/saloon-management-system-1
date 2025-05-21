<script setup>
import { ref, watch, watchEffect, onMounted } from 'vue'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore'
import firebaseConfig from '../firebaseConfig'
import { useRouter } from 'vue-router'

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

defineProps({
  msg: String,
})

const count = ref(0)

// Google Calendar Event Form
const eventTitle = ref('')
const eventDescription = ref('')
const eventDate = ref('')
const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))
const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'))

const startHour = ref('')
const startMinute = ref('')
const endHour = ref('')
const endMinute = ref('')

// Activity options with default time periods (in minutes)
const activityOptions = ref([])
const barberOptions = ref([])

// Total price for selected activities
const totalPrice = ref(0)

// Selected activities array
const selectedActivities = ref([])

// Activity selection for the dropdown
const activitySelection = ref('')

// User-selected starting hour and minute for the first activity
const userStartHour = ref('09')
const userStartMinute = ref('00')

// Available slots for the selected date
const availableSlots = ref([])

// Selected start time
const selectedStartTime = ref('')

// Preferred currency type
const currency = ref('₹')

// Fetch admin settings (open/close time, activities) from Firestore
const adminSettings = ref({ openTime: '09:00', closeTime: '20:00', activities: [] })

async function fetchAdminSettings() {
  const docSnap = await getDocs(collection(db, 'settings'))
  const settingsDoc = docSnap.docs.find(d => d.id === 'saloon')
  if (settingsDoc) {
    adminSettings.value = settingsDoc.data()
    if (settingsDoc.data().currency) {
      currency.value = settingsDoc.data().currency
    }
    if (settingsDoc.data().barbers) {
      barberOptions.value = [...settingsDoc.data().barbers]
    }
  }
}

// Use admin activities and open/close time in the form
watchEffect(() => {
  activityOptions.value = [...adminSettings.value.activities]
  barberOptions.value = adminSettings.value.barbers ? [...adminSettings.value.barbers] : []
  totalPrice.value = selectedActivities.value.reduce((sum, act) => {
    const found = activityOptions.value.find(opt => opt.name === act.activity)
    return sum + (found?.price || 0)
  }, 0)
})

// Helper to get available start times for the first activity, considering barber availability
async function getAvailableStartTimes() {
  if (!eventDate.value) return []
  const querySnapshot = await getDocs(collection(db, 'events'))
  const eventsOnDate = querySnapshot.docs
    .map(doc => doc.data())
    .filter(e => e.date === eventDate.value)
  const occupied = new Set()
  eventsOnDate.forEach(event => {
    event.activities.forEach(act => {
      const start = parseInt(act.startHour) * 60 + parseInt(act.startMinute)
      const end = parseInt(act.endHour) * 60 + parseInt(act.endMinute)
      for (let t = start; t < end; t++) occupied.add(t)
    })
  })
  const slots = []
  const duration = activityOptions.value.find(opt => opt.name === activitySelection.value)?.duration || 30
  const [openHour, openMinute] = adminSettings.value.openTime.split(':').map(Number)
  const [closeHour, closeMinute] = adminSettings.value.closeTime.split(':').map(Number)
  let h = openHour, m = openMinute
  while (h < closeHour || (h === closeHour && m < closeMinute)) {
    const t = h * 60 + m
    // For this slot, check if ANY barber is available for the selected activity
    const eligibleBarbers = barberOptions.value.filter(barber =>
      barber.activities.some(act => act.name === activitySelection.value)
    )
    let barberAvailable = false
    for (const barber of eligibleBarbers) {
      const barberAct = barber.activities.find(act => act.name === activitySelection.value)
      if (!barberAct) continue
      // Check if this barber is free for the full duration at this slot
      const slotStart = t
      const slotEnd = t + duration
      // Check Firestore events
      const isBusyInEvents = eventsOnDate.some(event =>
        event.activities.some(act =>
          act.barber === barber.name &&
          (parseInt(act.startHour) * 60 + parseInt(act.startMinute)) < slotEnd &&
          (parseInt(act.endHour) * 60 + parseInt(act.endMinute)) > slotStart
        )
      )
      // Check current session's selectedActivities
      const isBusyInSession = selectedActivities.value.some(act =>
        act.barber === barber.name &&
        (parseInt(act.startHour) * 60 + parseInt(act.startMinute)) < slotEnd &&
        (parseInt(act.endHour) * 60 + parseInt(act.endMinute)) > slotStart
      )
      if (!isBusyInEvents && !isBusyInSession) {
        barberAvailable = true
        break
      }
    }
    if (barberAvailable) {
      slots.push({ hour: h.toString().padStart(2, '0'), minute: m.toString().padStart(2, '0') })
    }
    m += 30
    if (m >= 60) { h++; m = 0 }
  }
  return slots
}

// Watch for eventDate and activitySelection changes and update available slots
watch([eventDate, activitySelection], async () => {
  availableSlots.value = await getAvailableStartTimes()
  if (availableSlots.value.length > 0) {
    const firstSlot = availableSlots.value[0]
    selectedStartTime.value = `${firstSlot.hour}:${firstSlot.minute}`
    userStartHour.value = firstSlot.hour
    userStartMinute.value = firstSlot.minute
  } else {
    selectedStartTime.value = adminSettings.value.openTime
    const [openHour, openMinute] = adminSettings.value.openTime.split(':')
    userStartHour.value = openHour
    userStartMinute.value = openMinute
  }
})

// Watch availableSlots and update selectedStartTime
watch(availableSlots, (slots) => {
  if (slots.length > 0) {
    selectedStartTime.value = slots[0].hour + ':' + slots[0].minute
    userStartHour.value = slots[0].hour
    userStartMinute.value = slots[0].minute
  } else {
    selectedStartTime.value = ''
    const [openHour, openMinute] = adminSettings.value.openTime.split(':')
    userStartHour.value = openHour
    userStartMinute.value = openMinute
  }
})

// Watch selectedStartTime and update userStartHour/userStartMinute
watch(selectedStartTime, (val) => {
  if (val) {
    const [h, m] = val.split(':')
    userStartHour.value = h
    userStartMinute.value = m
  }
})

// Modified addActivity to check all eligible barbers
function addActivity() {
  if (!activitySelection.value) {
    alert('Please select an activity.')
    return
  }

  // Find all eligible barbers for the selected activity
  const eligibleBarbers = barberOptions.value.filter(barber =>
    barber.activities.some(act => act.name === activitySelection.value)
  )
  if (eligibleBarbers.length === 0) {
    alert('No barber available for this activity.')
    return
  }

  // Determine the earliest possible start time
  let prevEndHour = parseInt(userStartHour.value)
  let prevEndMinute = parseInt(userStartMinute.value)
  if (selectedActivities.value.length > 0) {
    const last = selectedActivities.value[selectedActivities.value.length - 1]
    prevEndHour = parseInt(last.endHour)
    prevEndMinute = parseInt(last.endMinute)
  }

  // Try each eligible barber for the same starting time
  let assignedBarber = null
  let assignedStartHour = prevEndHour.toString().padStart(2, '0')
  let assignedStartMinute = prevEndMinute.toString().padStart(2, '0')
  let assignedEndHour = null
  let assignedEndMinute = null
  let duration = null
  let found = false

  for (const barber of eligibleBarbers) {
    const barberAct = barber.activities.find(act => act.name === activitySelection.value)
    if (!barberAct) continue
    duration = barberAct.duration
    const start = new Date(`2025-01-01T${assignedStartHour}:${assignedStartMinute}`)
    const end = new Date(start.getTime() + duration * 60000)
    const eHour = end.getHours().toString().padStart(2, '0')
    const eMinute = end.getMinutes().toString().padStart(2, '0')
    // Check Firestore events for barber availability
    const isBusyInEvents = localEvents.value
      .filter(e => e.date === eventDate.value)
      .some(event =>
        event.activities.some(act =>
          act.barber === barber.name &&
          (
            (parseInt(act.startHour) * 60 + parseInt(act.startMinute)) < (end.getHours() * 60 + end.getMinutes()) &&
            (parseInt(act.endHour) * 60 + parseInt(act.endMinute)) > (parseInt(assignedStartHour) * 60 + parseInt(assignedStartMinute))
          )
        )
      )
    // Check current session's selectedActivities for barber availability
    const isBusyInSession = selectedActivities.value.some(act =>
      act.barber === barber.name &&
      (
        (parseInt(act.startHour) * 60 + parseInt(act.startMinute)) < (end.getHours() * 60 + end.getMinutes()) &&
        (parseInt(act.endHour) * 60 + parseInt(act.endMinute)) > (parseInt(assignedStartHour) * 60 + parseInt(assignedStartMinute))
      )
    )
    if (!isBusyInEvents && !isBusyInSession) {
      assignedBarber = barber.name
      assignedEndHour = eHour
      assignedEndMinute = eMinute
      found = true
      break
    }
  }

  if (!found) {
    alert('No available barber for this activity at the selected time slot.')
    return
  }

  // Add the activity with the assigned barber
  selectedActivities.value.push({
    activity: activitySelection.value,
    startHour: assignedStartHour,
    startMinute: assignedStartMinute,
    endHour: assignedEndHour,
    endMinute: assignedEndMinute,
    barber: assignedBarber,
    duration: duration
  })

  activitySelection.value = ''
  totalPrice.value = selectedActivities.value.reduce((sum, act) => {
    const found = activityOptions.value.find(opt => opt.name === act.activity)
    return sum + (found?.price || 0)
  }, 0)
}

function removeActivity(idx) {
  selectedActivities.value.splice(idx, 1)
  totalPrice.value = selectedActivities.value.reduce((sum, act) => {
    const found = activityOptions.value.find(opt => opt.name === act.activity)
    return sum + (found?.price || 0)
  }, 0)
}

// Store events locally
const localEvents = ref([])

// Add a new ref for the email field
const eventEmail = ref('')

// Add a new ref for tracking booking success state
const bookingSuccess = ref(false)

async function saveEventToFirebase() {
  if (!eventTitle.value || !eventDate.value || selectedActivities.value.length === 0) {
    alert('Please fill in your name, select a date, and choose at least one service.')
    return
  }
  
  try {
    // Fix timezone issue - ensure we get the date as selected by user without timezone adjustments
    // Create a date object and get YYYY-MM-DD without timezone offset
    const datePartsStr = eventDate.value.split('-');
    // Use UTC date to prevent timezone shifts
    const formattedDate = eventDate.value;
    
    // Create the booking object with new fields
    const bookingData = {
      title: eventTitle.value,
      description: eventDescription.value, // Now used for contact number
      email: eventEmail.value, // New field for email
      date: formattedDate,  // Ensure consistent date format
      activities: JSON.parse(JSON.stringify(selectedActivities.value)),
      createdAt: new Date().toISOString(),
    };
    
    console.log('Saving appointment with date:', formattedDate);
    
    // Add to Firestore
    await addDoc(collection(db, 'events'), bookingData);
    
    // Set booking success to true to show success message
    bookingSuccess.value = true;
    
    // Refresh local events
    await fetchEventsFromFirebase();
  } catch (error) {
    console.error('Error saving appointment:', error);
    alert('There was an error booking your appointment. Please try again.');
  }
}

// Add a new function to reset the form for another booking
function makeAnotherBooking() {
  // Reset form fields
  eventTitle.value = '';
  eventDescription.value = '';
  eventEmail.value = '';
  selectedActivities.value = [];
  
  // Set a default date (today)
  const today = new Date();
  eventDate.value = today.toISOString().split('T')[0];
  
  // Reset success state
  bookingSuccess.value = false;
}

// Function to ensure date format consistency when fetching events
async function fetchEventsFromFirebase() {
  const querySnapshot = await getDocs(collection(db, 'events'));
  localEvents.value = querySnapshot.docs.map(doc => {
    const data = doc.data();
    // Keep original date format without timezone adjustment
    let formattedDate = data.date;
    
    return { id: doc.id, ...data, date: formattedDate };
  });
}

// Watch for date selection and ensure consistent format
watch(eventDate, (newDate) => {
  if (newDate) {
    try {
      // Only format if it's not already in YYYY-MM-DD format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
        const input = new Date(newDate);
        if (!isNaN(input.getTime())) {
          // Format as YYYY-MM-DD without timezone adjustments
          const year = input.getFullYear();
          const month = (input.getMonth() + 1).toString().padStart(2, '0');
          const day = input.getDate().toString().padStart(2, '0');
          eventDate.value = `${year}-${month}-${day}`;
        }
      }
    } catch (e) {
      console.error("Invalid date selected:", e);
    }
  }
});

const router = useRouter()

function goToSettings() {
  router.push('/admin')
}

onMounted(() => {
  fetchAdminSettings()
  fetchEventsFromFirebase()
  // Set default date to today if no date is selected
  if (!eventDate.value) {
    const today = new Date();
    eventDate.value = today.toISOString().split('T')[0]; // YYYY-MM-DD format
  }
})

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

// Add this function to help with date picker focus
function focusDateInput(event) {
  // This helps ensure the date picker opens on some mobile browsers
  event.target.showPicker && event.target.showPicker();
}
</script>

<template>
  <div class="salon-booking-container">
    <!-- Success Message Panel -->
    <div v-if="bookingSuccess" class="booking-success-panel">
      <div class="success-icon">
        <i class="fas fa-check-circle"></i>
      </div>
      <h2>Your appointment has been booked successfully!</h2>
      <p>We look forward to seeing you on {{ eventDate }}.</p>
      <button @click="makeAnotherBooking" class="another-booking-btn">
        <i class="fas fa-calendar-plus"></i> Make Another Booking
      </button>
    </div>
    
    <!-- Booking Form - visible only when not showing success message -->
    <form v-else @submit.prevent="saveEventToFirebase" class="event-form">
      <div class="form-header">
        <h2>Book Your Appointment</h2>
        <div class="total-price">
          <i class="fas fa-tag"></i> Total: {{ currency }} {{ totalPrice }}
        </div>
      </div>
      
      <div class="form-content">
        <div class="form-group">
          <label for="event-title">
            <i class="fas fa-user"></i> Enter Name
          </label>
          <input 
            id="event-title" 
            v-model="eventTitle" 
            required 
            placeholder="Your full name" 
          />
        </div>
        
        <div class="form-group">
          <label for="event-email">
            <i class="fas fa-envelope"></i> Enter Email <span class="optional-label">(optional)</span>
          </label>
          <input 
            id="event-email" 
            v-model="eventEmail" 
            type="email"
            placeholder="youremail@example.com" 
          />
        </div>
        
        <div class="form-group">
          <label for="event-description">
            <i class="fas fa-phone"></i> Contact Number <span class="optional-label">(optional)</span>
          </label>
          <input 
            id="event-description" 
            v-model="eventDescription"
            type="tel" 
            placeholder="Your contact number"
          />
        </div>
        
        <div class="date-time-container">
          <div class="form-group date-group">
            <label for="event-date">
              <i class="fas fa-calendar-day"></i> Date
            </label>
            <!-- Fix the date input for better cross-browser compatibility -->
            <input 
              id="event-date" 
              type="date" 
              v-model="eventDate" 
              required 
              class="date-picker"
              @focus="focusDateInput"
            />
          </div>
          
          <div class="form-group time-group" v-if="selectedActivities.length === 0 && availableSlots.length > 0">
            <label for="start-time-select">
              <i class="fas fa-clock"></i> Start Time
            </label>
            <select id="start-time-select" v-model="selectedStartTime">
              <option v-for="slot in availableSlots" :key="slot.hour + '-' + slot.minute" :value="slot.hour + ':' + slot.minute">
                {{ slot.hour }}:{{ slot.minute }}
              </option>
            </select>
          </div>
        </div>
        
        <div class="activity-selection-section">
          <h3><i class="fas fa-list-check"></i> Services</h3>
          
          <div class="activity-selection">
            <label for="activity-select" class="visually-hidden">Select Service</label>
            <select id="activity-select" v-model="activitySelection">
              <option value="" disabled>Select Service</option>
              <option v-for="opt in activityOptions" :key="opt.name" :value="opt.name" :disabled="selectedActivities.some(a => a.activity === opt.name)">
                {{ opt.name }} ({{ opt.duration }} min, {{ currency }}{{ opt.price || 0 }})
              </option>
            </select>
            
            <button 
              type="button" 
              @click="addActivity" 
              :disabled="!activitySelection" 
              class="add-activity-btn"
            >
              <i class="fas fa-plus"></i> Add
            </button>
          </div>
        </div>
        
        <div class="selected-activities" v-if="selectedActivities.length > 0">
          <h3><i class="fas fa-check-circle"></i> Selected Services</h3>
          
          <div class="activities-list">
            <div v-for="(act, idx) in selectedActivities" :key="idx" class="activity-card">
              <div class="activity-header">
                <span class="activity-name">{{ act.activity }}</span>
                <span class="activity-price">{{ currency }}{{ (activityOptions.find(opt => opt.name === act.activity)?.price) || 0 }}</span>
              </div>
              
              <div class="activity-details">
                <div class="activity-detail">
                  <i class="fas fa-clock"></i>
                  <span>{{ act.startHour }}:{{ act.startMinute }} - {{ act.endHour }}:{{ act.endMinute }}</span>
                </div>
                
                <div class="activity-detail">
                  <i class="fas fa-user"></i>
                  <span>{{ act.barber }}</span>
                </div>
              </div>
              
              <button type="button" @click="removeActivity(idx)" class="activity-remove-btn">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </div>
        </div>
        
        <button type="submit" class="save-button" :disabled="selectedActivities.length === 0">
          <i class="fas fa-check"></i> Confirm Booking
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.salon-booking-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 1rem;
}

.event-form {
  background: var(--background-card);
  border-radius: 16px;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  padding-bottom: 1rem;
}

.form-header {
  padding: 1.5rem 1.5rem 0;
  margin-bottom: 1.5rem;
  text-align: center;
}

.form-header h2 {
  color: var(--text-heading);
  font-size: 1.75rem;
  margin-bottom: 0.75rem;
}

.form-content {
  padding: 0 1.5rem;
  box-sizing: border-box;
  width: 100%;
}

.total-price {
  display: inline-block;
  font-size: 1.1rem;
  font-weight: 500;
  color: var(--accent-color);
  background: rgba(212, 175, 55, 0.1);
  padding: 0.5rem 1rem;
  border-radius: 999px;
  margin-top: 0.5rem;
}

.form-group {
  margin-bottom: 1.25rem;
  width: 100%;
  box-sizing: border-box;
}

.form-group label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--text-primary);
  font-size: 0.9rem;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--background-surface);
  color: var(--text-primary);
  font-size: 0.95rem;
  transition: all 0.2s;
  box-sizing: border-box;
  max-width: 100%;
}

.form-group input::placeholder,
.form-group textarea::placeholder {
  color: var(--text-muted);
}

.date-time-container {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.date-group, .time-group {
  flex: 1;
  min-width: 0;
}

input[type="date"] {
  position: relative;
  padding: 0.75rem 1rem;
  color: var(--text-primary);
  background-color: var(--background-surface);
  cursor: pointer;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  width: 100%;
  box-sizing: border-box;
  font-family: inherit;
  font-size: 0.95rem;
}

/* Fix for Firefox */
input[type="date"]::-moz-calendar-picker-indicator {
  background: transparent;
  color: transparent;
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  cursor: pointer;
}

/* Fix for Webkit browsers */
input[type="date"]::-webkit-calendar-picker-indicator {
  background: transparent;
  color: transparent;
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  cursor: pointer;
}

select {
  appearance: none;
  background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23E0E0E0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 1rem center;
  background-size: 14px;
  padding-right: 2.5rem;
}

.activity-selection-section h3,
.selected-activities h3 {
  color: var(--text-heading);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.activity-selection {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.add-activity-btn {
  background: var(--primary-color);
  color: var(--text-heading);
}

.add-activity-btn:hover {
  background: var(--primary-hover);
}

.activity-card {
  background: var(--background-surface);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 1rem;
  margin-bottom: 1rem;
  transition: all 0.2s;
}

.activity-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.activity-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--divider-color);
}

.activity-name {
  font-weight: 600;
  color: var(--text-heading);
}

.activity-price {
  color: var(--accent-color);
  font-weight: 600;
}

.activity-details {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.activity-detail {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-secondary);
}

.activity-detail i {
  color: var(--secondary-color);
}

.activity-remove-btn {
  background: var(--danger-color);
  border-radius: 50%;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  position: absolute;
  top: -10px;
  right: -10px;
}

.save-button {
  width: calc(100% - 3rem);
  background: var(--primary-color);
  color: var(--text-heading);
  border: none;
  border-radius: 8px;
  padding: 1rem;
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin: 2rem auto 1rem;
}

.save-button:hover {
  background: var(--primary-hover);
  transform: translateY(-2px);
}

.save-button:disabled {
  background: var(--border-color);
  cursor: not-allowed;
  opacity: 0.7;
  transform: none;
}

/* Add styling for the optional label */
.optional-label {
  font-size: 0.8rem;
  opacity: 0.7;
  font-weight: 400;
  font-style: italic;
  margin-left: 4px;
}

/* Add new styles for the success panel */
.booking-success-panel {
  background: var(--background-card);
  border-radius: 16px;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  padding: 3rem 2rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.success-icon {
  font-size: 4rem;
  color: var(--success-color);
  margin-bottom: 1.5rem;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(0.95);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.8;
  }
  100% {
    transform: scale(0.95);
    opacity: 1;
  }
}

.booking-success-panel h2 {
  color: var(--text-heading);
  font-size: 1.75rem;
  margin-bottom: 1rem;
}

.booking-success-panel p {
  color: var(--text-secondary);
  margin-bottom: 2rem;
  font-size: 1.1rem;
}

.another-booking-btn {
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 1rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(231, 76, 60, 0.3);
}

.another-booking-btn:hover {
  background: var(--primary-hover);
  transform: translateY(-3px);
  box-shadow: 0 6px 16px rgba(231, 76, 60, 0.4);
}

.another-booking-btn:active {
  transform: translateY(-1px);
}

/* Add responsiveness for the success panel */
@media (max-width: 576px) {
  .booking-success-panel {
    padding: 2rem 1.5rem;
  }
  
  .success-icon {
    font-size: 3.5rem;
  }
  
  .booking-success-panel h2 {
    font-size: 1.5rem;
  }
}
</style>