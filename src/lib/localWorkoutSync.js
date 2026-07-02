import { saveExerciseLogWithSets } from "./workoutApi";

const queueEvent = "workout-sync-queue-change";
let activeFlush = null;

function storageKey(userId) {
  return `workout-log-queue:${userId}`;
}

function readQueue(userId) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId)) || "[]");
  } catch {
    return [];
  }
}

function writeQueue(userId, queue) {
  localStorage.setItem(storageKey(userId), JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent(queueEvent, { detail: { userId, count: queue.length } }));
}

function localPerformedAt(dateValue) {
  return new Date(`${dateValue}T12:00:00`).toISOString();
}

export function pendingWorkoutCount(userId) {
  return readQueue(userId).length;
}

export function pendingWorkoutFeeling(userId) {
  return readQueue(userId).find((item) => item.awaitingFeeling) ?? null;
}

export function subscribeToWorkoutQueue(userId, onChange) {
  const handleChange = (event) => {
    if (event.detail?.userId === userId) onChange(event.detail.count);
  };
  window.addEventListener(queueEvent, handleChange);
  return () => window.removeEventListener(queueEvent, handleChange);
}

export function queueWorkoutLog(
  userId,
  exerciseId,
  sets,
  performedDate,
  {
    notes = "",
    feeling = null,
    awaitingFeeling = false,
  } = {},
) {
  const queue = readQueue(userId);
  const existingIndex = queue.findIndex(
    (item) => item.exerciseId === exerciseId && item.performedDate === performedDate,
  );
  const item = {
    id: crypto.randomUUID(),
    userId,
    exerciseId,
    sets,
    performedDate,
    notes,
    feeling,
    awaitingFeeling,
    queuedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) queue[existingIndex] = item;
  else queue.push(item);
  writeQueue(userId, queue);
  return item;
}

export function setQueuedWorkoutFeeling(userId, queueItemId, feeling) {
  const queue = readQueue(userId);
  const itemIndex = queue.findIndex((item) => item.id === queueItemId);
  if (itemIndex < 0) return null;

  queue[itemIndex] = {
    ...queue[itemIndex],
    feeling,
    awaitingFeeling: false,
  };
  writeQueue(userId, queue);
  return queue[itemIndex];
}

export function mergePendingWorkoutLogs(rows, userId, selectedDate) {
  const pending = readQueue(userId);
  if (!pending.length) return rows;

  return rows.map((exercise) => {
    const item = pending.find(
      (entry) => entry.exerciseId === exercise.id && entry.performedDate === selectedDate,
    );
    if (!item) return exercise;

    const pendingLog = {
      id: `local-${item.id}`,
      exercise_id: exercise.id,
      performed_at: localPerformedAt(item.performedDate),
      exercise_log_sets: item.sets,
      notes: item.notes || null,
      feeling: item.feeling ?? null,
      pending_sync: true,
    };

    return {
      ...exercise,
      selected_log: pendingLog,
      recent_logs: [
        pendingLog,
        ...(exercise.recent_logs ?? []).filter(
          (log) => new Date(log.performed_at).toISOString().slice(0, 10) !== selectedDate,
        ),
      ],
    };
  });
}

export function flushPendingWorkoutLogs(userId) {
  if (activeFlush) return activeFlush;
  if (!navigator.onLine || !readQueue(userId).length) return Promise.resolve(0);

  activeFlush = (async () => {
    let synced = 0;
    for (const item of readQueue(userId)) {
      if (item.awaitingFeeling) continue;
      try {
        await saveExerciseLogWithSets(
          item.userId,
          item.exerciseId,
          item.sets,
          item.performedDate,
          item.notes,
          item.feeling,
        );
        const remaining = readQueue(userId).filter((entry) => entry.id !== item.id);
        writeQueue(userId, remaining);
        synced += 1;
      } catch (error) {
        console.warn("Workout sync will retry later.", error);
        break;
      }
    }
    return synced;
  })().finally(() => {
    activeFlush = null;
  });

  return activeFlush;
}
