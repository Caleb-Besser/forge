export default function SupersetInput({
  exercise,
  weights,
  onWeightsChange,
  values,
  onChange,
}) {
  const parts = exercise.exercise_parts;

  function update(setIndex, partIndex, value) {
    const next = values.map((row) => [...row]);
    next[setIndex][partIndex] = value;
    onChange(next);
  }

  function updateWeight(partIndex, value) {
    const next = [...weights];
    next[partIndex] = value;
    onWeightsChange(next);
  }

  return (
    <div className="superset-input">
      <div className="superset-weight-fields">
        {[0, 1].map((partIndex) => (
          <label key={partIndex}>
            <span>{parts[partIndex]?.name ?? `Part ${partIndex + 1}`} Weight</span>
            <span className="input-with-unit">
              <input
                aria-label={`${parts[partIndex]?.name ?? `Part ${partIndex + 1}`} weight`}
                min="0"
                step="0.5"
                inputMode="decimal"
                type="number"
                value={weights[partIndex]}
                onChange={(event) => updateWeight(partIndex, event.target.value)}
                required
              />
              <b>LB</b>
            </span>
          </label>
        ))}
      </div>
      <div className="superset-head">
        <span>Set</span>
        <span>A / {parts[0]?.name ?? "Part A"}</span>
        <span>B / {parts[1]?.name ?? "Part B"}</span>
      </div>
      {values.map((row, setIndex) => (
        <div className="superset-row" key={setIndex}>
          <strong>{setIndex + 1}</strong>
          {[0, 1].map((partIndex) => (
            <input
              key={partIndex}
              aria-label={`Set ${setIndex + 1} ${parts[partIndex]?.name ?? `Part ${partIndex + 1}`} reps`}
              min="0"
              inputMode="numeric"
              type="number"
              value={row[partIndex]}
              onChange={(event) => update(setIndex, partIndex, event.target.value)}
              placeholder="reps"
              required
            />
          ))}
        </div>
      ))}
    </div>
  );
}
