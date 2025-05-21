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
const adminSettings = ref({ openTime: '09:00', closeTime: '20:00', activities: [
 
] })

async function fetchAdminSettings() {
  const docSnap = await getDocs(collection(db, 'settings'))
  const settingsDoc = docSnap.docs.find(d => d.id === 'saloon')
  if (settingsDoc) {
    adminSettings.value = settingsDoc.data()
    // Set currency from database if present
    if (settingsDoc.data().currency) {
      currency.value = settingsDoc.data().currency
    }
    // Set barbers from database if present
    if (settingsDoc.data().barbers) {
      barberOptions.value = [...settingsDoc.data().barbers]
    }
  }
}

// Use admin activities and open/close time in the form
watchEffect(() => {
  activityOptions.value = [...adminSettings.value.activities]
  // Always use barbers from adminSettings (Firestore)
  barberOptions.value = adminSettings.value.barbers ? [...adminSettings.value.barbers] : []
  // Update total price when activities or selection changes
  totalPrice.value = selectedActivities.value.reduce((sum, act) => {
    const found = activityOptions.value.find(opt => opt.name === act.activity)
    return sum + (found?.price || 0)
  }, 0)
})

// Helper to get available start times for the first activity
async function getAvailableStartTimes() {
  if (!eventDate.value) return [];
  // Fetch events for the selected date from Firestore
  const querySnapshot = await getDocs(collection(db, 'events'));
  const eventsOnDate = querySnapshot.docs
    .map(doc => doc.data())
    .filter(e => e.date === eventDate.value);
  // Build a set of occupied time slots (in minutes since 00:00)
  const occupied = new Set();
  eventsOnDate.forEach(event => {
    event.activities.forEach(act => {
      const start = parseInt(act.startHour) * 60 + parseInt(act.startMinute);
      const end = parseInt(act.endHour) * 60 + parseInt(act.endMinute);
      for (let t = start; t < end; t++) occupied.add(t);
    });
  });
  // Generate all possible 30-min slots from openTime to closeTime
  const slots = [];
  const duration = activityOptions.value.find(opt => opt.name === activitySelection.value)?.duration || 30;
  const [openHour, openMinute] = adminSettings.value.openTime.split(':').map(Number);
  const [closeHour, closeMinute] = adminSettings.value.closeTime.split(':').map(Number);
  let h = openHour, m = openMinute;
  while (h < closeHour || (h === closeHour && m < closeMinute)) {
    const t = h * 60 + m;
    // Check if this slot is free for the duration of the first activity
    let isFree = true;
    for (let d = 0; d < duration; d++) {
      if (occupied.has(t + d)) { isFree = false; break; }
    }
    if (isFree) slots.push({ hour: h.toString().padStart(2, '0'), minute: m.toString().padStart(2, '0') });
    m += 30;
    if (m >= 60) { h++; m = 0; }
  }
  // If no slots, return empty array
  return slots;
}

// Watch for eventDate and activitySelection changes and update available slots
watch([eventDate, activitySelection], async () => {
  availableSlots.value = await getAvailableStartTimes();
  if (availableSlots.value.length > 0) {
    // Always set the next available slot as the default
    const firstSlot = availableSlots.value[0];
    selectedStartTime.value = `${firstSlot.hour}:${firstSlot.minute}`;
    userStartHour.value = firstSlot.hour;
    userStartMinute.value = firstSlot.minute;
  } else {
    selectedStartTime.value = adminSettings.value.openTime;
    const [openHour, openMinute] = adminSettings.value.openTime.split(':');
    userStartHour.value = openHour;
    userStartMinute.value = openMinute;
  }
});

// Update selectedStartTime when availableSlots changes
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

function assignBarber(activity, startHour, startMinute, endHour, endMinute, date) {
  // Find all barbers who can do this activity
  const eligibleBarbers = barberOptions.value.filter(barber =>
    barber.activities.some(act => act.name === activity)
  )
  if (eligibleBarbers.length === 0) return null
  // Fetch all events for this date
  const eventsOnDate = localEvents.value.filter(e => e.date === date)
  // Build a map of barberName -> their occupied time slots
  const barberOccupied = {}
  for (const barber of eligibleBarbers) {
    barberOccupied[barber.name] = []
  }
  for (const event of eventsOnDate) {
    if (!event.activities) continue
    for (const act of event.activities) {
      if (barberOccupied[act.barber]) {
        const actStart = parseInt(act.startHour) * 60 + parseInt(act.startMinute)
        const actEnd = parseInt(act.endHour) * 60 + parseInt(act.endMinute)
        barberOccupied[act.barber].push([actStart, actEnd])
      }
    }
  }
  // Find a free barber
  const newStart = parseInt(startHour) * 60 + parseInt(startMinute)
  const newEnd = parseInt(endHour) * 60 + parseInt(endMinute)
  for (const barber of eligibleBarbers) {
    const slots = barberOccupied[barber.name]
    const overlap = slots.some(([s, e]) => newStart < e && newEnd > s)
    if (!overlap) return barber.name
  }
  return null // No available barber
}

// In addActivity, use the global price and assign a barber with the correct duration for the selected activity
function addActivity() {
  if (!activitySelection.value) {
    alert('Please select an activity.');
    return;
  }
  // Get the duration for the selected activity from the first eligible barber (all barbers for this activity should have a duration)
  const eligibleBarbers = barberOptions.value.filter(barber =>
    barber.activities.some(act => act.name === activitySelection.value)
  )
  if (eligibleBarbers.length === 0) {
    alert('No barber available for this activity.');
    return;
  }
  // Determine the earliest possible start time (after previous activity, or user-selected start time)
  let prevEndHour = userStartHour.value, prevEndMinute = userStartMinute.value;
  if (selectedActivities.value.length > 0) {
    const last = selectedActivities.value[selectedActivities.value.length - 1];
    prevEndHour = last.endHour;
    prevEndMinute = last.endMinute;
  }
  // Get close time
  const [closeHour, closeMinute] = adminSettings.value.closeTime.split(':').map(Number);
  // Try all eligible barbers and all possible start times (in 30-min increments)
  let found = false;
  let assignedBarber = null, assignedStartHour = null, assignedStartMinute = null, assignedEndHour = null, assignedEndMinute = null, duration = null;
  // Try each barber
  for (const barber of eligibleBarbers) {
    const barberAct = barber.activities.find(act => act.name === activitySelection.value);
    if (!barberAct) continue;
    duration = barberAct.duration;
    // Try all possible start times from prevEndHour:prevEndMinute to closing time
    let h = parseInt(prevEndHour), m = parseInt(prevEndMinute);
    while (h < closeHour || (h === closeHour && m <= closeMinute - duration)) {
      // Calculate end time
      const start = new Date(`2025-01-01T${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
      const end = new Date(start.getTime() + duration * 60000);
      const eHour = end.getHours().toString().padStart(2, '0');
      const eMinute = end.getMinutes().toString().padStart(2, '0');
      // Check if this barber is available in Firestore events
      const isBusyInEvents = localEvents.value.filter(e => e.date === eventDate.value).some(event =>
        event.activities.some(act => act.barber === barber.name && (
          (parseInt(act.startHour) * 60 + parseInt(act.startMinute)) < (end.getHours() * 60 + end.getMinutes()) &&
          (parseInt(act.endHour) * 60 + parseInt(act.endMinute)) > (h * 60 + m)
        ))
      );
      // Check if this barber is available in current session's selectedActivities
      const isBusyInSession = selectedActivities.value.some(act =>
        act.barber === barber.name &&
        ((parseInt(act.startHour) * 60 + parseInt(act.startMinute)) < (end.getHours() * 60 + end.getMinutes()) &&
         (parseInt(act.endHour) * 60 + parseInt(act.endMinute)) > (h * 60 + m))
      );
      if (!isBusyInEvents && !isBusyInSession) {
        assignedBarber = barber.name;
        assignedStartHour = h.toString().padStart(2, '0');
        assignedStartMinute = m.toString().padStart(2, '0');
        assignedEndHour = eHour;
        assignedEndMinute = eMinute;
        found = true;
        break;
      }
      // Increment by 30 minutes
      m += 30;
      if (m >= 60) { h++; m = 0; }
    }
    if (found) break;
  }
  if (!found) {
    alert('No available barber or time slot for this activity.');
    return;
  }
  selectedActivities.value.push({
    activity: activitySelection.value,
    startHour: assignedStartHour,
    startMinute: assignedStartMinute,
    endHour: assignedEndHour,
    endMinute: assignedEndMinute,
    barber: assignedBarber,
    duration: duration
  });
  activitySelection.value = '';
  // Update total price
  totalPrice.value = selectedActivities.value.reduce((sum, act) => {
    const found = activityOptions.value.find(opt => opt.name === act.activity);
    return sum + (found?.price || 0);
  }, 0);
}

function removeActivity(idx) {
  selectedActivities.value.splice(idx, 1)
  // Update total price
  totalPrice.value = selectedActivities.value.reduce((sum, act) => {
    const found = activityOptions.value.find(opt => opt.name === act.activity)
    return sum + (found?.price || 0)
  }, 0)
}

// Store events locally
const localEvents = ref([])

async function saveEventToFirebase() {
  if (!eventTitle.value || !eventDate.value || selectedActivities.value.length === 0) {
    alert('Please fill in all required fields and add at least one activity.');
    return;
  }
  await addDoc(collection(db, 'events'), {
    title: eventTitle.value,
    description: eventDescription.value,
    date: eventDate.value,
    activities: JSON.parse(JSON.stringify(selectedActivities.value)),
    createdAt: new Date().toISOString(),
  })
  eventTitle.value = ''
  eventDescription.value = ''
  eventDate.value = ''
  selectedActivities.value = []
  await fetchEventsFromFirebase()
}

async function fetchEventsFromFirebase() {
  const querySnapshot = await getDocs(collection(db, 'events'))
  localEvents.value = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

async function deleteEventFromFirebase(id) {
  await deleteDoc(doc(db, 'events', id))
  await fetchEventsFromFirebase()
}

const router = useRouter()

function goToSettings() {
  router.push('/admin')
}

onMounted(() => {
  fetchAdminSettings()
  fetchEventsFromFirebase()
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
</script>

<template>
  <div class="salon-booking-container">
    <form @submit.prevent="saveEventToFirebase" class="event-form">
      <div class="form-header">
        <h2>Book Your Appointment</h2>
        <div class="total-price">
          <i class="fas fa-tag"></i> Total: {{ currency }} {{ totalPrice }}
        </div>
      </div>
      
      <div class="form-content">
        <div class="form-group">
          <label for="event-title">
            <i class="fas fa-calendar-alt"></i> Appointment Title
          </label>
          <input 
            id="event-title" 
            v-model="eventTitle" 
            required 
            placeholder="e.g. Haircut Appointment" 
          />
        </div>
        
        <div class="form-group">
          <label for="event-description">
            <i class="fas fa-align-left"></i> Notes
          </label>
          <textarea 
            id="event-description" 
            v-model="eventDescription" 
            placeholder="Any special requests or instructions"
            rows="3"
          ></textarea>
        </div>
        
        <div class="date-time-container">
          <div class="form-group date-group">
            <label for="event-date">
              <i class="fas fa-calendar-day"></i> Date
            </label>
            <input id="event-date" type="date" v-model="eventDate" required />
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

/* Hide default calendar icon and use custom one */
input[type="date"]::-webkit-calendar-picker-indicator {
  filter: invert(1);
  opacity: 0.7;
}

/* Style for select dropdown */
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

@media (max-width: 576px) {
  .date-time-container {
    flex-direction: column;
    gap: 1rem;
  }
  
  .activity-selection {
    flex-direction: column;
  }
}
</style>
