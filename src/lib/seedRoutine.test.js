import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalExerciseName,
  defaultWorkoutSchedule,
} from "./seedRoutine.js";

test("the default routine is assigned only to Monday, Wednesday, and Friday", () => {
  assert.deepEqual(
    defaultWorkoutSchedule.map((workout) => workout.weekday),
    [1, 3, 5],
  );
  assert.equal(defaultWorkoutSchedule[0].exercises.length, 7);
  assert.equal(defaultWorkoutSchedule[1].exercises.length, 7);
  assert.equal(defaultWorkoutSchedule[2].exercises.length, 8);
});

test("legacy exercise names resolve to shared history-owning exercises", () => {
  assert.equal(canonicalExerciseName("Dumbbell Romanian Deadlifts"), "Dumbbell RDLs");
  assert.equal(canonicalExerciseName("Low Incline Dumbbell Press"), "Low-Incline Dumbbell Press");
  assert.equal(canonicalExerciseName("Pull-ups"), "Pull-ups / Assisted Pull-ups / Negatives");
});
