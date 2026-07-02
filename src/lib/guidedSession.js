import { blankDraft, setsFromDraft } from "./workoutLogUtils.js";

export const GUIDED_SESSION_VERSION = 1;
export const SKIPPED_LOG_NOTE = "Skipped";

function modeKey(userId) {
  return `workout-view-mode:${userId}`;
}

function sessionKey(userId, date) {
  return `guided-workout-session:${userId}:${date}`;
}

function storage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function readWorkoutMode(userId) {
  try {
    return storage()?.getItem(modeKey(userId)) === "list" ? "list" : "guided";
  } catch {
    return "guided";
  }
}

export function writeWorkoutMode(userId, mode) {
  try {
    storage()?.setItem(modeKey(userId), mode === "list" ? "list" : "guided");
  } catch {
    // The mode still works for this visit when storage is unavailable.
  }
}

export function createGuidedSession(date, currentExerciseId = null) {
  return {
    version: GUIDED_SESSION_VERSION,
    date,
    status: "greeting",
    currentExerciseId,
    startedAt: null,
    completedAt: null,
    drafts: {},
    setTimers: {},
    feelings: {},
    breakTimer: null,
    updatedAt: new Date().toISOString(),
  };
}

export function readGuidedSession(userId, date) {
  try {
    const parsed = JSON.parse(storage()?.getItem(sessionKey(userId, date)) || "null");
    if (
      !parsed
      || parsed.version !== GUIDED_SESSION_VERSION
      || parsed.date !== date
      || !["greeting", "active", "complete"].includes(parsed.status)
    ) {
      return null;
    }
    return {
      ...createGuidedSession(date),
      ...parsed,
      drafts: parsed.drafts ?? {},
      setTimers: parsed.setTimers ?? {},
      feelings: parsed.feelings ?? {},
    };
  } catch {
    return null;
  }
}

export function writeGuidedSession(userId, session) {
  if (!session?.date) return;
  try {
    storage()?.setItem(
      sessionKey(userId, session.date),
      JSON.stringify({ ...session, updatedAt: new Date().toISOString() }),
    );
  } catch {
    // Logging remains functional if private browsing blocks local storage.
  }
}

export function isSkippedLog(log) {
  return log?.notes === SKIPPED_LOG_NOTE;
}

export function skippedSetsForExercise(exercise) {
  return setsFromDraft(exercise, blankDraft(exercise));
}

export function nextIncompleteExercise(exercises, currentExerciseId = null) {
  if (!exercises.length) return null;
  const currentIndex = exercises.findIndex((exercise) => exercise.id === currentExerciseId);
  const afterCurrent = currentIndex >= 0 ? exercises.slice(currentIndex + 1) : exercises;
  return (
    afterCurrent.find((exercise) => !exercise.selected_log)
    ?? exercises.find(
      (exercise) => exercise.id !== currentExerciseId && !exercise.selected_log,
    )
    ?? null
  );
}

export function previousExercise(exercises, currentExerciseId) {
  const currentIndex = exercises.findIndex((exercise) => exercise.id === currentExerciseId);
  return currentIndex > 0 ? exercises[currentIndex - 1] : null;
}

export function remainingTimerSeconds(timer, now) {
  if (!timer?.endsAt) return 0;
  return Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
}
