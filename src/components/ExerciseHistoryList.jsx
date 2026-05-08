import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

async function getWorkoutLogs(exerciseId) {
  const { data, error } = await supabase
    .from("workout_logs")
    .select("*")
    .eq("exercise_id", exerciseId)
    .order("workout_date", { ascending: false })
    .limit(6);

  if (error) {
    console.error(error.message);
    return [];
  }

  return data;
}

export function formatDate(dateString) {
  if (!dateString) return "No date";

  const [year, month, day] = dateString.split("-").map(Number);

  const localDate = new Date(year, month - 1, day);

  return localDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(workout) {
  const hours = String(workout.hours ?? 0).padStart(2, "0");
  const minutes = String(workout.minutes ?? 0).padStart(2, "0");
  const seconds = String(workout.seconds ?? 0).padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
}

export function getTrend(currentValue, previousValue) {
  if (previousValue === null || previousValue === undefined) {
    return { symbol: "", label: "First log", className: "neutral" };
  }

  if (currentValue > previousValue) {
    return { symbol: "↑", label: "Improved", className: "up" };
  }

  if (currentValue < previousValue) {
    return { symbol: "↓", label: "Lower", className: "down" };
  }

  return { symbol: "-", label: "Same", className: "neutral" };
}

export function getWorkoutMainValue(workout, measurementType) {
  switch (measurementType) {
    case "reps":
      return Number(workout.reps ?? 0);

    case "weight_reps":
      return Number(workout.weight ?? 0);

    case "time":
      return (
        Number(workout.hours ?? 0) * 3600 +
        Number(workout.minutes ?? 0) * 60 +
        Number(workout.seconds ?? 0)
      );

    case "distance_time":
      return Number(workout.distance ?? 0);

    default:
      return 0;
  }
}

export function getWorkoutDisplay(workout, exercise) {
  switch (exercise.measurementType) {
    case "reps":
      return {
        main: `${workout.reps ?? 0}`,
        unit: "reps",
        detail: "Bodyweight entry",
      };

    case "distance_time":
      return {
        main: `${workout.distance ?? 0}`,
        unit: workout.distance_unit ?? "miles",
        detail: formatTime(workout),
      };

    case "time":
      return {
        main: formatTime(workout),
        unit: "duration",
        detail: "Timed entry",
      };

    case "weight_reps":
      return {
        main: `${workout.weight ?? 0}`,
        unit: "lb",
        detail: `${workout.reps ?? 0} reps`,
      };

    default:
      return {
        main: "0",
        unit: "entry",
        detail: "Workout log",
      };
  }
}

function ExerciseHistoryList({ exercise, refreshKey }) {
  const [workouts, setWorkouts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadWorkoutLogs() {
      setIsLoading(true);

      const logs = await getWorkoutLogs(exercise.id);

      setWorkouts(logs);
      setIsLoading(false);
    }

    loadWorkoutLogs();
  }, [exercise.id, refreshKey]);

  if (isLoading) {
    return <p className="empty-progress history-empty">Loading history...</p>;
  }

  if (workouts.length === 0) {
    return <p className="empty-progress history-empty">No history yet.</p>;
  }

  return (
    <section
      className="exercise-history-card"
      aria-label={`${exercise.name} history`}
    >
      <div className="history-header">
        <div>
          <h3 className="history-title">Recent history</h3>
          <p className="history-subtitle">
            Last {Math.min(workouts.length, 5)} entries
          </p>
        </div>
      </div>

      <div className="exercise-history-list">
        {workouts.slice(0, 5).map((workout, i) => {
          const previousWorkout = workouts[i + 1];
          const currentValue = getWorkoutMainValue(
            workout,
            exercise.measurementType,
          );
          const previousValue = previousWorkout
            ? getWorkoutMainValue(previousWorkout, exercise.measurementType)
            : null;
          const trend = getTrend(currentValue, previousValue);
          const display = getWorkoutDisplay(workout, exercise);

          return (
            <article key={workout.id} className="history-list-item">
              <div className="history-date-block">
                <span className="history-date">
                  {formatDate(workout.workout_date)}
                </span>
                <span className="history-detail">{display.detail}</span>
              </div>

              {workout.notes && (
                <div className="workout-notes">{workout.notes}</div>
              )}

              <div className="history-value-block">
                <span className="history-main-value">{display.main}</span>
                <span className="history-unit">{display.unit}</span>
              </div>

              <span
                className={`history-trend ${trend.className}`}
                title={trend.label}
              >
                {trend.symbol}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default ExerciseHistoryList;
