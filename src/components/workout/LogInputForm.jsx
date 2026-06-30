import { useState } from "react";
import MobilityChecklist from "./MobilityChecklist";
import SupersetInput from "./SupersetInput";

function blankValues(count) {
  return Array.from({ length: count }, () => "");
}

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function durationInSeconds(value) {
  const [minutes, seconds] = value.split(":").map(Number);
  return (minutes * 60) + seconds;
}

function formatDurationInput(value) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length < 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function handleDurationBackspace(event, value, onChange) {
  if (event.key !== "Backspace") return;
  event.preventDefault();
  const digits = value.replace(/\D/g, "").slice(0, -1);
  onChange(formatDurationInput(digits));
}

export default function LogInputForm({ exercise, onSubmit, busy }) {
  const setCount = exercise.default_sets || 3;
  const today = localDateValue();
  const [performedDate, setPerformedDate] = useState(today);
  const [weight, setWeight] = useState(exercise.default_weight ?? "");
  const [values, setValues] = useState(blankValues(setCount));
  const [supersetWeights, setSupersetWeights] = useState([
    exercise.default_weight ?? "",
    exercise.default_weight ?? "",
  ]);
  const [supersetValues, setSupersetValues] = useState(
    Array.from({ length: setCount }, () => ["", ""]),
  );
  const [checked, setChecked] = useState({});
  const [cardio, setCardio] = useState({
    mode: "walking",
    incline: "",
    speed: "",
    duration: "",
  });

  async function handleSubmit(event) {
    event.preventDefault();
    let sets;

    if (exercise.type === "cardio") {
      sets = [{
        set_number: 1,
        activity_mode: cardio.mode,
        incline: Number(cardio.incline),
        speed: Number(cardio.speed),
        duration_seconds: durationInSeconds(cardio.duration),
      }];
    } else if (exercise.type === "mobility") {
      sets = exercise.exercise_parts.map((part, index) => ({
        exercise_part_id: part.id,
        set_number: index + 1,
        completed: checked[part.id] ?? false,
      }));
    } else if (exercise.type === "superset") {
      sets = supersetValues.flatMap((row, setIndex) =>
        exercise.exercise_parts.slice(0, 2).map((part, partIndex) => ({
          exercise_part_id: part.id,
          set_number: setIndex + 1,
          reps: Number(row[partIndex]),
          weight: supersetWeights[partIndex] === ""
            ? null
            : Number(supersetWeights[partIndex]),
        })),
      );
    } else {
      sets = values.map((value, index) => ({
        set_number: index + 1,
        reps: exercise.type === "timed" ? null : Number(value),
        duration_seconds: exercise.type === "timed" ? durationInSeconds(value) : null,
        weight: exercise.type === "weighted" && weight !== "" ? Number(weight) : null,
      }));
    }

    const saved = await onSubmit(sets, performedDate);
    if (!saved) return;

    setValues(blankValues(setCount));
    setSupersetValues(Array.from({ length: setCount }, () => ["", ""]));
    setChecked({});
    setCardio({
      mode: cardio.mode,
      incline: "",
      speed: "",
      duration: "",
    });
  }

  const valueLabel = exercise.type === "timed" ? "Time" : "Reps";

  return (
    <form className="log-form" onSubmit={handleSubmit}>
      <div className="log-form-heading">
        <div className="section-label">New Entry</div>
        <label className="workout-date-field">
          <span>Date</span>
          <input
            type="date"
            value={performedDate}
            max={today}
            onChange={(event) => setPerformedDate(event.target.value)}
            required
          />
        </label>
      </div>

      {exercise.type === "weighted" && (
        <label className="weight-field">
          <span>Weight</span>
          <span className="input-with-unit">
            <input
              min="0"
              step="0.5"
              inputMode="decimal"
              type="number"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              required
            />
            <b>LB</b>
          </span>
        </label>
      )}

      {exercise.type === "superset" && (
        <SupersetInput
          exercise={exercise}
          weights={supersetWeights}
          onWeightsChange={setSupersetWeights}
          values={supersetValues}
          onChange={setSupersetValues}
        />
      )}

      {exercise.type === "mobility" && (
        <MobilityChecklist
          parts={exercise.exercise_parts}
          checked={checked}
          onChange={setChecked}
        />
      )}

      {exercise.type === "cardio" && (
        <div className="cardio-inputs">
          <label className="cardio-mode-field">
            <span>Activity</span>
            <select
              value={cardio.mode}
              onChange={(event) => setCardio({ ...cardio, mode: event.target.value })}
            >
              <option value="walking">Walking</option>
              <option value="running">Running</option>
            </select>
          </label>
          <label>
            <span>Incline</span>
            <span className="input-with-unit">
              <input
                min="0"
                step="0.5"
                inputMode="decimal"
                type="number"
                value={cardio.incline}
                onChange={(event) => setCardio({ ...cardio, incline: event.target.value })}
                required
              />
              <b>%</b>
            </span>
          </label>
          <label>
            <span>Speed</span>
            <span className="input-with-unit">
              <input
                min="0"
                step="0.1"
                inputMode="decimal"
                type="number"
                value={cardio.speed}
                onChange={(event) => setCardio({ ...cardio, speed: event.target.value })}
                required
              />
              <b>MPH</b>
            </span>
          </label>
          <label className="cardio-duration-field">
            <span>Time (MM:SS)</span>
            <input
              inputMode="numeric"
              type="text"
              pattern="[0-9]{2}:[0-5][0-9]"
              placeholder="00:00"
              title="Enter time as minutes and seconds, for example 05:30."
              value={cardio.duration}
              onChange={(event) => setCardio({
                ...cardio,
                duration: formatDurationInput(event.target.value),
              })}
              onKeyDown={(event) => handleDurationBackspace(
                event,
                cardio.duration,
                (duration) => setCardio({ ...cardio, duration }),
              )}
              required
            />
          </label>
        </div>
      )}

      {!["superset", "mobility", "cardio"].includes(exercise.type) && (
        <div className="set-inputs">
          {values.map((value, index) => (
            <label key={index}>
              <span>{valueLabel} {index + 1}</span>
              <input
                inputMode="numeric"
                type={exercise.type === "timed" ? "text" : "number"}
                min={exercise.type === "timed" ? undefined : "0"}
                pattern={exercise.type === "timed" ? "[0-9]{2}:[0-5][0-9]" : undefined}
                placeholder={exercise.type === "timed" ? "00:00" : undefined}
                title={
                  exercise.type === "timed"
                    ? "Enter time as minutes and seconds, for example 01:30."
                    : undefined
                }
                value={value}
                onChange={(event) => {
                  const next = [...values];
                  next[index] = exercise.type === "timed"
                    ? formatDurationInput(event.target.value)
                    : event.target.value;
                  setValues(next);
                }}
                onKeyDown={(event) => {
                  if (exercise.type !== "timed") return;
                  handleDurationBackspace(event, value, (duration) => {
                    const next = [...values];
                    next[index] = duration;
                    setValues(next);
                  });
                }}
                required
              />
            </label>
          ))}
        </div>
      )}

      <button className="arcade-button primary" type="submit" disabled={busy}>
        {busy ? "Saving..." : "Submit Log"}
      </button>
    </form>
  );
}
