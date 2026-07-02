const messages = {
  greeting: [
    "Ready when you are.",
    "Let’s get moving.",
    "Today’s workout is lined up.",
  ],
  idle: [
    "Log it when you’re ready.",
    "You’ve got this one.",
    "Stay smooth. Keep moving.",
  ],
  focused: [
    "Lock in.",
    "Clean reps. Steady pace.",
    "Make this set count.",
  ],
  rest: [
    "Catch your breath.",
    "Quick reset.",
    "Hydrate. Then we go again.",
  ],
  exerciseComplete: [
    "That one’s done.",
    "Strong work.",
    "You cleared it.",
  ],
  skipped: [
    "Skipped. Keep it moving.",
    "On to the next one.",
    "Marked and moving on.",
  ],
  next: [
    "Next up.",
    "Keep the momentum.",
    "Here’s the next one.",
  ],
  workoutComplete: [
    "Workout cleared.",
    "That’s the full session.",
    "You showed up and finished.",
  ],
};

const poses = {
  greeting: { king: "happy", drip: "happy" },
  idle: { king: "encouraging", drip: "encouraging" },
  focused: { king: "focused", drip: "focused" },
  rest: { king: "resting", drip: "hydration" },
  exerciseComplete: { king: "celebrating", drip: "celebrating" },
  skipped: { king: "pointing-right", drip: "pointing-right" },
  next: { king: "pointing-right", drip: "pointing-right" },
  workoutComplete: { king: "victory", drip: "celebrating" },
};

function stableNumber(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mascotAsset(character, pose) {
  const safeCharacter = ["king", "drip", "duo"].includes(character) ? character : "king";
  return `/mascots/${safeCharacter}-${pose}.png`;
}

export function guideMoment({
  state = "idle",
  date = "",
  exerciseId = "",
  exerciseName = "",
  index = 0,
  duo = false,
}) {
  const pool = messages[state] ?? messages.idle;
  const seed = stableNumber(`${date}:${exerciseId}:${state}:${index}`);
  const character = duo ? "duo" : ((seed + index) % 2 ? "drip" : "king");
  const duoPose = {
    exerciseComplete: "exercise-complete",
    workoutComplete: "workout-complete",
    rest: "rest",
    next: "next",
  }[state];
  const pose = duo
    ? (duoPose ?? "greeting")
    : (poses[state]?.[character] ?? "idle");
  let message = pool[seed % pool.length];

  if (state === "greeting" && exerciseName) {
    message = `${message} First up: ${exerciseName}.`;
  } else if (state === "next" && exerciseName) {
    message = `${message} ${exerciseName}.`;
  }

  return { character, pose, message };
}

