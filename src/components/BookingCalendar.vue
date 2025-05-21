<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps({
  bookings: {
    type: Array,
    default: () => []
  },
  showBarbers: {
    type: Boolean,
    default: true
  },
  initialOffset: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits(['booking-clicked', 'prev-week', 'next-week'])

// Calendar week offset
const calendarWeekOffset = ref(props.initialOffset || 0);

// Watch for changes to the initialOffset prop
watch(() => props.initialOffset, (newOffset) => {
  if (newOffset !== calendarWeekOffset.value) {
    calendarWeekOffset.value = newOffset;
  }
});

// Calculate the dates for the current week view
const weekDates = computed(() => {
  const today = new Date()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay() + (calendarWeekOffset.value * 7))
  
  const dates = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    dates.push(d)
  }
  return dates
})

// Weekday names
const weekDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Format date for display
const formatDate = (date) => {
  return `${date.getDate()}/${date.getMonth() + 1}`
}

// Get current formatted date range for the week display
const currentWeekDisplay = computed(() => {
  if (weekDates.value.length === 0) return ''
  
  const firstDay = weekDates.value[0]
  const lastDay = weekDates.value[6]
  
  const firstMonth = firstDay.toLocaleString('default', { month: 'long' })
  const lastMonth = lastDay.toLocaleString('default', { month: 'long' })
  
  const firstDate = firstDay.getDate()
  const lastDate = lastDay.getDate()
  const year = lastDay.getFullYear()
  
  if (firstMonth === lastMonth) {
    return `${firstMonth} ${firstDate} - ${lastDate}, ${year}`
  } else {
    return `${firstMonth} ${firstDate} - ${lastMonth} ${lastDate}, ${year}`
  }
})

// Generate time slots from 9:00 to 20:00 with 30-min intervals
const timeSlots = computed(() => {
  const slots = []
  for (let hour = 9; hour <= 20; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`)
    if (hour < 20) {
      slots.push(`${hour.toString().padStart(2, '0')}:30`)
    }
  }
  return slots
})

// Check if a booking is in a specific day and time slot
const getBookingsForSlot = (date, timeSlot) => {
  // Fix timezone issue properly by normalizing both dates the same way
  // Create a date string in YYYY-MM-DD format without timezone shifts
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  
  const [slotHour, slotMinute] = timeSlot.split(':').map(Number);
  
  return props.bookings.filter(booking => {
    if (!booking.date) return false;
    
    // Compare using normalized date format
    if (booking.date !== dateStr) return false;
    
    return booking.activities.some(act => {
      const startTime = parseInt(act.startHour) * 60 + parseInt(act.startMinute);
      const endTime = parseInt(act.endHour) * 60 + parseInt(act.endMinute);
      const slotTime = slotHour * 60 + slotMinute;
      const slotEndTime = slotTime + 30;
      
      return startTime < slotEndTime && endTime > slotTime;
    });
  });
}

// Get activity color based on activity type for visual distinction
const getActivityColor = (activityName, index = 0) => {
  const activityColors = {
    'Haircut': '#FF6F61',
    'Hair Coloring': '#D4AF37',
    'Facial': '#88B04B',
    'Manicure': '#92A8D1',
    'Pedicure': '#955251',
    'Massage': '#B565A7',
    'Styling': '#6B5B95',
    'Beard Trim': '#D8A499',
    'Spa Treatment': '#45B8AC',
    'Hair Treatment': '#EFC050'
  }
  
  if (activityColors[activityName]) {
    return activityColors[activityName]
  }
  
  // Fallback colors for any activity not in the list
  const fallbackColors = [
    '#FF6F61', '#88B04B', '#D4AF37', '#92A8D1', 
    '#955251', '#B565A7', '#6B5B95', '#D8A499'
  ]
  
  return fallbackColors[index % fallbackColors.length]
}

// Navigation handlers - enhanced with more robust implementation
function goToPrevWeek() {
  calendarWeekOffset.value--;
  console.log("Calendar going to previous week, new offset:", calendarWeekOffset.value);
  emit('prev-week', calendarWeekOffset.value);
}

function goToNextWeek() {
  calendarWeekOffset.value++;
  console.log("Calendar going to next week, new offset:", calendarWeekOffset.value);
  emit('next-week', calendarWeekOffset.value);
}

// Current time tracking for highlighting current slot
const currentTime = ref('')
function updateCurrentTime() {
  const now = new Date()
  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  currentTime.value = `${hours}:${minutes}`
}

// Check if a time slot is the current time
const isCurrentTimeSlot = (timeSlot) => {
  if (!currentTime.value) return false
  
  const [slotHour, slotMinute] = timeSlot.split(':').map(Number)
  const [currentHour, currentMinute] = currentTime.value.split(':').map(Number)
  
  const slotTime = slotHour * 60 + slotMinute
  const currentTimeValue = currentHour * 60 + currentMinute
  
  return currentTimeValue >= slotTime && currentTimeValue < (slotTime + 30)
}

// Initialize and update current time
onMounted(() => {
  updateCurrentTime()
  setInterval(updateCurrentTime, 60000) // Update every minute
})
</script>

<template>
  <div class="booking-calendar">
    <!-- Calendar Header with Navigation -->
    <div class="calendar-header">
      <button class="nav-button" @click="goToPrevWeek">
        <i class="fas fa-chevron-left"></i> Prev Week
      </button>
      <h3 class="week-title">{{ currentWeekDisplay }}</h3>
      <button class="nav-button" @click="goToNextWeek">
        Next Week <i class="fas fa-chevron-right"></i>
      </button>
    </div>
    
    <!-- Calendar Days Header -->
    <div class="calendar-days-header">
      <div class="time-cell-header"></div>
      <div 
        v-for="(date, index) in weekDates" 
        :key="index" 
        class="day-cell-header"
      >
        <div class="day-name">{{ weekDayNames[date.getDay()] }}</div>
        <div class="day-date">{{ formatDate(date) }}</div>
      </div>
    </div>
    
    <!-- Calendar Grid -->
    <div class="calendar-grid">
      <!-- Time Column -->
      <div class="time-column">
        <div
          v-for="timeSlot in timeSlots"
          :key="timeSlot"
          class="time-cell"
          :class="{ 'current-time': isCurrentTimeSlot(timeSlot) }"
        >
          {{ timeSlot }}
        </div>
      </div>
      
      <!-- Day Columns -->
      <div
        v-for="(date, dateIndex) in weekDates"
        :key="dateIndex"
        class="day-column"
      >
        <div
          v-for="(timeSlot, timeIndex) in timeSlots"
          :key="`${dateIndex}-${timeIndex}`"
          class="calendar-cell"
          :class="{
            'current-time': isCurrentTimeSlot(timeSlot),
            'has-bookings': getBookingsForSlot(date, timeSlot).length > 0,
          }"
        >
          <!-- Side-by-side bookings in the same slot -->
          <div 
            class="bookings-container"
            :class="{ 'multiple-bookings': getBookingsForSlot(date, timeSlot).length > 1 }"
          >
            <template v-if="getBookingsForSlot(date, timeSlot).length > 0">
              <div 
                v-for="(booking, bookingIndex) in getBookingsForSlot(date, timeSlot)" 
                :key="booking.id || bookingIndex"
                class="booking-card"
                :class="{ 'side-by-side': getBookingsForSlot(date, timeSlot).length > 1 }"
                :style="{
                  '--booking-width': `${100 / getBookingsForSlot(date, timeSlot).length}%`,
                  '--booking-left': `${(100 / getBookingsForSlot(date, timeSlot).length) * bookingIndex}%`,
                  'border-left-color': getActivityColor('', bookingIndex)
                }"
                @click="emit('booking-clicked', booking)"
              >
                <div class="booking-title">
                  <span class="title-text">{{ booking.title }}</span>
                </div>
                
                <div class="booking-activities">
                  <template v-if="getBookingsForSlot(date, timeSlot).length <= 2">
                    <div 
                      v-for="(activity, actIndex) in booking.activities.filter(act => {
                        const [slotHour, slotMinute] = timeSlot.split(':').map(Number);
                        const startTime = parseInt(act.startHour) * 60 + parseInt(act.startMinute);
                        const endTime = parseInt(act.endHour) * 60 + parseInt(act.endMinute);
                        const slotTime = slotHour * 60 + slotMinute;
                        const slotEndTime = slotTime + 30;
                        return startTime < slotEndTime && endTime > slotTime;
                      })"
                      :key="actIndex"
                      class="activity-tag"
                      :style="{ backgroundColor: getActivityColor(activity.activity, actIndex) }"
                    >
                      <span class="activity-name">{{ activity.activity }}</span>
                      <span v-if="showBarbers && activity.barber && getBookingsForSlot(date, timeSlot).length === 1" class="activity-barber">
                        <i class="fas fa-user"></i> {{ activity.barber }}
                      </span>
                    </div>
                  </template>
                  <div v-else class="activity-count">
                    {{ booking.activities.length }} activities
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.booking-calendar {
  width: 100%;
  background: #ffffff;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: fixed;
  top: 64px;
  left: 0;
  right: 0;
  bottom: 0;
  box-shadow: 0 0 15px rgba(0,0,0,0.05);
}

/* Calendar Header - Light theme styling */
.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1.5rem;
  background: #ffffff;
  border-bottom: 1px solid #dfe4ea;
}

.week-title {
  color: var(--text-heading);
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  text-align: center;
  flex-grow: 1;
}

/* Remove underline to match screenshot */
.week-title::after {
  display: none;
}

.nav-button {
  background: transparent;
  color: var(--primary-color);
  border: 1px solid var(--primary-color);
  border-radius: 4px;
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-button:hover {
  background-color: var(--primary-color);
  color: white;
}

/* Calendar Days Header */
.calendar-days-header {
  display: grid;
  grid-template-columns: 80px repeat(7, 1fr);
  background: #f8f9fa;
  border-bottom: 1px solid #dfe4ea;
}

.time-cell-header {
  border-right: 1px solid #dfe4ea;
}

.day-cell-header {
  padding: 0.5rem;
  text-align: center;
  border-right: 1px solid #dfe4ea;
}

.day-name {
  color: var(--primary-color);
  font-weight: 600;
  font-size: 1rem;
}

.day-date {
  color: var(--text-secondary);
  font-size: 0.85rem;
  margin-top: 0.25rem;
}

/* Calendar Grid */
.calendar-grid {
  display: grid;
  grid-template-columns: 80px repeat(7, 1fr);
  overflow-y: auto;
  flex-grow: 1;
  background: #ffffff;
}

.time-column {
  background: #f8f9fa;
  border-right: 1px solid #dfe4ea;
  position: sticky;
  left: 0;
  z-index: 1;
}

.time-cell {
  height: 60px; /* Match screenshot height */
  padding: 0.25rem 0.5rem;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  color: var(--text-muted);
  font-size: 0.85rem;
  border-bottom: 1px solid #dfe4ea;
  font-weight: 500;
}

.day-column {
  display: flex;
  flex-direction: column;
  border-right: 1px solid #dfe4ea;
}

.calendar-cell {
  height: 60px; /* Match screenshot height */
  border-bottom: 1px solid #dfe4ea;
  padding: 2px;
  position: relative;
  background: #ffffff;
  overflow: hidden;
}

.calendar-cell.has-bookings {
  background: #f8f9fa;
}

.calendar-cell.current-time {
  background: rgba(46, 204, 113, 0.08);
}

/* Bookings container */
.bookings-container {
  display: flex;
  width: 100%;
  height: 100%;
  position: relative;
}

.bookings-container.multiple-bookings {
  position: relative;
}

/* Booking Card - modified for side-by-side display */
.booking-card {
  background-color: rgba(231, 76, 60, 0.08);
  border-left: 3px solid var(--primary-color);
  border-radius: 4px;
  height: calc(100% - 4px);
  margin: 2px;
  padding: 4px 6px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  flex: 1;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

/* Side by side layout for multiple bookings */
.booking-card.side-by-side {
  position: absolute;
  width: var(--booking-width);
  left: var(--booking-left);
  margin: 2px 0;
  box-sizing: border-box;
  border-radius: 3px;
}

.booking-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.booking-title {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
  padding-bottom: 2px;
  border-bottom: 1px dashed rgba(0, 0, 0, 0.1);
}

.title-text {
  font-weight: 500;
  color: var(--text-heading);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  font-size: 0.85rem;
}

.booking-activities {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  max-height: calc(100% - 22px);
  overflow: hidden;
}

.activity-tag {
  display: flex;
  align-items: center;
  gap: 3px;
  border-radius: 3px;
  padding: 1px 4px;
  color: white;
  font-size: 0.7rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.activity-name {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 70px;
}

.activity-barber {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 0.65rem;
  opacity: 0.9;
}

.activity-count {
  font-size: 0.7rem;
  color: var(--text-muted);
  padding: 2px 0;
}

/* Light theme media queries */
@media (max-width: 768px) {
  .calendar-grid {
    grid-template-columns: 50px repeat(7, minmax(90px, 1fr));
  }
  
  .calendar-days-header {
    grid-template-columns: 50px repeat(7, minmax(90px, 1fr));
  }
  
  .time-cell {
    padding: 0.25rem;
    font-size: 0.7rem;
    justify-content: center;
  }
  
  .day-name {
    font-size: 0.8rem;
  }
  
  .day-date {
    font-size: 0.7rem;
  }
  
  .nav-button {
    padding: 0.35rem 0.7rem;
    font-size: 0.8rem;
  }
}
</style>
