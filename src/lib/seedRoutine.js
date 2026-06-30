export const defaultRoutine = [
  { name: "Cable Rows", type: "weighted", defaultWeight: 50 },
  { name: "Low Incline Dumbbell Press", type: "weighted", defaultWeight: 25 },
  { name: "Goblet Squats", type: "weighted", defaultWeight: 35 },
  { name: "Dumbbell Romanian Deadlifts", type: "weighted", defaultWeight: 35 },
  { name: "Incline Dumbbell Curls", type: "weighted", defaultWeight: 15 },
  { name: "Dumbbell Calf Raises", type: "weighted", defaultWeight: 35 },
  { name: "Lateral Raises", type: "weighted", defaultWeight: 10 },
  { name: "Rear-Delt Raises", type: "weighted", defaultWeight: 10 },
  { name: "Bench Dips", type: "bodyweight" },
  { name: "Hanging L-Raises", type: "bodyweight" },
  { name: "Planks", type: "timed" },
  {
    name: "Running / Walking",
    type: "cardio",
    defaultSets: 1,
  },
];

export const defaultRoutineAliases = {
  "lateral raise": "Lateral Raises",
  "rear-delt raise": "Rear-Delt Raises",
  "rear delt raise": "Rear-Delt Raises",
  "incline dumbbell curl": "Incline Dumbbell Curls",
  "incline dumbbell curls": "Incline Dumbbell Curls",
  "low incline dumbell press": "Low Incline Dumbbell Press",
  "dumbell romanian deadlifts": "Dumbbell Romanian Deadlifts",
  "dumbbell calf raise": "Dumbbell Calf Raises",
  "dumbell calf raises": "Dumbbell Calf Raises",
  "l raises": "Hanging L-Raises",
  "l-raises": "Hanging L-Raises",
  "hanging l raises": "Hanging L-Raises",
  "hanging l-raises": "Hanging L-Raises",
};

export const retiredDefaultExerciseNames = [
  "Inverted Rows",
  "Curl + Extension Superset",
  "Mobility",
  "Overhead Triceps Extension",
  "Dumbbell Step Ups",
];

export function trackingTypeFor(exerciseType) {
  if (exerciseType === "mobility") return "completed";
  if (exerciseType === "timed") return "time";
  return "reps";
}
