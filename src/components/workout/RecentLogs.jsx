function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function formatSets(exercise, sets) {
  if (exercise.type === "cardio") {
    const entry = sets[0];
    if (!entry) return "No cardio details";
    const totalSeconds = entry.duration_seconds ?? 0;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const time = seconds ? `${minutes}m ${seconds}s` : `${minutes} min`;
    const mode = entry.activity_mode === "running" ? "Run" : "Walk";
    return `${mode} / ${entry.speed ?? 0} mph / ${entry.incline ?? 0}% / ${time}`;
  }
  if (exercise.type === "mobility") {
    const completed = sets.filter((set) => set.completed).length;
    return `${completed}/${exercise.exercise_parts.length} complete`;
  }
  if (exercise.type === "timed") {
    return sets.map((set) => `${set.duration_seconds ?? 0}s`).join(" / ");
  }
  if (exercise.type === "superset") {
    return exercise.exercise_parts.slice(0, 2).map((part) => {
      const partSets = sets.filter((set) => set.exercise_part_id === part.id);
      const weight = partSets.find((set) => set.weight != null)?.weight;
      const reps = partSets.map((set) => set.reps ?? 0).join("/");
      return `${weight ?? 0} lb ${reps}`;
    }).join(" + ");
  }

  const reps = sets.map((set) => set.reps ?? 0).join(" / ");
  const weight = sets.find((set) => set.weight != null)?.weight;
  return weight != null ? `${weight} lb / ${reps}` : reps;
}

export default function RecentLogs({ exercise }) {
  return (
    <section className="recent-logs" aria-label="Recent logs">
      <div className="section-label">Recent Logs</div>
      {exercise.recent_logs.length ? (
        exercise.recent_logs.map((log) => (
          <div className="recent-log-row" key={log.id}>
            <strong>{formatSets(exercise, log.exercise_log_sets ?? [])}</strong>
            <span>{formatDate(log.performed_at)}</span>
          </div>
        ))
      ) : (
        <p className="empty-copy">No logs yet. Your first entry starts here.</p>
      )}
    </section>
  );
}
