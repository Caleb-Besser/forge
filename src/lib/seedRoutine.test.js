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
  assert.deepEqual(defaultWorkoutSchedule[0].exercises, [
    "Goblet Squats",
    "Flat Dumbbell Press",
    "Dumbbell RDLs",
    "Lateral Raises",
    "Incline Dumbbell Curls",
    "Hanging L-Raises",
    "Planks",
    "Cable Rows",
  ]);
  assert.deepEqual(defaultWorkoutSchedule[1].exercises, [
    "Bulgarian Split Squats",
    "Low-Incline Dumbbell Press",
    "Pull-ups / Assisted Pull-ups / Negatives",
    "Bench Dips",
    "Rear-Delt Raises",
    "Planks",
    "Calf-Raise Machine",
  ]);
  assert.deepEqual(defaultWorkoutSchedule[2].exercises, [
    "Dumbbell RDLs",
    "Dumbbell Shoulder Press",
    "Pull-ups / Assisted Pull-ups / Negatives",
    "Push-ups",
    "Incline Dumbbell Curls",
    "Hanging L-Raises",
    "Planks",
    "Cable Rows",
  ]);
});

test("exercise aliases resolve to shared history-owning exercises", () => {
  assert.equal(canonicalExerciseName("Dumbbell Romanian Deadlifts"), "Dumbbell RDLs");
  assert.equal(canonicalExerciseName("Low Incline Dumbbell Press"), "Low-Incline Dumbbell Press");
  assert.equal(canonicalExerciseName("Pull-ups"), "Pull-ups / Assisted Pull-ups / Negatives");
});
