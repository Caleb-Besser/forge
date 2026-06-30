import LogInputForm from "./LogInputForm";
import RecentLogs from "./RecentLogs";

export default function ExerciseCard({ exercise, onEdit, onLog, busy }) {
  return (
    <article className="exercise-card">
      <header className="exercise-card-head">
        <div>
          <span className="exercise-position">{String(exercise.position).padStart(2, "0")}</span>
          <h2>{exercise.name}</h2>
        </div>
        <button className="icon-button" type="button" onClick={onEdit} aria-label="Edit exercise">
          EDIT
        </button>
      </header>

      <div className="exercise-meta">
        <span>{exercise.type.replace("bodyweight", "body weight")}</span>
        {exercise.type !== "cardio" && <span>{exercise.default_sets} sets</span>}
        {exercise.default_weight != null && <span>{exercise.default_weight} lb default</span>}
      </div>

      <div className="card-content">
        <RecentLogs exercise={exercise} />
        <LogInputForm key={exercise.id} exercise={exercise} onSubmit={onLog} busy={busy} />
      </div>
    </article>
  );
}
