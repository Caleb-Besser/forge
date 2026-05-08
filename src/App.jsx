import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { exercises } from "./data/exercises";
import { supabase } from "./supabaseClient";
import LoginScreen from "./components/LoginScreen";
import MeasurementsInput from "./components/MeasurementsInput";
import ToastNotification from "./components/ToastNotification";
import ExerciseHistoryList from "./components/ExerciseHistoryList";
import DetailsBox from "./components/DetailsBox";

async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error(error.message);
    return;
  }

  console.log("Signed Out");
}

function formatWorkoutDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  const start = new Date(year, month - 1, day);
  const today = new Date();
  const diff = Math.floor((today - start) / (1000 * 60 * 60 * 24));

  return diff;
}

function getLatestWorkoutText(workout, exercise) {
  if (!workout) {
    return "No entry yet";
  }

  const dateDiff = formatWorkoutDate(workout.workout_date);
  let dateText = "";

  if (dateDiff === 0) {
    dateText = "Today";
  } else if (dateDiff === 1) {
    dateText = "1 day ago";
  } else if (dateDiff > 5) {
    dateText = workout.workout_date;
  } else {
    dateText = `${dateDiff} days ago`;
  }

  switch (exercise.measurementType) {
    case "reps":
      return `${dateText} ${workout.reps ?? 0} reps`;

    case "weight_reps":
      return `${dateText} ${workout.weight ?? 0} lb × ${workout.reps ?? 0} reps`;

    case "time": {
      const hours = String(workout.hours ?? 0).padStart(2, "0");
      const minutes = String(workout.minutes ?? 0).padStart(2, "0");
      const seconds = String(workout.seconds ?? 0).padStart(2, "0");

      return `${dateText} ${hours}:${minutes}:${seconds}`;
    }

    case "distance_time": {
      const hours = String(workout.hours ?? 0).padStart(2, "0");
      const minutes = String(workout.minutes ?? 0).padStart(2, "0");
      const seconds = String(workout.seconds ?? 0).padStart(2, "0");

      return `${dateText} ${workout.distance ?? 0} ${
        workout.distance_unit ?? "mi"
      } • ${hours}:${minutes}:${seconds}`;
    }

    default:
      return "Entry saved";
  }
}

function App() {
  const [progressRefreshKey, setProgressRefreshKey] = useState(0);
  const [activeExerciseId, setActiveExerciseId] = useState(null);
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [scheduleRows, setScheduleRows] = useState([]);
  const [notification, setNotification] = useState(null);
  const [latestWorkoutsByExerciseId, setLatestWorkoutsByExerciseId] = useState(
    {},
  );
  const [selectedScheduleDay, setSelectedScheduleDay] = useState("all");
  const [showOnlyWithEntries, setShowOnlyWithEntries] = useState(true);

  async function loadScheduleRows(userId) {
    const { data, error } = await supabase
      .from("exercise_schedule")
      .select("exercise_id, day_of_week")
      .eq("user_id", userId);

    if (error) {
      console.error(error.message);
      return;
    }

    setScheduleRows(data ?? []);
  }

  async function loadLatestWorkouts(userId) {
    const { data, error } = await supabase
      .from("workout_logs")
      .select("*")
      .eq("user_id", userId)
      .order("workout_date", { ascending: false });

    if (error) {
      console.error(error.message);
      return;
    }

    const latestLookup = {};

    (data ?? []).forEach((workout) => {
      if (!latestLookup[workout.exercise_id]) {
        latestLookup[workout.exercise_id] = workout;
      }
    });

    setLatestWorkoutsByExerciseId(latestLookup);
  }

  function showToast(message, type = "success") {
    setNotification({ message, type });

    setTimeout(() => {
      setNotification(null);
    }, 3000);
  }

  function refreshProgress() {
    setProgressRefreshKey((currentKey) => currentKey + 1);

    if (session?.user?.id) {
      loadLatestWorkouts(session.user.id);
    }
  }

  const scheduleDaysByExerciseId = useMemo(() => {
    const lookup = {};

    scheduleRows.forEach((row) => {
      if (!lookup[row.exercise_id]) {
        lookup[row.exercise_id] = [];
      }

      lookup[row.exercise_id].push(row.day_of_week);
    });

    return lookup;
  }, [scheduleRows]);

  const todayKey = useMemo(() => {
    return new Date()
      .toLocaleDateString("en-US", { weekday: "long" })
      .toLowerCase();
  }, []);

  const scheduleFilterDays = [
    { key: "all", label: "All days" },
    { key: "monday", label: "Monday" },
    { key: "tuesday", label: "Tuesday" },
    { key: "wednesday", label: "Wednesday" },
    { key: "thursday", label: "Thursday" },
    { key: "friday", label: "Friday" },
    { key: "saturday", label: "Saturday" },
    { key: "sunday", label: "Sunday" },
  ];

  const selectedDayExerciseIds = useMemo(() => {
    if (selectedScheduleDay === "all") {
      return new Set();
    }

    return new Set(
      scheduleRows
        .filter((row) => row.day_of_week === selectedScheduleDay)
        .map((row) => row.exercise_id),
    );
  }, [scheduleRows, selectedScheduleDay]);

  const filteredExercises = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return exercises.filter((exercise) => {
      const hasEntry = Boolean(latestWorkoutsByExerciseId[exercise.id]);

      if (showOnlyWithEntries && !hasEntry) {
        return false;
      }

      if (
        selectedScheduleDay !== "all" &&
        !selectedDayExerciseIds.has(exercise.id)
      ) {
        return false;
      }

      if (!search) {
        return true;
      }

      const scheduledDaysForExercise =
        scheduleDaysByExerciseId[exercise.id]?.join(" ") ?? "";

      const searchableText = `
        ${exercise.name}
        ${exercise.group}
        ${exercise.muscleGroup}
        ${exercise.equipment}
        ${exercise.equipmentType}
        ${exercise.primaryMuscles.join(" ")}
        ${exercise.secondaryMuscles.join(" ")}
        ${exercise.tags?.join(" ") ?? ""}
        ${scheduledDaysForExercise}
      `.toLowerCase();

      return searchableText.includes(search);
    });
  }, [
    searchText,
    scheduleDaysByExerciseId,
    selectedScheduleDay,
    selectedDayExerciseIds,
    showOnlyWithEntries,
    latestWorkoutsByExerciseId,
  ]);

  useEffect(() => {
    async function getSession() {
      const { data } = await supabase.auth.getSession();

      setSession(data.session);

      if (data.session?.user?.id) {
        await loadScheduleRows(data.session.user.id);
        await loadLatestWorkouts(data.session.user.id);
      }

      setIsLoading(false);
    }

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);

      if (newSession?.user?.id) {
        loadScheduleRows(newSession.user.id);
        loadLatestWorkouts(newSession.user.id);
      } else {
        setScheduleRows([]);
        setLatestWorkoutsByExerciseId({});
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (isLoading) {
    return <p>Loading...</p>;
  }

  if (!session) {
    return (
      <>
        <ToastNotification notification={notification} />
        <LoginScreen showToast={showToast} />
      </>
    );
  }

  return (
    <>
      <ToastNotification notification={notification} />

      <main className="app-main">
        <header className="app-header">
          <h1 className="app-title">Workout Assistant</h1>

          <input
            className="search-box"
            type="text"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search exercises..."
          />

          <label className="entries-toggle">
            <input
              className="entries-toggle-input"
              type="checkbox"
              checked={showOnlyWithEntries}
              onChange={(event) => setShowOnlyWithEntries(event.target.checked)}
            />

            <span className="entries-toggle-track" aria-hidden="true">
              <span className="entries-toggle-thumb" />
            </span>

            <span className="entries-toggle-text">With entries</span>
          </label>

          <div className="schedule-filter-controls">
            <button
              className={`today-button ${
                selectedScheduleDay === todayKey ? "active" : ""
              }`}
              type="button"
              aria-pressed={selectedScheduleDay === todayKey}
              onClick={() =>
                setSelectedScheduleDay((currentDay) =>
                  currentDay === todayKey ? "all" : todayKey,
                )
              }
            >
              Today
            </button>

            <label className="day-filter-label" htmlFor="day-filter-select">
              <span className="visually-hidden">Filter exercises by day</span>

              <select
                id="day-filter-select"
                className={`day-filter-select ${
                  selectedScheduleDay !== "all" ? "active" : ""
                }`}
                value={selectedScheduleDay}
                onChange={(event) => setSelectedScheduleDay(event.target.value)}
              >
                {scheduleFilterDays.map((day) => (
                  <option key={day.key} value={day.key}>
                    {day.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button className="logout-button" type="button" onClick={signOut}>
            Logout
          </button>
        </header>

        <section id="exercise-list">
          {filteredExercises.map((exercise) => {
            const isActive = activeExerciseId === exercise.id;
            const latestWorkout = latestWorkoutsByExerciseId[exercise.id];

            return (
              <div key={exercise.id} className="exercise-list-row">
                <div
                  className="list-item"
                  onClick={() => {
                    setActiveExerciseId(isActive ? null : exercise.id);
                  }}
                >
                  <div className="horizontal-align">
                    <div className="list-item-name">{exercise.name}</div>

                    <div className="last-workout-preview">
                      <span className="last-workout-label">Last workout</span>

                      {latestWorkout ? (
                        <span className="last-workout-value">
                          {getLatestWorkoutText(latestWorkout, exercise)}
                        </span>
                      ) : (
                        <span className="last-workout-empty">No entry yet</span>
                      )}
                    </div>

                    <div className="list-item-group">{exercise.group}</div>
                    <div className="list-item-equipment">
                      {exercise.equipmentType}
                    </div>
                  </div>

                  {isActive ? (
                    <svg
                      className="up-caret"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        d="M6 15L12 9L18 15"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="down-caret"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        d="M6 9L12 15L18 9"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>

                {isActive && (
                  <div className="list-item-details active">
                    <div className="details-content-grid">
                      <ExerciseHistoryList
                        exercise={exercise}
                        refreshKey={progressRefreshKey}
                      />

                      <DetailsBox exercise={exercise} />
                    </div>

                    <div className="new-entry-area">
                      <MeasurementsInput
                        measurementType={exercise.measurementType}
                        exercise={exercise}
                        onWorkoutSaved={refreshProgress}
                        showToast={showToast}
                        onScheduleChanged={() =>
                          loadScheduleRows(session.user.id)
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </main>
    </>
  );
}

export default App;
