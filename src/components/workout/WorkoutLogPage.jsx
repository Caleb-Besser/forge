import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addMissingDefaultExercises,
  createExercise,
  deactivateDuplicateExercises,
  deactivateLegacyLateralRaiseSuperset,
  deactivateExercise,
  deleteExerciseLog,
  getDailyWorkoutDashboard,
  moveExerciseTo,
  reconcileAliasedExercises,
  seedDefaultRoutineIfEmpty,
  syncDefaultRoutine,
  updateExercise,
} from "../../lib/workoutApi";
import {
  flushPendingWorkoutLogs,
  mergePendingWorkoutLogs,
  pendingWorkoutCount,
  queueWorkoutLog,
  subscribeToWorkoutQueue,
} from "../../lib/localWorkoutSync";
import AddExerciseModal from "./AddExerciseModal";
import EditExerciseModal from "./EditExerciseModal";
import RemoveExerciseModal from "./RemoveExerciseModal";

const breakPresets = [
  { label: "30s", seconds: 30 },
  { label: "45s", seconds: 45 },
  { label: "1m", seconds: 60 },
  { label: "90s", seconds: 90 },
  { label: "2m", seconds: 120 },
];

function setupErrorMessage(error) {
  const message = error?.message || "Could not load your routine.";

  if (
    message.includes("Could not find the table") ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  ) {
    return "Supabase is connected, but the workout tables have not been created yet. Run the SQL migration in the Supabase SQL Editor, then press Retry.";
  }

  return message;
}

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function displayDate(dateValue) {
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(`${dateValue}T12:00:00`));
}

function logDateValue(log) {
  return localDateValue(new Date(log.performed_at));
}

function secondsToClock(totalSeconds = 0) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function durationInputToSeconds(value) {
  if (!value) return 0;
  if (String(value).includes(":")) {
    const [minutes, seconds] = String(value).split(":").map(Number);
    return (minutes * 60) + seconds;
  }
  return Number(value) || 0;
}

function formatDurationInput(value) {
  const digits = String(value).replace(/\D/g, "").slice(0, 4);
  if (digits.length < 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function exerciseIcon(exercise) {
  if (exercise.type === "cardio") return "RW";
  if (exercise.type === "timed") return "TM";
  if (exercise.type === "mobility") return "MO";
  if (exercise.type === "superset") return "SS";
  if (exercise.name.toLocaleLowerCase().includes("squat")) return "SQ";
  if (exercise.name.toLocaleLowerCase().includes("row")) return "RW";
  return "WT";
}

function exerciseIconAsset(exercise) {
  const name = exercise.name.toLocaleLowerCase();

  if (name.includes("lateral raise")) {
    return "/exercise-icons/lateral-raise.webp";
  }
  if (name.includes("low incline") || name.includes("press")) {
    return "/exercise-icons/low-incline-dumbbell-press.webp";
  }
  if (name.includes("bench dip") || name.includes("bench dips") || name.includes("dip")) {
    return "/exercise-icons/bench-dips.webp";
  }
  if (/\bl[\s-]?raises?\b/.test(name)) {
    return "/exercise-icons/l-raises.webp";
  }
  if (name.includes("calf")) {
    return "/exercise-icons/dumbbell-calf-raises.webp";
  }
  if (name.includes("goblet") || name.includes("squat")) {
    return "/exercise-icons/goblet-squats.webp";
  }
  if (name.includes("inverted")) {
    return "/exercise-icons/inverted-rows.webp";
  }
  if (name.includes("romanian") || name.includes("rdl")) {
    return "/exercise-icons/dumbbell-romanian-deadlifts.webp";
  }
  if (name.includes("cable row")) {
    return "/exercise-icons/cable-rows.webp";
  }
  if (name.includes("rear-delt") || name.includes("rear delt")) {
    return "/exercise-icons/rear-delt-raise.webp";
  }
  if (name.includes("plank")) {
    return "/exercise-icons/planks.webp";
  }
  if (name.includes("tricep") || name.includes("triceps") || (
    name.includes("extension") && !name.includes("curl")
  )) {
    return "/exercise-icons/triceps-extension.webp";
  }
  if (name.includes("curl") || name.includes("extension")) {
    return "/exercise-icons/incline-dumbbell-curls.webp";
  }
  if (name.includes("step")) {
    return "/exercise-icons/dumbbell-step-ups.webp";
  }
  if (name.includes("running") || name.includes("walking")) {
    return "/exercise-icons/running-walking.webp";
  }

  return "";
}

function ExerciseIconSlot({ exercise, large = false }) {
  const src = exerciseIconAsset(exercise);
  const label = exerciseIcon(exercise);

  return (
    <span className={`exercise-icon-slot ${large ? "large" : ""}`} aria-hidden="true">
      {src ? <img src={src} alt="" loading="lazy" /> : label}
    </span>
  );
}

function formatLogResult(exercise, log) {
  const sets = log?.exercise_log_sets ?? [];
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

function normalizedResultSignature(exercise, log) {
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

function trendScore(exercise, log) {
  const sets = log?.exercise_log_sets ?? [];
  if (!sets.length) return null;

  if (exercise.type === "weighted") {
    return sets.reduce((total, set) => (
      total + ((Number(set.weight) || 0) * (Number(set.reps) || 0))
    ), 0);
  }

  if (exercise.type === "bodyweight") {
    return sets.reduce((total, set) => total + (Number(set.reps) || 0), 0);
  }

  if (exercise.type === "timed") {
    return sets.reduce((total, set) => total + (Number(set.duration_seconds) || 0), 0);
  }

  if (exercise.type === "cardio") {
    const entry = sets[0];
    if (!entry) return null;
    return (Number(entry.duration_seconds) || 0) * (Number(entry.speed) || 1);
  }

  if (exercise.type === "superset") {
    return sets.reduce((total, set) => (
      total + ((Number(set.weight) || 0) * (Number(set.reps) || 0))
    ), 0);
  }

  if (exercise.type === "mobility") {
    return sets.filter((set) => set.completed).length;
  }

  return null;
}

function trendMeta(exercise, log, previousLog) {
  const current = trendScore(exercise, log);
  const previous = trendScore(exercise, previousLog);
  if (current == null || previous == null) {
    return { direction: "neutral", symbol: "\u2022", label: "No trend yet" };
  }
  if (current > previous) {
    return { direction: "up", symbol: "\u2191", label: "Improved from previous log" };
  }
  if (current < previous) {
    return { direction: "down", symbol: "\u2193", label: "Lower than previous log" };
  }
  return { direction: "same", symbol: "\u2192", label: "Same as previous log" };
}

function isThreeByTenSignature(signature) {
  const [, repsPart] = signature.split(":");
  if (!repsPart) return false;
  const reps = repsPart.split(",").map(Number);
  return reps.length >= 3 && reps.slice(0, 3).every((rep) => rep >= 10);
}

function blankDraft(exercise) {
  const count = 1;

  if (exercise.type === "cardio") {
    return {
      cardio: {
        mode: "walking",
        incline: "",
        speed: "",
        duration: "",
      },
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
      sets: Array.from({ length: count }, () => ({
        parts: exercise.exercise_parts.slice(0, 2).map((part) => ({
          exercise_part_id: part.id,
          name: part.name,
          weight: "",
          reps: "",
        })),
      })),
    };
  }

  if (exercise.type === "timed") {
    return {
      sets: Array.from({ length: count }, () => ({
        duration: "",
      })),
    };
  }

  return {
    sets: Array.from({ length: count }, () => ({
      weight: exercise.type === "weighted" ? "" : null,
      reps: "",
    })),
  };
}

function draftFromLog(exercise, log) {
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
      sets: [...grouped.entries()].map(([, rowSets]) => ({
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

function setsFromDraft(exercise, draft) {
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

function addDraftSet(exercise, draft) {
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
      {
        weight: exercise.type === "weighted" ? "" : null,
        reps: "",
      },
    ],
  };
}

function updateDraftSet(draft, index, updater) {
  return {
    ...draft,
    sets: draft.sets.map((set, setIndex) => (
      setIndex === index ? updater(set) : set
    )),
  };
}

function setupInsight(exercise) {
  const logs = exercise.recent_logs ?? [];
  if (logs.length < 2) return "";

  const latest = logs[0];
  const previous = logs[1];
  const latestScore = trendScore(exercise, latest);
  const previousScore = trendScore(exercise, previous);
  const olderScores = logs.slice(1).map((log) => trendScore(exercise, log)).filter(Number.isFinite);
  const percentChange = previousScore > 0
    ? Math.round(((latestScore - previousScore) / previousScore) * 100)
    : 0;

  if (
    latestScore != null
    && olderScores.length
    && latestScore > Math.max(...olderScores)
  ) {
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
    const latestWeight = Math.max(...latest.exercise_log_sets.map((set) => Number(set.weight) || 0));
    const previousWeight = Math.max(...previous.exercise_log_sets.map((set) => Number(set.weight) || 0));
    const latestReps = latest.exercise_log_sets.reduce((sum, set) => sum + (Number(set.reps) || 0), 0);
    const previousReps = previous.exercise_log_sets.reduce((sum, set) => sum + (Number(set.reps) || 0), 0);
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

  const latestSignature = normalizedResultSignature(exercise, logs[0]);
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

  if (streak >= 3 && ["weighted", "bodyweight"].includes(exercise.type) && isThreeByTenSignature(latestSignature)) {
    return `You've hit 3x10 for ${streak} sessions. Consider increasing weight next time.`;
  }

  if (streak >= 3) return `Same result ${streak} sessions in a row — consistent and ready to progress.`;
  return Math.abs(percentChange) < 5 ? "Very close to your last result — a steady session." : "";
}

function LoadingScreen({ copy }) {
  return (
    <main className="loading-screen">
      <div className="loading-mark">F</div>
      <p>{copy}</p>
    </main>
  );
}

function DashboardCard({
  exercise,
  index,
  onOpen,
  dragging,
  dragOver,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onGripPointerDown,
}) {
  const completed = Boolean(exercise.selected_log);
  const lastLog = exercise.recent_logs.find((log) => log.id !== exercise.selected_log?.id)
    ?? exercise.recent_logs[0];
  const previousLog = lastLog
    ? exercise.recent_logs.find((log) => log.id !== lastLog.id)
    : null;
  const trend = trendMeta(exercise, lastLog, previousLog);

  return (
    <article
      className={`daily-card ${completed ? "is-complete" : "is-pending"} ${dragging ? "is-dragging" : ""} ${dragOver ? "is-drag-over" : ""}`}
      data-exercise-id={exercise.id}
      role="button"
      tabIndex="0"
      onClick={() => onOpen(exercise)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen(exercise);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragEnter={() => onDragEnter(exercise.id)}
      onDrop={(event) => {
        event.preventDefault();
        onDragEnd(exercise.id);
      }}
    >
      <ExerciseIconSlot exercise={exercise} />
      <span className="daily-card-main">
        <span className="daily-card-number">{String(index + 1).padStart(2, "0")}</span>
        <strong>{exercise.name}</strong>
        <small className="daily-card-last">
          <span>Last: {lastLog ? formatLogResult(exercise, lastLog) : "No history yet"}</span>
          {lastLog && (
            <span className={`list-trend trend-${trend.direction}`} aria-label={trend.label} title={trend.label}>
              {trend.symbol}
            </span>
          )}
        </small>
      </span>
      <span className="daily-card-action" aria-hidden="true">
        {completed ? "\u2713" : "\u203a"}
      </span>
      <span
        className="exercise-drag-handle"
        role="button"
        tabIndex="0"
        draggable
        aria-label={`Drag to reorder ${exercise.name}`}
        title="Drag to reorder"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        onDragStart={(event) => {
          event.stopPropagation();
          event.dataTransfer.effectAllowed = "move";
          onDragStart(exercise.id);
        }}
        onDragEnd={() => onDragEnd()}
        onPointerDown={(event) => {
          event.stopPropagation();
          onGripPointerDown(event, exercise.id);
        }}
      >
        <i /><i /><i /><i /><i /><i />
      </span>
    </article>
  );
}

function BreakTimer({ timer, onQuit }) {
  if (!timer) return null;
  return (
    <div className="break-timer-overlay" role="status">
      <strong>Break {secondsToClock(timer.remaining)}</strong>
      <button type="button" onClick={onQuit}>Quit</button>
    </div>
  );
}

function CompletionCelebration({ onClose }) {
  return (
    <div className="completion-backdrop" role="presentation" onClick={onClose}>
      <section
        className="completion-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="completion-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="completion-sparkles" aria-hidden="true">
          <span>✦</span><span>★</span><span>✦</span>
        </div>
        <div className="completion-check" aria-hidden="true">✓</div>
        <div className="header-kicker">Day complete</div>
        <h2 id="completion-title">You did it!</h2>
        <p>Every exercise is logged. Nice work showing up for yourself today.</p>
        <button className="soft-button primary" type="button" onClick={onClose}>
          Heck yeah
        </button>
      </section>
    </div>
  );
}

function BreakControl({ onStart, blocked = false, blockedPulse = false, onBlocked }) {
  const [open, setOpen] = useState(false);

  function handleOpen() {
    if (blocked) {
      onBlocked?.();
      return;
    }
    setOpen((value) => !value);
  }

  return (
    <div className="break-control">
      <button
        className={`soft-button secondary ${blockedPulse ? "timer-denied" : ""}`}
        type="button"
        onClick={handleOpen}
        aria-disabled={blocked}
      >
        Break
      </button>
      {open && (
        <div className="break-popover">
          {breakPresets.map((preset) => (
            <button
              key={preset.seconds}
              type="button"
              onClick={() => {
                if (blocked) {
                  onBlocked?.();
                  return;
                }
                onStart(preset.seconds);
                setOpen(false);
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SetRows({
  exercise,
  draft,
  setDraft,
  timer,
  setTimer,
  breakTimerActive = false,
  blockedPulse = false,
  onTimerBlocked,
}) {
  if (exercise.type === "cardio") {
    return (
      <div className="cardio-detail-grid">
        <label>
          Activity
          <select
            value={draft.cardio.mode}
            onChange={(event) => setDraft({
              ...draft,
              cardio: { ...draft.cardio, mode: event.target.value },
            })}
          >
            <option value="walking">Walking</option>
            <option value="running">Running</option>
          </select>
        </label>
        <label>
          Speed
          <input
            min="0"
            step="0.1"
            inputMode="decimal"
            type="number"
            value={draft.cardio.speed}
            onChange={(event) => setDraft({
              ...draft,
              cardio: { ...draft.cardio, speed: event.target.value },
            })}
            required
          />
        </label>
        <label>
          Incline
          <input
            min="0"
            step="0.5"
            inputMode="decimal"
            type="number"
            value={draft.cardio.incline}
            onChange={(event) => setDraft({
              ...draft,
              cardio: { ...draft.cardio, incline: event.target.value },
            })}
            required
          />
        </label>
        <label>
          Time
          <input
            inputMode="numeric"
            pattern="[0-9]{2}:[0-5][0-9]"
            placeholder="20:00"
            value={draft.cardio.duration}
            onChange={(event) => setDraft({
              ...draft,
              cardio: { ...draft.cardio, duration: formatDurationInput(event.target.value) },
            })}
            required
          />
        </label>
      </div>
    );
  }

  if (exercise.type === "mobility") {
    return (
      <div className="mobility-detail-list">
        {exercise.exercise_parts.map((part) => (
          <label key={part.id}>
            <input
              type="checkbox"
              checked={draft.mobility[part.id] ?? false}
              onChange={(event) => setDraft({
                ...draft,
                mobility: { ...draft.mobility, [part.id]: event.target.checked },
              })}
            />
            {part.name}
          </label>
        ))}
      </div>
    );
  }

  return (
    <div className="dynamic-sets">
      {draft.sets.map((set, index) => {
        if (exercise.type === "superset") {
          return (
            <div className="set-row superset-set-row" key={index}>
              <span className="set-number">Set {index + 1}</span>
              {set.parts.map((part, partIndex) => (
                <div className="part-set-fields" key={part.exercise_part_id}>
                  <b>{part.name}</b>
                  <input
                    min="0"
                    step="0.5"
                    inputMode="decimal"
                    type="number"
                    placeholder="lb"
                    value={part.weight}
                    onChange={(event) => setDraft(updateDraftSet(draft, index, (row) => ({
                      ...row,
                      parts: row.parts.map((item, itemIndex) => (
                        itemIndex === partIndex ? { ...item, weight: event.target.value } : item
                      )),
                    })))}
                    required
                  />
                  <input
                    min="0"
                    inputMode="numeric"
                    type="number"
                    placeholder="reps"
                    value={part.reps}
                    onChange={(event) => setDraft(updateDraftSet(draft, index, (row) => ({
                      ...row,
                      parts: row.parts.map((item, itemIndex) => (
                        itemIndex === partIndex ? { ...item, reps: event.target.value } : item
                      )),
                    })))}
                    required
                  />
                </div>
              ))}
              <button
                className="row-remove"
                type="button"
                aria-label={`Remove set ${index + 1}`}
                onClick={() => {
                  if (timer && index <= timer.index) setTimer(null);
                  setDraft({ ...draft, sets: draft.sets.filter((_, setIndex) => setIndex !== index) });
                }}
                disabled={draft.sets.length === 1}
              >
                {"\u00d7"}
              </button>
            </div>
          );
        }

        if (exercise.type === "timed") {
          const active = timer?.index === index;
          return (
            <div className={`set-row timed-set-row ${active ? "timer-active" : ""}`} key={index}>
              <span className="set-number">Set {index + 1}</span>
              <input
                inputMode="numeric"
                pattern="[0-9]{2}:[0-5][0-9]"
                placeholder="01:00"
                value={set.duration}
                onChange={(event) => setDraft(updateDraftSet(draft, index, (row) => ({
                  ...row,
                  duration: formatDurationInput(event.target.value),
                })))}
                required
              />
              {active && <strong className="inline-timer">Timing...</strong>}
              {!active && (
                <button
                  className={`set-action-button ${blockedPulse ? "timer-denied" : ""}`}
                  type="button"
                  onClick={() => {
                    if (breakTimerActive || timer) {
                      onTimerBlocked?.();
                      return;
                    }
                    setTimer({
                      index,
                      startedAt: Date.now(),
                      displaySeconds: 0,
                    });
                  }}
                >
                  Start
                </button>
              )}
              <button
                className="row-remove"
                type="button"
                aria-label={`Remove set ${index + 1}`}
                onClick={() => {
                  if (timer && index <= timer.index) setTimer(null);
                  setDraft({ ...draft, sets: draft.sets.filter((_, setIndex) => setIndex !== index) });
                }}
                disabled={draft.sets.length === 1}
              >
                {"\u00d7"}
              </button>
            </div>
          );
        }

        return (
          <div className="set-row" key={index}>
            <span className="set-number">Set {index + 1}</span>
            {exercise.type === "weighted" && (
              <input
                min="0"
                step="0.5"
                inputMode="decimal"
                type="number"
                placeholder="lb"
                value={set.weight}
                onChange={(event) => setDraft(updateDraftSet(draft, index, (row) => ({
                  ...row,
                  weight: event.target.value,
                })))}
                required
              />
            )}
            <input
              min="0"
              inputMode="numeric"
              type="number"
              placeholder="reps"
              value={set.reps}
              onChange={(event) => setDraft(updateDraftSet(draft, index, (row) => ({
                ...row,
                reps: event.target.value,
              })))}
              required
            />
            <button
              className="row-remove"
              type="button"
              aria-label={`Remove set ${index + 1}`}
              onClick={() => {
                if (timer && index <= timer.index) setTimer(null);
                setDraft({ ...draft, sets: draft.sets.filter((_, setIndex) => setIndex !== index) });
              }}
              disabled={draft.sets.length === 1}
            >
              {"\u00d7"}
            </button>
          </div>
        );
      })}
      <button className="soft-button secondary" type="button" onClick={() => setDraft(addDraftSet(exercise, draft))}>
        + Add another set
      </button>
    </div>
  );
}

function ExerciseDetail({
  exercise,
  selectedDate,
  onClose,
  onEditExercise,
  onSave,
  onDeleteHistory,
  onStartBreak,
  breakTimerActive,
  busy,
}) {
  const [draft, setDraft] = useState(() => draftFromLog(exercise, exercise.selected_log));
  const [editingLog, setEditingLog] = useState(exercise.selected_log);
  const [setTimer, setSetTimer] = useState(null);
  const [blockedTimerTarget, setBlockedTimerTarget] = useState("");
  const history = exercise.recent_logs ?? [];
  const insight = useMemo(() => setupInsight(exercise), [exercise]);
  const setTimerActive = Boolean(setTimer);

  useEffect(() => {
    if (!blockedTimerTarget) return undefined;
    const timeout = window.setTimeout(() => setBlockedTimerTarget(""), 450);
    return () => window.clearTimeout(timeout);
  }, [blockedTimerTarget]);

  useEffect(() => {
    const startedAt = setTimer?.startedAt;
    if (!startedAt) return undefined;
    const interval = window.setInterval(() => {
      setSetTimer((current) => {
        if (!current || current.startedAt !== startedAt) return current;
        return {
          ...current,
          displaySeconds: Math.floor((Date.now() - startedAt) / 1000),
        };
      });
    }, 250);
    return () => window.clearInterval(interval);
  }, [setTimer?.startedAt]);

  function stopSetTimer() {
    if (!setTimer) return;
    const finalSeconds = Math.floor((Date.now() - setTimer.startedAt) / 1000);
    setDraft((currentDraft) => updateDraftSet(currentDraft, setTimer.index, (row) => ({
      ...row,
      duration: secondsToClock(finalSeconds),
    })));
    setSetTimer(null);
  }

  function showTimerBlocked(target) {
    setBlockedTimerTarget("");
    window.requestAnimationFrame(() => setBlockedTimerTarget(target));
  }

  function repeatLast() {
    const lastLog = history.find((log) => log.id !== editingLog?.id);
    if (lastLog) setDraft(draftFromLog(exercise, lastLog));
  }

  return (
    <div className="detail-shell" role="dialog" aria-modal="true">
      <section className="detail-card">
        <button className="detail-close" type="button" onClick={onClose} aria-label="Close detail">{"\u00d7"}</button>
        <header className="detail-header">
          <ExerciseIconSlot exercise={exercise} large />
          <div>
            <span className="detail-kicker">
              {editingLog ? `Editing ${displayDate(logDateValue(editingLog))} log` : `Logging ${displayDate(selectedDate)}`}
            </span>
            <h2>{exercise.name}</h2>
          </div>
        </header>

        {insight && <p className="soft-insight">{insight}</p>}

        <div className="detail-toolbar">
          <button className="soft-button secondary" type="button" onClick={repeatLast} disabled={!history.length}>
            Repeat Last
          </button>
          {["weighted", "bodyweight", "superset", "timed"].includes(exercise.type) && (
            <BreakControl
              onStart={onStartBreak}
              blocked={setTimerActive || breakTimerActive}
              blockedPulse={blockedTimerTarget === "break"}
              onBlocked={() => showTimerBlocked("break")}
            />
          )}
          <button className="soft-button secondary" type="button" onClick={() => onEditExercise(exercise)}>
            Manage
          </button>
        </div>

        <form
          className="detail-form"
          onSubmit={async (event) => {
            event.preventDefault();
            await onSave(
              exercise,
              setsFromDraft(exercise, draft),
              editingLog ? logDateValue(editingLog) : selectedDate,
            );
          }}
        >
          <SetRows
            exercise={exercise}
            draft={draft}
            setDraft={setDraft}
            timer={setTimer}
            setTimer={setSetTimer}
            breakTimerActive={breakTimerActive}
            blockedPulse={blockedTimerTarget === "set"}
            onTimerBlocked={() => showTimerBlocked("set")}
          />
          <div className="log-action-row">
            {exercise.type === "timed" && setTimer && (
              <div className="set-timer-overlay" role="timer">
                <strong>Plank {secondsToClock(setTimer.displaySeconds)}</strong>
                <button type="button" onClick={stopSetTimer}>Stop</button>
              </div>
            )}
            <button className="soft-button primary save-log-button" type="submit" disabled={busy}>
              {busy ? "Saving..." : "Save Log"}
            </button>
          </div>
        </form>

        <section className="history-panel">
          {history.length ? (
            <div className="history-chip-strip" aria-label="Recent workout trend">
              {history.slice(0, 7).map((log, index) => {
                const trend = trendMeta(exercise, log, history[index + 1]);
                return (
                  <article className={`history-chip trend-${trend.direction}`} key={log.id}>
                    <div className="history-chip-main">
                      <span className="history-chip-date">{displayDate(logDateValue(log))}</span>
                      <span className="history-chip-result">{formatLogResult(exercise, log)}</span>
                    </div>
                    <span className="history-chip-trend" aria-label={trend.label}>{trend.symbol}</span>
                    <div className="history-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLog(log);
                          setDraft(draftFromLog(exercise, log));
                        }}
                      >
                        Edit
                      </button>
                      <button type="button" onClick={() => onDeleteHistory(log)}>
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="empty-copy">No history yet. This can be the first quiet little entry.</p>
          )}
        </section>
      </section>
    </div>
  );
}

export default function WorkoutLogPage({ user, onSignOut, showToast }) {
  const [exercises, setExercises] = useState([]);
  const [selectedDate, setSelectedDate] = useState(localDateValue());
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [breakTimer, setBreakTimer] = useState(null);
  const [celebrating, setCelebrating] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("workout-theme") || "light");
  const [pendingSyncCount, setPendingSyncCount] = useState(() => pendingWorkoutCount(user.id));
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const selectedDateRef = useRef(selectedDate);
  const lastLoadedDateRef = useRef("");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("workout-theme", theme);
  }, [theme]);

  useEffect(() => subscribeToWorkoutQueue(user.id, setPendingSyncCount), [user.id]);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  const loadRoutine = useCallback(async () => {
    const remoteRows = await getDailyWorkoutDashboard(user.id, selectedDate);
    const rows = mergePendingWorkoutLogs(remoteRows, user.id, selectedDate);
    lastLoadedDateRef.current = selectedDate;
    setExercises(rows);
    setSelectedExercise((current) => {
      if (!current) return null;
      return rows.find((exercise) => exercise.id === current.id) ?? null;
    });
    return rows;
  }, [selectedDate, user.id]);

  useEffect(() => {
    let active = true;
    const sync = async () => {
      const synced = await flushPendingWorkoutLogs(user.id);
      if (active && synced > 0) await loadRoutine();
    };
    const interval = window.setInterval(sync, 30000);
    window.addEventListener("online", sync);
    sync();
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("online", sync);
    };
  }, [loadRoutine, user.id]);

  useEffect(() => {
    let active = true;

    async function initialize() {
      setLoading(true);
      setLoadError("");
      try {
        await seedDefaultRoutineIfEmpty(user.id);
        const reconciledCount = await reconcileAliasedExercises(user.id);
        await addMissingDefaultExercises(user.id);
        await syncDefaultRoutine(user.id);
        const splitCount = await deactivateLegacyLateralRaiseSuperset(user.id);
        const duplicateCount = await deactivateDuplicateExercises(user.id);
        const remoteRows = await getDailyWorkoutDashboard(user.id, selectedDateRef.current);
        const rows = mergePendingWorkoutLogs(
          remoteRows,
          user.id,
          selectedDateRef.current,
        );
        lastLoadedDateRef.current = selectedDateRef.current;
        if (active) {
          setExercises(rows);
          setSelectedExercise((current) => {
            if (!current) return null;
            return rows.find((exercise) => exercise.id === current.id) ?? null;
          });
        }
        if (active && splitCount) {
          showToast("Split lateral raises into separate exercises.");
        }
        if (active && duplicateCount) {
          showToast(`Removed ${duplicateCount} duplicate exercises.`);
        }
        if (active && reconciledCount) {
          showToast("Merged Hanging L-Raises and restored its history.");
        }
      } catch (error) {
        console.error(error);
        if (active) setLoadError(setupErrorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();
    return () => {
      active = false;
    };
  }, [reloadKey, showToast, user.id]);

  useEffect(() => {
    if (loading || loadError || lastLoadedDateRef.current === selectedDate) return undefined;

    let active = true;
    loadRoutine().catch((error) => {
      console.error(error);
      if (active) showToast(error.message, "error");
    });

    return () => {
      active = false;
    };
  }, [loadError, loadRoutine, loading, selectedDate, showToast]);

  useEffect(() => {
    if (!breakTimer) return undefined;
    if (breakTimer.remaining <= 0) {
      const doneTimer = window.setTimeout(() => setBreakTimer(null), 900);
      return () => window.clearTimeout(doneTimer);
    }

    const interval = window.setInterval(() => {
      setBreakTimer((timer) => (
        timer ? { ...timer, remaining: Math.max(0, timer.remaining - 1) } : null
      ));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [breakTimer]);

  async function perform(action, successMessage, { reload = true } = {}) {
    setBusy(true);
    try {
      await action();
      if (reload) await loadRoutine();
      showToast(successMessage);
      return true;
    } catch (error) {
      console.error(error);
      showToast(error.message, "error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function finishReorder(targetId = dragOverId, sourceOverride = null) {
    const sourceId = sourceOverride ?? draggingId;
    setDraggingId(null);
    setDragOverId(null);
    if (!sourceId || !targetId || sourceId === targetId) return;
    const snapshot = exercises;
    const sourceIndex = snapshot.findIndex((item) => item.id === sourceId);
    const targetIndex = snapshot.findIndex((item) => item.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const reordered = [...snapshot];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    setExercises(reordered);
    try {
      await moveExerciseTo(user.id, sourceId, targetId);
      await loadRoutine();
      showToast("Exercise order updated.");
    } catch (error) {
      console.error(error);
      setExercises(snapshot);
      showToast(error.message, "error");
    }
  }

  function startPointerReorder(event, exerciseId) {
    if (event.pointerType === "mouse") return;
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    setDraggingId(exerciseId);
    setDragOverId(exerciseId);

    const move = (moveEvent) => {
      const card = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)
        ?.closest("[data-exercise-id]");
      if (card) setDragOverId(card.dataset.exerciseId);
    };
    const end = (endEvent) => {
      handle.releasePointerCapture(endEvent.pointerId);
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", cancel);
      const card = document.elementFromPoint(endEvent.clientX, endEvent.clientY)
        ?.closest("[data-exercise-id]");
      finishReorder(card?.dataset.exerciseId, exerciseId);
    };
    const cancel = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", cancel);
      setDraggingId(null);
      setDragOverId(null);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", cancel);
  }

  if (loading) return <LoadingScreen copy="Loading routine..." />;

  if (loadError) {
    return (
      <main className="setup-error-screen">
        <section className="setup-error-card">
          <div className="confirm-symbol">!</div>
          <div className="header-kicker">Supabase Setup</div>
          <h1>Almost There</h1>
          <p>{loadError}</p>
          <div className="setup-error-actions">
            <button className="soft-button primary" type="button" onClick={() => setReloadKey((key) => key + 1)}>
              Retry
            </button>
            <button className="soft-button secondary" type="button" onClick={onSignOut}>
              Sign Out
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={`workout-page ${selectedExercise ? "detail-open" : ""}`}>
      <div className="aero-fall-field" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <header className="workout-header">
        <div className="workout-title-block">
          <div className="header-kicker">Daily Fitness Journal</div>
          <h1>Forge</h1>
        </div>
        <details className="header-actions">
          <summary className="soft-button secondary">Menu</summary>
          <div className="header-action-menu">
            <button
              type="button"
              onClick={() => {
                setTheme((current) => current === "light" ? "dark" : "light");
              }}
              aria-pressed={theme === "dark"}
            >
              {theme === "light" ? "Dark mode" : "Light mode"}
            </button>
            <button className="sign-out-action" type="button" onClick={onSignOut}>
              Sign Out
            </button>
          </div>
        </details>
      </header>

      <section className="dashboard-controls" aria-label="Workout date controls">
        <label className="date-control">
          <span>Date</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </label>
        <button className="today-pill" type="button" onClick={() => setSelectedDate(localDateValue())}>
          Today
        </button>
        <button className="soft-button primary add-exercise-button" type="button" onClick={() => setAddOpen(true)}>
          + Add Exercise
        </button>
      </section>
      {pendingSyncCount > 0 && (
        <div className="sync-status" role="status">
          <span aria-hidden="true">●</span>
          Saved locally · {pendingSyncCount} {pendingSyncCount === 1 ? "workout" : "workouts"} waiting to sync
        </div>
      )}

      {exercises.length ? (
        <section className="daily-card-grid" aria-label="Daily exercise checklist">
          {exercises.map((exercise, index) => (
            <DashboardCard
              key={exercise.id}
              exercise={exercise}
              index={index}
              onOpen={setSelectedExercise}
              dragging={draggingId === exercise.id}
              dragOver={dragOverId === exercise.id && draggingId !== exercise.id}
              onDragStart={(id) => {
                setDraggingId(id);
                setDragOverId(id);
              }}
              onDragEnter={setDragOverId}
              onDragEnd={finishReorder}
              onGripPointerDown={startPointerReorder}
            />
          ))}
        </section>
      ) : (
        <section className="empty-routine">
          <h2>Your routine is empty</h2>
          <p>Add an exercise to start your daily checklist.</p>
          <button className="soft-button primary" type="button" onClick={() => setAddOpen(true)}>Add Exercise</button>
        </section>
      )}

      {selectedExercise && (
        <ExerciseDetail
          key={`${selectedExercise.id}-${selectedExercise.selected_log?.id ?? "new"}`}
          exercise={selectedExercise}
          selectedDate={selectedDate}
          busy={busy}
          breakTimerActive={Boolean(breakTimer)}
          onClose={() => setSelectedExercise(null)}
          onEditExercise={(exercise) => setEditing(exercise)}
          onStartBreak={(seconds) => setBreakTimer({ remaining: seconds })}
          onDeleteHistory={async (log) => {
            if (!window.confirm("Delete this history entry?")) return;
            await perform(() => deleteExerciseLog(log.id), "History entry deleted.");
          }}
          onSave={async (exercise, sets, logDate) => {
            const queued = queueWorkoutLog(user.id, exercise.id, sets, logDate);
            const optimisticLog = {
              id: `local-${queued.id}`,
              exercise_id: exercise.id,
              performed_at: new Date(`${logDate}T12:00:00`).toISOString(),
              exercise_log_sets: sets,
              pending_sync: true,
            };
            let nextRows = [];
            setExercises((current) => {
              nextRows = current.map((item) => (
                item.id === exercise.id ? { ...item, selected_log: optimisticLog } : item
              ));
              return nextRows;
            });
            setSelectedExercise(null);
            showToast(navigator.onLine ? "Saved locally. Syncing…" : "Saved locally. We’ll sync when you’re online.");
            if (nextRows.length > 0 && nextRows.every((item) => item.selected_log)) {
              setCelebrating(true);
            }
            flushPendingWorkoutLogs(user.id).then((synced) => {
              if (synced > 0) loadRoutine();
            });
          }}
        />
      )}

      <BreakTimer timer={breakTimer} onQuit={() => setBreakTimer(null)} />
      {celebrating && <CompletionCelebration onClose={() => setCelebrating(false)} />}

      <AddExerciseModal
        open={addOpen}
        busy={busy}
        onClose={() => setAddOpen(false)}
        onSave={async (values) => {
          const nextPosition = exercises.reduce(
            (highest, exercise) => Math.max(highest, exercise.position),
            0,
          ) + 1;
          const saved = await perform(
            () => createExercise(user.id, values, nextPosition),
            "Exercise added.",
          );
          if (saved) setAddOpen(false);
        }}
      />
      <EditExerciseModal
        key={editing?.id ?? "closed"}
        exercise={editing}
        busy={busy}
        onClose={() => setEditing(null)}
        onRemove={() => {
          setRemoving(editing);
          setEditing(null);
        }}
        onSave={async (values) => {
          const saved = await perform(
            () => updateExercise(editing.id, values),
            "Exercise updated.",
          );
          if (saved) setEditing(null);
        }}
      />
      <RemoveExerciseModal
        exercise={removing}
        busy={busy}
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          const removed = await perform(
            () => deactivateExercise(removing.id),
            "Exercise removed. History preserved.",
          );
          if (removed) setRemoving(null);
        }}
      />
    </main>
  );
}

