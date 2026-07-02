import { formatLogResult, trendMeta } from "../../lib/workoutLogUtils";
import ExerciseIconSlot from "./ExerciseIconSlot";

export default function DashboardCard({
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
        {completed ? "✓" : "›"}
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
