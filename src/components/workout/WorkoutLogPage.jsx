import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createExercise,
  deleteExerciseLog,
  ensureDefaultWeeklyRoutine,
  getDailyWorkoutDashboard,
  moveExerciseTo,
  removeExerciseFromWorkout,
  updateExercise,
} from "../../lib/workoutApi";
import {
  flushPendingWorkoutLogs,
  mergePendingWorkoutLogs,
  pendingWorkoutCount,
  pendingWorkoutFeeling,
  queueWorkoutLog,
  setQueuedWorkoutFeeling,
  subscribeToWorkoutQueue,
} from "../../lib/localWorkoutSync";
import {
  addDraftSet,
  displayDate,
  draftFromLog,
  formatDurationInput,
  formatLogResult,
  localDateValue,
  logDateValue,
  secondsToClock,
  setsFromDraft,
  setupInsight,
  trendScore,
  trendMeta,
  updateDraftSet,
} from "../../lib/workoutLogUtils";
import { workoutFeeling } from "../../lib/workoutFeelings";
import { guideMoment } from "../../lib/mascotGuide";
import AddExerciseModal from "./AddExerciseModal";
import DashboardCard from "./DashboardCard";
import EditExerciseModal from "./EditExerciseModal";
import ExerciseIconSlot from "./ExerciseIconSlot";
import MascotGuide from "./MascotGuide";
import RemoveExerciseModal from "./RemoveExerciseModal";
import WorkoutFeelingPrompt from "./WorkoutFeelingPrompt";
import {
  BreakTimer,
  CompletionCelebration,
  LoadingScreen,
} from "./WorkoutOverlays";

const breakPresets = [
  { label: "30s", seconds: 30 },
  { label: "45s", seconds: 45 },
  { label: "1m", seconds: 60 },
  { label: "90s", seconds: 90 },
  { label: "2m", seconds: 120 },
];
const SKIPPED_LOG_NOTE = "Skipped";

function remainingTimerSeconds(timer, now = Date.now()) {
  if (!timer?.endsAt) return 0;
  return Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
}

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
  const [draft, setDraft] = useState(
    () => draftFromLog(exercise, exercise.selected_log),
  );
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
    }, 1000);
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
              {editingLog
                ? `Editing ${displayDate(logDateValue(editingLog))} log`
                : `Logging ${displayDate(selectedDate)}`}
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
                const feeling = workoutFeeling(log.feeling);
                return (
                  <article className={`history-chip trend-${trend.direction}`} key={log.id}>
                    <div className="history-chip-main">
                      <span className="history-chip-date">{displayDate(logDateValue(log))}</span>
                      <span className="history-chip-result">{formatLogResult(exercise, log)}</span>
                      {feeling && (
                        <span className="history-chip-feeling">
                          <span aria-hidden="true">{feeling.emoji}</span>
                          {feeling.label}
                        </span>
                      )}
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
  const today = localDateValue();
  const [exercises, setExercises] = useState([]);
  const [workout, setWorkout] = useState(null);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [breakTimer, setBreakTimer] = useState(null);
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const [celebrating, setCelebrating] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("workout-theme") || "light");
  const [pendingSyncCount, setPendingSyncCount] = useState(() => pendingWorkoutCount(user.id));
  const [pendingFeeling, setPendingFeeling] = useState(
    () => pendingWorkoutFeeling(user.id),
  );
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
    const dashboard = await getDailyWorkoutDashboard(user.id, selectedDate);
    const rows = mergePendingWorkoutLogs(dashboard.exercises, user.id, selectedDate);
    lastLoadedDateRef.current = selectedDate;
    setWorkout(dashboard.workout);
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
        await ensureDefaultWeeklyRoutine(user.id);
        const dashboard = await getDailyWorkoutDashboard(user.id, selectedDateRef.current);
        const rows = mergePendingWorkoutLogs(
          dashboard.exercises,
          user.id,
          selectedDateRef.current,
        );
        lastLoadedDateRef.current = selectedDateRef.current;
        if (active) {
          setWorkout(dashboard.workout);
          setExercises(rows);
          setSelectedExercise((current) => {
            if (!current) return null;
            return rows.find((exercise) => exercise.id === current.id) ?? null;
          });
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
    if (!breakTimer?.endsAt) return undefined;
    const tick = () => setTimerNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [breakTimer]);

  useEffect(() => {
    if (!breakTimer?.endsAt || breakTimer.endsAt > timerNow) return undefined;
    const doneTimer = window.setTimeout(() => {
      setBreakTimer(null);
    }, 900);
    return () => window.clearTimeout(doneTimer);
  }, [breakTimer, timerNow]);

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

  function startBreak(seconds) {
    const timer = {
      duration: seconds,
      endsAt: Date.now() + (seconds * 1000),
    };
    setBreakTimer(timer);
  }

  function quitBreak() {
    setBreakTimer(null);
  }

  function commitExerciseLog(
    exercise,
    sets,
    logDate,
    {
      feeling = null,
      notes = "",
      awaitingFeeling = false,
      announce = false,
    } = {},
  ) {
    try {
      const candidateScore = notes === SKIPPED_LOG_NOTE
        ? null
        : trendScore(exercise, { exercise_log_sets: sets });
      const previousScores = (exercise.recent_logs ?? [])
        .filter((log) => log.id !== exercise.selected_log?.id && log.notes !== SKIPPED_LOG_NOTE)
        .map((log) => trendScore(exercise, log))
        .filter((score) => score != null);
      const personalBest = candidateScore != null
        && previousScores.length > 0
        && candidateScore > Math.max(...previousScores);
      const queued = queueWorkoutLog(
        user.id,
        exercise.id,
        sets,
        logDate,
        { feeling, notes, awaitingFeeling },
      );
      const optimisticLog = {
        id: `local-${queued.id}`,
        exercise_id: exercise.id,
        performed_at: new Date(`${logDate}T12:00:00`).toISOString(),
        exercise_log_sets: sets,
        notes: notes || null,
        feeling,
        pending_sync: true,
      };
      setExercises((current) => current.map((item) => (
        item.id === exercise.id
          ? {
              ...item,
              selected_log: optimisticLog,
              recent_logs: [
                optimisticLog,
                ...(item.recent_logs ?? []).filter(
                  (log) => logDateValue(log) !== logDate,
                ),
              ],
            }
          : item
      )));
      if (awaitingFeeling) setPendingFeeling(queued);
      if (announce) {
        showToast(
          navigator.onLine
            ? "Saved locally. Syncing…"
            : "Saved locally. We’ll sync when you’re online.",
        );
      }
      if (!awaitingFeeling) {
        flushPendingWorkoutLogs(user.id).then((synced) => {
          if (synced > 0) loadRoutine();
        });
      }
      return { saved: true, personalBest };
    } catch (error) {
      console.error(error);
      showToast("Could not save this workout locally.", "error");
      return false;
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
      await moveExerciseTo(workout.id, sourceId, targetId);
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

  const displayedBreakTimer = breakTimer
    ? {
        ...breakTimer,
        remaining: remainingTimerSeconds(breakTimer, timerNow),
      }
    : null;

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
        {workout?.id && (
          <button className="soft-button primary add-exercise-button" type="button" onClick={() => setAddOpen(true)}>
            + Add Exercise
          </button>
        )}
      </section>
      {pendingSyncCount > 0 && (
        <div className="sync-status" role="status">
          <span aria-hidden="true">●</span>
          Saved locally · {pendingSyncCount} {pendingSyncCount === 1 ? "workout" : "workouts"} waiting to sync
        </div>
      )}

      <MascotGuide
        compact
        className="list-mascot"
        moment={(() => {
          if (!workout) {
            return {
              ...guideMoment({ state: "rest", date: selectedDate }),
              message: "Rest day. Recover well and come back ready.",
            };
          }
          const completed = exercises.filter((exercise) => exercise.selected_log).length;
          if (exercises.length > 0 && completed === exercises.length) {
            return guideMoment({ state: "workoutComplete", date: selectedDate, duo: true });
          }
          if (completed > 0) {
            return guideMoment({ state: "exerciseComplete", date: selectedDate, index: completed });
          }
          return guideMoment({
            state: "greeting",
            date: selectedDate,
            exerciseId: exercises[0]?.id,
            exerciseName: exercises[0]?.name,
          });
        })()}
      />

      {workout && exercises.length ? (
        <>
        <div className="routine-heading">
          <div>
            <span>{displayDate(selectedDate)}</span>
            <h2>{workout.name}</h2>
          </div>
          <strong>{exercises.filter((exercise) => exercise.selected_log).length}/{exercises.length}</strong>
        </div>
        <section className="daily-card-grid" aria-label={`${workout.name} exercise checklist`}>
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
                reorderable={exercise.in_workout}
            />
          ))}
        </section>
        </>
      ) : workout ? (
        <section className="empty-routine">
          <h2>{workout.name} is empty</h2>
          <p>Add an exercise when you are ready to adjust this routine.</p>
          <button className="soft-button primary" type="button" onClick={() => setAddOpen(true)}>Add Exercise</button>
        </section>
      ) : (
        <section className="empty-routine rest-day">
          <h2>Rest day</h2>
          <p>No workout is assigned to this weekday.</p>
        </section>
      )}

      {selectedExercise && (
        <ExerciseDetail
          key={`${selectedExercise.id}-${selectedExercise.selected_log?.id ?? "new"}`}
          exercise={selectedExercise}
          selectedDate={selectedDate}
          busy={busy}
          breakTimerActive={Boolean(displayedBreakTimer)}
          onClose={() => setSelectedExercise(null)}
          onEditExercise={(exercise) => setEditing(exercise)}
          onStartBreak={startBreak}
          onDeleteHistory={async (log) => {
            if (!window.confirm("Delete this history entry?")) return;
            await perform(() => deleteExerciseLog(log.id), "History entry deleted.");
          }}
          onSave={async (exercise, sets, logDate) => {
            commitExerciseLog(
              exercise,
              sets,
              logDate,
              { awaitingFeeling: true },
            );
          }}
        />
      )}

      <BreakTimer timer={displayedBreakTimer} onQuit={quitBreak} />
      {pendingFeeling && (
        <WorkoutFeelingPrompt
          exerciseName={
            exercises.find((exercise) => exercise.id === pendingFeeling.exerciseId)?.name
            ?? "Workout"
          }
          onChoose={(feeling) => {
            setQueuedWorkoutFeeling(user.id, pendingFeeling.id, feeling);
            setExercises((current) => current.map((exercise) => (
              exercise.id === pendingFeeling.exerciseId && exercise.selected_log
                ? {
                    ...exercise,
                    selected_log: { ...exercise.selected_log, feeling },
                    recent_logs: (exercise.recent_logs ?? []).map((log) => (
                      log.id === exercise.selected_log.id ? { ...log, feeling } : log
                    )),
                  }
                : exercise
            )));
            const completesDay = exercises.length > 0
              && exercises.every((exercise) => exercise.selected_log);
            setPendingFeeling(null);
            setSelectedExercise(null);
            showToast(
              navigator.onLine
                ? "Saved locally. Syncing…"
                : "Saved locally. We’ll sync when you’re online.",
            );
            if (completesDay) setCelebrating(true);
            flushPendingWorkoutLogs(user.id).then((synced) => {
              if (synced > 0) loadRoutine();
            });
          }}
        />
      )}
      {celebrating && (
        <CompletionCelebration onClose={() => setCelebrating(false)} />
      )}

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
            () => createExercise(user.id, workout.id, values, nextPosition),
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
        onRemove={editing?.in_workout ? () => {
          setRemoving(editing);
          setEditing(null);
        } : null}
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
            () => removeExerciseFromWorkout(workout.id, removing.id),
            `Exercise removed from ${workout.name}. History preserved.`,
          );
          if (removed) setRemoving(null);
        }}
      />
    </main>
  );
}

