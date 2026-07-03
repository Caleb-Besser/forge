const exerciseTypes = ["weighted", "bodyweight", "timed", "cardio", "superset", "mobility"];

export default function ExerciseFormFields({ values, onChange }) {
  const update = (field, value) => onChange({ ...values, [field]: value });

  return (
    <div className="modal-fields">
      <label>
        <span>Name</span>
        <input
          value={values.name}
          onChange={(event) => update("name", event.target.value)}
          required
          autoFocus
        />
      </label>
      <label>
        <span>Type</span>
        <select value={values.type} onChange={(event) => update("type", event.target.value)}>
          {exerciseTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </label>
      {values.type === "superset" && (
        <div className="paired-fields">
          <label>
            <span>Part A</span>
            <input value={values.partA} onChange={(event) => update("partA", event.target.value)} />
          </label>
          <label>
            <span>Part B</span>
            <input value={values.partB} onChange={(event) => update("partB", event.target.value)} />
          </label>
        </div>
      )}
      {values.type === "mobility" && (
        <div className="mobility-part-fields">
          {(values.parts.length ? values.parts : ["", "", "", ""]).map((part, index) => (
            <label key={index}>
              <span>Mobility item {index + 1}</span>
              <input
                value={part}
                onChange={(event) => {
                  const parts = [...values.parts];
                  parts[index] = event.target.value;
                  update("parts", parts);
                }}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
