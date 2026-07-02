# Forge

Forge is an offline-friendly daily workout journal built with React, Vite, and
Supabase. It supports weighted, bodyweight, timed, cardio, mobility, and
superset exercises, along with recent-history trends, timers, workout feelings,
and local queueing when the network is unavailable.

## Local setup

1. Install dependencies with `npm install`.
2. Create `.env.local`:

   ```text
   VITE_SUPABASE_URL=your-project-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

3. Apply every SQL file in `supabase/migrations` to the Supabase project in
   filename order.
4. Start Forge with `npm run dev`.

## Quality checks

```sh
npm run lint
npm test
npm run build
```

## Project map

- `src/components/workout/WorkoutLogPage.jsx` coordinates dashboard state,
  persistence, offline synchronization, and modal flow.
- `src/components/workout/DashboardCard.jsx` renders an exercise on the daily
  checklist.
- `src/components/workout/WorkoutFeelingPrompt.jsx` owns the post-save feeling
  choice.
- `src/components/workout/WorkoutOverlays.jsx` contains page-level timers,
  loading, and completion overlays.
- `src/lib/workoutLogUtils.js` contains pure formatting, draft conversion,
  trend, and progression logic. Keep calculation code here so it remains easy
  to test.
- `src/lib/localWorkoutSync.js` owns the local persistence queue and sync retry
  behavior.
- `src/lib/workoutApi.js` is the Supabase data-access layer.
- `supabase/migrations` is the ordered database schema history.

Workout feelings are stored on `exercise_logs`. Pending logs remain local until
the feeling prompt is answered, so the save flow works consistently online and
offline.
