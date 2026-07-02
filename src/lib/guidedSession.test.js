import test from "node:test";
import assert from "node:assert/strict";
import {
  createGuidedSession,
  isSkippedLog,
  nextIncompleteExercise,
  previousExercise,
  readGuidedSession,
  readWorkoutMode,
  remainingTimerSeconds,
  skippedSetsForExercise,
  writeGuidedSession,
  writeWorkoutMode,
} from "./guidedSession.js";

test("new guided sessions begin at the greeting without losing draft containers", () => {
  const session = createGuidedSession("2026-07-02", "first");
  assert.equal(session.status, "greeting");
  assert.equal(session.currentExerciseId, "first");
  assert.deepEqual(session.drafts, {});
  assert.deepEqual(session.setTimers, {});
});

test("guided progression skips completed exercises and does not wrap to the current one", () => {
  const exercises = [
    { id: "a", selected_log: null },
    { id: "b", selected_log: { id: "done" } },
    { id: "c", selected_log: null },
  ];
  assert.equal(nextIncompleteExercise(exercises, "a")?.id, "c");
  assert.equal(nextIncompleteExercise(exercises, "c")?.id, "a");
  exercises[0].selected_log = { id: "also-done" };
  assert.equal(nextIncompleteExercise(exercises, "c"), null);
  assert.equal(previousExercise(exercises, "c")?.id, "b");
});

test("skipping produces zero-value sets and remains identifiable in history", () => {
  const exercise = {
    id: "weighted",
    type: "weighted",
    exercise_parts: [],
  };
  assert.deepEqual(skippedSetsForExercise(exercise), [{
    set_number: 1,
    reps: 0,
    weight: null,
  }]);
  assert.equal(isSkippedLog({ notes: "Skipped" }), true);
  assert.equal(isSkippedLog({ notes: "" }), false);
});

test("mode and active position survive a same-device reload", () => {
  const values = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  };

  const session = {
    ...createGuidedSession("2026-07-02", "incline-curls"),
    status: "active",
    drafts: { "incline-curls": { sets: [{ weight: "20", reps: "10" }] } },
  };
  writeWorkoutMode("user-1", "guided");
  writeGuidedSession("user-1", session);

  assert.equal(readWorkoutMode("user-1"), "guided");
  assert.equal(readGuidedSession("user-1", "2026-07-02").currentExerciseId, "incline-curls");
  assert.equal(
    readGuidedSession("user-1", "2026-07-02").drafts["incline-curls"].sets[0].reps,
    "10",
  );
  delete globalThis.window;
});

test("rest timers derive remaining time from their end timestamp", () => {
  const timer = { endsAt: 11_500 };
  assert.equal(remainingTimerSeconds(timer, 10_000), 2);
  assert.equal(remainingTimerSeconds(timer, 11_500), 0);
  assert.equal(remainingTimerSeconds(timer, 20_000), 0);
});
