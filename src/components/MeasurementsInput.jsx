import { useEffect, useState } from "react";
import TimeAmountInputBox from "./TimeAmountInputBox";
import { supabase } from "../supabaseClient";
import DateInputBox from "./DateInputBox";
import NotesInputBox from "./NotesInputBox";

const emptyDaysOfWeek = {
  monday: false,
  tuesday: false,
  wednesday: false,
  thursday: false,
  friday: false,
  saturday: false,
  sunday: false,
};

const days = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
];

async function saveWorkoutLog(exercise, values) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("You must be signed in first");
    return false;
  }

  const { data, error } = await supabase
    .from("workout_logs")
    .insert({
      user_id: user.id,
      exercise_id: exercise.id,
      measurement_type: exercise.measurementType,
      hours: values.hours ?? null,
      minutes: values.minutes ?? null,
      seconds: values.seconds ?? null,
      reps: values.reps ?? null,
      weight: values.weight ?? null,
      distance: values.distance ?? null,
      distance_unit: values.distanceUnit ?? null,
      notes: values.notes ?? null,
      workout_date: values.date ?? null,
    })
    .select();

  if (error) {
    console.error(error.message);
    return false;
  }

  console.log("Saved workout:", data);
  return true;
}

async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    console.error("You must be signed in first");
    return null;
  }

  return user;
}

function NumberField({ label, value, onChange, placeholder, suffix }) {
  return (
    <label className="measurement-field">
      <span className="measurement-label-text">{label}</span>
      <div className="measurement-input-shell">
        <input
          className="measurement-control"
          type="number"
          min="0"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix ? <span className="measurement-suffix">{suffix}</span> : null}
      </div>
    </label>
  );
}

function MeasurementsInput({
  measurementType,
  exercise,
  onWorkoutSaved,
  showToast,
  onScheduleChanged,
}) {
  const [repsInput, setRepsInput] = useState(0);
  const [weightInput, setWeightInput] = useState(0);
  const [duration, setDuration] = useState({
    seconds: 0,
    minutes: 0,
    hours: 0,
  });
  const [dateInput, setDateInput] = useState(null);
  const [distanceInput, setDistanceInput] = useState(0);
  const [daysOfWeek, setDaysOfWeek] = useState(emptyDaysOfWeek);
  const [isLoadingDays, setIsLoadingDays] = useState(false);
  const [currentNote, setCurrentNote] = useState("");

  useEffect(() => {
    async function loadExerciseSchedule() {
      const user = await getCurrentUser();

      if (!user) {
        return;
      }

      setIsLoadingDays(true);

      const { data, error } = await supabase
        .from("exercise_schedule")
        .select("day_of_week")
        .eq("user_id", user.id)
        .eq("exercise_id", exercise.id);

      setIsLoadingDays(false);

      if (error) {
        console.error(error.message);
        return;
      }

      const loadedDays = { ...emptyDaysOfWeek };

      data.forEach((row) => {
        if (row.day_of_week in loadedDays) {
          loadedDays[row.day_of_week] = true;
        }
      });

      setDaysOfWeek(loadedDays);
    }

    loadExerciseSchedule();
  }, [exercise.id]);

  async function handleDayChange(day, checked) {
    const previousDays = daysOfWeek;

    setDaysOfWeek((currentDays) => ({
      ...currentDays,
      [day]: checked,
    }));

    const user = await getCurrentUser();

    if (!user) {
      setDaysOfWeek(previousDays);
      showToast("You must be signed in first.", "error");
      return;
    }

    if (checked) {
      const { error } = await supabase.from("exercise_schedule").insert({
        user_id: user.id,
        exercise_id: exercise.id,
        day_of_week: day,
      });

      if (error) {
        console.error(error.message);
        setDaysOfWeek(previousDays);
        showToast("Could not save workout day.", "error");
        return;
      }

      showToast(`${exercise.name} added to ${day}.`);
      onScheduleChanged();
    } else {
      const { error } = await supabase
        .from("exercise_schedule")
        .delete()
        .eq("user_id", user.id)
        .eq("exercise_id", exercise.id)
        .eq("day_of_week", day);

      if (error) {
        console.error(error.message);
        setDaysOfWeek(previousDays);
        showToast("Could not remove workout day.", "error");
        return;
      }

      showToast(`${exercise.name} removed from ${day}.`);
      onScheduleChanged();
    }
  }

  async function handleSave(values) {
    const saved = await saveWorkoutLog(exercise, values);

    if (saved) {
      setCurrentNote("");
      onWorkoutSaved();
      showToast(`${exercise.name} saved successfully.`);
    } else {
      showToast("Could not save workout.", "error");
    }
  }

  function getSubmitValues(currentNote) {
    switch (measurementType) {
      case "reps":
        return { date: dateInput, reps: repsInput, notes: currentNote.trim() || null };

      case "time":
        return {
          date: dateInput,
          hours: duration.hours,
          minutes: duration.minutes,
          seconds: duration.seconds,
          notes: currentNote.trim() || null,
        };

      case "weight_reps":
        return {
          date: dateInput,
          weight: weightInput,
          reps: repsInput,
          notes: currentNote.trim() || null,
        };

      case "distance_time":
        return {
          date: dateInput,
          distance: distanceInput,
          distanceUnit: "miles",
          hours: duration.hours,
          minutes: duration.minutes,
          seconds: duration.seconds,
          notes: currentNote.trim() || null,
        };

      default:
        return { date: dateInput, notes: currentNote.trim() || null };
    }
  }

  return (
    <div className="measurement-panel">
      <div className="measurement-panel-top">
        <div className="measurement-panel-header">
          <div>
            <h3 className="measurement-title">Log entry</h3>
            <p className="measurement-subtitle">
              Track your latest set or session.
            </p>
          </div>
        </div>

        <div className="weekly-schedule-card" aria-label="Weekly schedule">
          <div className="weekly-schedule-header">Schedule</div>

          <div className="weekly-input-box">
            {days.map((day) => (
              <label
                key={day.key}
                className={`day-pill ${daysOfWeek[day.key] ? "active" : ""}`}
              >
                <input
                  className="day-pill-checkbox"
                  type="checkbox"
                  checked={daysOfWeek[day.key]}
                  disabled={isLoadingDays}
                  onChange={(e) => handleDayChange(day.key, e.target.checked)}
                />
                <span>{day.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="measurement-inputs">
        <div className="measurement-actions vertical-align">
          {measurementType === "reps" && (
            <NumberField
              label="Reps"
              value={repsInput}
              onChange={setRepsInput}
              placeholder="0"
            />
          )}

          {measurementType === "time" && (
            <TimeAmountInputBox duration={duration} setDuration={setDuration} />
          )}

          {measurementType === "weight_reps" && (
            <>
              <NumberField
                label="Weight"
                value={weightInput}
                onChange={setWeightInput}
                placeholder="0"
                suffix="lb"
              />
              <NumberField
                label="Reps"
                value={repsInput}
                onChange={setRepsInput}
                placeholder="0"
              />
            </>
          )}

          {measurementType === "distance_time" && (
            <>
              <NumberField
                label="Distance"
                value={distanceInput}
                onChange={setDistanceInput}
                placeholder="0"
                suffix="mi"
              />
              <TimeAmountInputBox
                duration={duration}
                setDuration={setDuration}
              />
            </>
          )}

          <DateInputBox dateInput={dateInput} setDateInput={setDateInput} />
          <button
            className="measurement-submit-button"
            type="button"
            onClick={() => handleSave(getSubmitValues(currentNote))}
          >
            Save Entry
          </button>
        </div>
        <NotesInputBox
          note={currentNote}
          setNote={setCurrentNote}
        ></NotesInputBox>
      </div>
    </div>
  );
}

export default MeasurementsInput;
