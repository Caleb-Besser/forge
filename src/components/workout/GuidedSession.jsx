import { useMemo, useState } from "react";
import { draftFromLog, setupInsight } from "../../lib/workoutLogUtils";
import { guideMoment } from "../../lib/mascotGuide";
import { isSkippedLog } from "../../lib/guidedSession";
import MascotGuide from "./MascotGuide";

export default function GuidedSession({
  exercises,
  session,
  selectedDate,
  busy,
  breakTimerActive,
  onStart,
  onCancel,
  onSessionChange,
  onSave,
  onSkip,
  onStartBreak,
  onEditExercise,
  onDeleteHistory,
  onShowList,
  renderExercise,
}) {
  const [reaction, setReaction] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const currentExercise = exercises.find(
    (exercise) => exercise.id === session.currentExerciseId,
  ) ?? exercises.find((exercise) => !exercise.selected_log) ?? exercises[0];
  const currentIndex = Math.max(
    0,
    exercises.findIndex((exercise) => exercise.id === currentExercise?.id),
  );
  const completedCount = exercises.filter(
    (exercise) => exercise.selected_log && !isSkippedLog(exercise.selected_log),
  ).length;
  const skippedCount = exercises.filter((exercise) => isSkippedLog(exercise.selected_log)).length;
  const currentInsight = useMemo(
    () => (currentExercise ? setupInsight(currentExercise) : ""),
    [currentExercise],
  );

  const baseMoment = useMemo(() => {
    if (session.status === "complete") {
      return guideMoment({ state: "workoutComplete", date: selectedDate, duo: true });
    }
    if (breakTimerActive) {
      return guideMoment({
        state: "rest",
        date: selectedDate,
        exerciseId: currentExercise?.id,
        index: currentIndex,
      });
    }
    const moment = guideMoment({
      state: session.status === "greeting" ? "greeting" : "focused",
      date: selectedDate,
      exerciseId: currentExercise?.id,
      exerciseName: currentExercise?.name,
      index: currentIndex,
    });
    return session.status === "active" && currentInsight
      ? { ...moment, message: currentInsight }
      : moment;
  }, [
    breakTimerActive,
    currentExercise?.id,
    currentExercise?.name,
    currentInsight,
    currentIndex,
    selectedDate,
    session.status,
  ]);

  if (!exercises.length) return null;

  if (session.status === "greeting") {
    return (
      <section className="guided-greeting">
        <div className="guided-orbit" aria-hidden="true" />
        <div className="header-kicker">Guided session · Today</div>
        <h2>Your workout is ready.</h2>
        <MascotGuide moment={baseMoment} />
        <div className="guided-greeting-meta">
          <strong>{exercises.length} exercises</strong>
          <span>Fast, focused, and saved as you go.</span>
        </div>
        <button className="soft-button primary guided-start" type="button" onClick={onStart}>
          Start Workout
        </button>
        <button className="text-action" type="button" onClick={onShowList}>
          Open full list
        </button>
      </section>
    );
  }

  if (session.status === "complete") {
    return (
      <section className="guided-complete">
        <div className="header-kicker">Workout complete</div>
        <h2>Session cleared.</h2>
        <MascotGuide moment={baseMoment} />
        <div className="guided-summary">
          <div><strong>{completedCount}</strong><span>Completed</span></div>
          <div><strong>{skippedCount}</strong><span>Skipped</span></div>
          <div><strong>{exercises.length}</strong><span>Total</span></div>
        </div>
        <button className="soft-button primary" type="button" onClick={onShowList}>
          View Workout List
        </button>
      </section>
    );
  }

  const displayMoment = reaction ?? baseMoment;

  async function finishExercise(kind, saveAction) {
    if (transitioning) return;
    setTransitioning(true);
    const result = await saveAction();
    if (!result) {
      setTransitioning(false);
      return;
    }
    const personalBest = Boolean(result.personalBest);
    const duo = personalBest || exercises.length === 1 || (currentIndex + 1) % 4 === 0;
    const nextReaction = guideMoment({
      state: kind === "skip" ? "skipped" : "exerciseComplete",
      date: selectedDate,
      exerciseId: currentExercise.id,
      index: currentIndex,
      duo: kind !== "skip" && duo,
    });
    setReaction(personalBest
      ? { ...nextReaction, message: "New best. You moved the line." }
      : nextReaction);
    window.setTimeout(() => {
      setReaction(null);
      setTransitioning(false);
      onSessionChange("advance", currentExercise.id);
    }, 650);
  }

  return (
    <section className="guided-session">
      <div className="guided-progress-row">
        <span>Exercise {currentIndex + 1} of {exercises.length}</span>
        <div className="guided-progress-actions">
          <button type="button" onClick={onShowList}>Full list</button>
          <button
            className="cancel-session-action"
            type="button"
            disabled={busy || transitioning}
            onClick={onCancel}
          >
            Cancel session
          </button>
        </div>
      </div>
      <div className="guided-progress-track" aria-hidden="true">
        <span style={{ width: `${((currentIndex + 1) / exercises.length) * 100}%` }} />
      </div>

      <MascotGuide moment={displayMoment} compact />

      {renderExercise({
        key: `${currentExercise.id}-${currentExercise.selected_log?.id ?? "new"}`,
        exercise: currentExercise,
        selectedDate,
        busy: busy || transitioning,
        breakTimerActive,
        presentation: "guided",
        progressLabel: `${currentIndex + 1} of ${exercises.length}`,
        initialDraft: (
          session.drafts[currentExercise.id]
          ?? draftFromLog(currentExercise, currentExercise.selected_log)
        ),
        initialSetTimer: session.setTimers[currentExercise.id] ?? null,
        inlineFeeling: session.feelings[currentExercise.id] ?? null,
        onInlineFeelingChange: (feeling) => onSessionChange(
          "feeling",
          currentExercise.id,
          feeling,
        ),
        onDraftChange: (draft) => onSessionChange("draft", currentExercise.id, draft),
        onSetTimerChange: (timer) => onSessionChange(
          "setTimer",
          currentExercise.id,
          timer,
        ),
        onEditExercise,
        onStartBreak,
        onDeleteHistory,
        onSave: (exercise, sets, logDate, feeling) => finishExercise(
          "complete",
          () => onSave(exercise, sets, logDate, feeling),
        ),
      })}

      <nav className="guided-navigation" aria-label="Guided workout navigation">
        <button
          className="soft-button secondary"
          type="button"
          disabled={currentIndex === 0 || transitioning}
          onClick={() => onSessionChange("previous", currentExercise.id)}
        >
          Previous
        </button>
        <button
          className="soft-button secondary skip-action"
          type="button"
          disabled={transitioning}
          onClick={() => (
            currentExercise.selected_log
              ? onSessionChange("advance", currentExercise.id)
              : finishExercise("skip", () => onSkip(currentExercise))
          )}
        >
          {currentExercise.selected_log ? "Next exercise" : "Skip exercise"}
        </button>
      </nav>
    </section>
  );
}
