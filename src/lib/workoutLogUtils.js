export function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function displayDate(dateValue) {
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(`${dateValue}T12:00:00`));
}

export function logDateValue(log) {
  return localDateValue(new Date(log.performed_at));
}

export function secondsToClock(totalSeconds = 0) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function durationInputToSeconds(value) {
  if (!value) return 0;
  if (String(value).includes(":")) {
    const [minutes, seconds] = String(value).split(":").map(Number);
    return (minutes * 60) + seconds;
  }
  return Number(value) || 0;
}

export function formatDurationInput(value) {
  const digits = String(value).replace(/\D/g, "").slice(0, 4);
  if (digits.length < 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function exerciseIconLabel(exercise) {
  if (exercise.type === "cardio") return "RW";
  if (exercise.type === "timed") return "TM";
  if (exercise.type === "mobility") return "MO";
  if (exercise.type === "superset") return "SS";
  if (exercise.name.toLocaleLowerCase().includes("squat")) return "SQ";
  if (exercise.name.toLocaleLowerCase().includes("row")) return "RW";
  return "WT";
}

export function exerciseIconAsset(exercise) {
  const name = exercise.name.toLocaleLowerCase();

  if (name.includes("flat dumbbell press")) return "/exercise-icons/flat-dumbbell-press.png";
  if (name.includes("bulgarian")) return "/exercise-icons/bulgarian-split-squats.png";
  if (name.includes("shoulder press")) return "/exercise-icons/dumbbell-shoulder-press.png";
  if (name.includes("pull-up") || name.includes("pull up")) return "/exercise-icons/pull-ups.png";
  if (name.includes("push-up") || name.includes("push up")) return "/exercise-icons/push-ups.png";
  if (name.includes("lateral raise")) return "/exercise-icons/lateral-raise.webp";
  if (name.includes("low incline") || name.includes("low-incline")) {
    return "/exercise-icons/low-incline-dumbbell-press.webp";
  }
  if (name.includes("bench dip") || name.includes("dip")) {
    return "/exercise-icons/bench-dips.webp";
  }
  if (/\bl[\s-]?raises?\b/.test(name)) return "/exercise-icons/l-raises.webp";
  if (name.includes("calf")) return "/exercise-icons/dumbbell-calf-raises.webp";
  if (name.includes("goblet") || name.includes("squat")) {
    return "/exercise-icons/goblet-squats.webp";
  }
  if (name.includes("inverted")) return "/exercise-icons/inverted-rows.webp";
  if (name.includes("romanian") || name.includes("rdl")) {
    return "/exercise-icons/dumbbell-romanian-deadlifts.webp";
  }
  if (name.includes("cable row")) return "/exercise-icons/cable-rows.webp";
  if (name.includes("rear-delt") || name.includes("rear delt")) {
    return "/exercise-icons/rear-delt-raise.webp";
  }
  if (name.includes("plank")) return "/exercise-icons/planks.webp";
  if (
    name.includes("tricep")
    || name.includes("triceps")
    || (name.includes("extension") && !name.includes("curl"))
  ) {
    return "/exercise-icons/triceps-extension.webp";
  }
  if (name.includes("curl") || name.includes("extension")) {
    return "/exercise-icons/incline-dumbbell-curls.webp";
  }
  if (name.includes("step")) return "/exercise-icons/dumbbell-step-ups.webp";
  if (name.includes("running") || name.includes("walking")) {
    return "/exercise-icons/running-walking.webp";
  }
  return "";
}

export function formatLogResult(exercise, log) {
  const sets = log?.exercise_log_sets ?? [];
  if (log?.notes === "Skipped") return "Skipped day";
  if (!log || !sets.length) return "No history yet";

  if (exercise.type === "cardio") {
    const entry = sets[0];
    const mode = entry.activity_mode === "running" ? "Run" : "Walk";
    return `${mode} / ${entry.speed ?? 0} mph / ${entry.incline ?? 0}% / ${secondsToClock(entry.duration_seconds ?? 0)}`;
  }

  if (exercise.type === "mobility") {
    return `${sets.filter((set) => set.completed).length}/${exercise.exercise_parts.length || sets.length} complete`;
  }

  if (exercise.type === "timed") {
    return sets.map((set) => secondsToClock(set.duration_seconds ?? 0)).join(" / ");
  }

  if (exercise.type === "superset") {
    return exercise.exercise_parts.slice(0, 2).map((part) => {
      const partSets = sets.filter((set) => set.exercise_part_id === part.id);
      const weight = partSets.find((set) => set.weight != null)?.weight;
      const reps = partSets.map((set) => set.reps ?? 0).join("/");
      return `${part.name}: ${weight ?? 0} lb ${reps}`;
    }).join(" + ");
  }

  const reps = sets.map((set) => set.reps ?? 0).join(" / ");
  const weight = sets.find((set) => set.weight != null)?.weight;
  return weight != null ? `${weight} lb / ${reps}` : reps;
}

export function normalizedResultSignature(exercise, log) {
  const sets = log?.exercise_log_sets ?? [];
  if (!sets.length) return "";

  if (exercise.type === "weighted") {
    const weight = sets.find((set) => set.weight != null)?.weight;
    if (weight == null) return "";
    return `${weight}lb:${sets.map((set) => set.reps ?? 0).join(",")}`;
  }
  if (exercise.type === "bodyweight") {
    return `BW:${sets.map((set) => set.reps ?? 0).join(",")}`;
  }
  if (exercise.type === "timed") {
    return sets.map((set) => `${set.duration_seconds ?? 0}s`).join(",");
  }
  return "";
}

export function trendScore(exercise, log) {
  const sets = log?.exercise_log_sets ?? [];
  if (!sets.length) return null;

  if (exercise.type === "weighted" || exercise.type === "superset") {
    return sets.reduce(
      (total, set) => total + ((Number(set.weight) || 0) * (Number(set.reps) || 0)),
      0,
    );
  }
  if (exercise.type === "bodyweight") {
    return sets.reduce((total, set) => total + (Number(set.reps) || 0), 0);
  }
  if (exercise.type === "timed") {
    return sets.reduce((total, set) => total + (Number(set.duration_seconds) || 0), 0);
  }
  if (exercise.type === "cardio") {
    const entry = sets[0];
    return entry
      ? (Number(entry.duration_seconds) || 0) * (Number(entry.speed) || 1)
      : null;
  }
  if (exercise.type === "mobility") {
    return sets.filter((set) => set.completed).length;
  }
  return null;
}

export function trendMeta(exercise, log, previousLog) {
  if (log?.notes === "Skipped") {
    return { direction: "neutral", symbol: "—", label: "Exercise skipped" };
  }
  const current = trendScore(exercise, log);
  const previous = trendScore(exercise, previousLog);
  if (current == null || previous == null) {
    return { direction: "neutral", symbol: "•", label: "No trend yet" };
  }
  if (current > previous) {
    return { direction: "up", symbol: "↑", label: "Improved from previous log" };
  }
  if (current < previous) {
    return { direction: "down", symbol: "↓", label: "Lower than previous log" };
  }
  return { direction: "same", symbol: "→", label: "Same as previous log" };
}

export function blankDraft(exercise) {
  if (exercise.type === "cardio") {
    return {
      cardio: { mode: "walking", incline: "", speed: "", duration: "" },
    };
  }
  if (exercise.type === "mobility") {
    return {
      mobility: Object.fromEntries(
        exercise.exercise_parts.map((part) => [part.id, false]),
      ),
    };
  }
  if (exercise.type === "superset") {
    return {
      sets: [{
        parts: exercise.exercise_parts.slice(0, 2).map((part) => ({
          exercise_part_id: part.id,
          name: part.name,
          weight: "",
          reps: "",
        })),
      }],
    };
  }
  if (exercise.type === "timed") return { sets: [{ duration: "" }] };
  return {
    sets: [{
      weight: exercise.type === "weighted" ? "" : null,
      reps: "",
    }],
  };
}

export function draftFromLog(exercise, log) {
  if (!log) return blankDraft(exercise);
  const sets = log.exercise_log_sets ?? [];

  if (exercise.type === "cardio") {
    const entry = sets[0] ?? {};
    return {
      cardio: {
        mode: entry.activity_mode ?? "walking",
        incline: entry.incline ?? "",
        speed: entry.speed ?? "",
        duration: secondsToClock(entry.duration_seconds ?? 0),
      },
    };
  }
  if (exercise.type === "mobility") {
    return {
      mobility: Object.fromEntries(
        exercise.exercise_parts.map((part) => [
          part.id,
          sets.find((set) => set.exercise_part_id === part.id)?.completed ?? false,
        ]),
      ),
    };
  }
  if (exercise.type === "superset") {
    const grouped = new Map();
    for (const set of sets) {
      grouped.set(set.set_number, [...(grouped.get(set.set_number) ?? []), set]);
    }
    return {
      sets: [...grouped.values()].map((rowSets) => ({
        parts: exercise.exercise_parts.slice(0, 2).map((part) => {
          const partSet = rowSets.find((set) => set.exercise_part_id === part.id) ?? {};
          return {
            exercise_part_id: part.id,
            name: part.name,
            weight: partSet.weight ?? "",
            reps: partSet.reps ?? "",
          };
        }),
      })),
    };
  }
  if (exercise.type === "timed") {
    return {
      sets: sets.map((set) => ({
        duration: secondsToClock(set.duration_seconds ?? 0),
      })),
    };
  }
  return {
    sets: sets.map((set) => ({
      weight: exercise.type === "weighted" ? (set.weight ?? "") : null,
      reps: set.reps ?? "",
    })),
  };
}

export function setsFromDraft(exercise, draft) {
  if (exercise.type === "cardio") {
    return [{
      set_number: 1,
      activity_mode: draft.cardio.mode,
      incline: Number(draft.cardio.incline),
      speed: Number(draft.cardio.speed),
      duration_seconds: durationInputToSeconds(draft.cardio.duration),
    }];
  }
  if (exercise.type === "mobility") {
    return exercise.exercise_parts.map((part, index) => ({
      exercise_part_id: part.id,
      set_number: index + 1,
      completed: draft.mobility[part.id] ?? false,
    }));
  }
  if (exercise.type === "superset") {
    return draft.sets.flatMap((row, setIndex) =>
      row.parts.map((part) => ({
        exercise_part_id: part.exercise_part_id,
        set_number: setIndex + 1,
        reps: Number(part.reps),
        weight: part.weight === "" ? null : Number(part.weight),
      })),
    );
  }
  if (exercise.type === "timed") {
    return draft.sets.map((set, index) => ({
      set_number: index + 1,
      duration_seconds: durationInputToSeconds(set.duration),
    }));
  }
  return draft.sets.map((set, index) => ({
    set_number: index + 1,
    reps: Number(set.reps),
    weight: exercise.type === "weighted" && set.weight !== "" ? Number(set.weight) : null,
  }));
}

export function addDraftSet(exercise, draft) {
  if (exercise.type === "superset") {
    return {
      ...draft,
      sets: [
        ...draft.sets,
        {
          parts: exercise.exercise_parts.slice(0, 2).map((part) => ({
            exercise_part_id: part.id,
            name: part.name,
            weight: "",
            reps: "",
          })),
        },
      ],
    };
  }
  if (exercise.type === "timed") {
    return { ...draft, sets: [...draft.sets, { duration: "" }] };
  }
  return {
    ...draft,
    sets: [
      ...draft.sets,
      { weight: exercise.type === "weighted" ? "" : null, reps: "" },
    ],
  };
}

export function updateDraftSet(draft, index, updater) {
  return {
    ...draft,
    sets: draft.sets.map((set, setIndex) => (
      setIndex === index ? updater(set) : set
    )),
  };
}

function isThreeByTenSignature(signature) {
  const [, repsPart] = signature.split(":");
  if (!repsPart) return false;
  const reps = repsPart.split(",").map(Number);
  return reps.length >= 3 && reps.slice(0, 3).every((rep) => rep >= 10);
}

export function setupInsight(exercise) {
  const logs = exercise.recent_logs ?? [];
  if (logs.length < 2) return "";

  const latest = logs[0];
  const previous = logs[1];
  const latestScore = trendScore(exercise, latest);
  const previousScore = trendScore(exercise, previous);
  const olderScores = logs.slice(1)
    .map((log) => trendScore(exercise, log))
    .filter(Number.isFinite);
  const percentChange = previousScore > 0
    ? Math.round(((latestScore - previousScore) / previousScore) * 100)
    : 0;

  if (latestScore != null && olderScores.length && latestScore > Math.max(...olderScores)) {
    return percentChange > 0
      ? `New ${logs.length}-session best — total work is up ${percentChange}% from last time.`
      : `New ${logs.length}-session best. Strongest recent entry.`;
  }

  const recentScores = logs.slice(0, 3).map((log) => trendScore(exercise, log));
  if (
    recentScores.length === 3
    && recentScores.every(Number.isFinite)
    && recentScores[0] > recentScores[1]
    && recentScores[1] > recentScores[2]
  ) {
    return "Three sessions trending upward. Your recent work is building nicely.";
  }

  if (exercise.type === "weighted") {
    const latestWeight = Math.max(
      ...latest.exercise_log_sets.map((set) => Number(set.weight) || 0),
    );
    const previousWeight = Math.max(
      ...previous.exercise_log_sets.map((set) => Number(set.weight) || 0),
    );
    const latestReps = latest.exercise_log_sets.reduce(
      (sum, set) => sum + (Number(set.reps) || 0),
      0,
    );
    const previousReps = previous.exercise_log_sets.reduce(
      (sum, set) => sum + (Number(set.reps) || 0),
      0,
    );
    if (latestWeight > previousWeight && latestReps >= previousReps) {
      return `Weight increased by ${latestWeight - previousWeight} lb while total reps held steady.`;
    }
  }

  if (percentChange >= 5) {
    const metric = exercise.type === "timed" ? "total time" : "total work";
    return `${metric[0].toUpperCase()}${metric.slice(1)} improved ${percentChange}% from last session.`;
  }
  if (percentChange <= -10) {
    return `This was ${Math.abs(percentChange)}% lighter than last time. Recovery days still count.`;
  }

  const latestSignature = normalizedResultSignature(exercise, latest);
  if (!latestSignature) {
    return Math.abs(percentChange) < 5
      ? "Very close to your last result — a steady session."
      : "";
  }

  let streak = 0;
  for (const log of logs) {
    if (normalizedResultSignature(exercise, log) !== latestSignature) break;
    streak += 1;
  }

  if (
    streak >= 3
    && ["weighted", "bodyweight"].includes(exercise.type)
    && isThreeByTenSignature(latestSignature)
  ) {
    return `You've hit 3x10 for ${streak} sessions. Consider increasing weight next time.`;
  }
  if (streak >= 3) {
    return `Same result ${streak} sessions in a row — consistent and ready to progress.`;
  }
  return Math.abs(percentChange) < 5
    ? "Very close to your last result — a steady session."
    : "";
}
