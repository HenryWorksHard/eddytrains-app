# Workout Logging System Audit
> Generated: 2026-02-25

## Executive Summary

The workout logging system has a solid foundation but suffers from **state confusion** between "previous data" and "currently logged data". This causes the UI to show misleading feedback (green checkmarks before logging) and makes it unclear what data is saved.

---

## Current Architecture

### Database Tables

```
┌─────────────────────┐     ┌─────────────────────┐
│   workout_logs      │     │     set_logs        │
├─────────────────────┤     ├─────────────────────┤
│ id (PK)             │────▶│ workout_log_id (FK) │
│ client_id           │     │ exercise_id (FK)    │
│ workout_id          │     │ set_number          │
│ completed_at        │     │ weight_kg           │
│ scheduled_date      │     │ reps_completed      │
│ notes               │     │ swapped_exercise_name│
│ rating              │     └─────────────────────┘
│ trainer_id          │
└─────────────────────┘

┌─────────────────────┐
│ workout_completions │  (For streaks/calendar)
├─────────────────────┤
│ client_id           │
│ workout_id          │
│ scheduled_date      │
│ completed_at        │
│ workout_log_id (FK) │
└─────────────────────┘
```

### Data Flow

```
CLIENT LOGS A SET:
ExerciseCard.handleWheelPickerConfirm()
    ↓
WorkoutClient.handleLogUpdate()
    ↓
setLogs state (Map<string, SetLog>)
    ↓ (1.5s debounce)
saveWorkoutLogs()
    ↓
1. Create/find workout_log
2. Upsert set_logs

LOADING PREVIOUS DATA:
loadPreviousLogs()
    ↓
Query workout_logs (most recent for this workout_id)
    ↓
Query set_logs for that workout_log
    ↓
setPreviousLogs state (Map<exerciseId, SetLog[]>)
    ↓
Passed to ExerciseCard as `previousLogs` prop
```

---

## 🔴 Critical Issues

### Issue 1: State Confusion (Root Cause of UI Bug)

**Problem:** The system conflates three distinct states:
1. **Empty** - Never logged this exercise
2. **Pre-filled** - Showing last session's values as reference
3. **Logged** - User confirmed values this session

**Current Code:**
```typescript
// ExerciseCard.tsx
const isLogged = log?.reps_completed !== null  // Only checks localLogs

// But displayWeight shows previousLogs values:
const displayWeight = log?.weight_kg ?? prevLog?.weight_kg ?? calculatedWeight
```

**Result:** Users see pre-filled values but can't tell if they're saved.

### Issue 2: Previous Logs Include Today

**Problem:** `loadPreviousLogs()` queries the most recent workout_log with no date filter, so if user started logging today, those partial logs show as "previous".

```typescript
// Loads ANY recent workout, including today's partial session
const { data: recentWorkoutLog } = await supabase
  .from('workout_logs')
  .eq('workout_id', workoutId)
  .order('completed_at', { ascending: false })
  .limit(1)
```

### Issue 3: No Session Tracking

**Problem:** No way to distinguish:
- "I opened workout but haven't started"
- "I logged 2 of 4 sets and left"
- "I completed and saved the workout"

---

## 🟡 Secondary Issues

### Issue 4: Unique Constraint Missing
The code falls back to delete+insert when upsert fails:
```typescript
const { error: setError } = await supabase
  .from('set_logs')
  .upsert(logsToSave, { onConflict: 'workout_log_id,exercise_id,set_number' })
```
Needs constraint: `UNIQUE(workout_log_id, exercise_id, set_number)`

### Issue 5: Race Condition on Page Unload
```typescript
// beforeunload tries to save but page may close before complete
window.addEventListener('beforeunload', (e) => {
  if (pendingLogsRef.current.size > 0) {
    saveWorkoutLogs()  // Async, may not complete!
  }
})
```

### Issue 6: Trainer App Doesn't Show All Sets
Coach view only shows logged sets, not all planned sets with empty values.

---

## 📊 Recommended Schema Changes

### Add Session Status to workout_logs
```sql
ALTER TABLE workout_logs 
ADD COLUMN status TEXT DEFAULT 'in_progress' 
CHECK (status IN ('in_progress', 'completed', 'abandoned'));

ALTER TABLE workout_logs
ADD COLUMN started_at TIMESTAMPTZ DEFAULT NOW();
```

### Add Unique Constraint to set_logs
```sql
ALTER TABLE set_logs
ADD CONSTRAINT set_logs_unique_entry 
UNIQUE (workout_log_id, exercise_id, set_number);
```

### Add Index for Performance
```sql
CREATE INDEX idx_workout_logs_client_workout_date 
ON workout_logs(client_id, workout_id, scheduled_date DESC);

CREATE INDEX idx_set_logs_workout_log 
ON set_logs(workout_log_id);
```

---

## 🛠 Code Fixes (Priority Order)

### Fix 1: Separate Session State from Previous Data

```typescript
// WorkoutClient.tsx - Add new state
const [sessionLogs, setSessionLogs] = useState<Map<string, SetLog>>(new Map())
const [previousLogs, setPreviousLogs] = useState<Map<string, SetLog[]>>(new Map())
const [sessionStatus, setSessionStatus] = useState<'idle' | 'active' | 'saved'>('idle')

// ExerciseCard.tsx - Explicit states
const isLoggedThisSession = sessionLogs.has(`${exerciseId}-${setNumber}`)
const hasPreviousData = previousLogs.get(exerciseId)?.some(p => p.set_number === setNumber)

// UI states:
// - isLoggedThisSession=true → GREEN (confirmed)
// - hasPreviousData=true && !isLoggedThisSession → GRAY (pre-filled, tap to confirm)
// - neither → GRAY with dashes (empty)
```

### Fix 2: Exclude Today from Previous Logs

```typescript
// loadPreviousLogs - Exclude today
const todayStart = new Date()
todayStart.setHours(0, 0, 0, 0)

const { data: recentWorkoutLog } = await supabase
  .from('workout_logs')
  .select('id, completed_at')
  .eq('client_id', user.id)
  .eq('workout_id', workoutId)
  .lt('completed_at', todayStart.toISOString())  // BEFORE today
  .order('completed_at', { ascending: false })
  .limit(1)
  .single()
```

### Fix 3: Load Existing Today's Session

```typescript
// On mount, check if there's an existing session for today
const loadTodaySession = async () => {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  
  const { data: todayLog } = await supabase
    .from('workout_logs')
    .select('id, status')
    .eq('client_id', user.id)
    .eq('workout_id', workoutId)
    .eq('scheduled_date', scheduledDate)
    .single()
  
  if (todayLog) {
    setWorkoutLogId(todayLog.id)
    // Load today's set_logs into sessionLogs (not previousLogs)
    const { data: todaySets } = await supabase
      .from('set_logs')
      .select('*')
      .eq('workout_log_id', todayLog.id)
    
    // Populate sessionLogs with today's data
    const logMap = new Map()
    todaySets?.forEach(s => {
      logMap.set(`${s.exercise_id}-${s.set_number}`, s)
    })
    setSessionLogs(logMap)
    setSessionStatus('active')
  }
}
```

### Fix 4: Reliable Save on Page Unload

```typescript
// Use navigator.sendBeacon for reliable unload saves
const handleBeforeUnload = () => {
  if (pendingLogsRef.current.size > 0) {
    const payload = JSON.stringify({
      workoutLogId,
      logs: Array.from(pendingLogsRef.current.values())
    })
    navigator.sendBeacon('/api/workouts/sync-logs', payload)
  }
}
```

---

## 🎨 UI Improvements

### Clear Visual States

| State | Button Style | Text Color | Checkmark | Label |
|-------|--------------|------------|-----------|-------|
| Empty | Gray border, gray bg | zinc-500 | ❌ | "—" |
| Pre-filled | Gray border, gray bg | zinc-400 | ❌ | Shows previous value + "Last week" |
| Logged | Green border, green bg | green-400 | ✅ | Shows logged value |

### One-Tap Confirm
When tapping a pre-filled set, it should:
1. Open wheel picker with previous values pre-selected
2. User can adjust or tap "Confirm"
3. On confirm → immediately marks as logged (green)

### Progress Indicator
Add a progress bar showing: `3/12 sets logged`

---

## 📋 Implementation Checklist

```
Database:
[ ] Add status column to workout_logs
[ ] Add unique constraint to set_logs
[ ] Add performance indexes
[ ] Run migration

Client App:
[ ] Separate sessionLogs from previousLogs state
[ ] Exclude today from previous logs query
[ ] Load existing today's session on mount
[ ] Update ExerciseCard with 3-state UI (empty/prefilled/logged)
[ ] Add sendBeacon fallback for page unload
[ ] Add session status indicator
[ ] Add progress bar

Trainer App:
[ ] Show all planned sets (not just logged)
[ ] Highlight sets that client didn't complete
[ ] Pull previous workout data for comparison

Testing:
[ ] Log a workout, leave, come back - should resume
[ ] Log partial workout, complete next day - should work
[ ] Two tabs open same workout - should not conflict
[ ] Page close mid-logging - should save
[ ] Trainer view after client logs - should show all data
```

---

## JSON Schema (Requested)

```json
{
  "workout_log": {
    "id": "uuid",
    "client_id": "uuid",
    "workout_id": "uuid",
    "scheduled_date": "2026-02-25",
    "started_at": "2026-02-25T10:00:00Z",
    "completed_at": "2026-02-25T10:45:00Z",
    "status": "completed",
    "notes": "Felt strong today",
    "rating": 4,
    "trainer_id": "uuid|null"
  },
  "set_logs": [
    {
      "workout_log_id": "uuid",
      "exercise_id": "uuid",
      "set_number": 1,
      "weight_kg": 20,
      "reps_completed": 8,
      "swapped_exercise_name": null
    }
  ],
  "session_state": {
    "status": "active|saved|idle",
    "logged_sets": ["exerciseId-1", "exerciseId-2"],
    "prefilled_sets": ["exerciseId-3", "exerciseId-4"],
    "progress": "2/16"
  }
}
```

---

## Quick Wins (Do First)

1. **Fix UI styling** - Gray for pre-filled (done, pending deploy)
2. **Exclude today from previous logs** - 5 min fix
3. **Add unique constraint** - Database migration
4. **Load today's existing session** - Resume partial workouts

## Medium Effort

5. **Session status tracking** - Add status column
6. **SendBeacon for reliable saves**
7. **Progress indicator**

## Future Enhancements

8. **Offline support** - Service worker + IndexedDB
9. **Conflict resolution** - Multiple device support
10. **Audit log** - Track all changes for debugging
