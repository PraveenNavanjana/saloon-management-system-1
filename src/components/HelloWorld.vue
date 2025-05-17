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
  <form @submit.prevent="saveEventToFirebase" class="event-form" style="margin-top:2rem;max-width:400px;">
    <h2>Add Event to My Calendar</h2>

     <div style="font-size:1.1em; font-weight:600; color:#42b983; text-align:right; margin-bottom:1rem;">
      Total Price: {{ currency }} {{ totalPrice }}
    </div>
    <div>
      <label for="event-title">Event Title*:<br />
        <input id="event-title" v-model="eventTitle" required placeholder="e.g. Haircut Appointment" />
      </label>
    </div>
    <div>
      <label for="event-description">Event Description:<br />
        <textarea id="event-description" v-model="eventDescription" placeholder="e.g. Haircut with stylist Jane"></textarea>
      </label>
    </div>
    <div>
      <label for="event-date">Event Date*:<br />
        <input id="event-date" type="date" v-model="eventDate" required />
      </label>
    </div>
    <div v-if="selectedActivities.length === 0 && availableSlots.length > 0" style="margin-bottom:1rem;">
      <label for="start-time-select" style="display:block; margin-bottom:0.25rem;">Start Time*:</label>
      <select id="start-time-select" v-model="selectedStartTime" style="width:100%;">
        <option v-for="slot in availableSlots" :key="slot.hour + '-' + slot.minute" :value="slot.hour + ':' + slot.minute">
          {{ slot.hour }}:{{ slot.minute }}
        </option>
      </select>
    </div>
    <div style="border:1px solid #333; border-radius:6px; padding:1rem; margin-bottom:1rem; background:#181818;">
      <label for="activity-select">Activity*:<br /></label>
      <select id="activity-select" v-model="activitySelection" style="width:100%; padding:0.5rem; border-radius:4px; border:1px solid #ccc; font-size:1rem; margin-bottom:1rem; background:#23293a; color:#fff;">
        <option value="" disabled>Select Activity</option>
        <option v-for="opt in activityOptions" :key="opt.name" :value="opt.name" :disabled="selectedActivities.some(a => a.activity === opt.name)">
          {{ opt.name }} ({{ opt.duration }} min, {{ currency }}{{ opt.price || 0 }})
        </option>
      </select>
      <button type="button" @click="addActivity" :disabled="!activitySelection" style="margin-left:1rem;">Add Activity</button>
    </div>
    <div v-for="(act, idx) in selectedActivities" :key="idx" style="border:1px solid #333; border-radius:6px; padding:1rem; margin-bottom:1rem; background:#222;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem;">
        <span style="font-weight:600; flex:2;">{{ act.activity }}</span>
        <span style="color:#ffd54f; font-weight:500; flex:1; text-align:right;">{{ currency }}{{ (activityOptions.find(opt => opt.name === act.activity)?.price) || 0 }}</span>
        <span style="color:#90caf9; font-weight:500; flex:1; text-align:right;">{{ act.startHour }}:{{ act.startMinute }} - {{ act.endHour }}:{{ act.endMinute }}</span>
        <span style="color:#42b983; font-weight:500; flex:1; text-align:right;">Barber: {{ act.barber }}</span>
        <button type="button" @click="removeActivity(idx)" style="background:#c00; color:#fff; border:none; border-radius:4px; padding:0.25rem 0.75rem; cursor:pointer; flex:0 0 auto;">Remove</button>
      </div>
    </div>
   
    <button type="submit" style="margin-top:1rem; background:#1976d2;">Save to My Calendar</button>
  </form>
  
</template>

<style scoped>
.read-the-docs {
  color: #888;
}
.event-form {
  background: #000000;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}
.event-form h2 {
  margin-top: 0;
}
.event-form input,
.event-form textarea,
.event-form select {
  width: 100%;
  margin-top: 0.25rem;
  margin-bottom: 1rem;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
}
.event-form button {
  background: #42b983;
  color: #fff;
  border: none;
  padding: 0.5rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}
.event-form button:hover {
  background: #369870;
}
.custom-calendar {
  margin-top: 2.5rem;
  background: #181c24;
  border-radius: 10px;
  padding: 2rem;
  box-shadow: 0 4px 16px rgba(25, 118, 210, 0.08);
  color: #fff;
}
.custom-calendar h2 {
  margin-top: 0;
  color: #90caf9;
  letter-spacing: 1px;
}
.empty-calendar {
  color: #aaa;
  font-style: italic;
  padding: 1rem 0;
}
.calendar-event {
  background: #23293a;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  padding: 1rem 1.5rem;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.05);
}
.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}
.event-title {
  font-weight: bold;
  font-size: 1.1rem;
  color: #42b983;
}
.event-date {
  font-size: 0.95rem;
  color: #90caf9;
}
.event-description {
  color: #b0bec5;
  margin-bottom: 0.5rem;
}
.event-activities {
  list-style: none;
  padding: 0;
  margin: 0;
}
.event-activities li {
  margin-bottom: 0.25rem;
  color: #fff;
}
.activity-name {
  font-weight: 500;
  color: #ffd54f;
}
.activity-time {
  color: #90caf9;
  margin-left: 0.5rem;
}
.activity-summary-row {
  border: 1px solid #333;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1rem;
  background: #222;
}
.activity-summary-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}
.activity-summary-name {
  font-weight: 600;
}
.activity-summary-price {
  color: #ffd54f;
  font-weight: 500;
  min-width: 80px;
  text-align: right;
}
.activity-remove-btn {
  background: #c00;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 0.25rem 0.75rem;
  cursor: pointer;
}
.activity-summary-times {
  display: flex;
  gap: 2rem;
  align-items: center;
  margin-top: 0.5rem;
}
.activity-summary-label {
  font-weight: 600;
  display: inline-block;
  min-width: 80px;
}
</style>
