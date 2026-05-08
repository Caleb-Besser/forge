import { useEffect, useState, useMemo } from "react";
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
function getLatestWorkoutText(workout, exercise) {
  if (!workout) {
    return "No entry yet";
  }

  switch (exercise.measurementType) {
    case "reps":
      return `${workout.workout_date} ${workout.reps ?? 0} reps`;

    case "weight_reps":
      return `${workout.workout_date} ${workout.weight ?? 0} lb × ${workout.reps ?? 0} reps`;

    case "time": {
      const hours = String(workout.hours ?? 0).padStart(2, "0");
      const minutes = String(workout.minutes ?? 0).padStart(2, "0");
      const seconds = String(workout.seconds ?? 0).padStart(2, "0");
      return `${workout.workout_date} ${hours}:${minutes}:${seconds}`;
    }

    case "distance_time": {
      const hours = String(workout.hours ?? 0).padStart(2, "0");
      const minutes = String(workout.minutes ?? 0).padStart(2, "0");
      const seconds = String(workout.seconds ?? 0).padStart(2, "0");
      return `${workout.workout_date} ${workout.distance ?? 0} ${workout.distance_unit ?? "mi"} • ${hours}:${minutes}:${seconds}`;
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
  async function loadScheduleRows(userId) {
    const { data, error } = await supabase
      .from("exercise_schedule")
      .select("exercise_id, day_of_week")
      .eq("user_id", userId);

    if (error) {
      console.error(error.message);
      return;
    }

    setScheduleRows(data);
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

    data.forEach((workout) => {
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
  ]);

  function refreshProgress() {
    setProgressRefreshKey((currentKey) => currentKey + 1);

    if (session?.user?.id) {
      loadLatestWorkouts(session.user.id);
    }
  }

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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id) {
        loadScheduleRows(session.user.id);
        loadLatestWorkouts(session.user.id);
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
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search exercises..."
          ></input>

          <div className="schedule-filter-controls">
            <button
              className={`today-button ${selectedScheduleDay === todayKey ? "active" : ""}`}
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
                className={`day-filter-select ${selectedScheduleDay !== "all" ? "active" : ""}`}
                value={selectedScheduleDay}
                onChange={(e) => setSelectedScheduleDay(e.target.value)}
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
          {filteredExercises.map((exercise, i) => {
            let isActive = activeExerciseId === exercise.id;
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
                      {latestWorkout ? (
                        <>
                          <span className="last-workout-label">
                            Last workout
                          </span>
                          <span className="last-workout-value">
                            {getLatestWorkoutText(latestWorkout, exercise)}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="last-workout-label">
                            Last workout
                          </span>
                          <span className="last-workout-empty">
                            No entry yet
                          </span>
                        </>
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
                      onClick={() => {
                        setActiveExerciseId(isActive ? null : exercise.id);
                      }}
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
                      onClick={() => {
                        setActiveExerciseId(isActive ? null : exercise.id);
                      }}
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
                  <div
                    className={`list-item-details ${isActive ? "active" : ""}`}
                  >
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
                      ></MeasurementsInput>
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
