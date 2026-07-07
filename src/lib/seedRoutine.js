export const defaultWorkoutSchedule = [
  {
    name: "Monday Workout",
    weekday: 1,
    exercises: [
      "Goblet Squats",
      "Flat Dumbbell Press",
      "Cable Rows",
      "Dumbbell RDLs",
      "Lateral Raises",
      "Incline Dumbbell Curls",
      "Hanging L-Raises",
      "Planks",
    ],
  },
  {
    name: "Wednesday Workout",
    weekday: 3,
    exercises: [
      "Bulgarian Split Squats",
      "Low-Incline Dumbbell Press",
      "Pull-ups / Assisted Pull-ups / Negatives",
      "Dumbbell Shoulder Press",
      "Bench Dips",
      "Rear-Delt Raises",
      "Planks",
    ],
  },
  {
    name: "Friday Workout",
    weekday: 5,
    exercises: [
      "Dumbbell RDLs",
      "Push-ups",
      "Cable Rows",
      "Pull-ups / Assisted Pull-ups / Negatives",
      "Dumbbell Calf Raises",
      "Incline Dumbbell Curls",
      "Hanging L-Raises",
      "Planks",
    ],
  },
];

export const defaultRoutine = [
  { name: "Goblet Squats", type: "weighted" },
  { name: "Flat Dumbbell Press", type: "weighted" },
  { name: "Cable Rows", type: "weighted" },
  { name: "Dumbbell RDLs", type: "weighted" },
  { name: "Lateral Raises", type: "weighted" },
  { name: "Incline Dumbbell Curls", type: "weighted" },
  { name: "Hanging L-Raises", type: "bodyweight" },
  { name: "Bulgarian Split Squats", type: "weighted" },
  { name: "Low-Incline Dumbbell Press", type: "weighted" },
  { name: "Pull-ups / Assisted Pull-ups / Negatives", type: "bodyweight" },
  { name: "Dumbbell Shoulder Press", type: "weighted" },
  { name: "Bench Dips", type: "bodyweight" },
  { name: "Rear-Delt Raises", type: "weighted" },
  { name: "Planks", type: "timed" },
  { name: "Push-ups", type: "bodyweight" },
  { name: "Dumbbell Calf Raises", type: "weighted" },
];

export const defaultRoutineAliases = {
  "lateral raise": "Lateral Raises",
  "rear-delt raise": "Rear-Delt Raises",
  "rear delt raise": "Rear-Delt Raises",
  "incline dumbbell curl": "Incline Dumbbell Curls",
  "low incline dumbbell press": "Low-Incline Dumbbell Press",
  "low incline dumbell press": "Low-Incline Dumbbell Press",
  "dumbbell romanian deadlifts": "Dumbbell RDLs",
  "dumbell romanian deadlifts": "Dumbbell RDLs",
  "dumbbell calf raise": "Dumbbell Calf Raises",
  "dumbell calf raises": "Dumbbell Calf Raises",
  "l raises": "Hanging L-Raises",
  "l-raises": "Hanging L-Raises",
  "hanging l raises": "Hanging L-Raises",
  "pull-ups": "Pull-ups / Assisted Pull-ups / Negatives",
  "pull ups": "Pull-ups / Assisted Pull-ups / Negatives",
  "push ups": "Push-ups",
};

export function canonicalExerciseName(name) {
  const trimmed = name.trim();
  return defaultRoutineAliases[trimmed.toLocaleLowerCase()] ?? trimmed;
}

export function trackingTypeFor(exerciseType) {
  if (exerciseType === "mobility") return "completed";
  if (exerciseType === "timed") return "time";
  return "reps";
}
