import { useState } from "react";
import ExerciseFormFields from "./ExerciseFormFields";

export default function EditExerciseModal({
  exercise,
  onClose,
  onSave,
  onRemove,
  busy,
}) {
  const [values, setValues] = useState(() => {
    if (!exercise) return null;
    return {
      name: exercise.name,
      type: exercise.type,
      partA: exercise.exercise_parts[0]?.name ?? "",
      partB: exercise.exercise_parts[1]?.name ?? "",
      parts: exercise.exercise_parts.map((part) => part.name),
    };
  });

  if (!exercise || !values) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="cyber-modal"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={async (event) => {
          event.preventDefault();
          await onSave(values);
        }}
      >
        <div className="modal-kicker">Routine Editor</div>
        <h2>Edit Exercise</h2>
        <ExerciseFormFields values={values} onChange={setValues} />
        <div className="modal-actions split">
          {onRemove && (
            <button className="arcade-button danger" type="button" onClick={onRemove}>Remove</button>
          )}
          <button className="arcade-button secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="arcade-button primary" type="submit" disabled={busy}>Save</button>
        </div>
      </form>
    </div>
  );
}
