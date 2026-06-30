import { useState } from "react";
import ExerciseFormFields from "./ExerciseFormFields";

const initialValues = {
  name: "",
  type: "weighted",
  defaultWeight: "",
  defaultSets: 1,
  partA: "",
  partB: "",
  parts: ["Wall Angels", "Lat Stretch on Table", "Leg Hugs", "Cobra Stretch"],
};

export default function AddExerciseModal({ open, onClose, onSave, busy }) {
  const [values, setValues] = useState(initialValues);
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="cyber-modal"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={async (event) => {
          event.preventDefault();
          await onSave(values);
          setValues(initialValues);
        }}
      >
        <div className="modal-kicker">Routine Editor</div>
        <h2>New Exercise</h2>
        <ExerciseFormFields values={values} onChange={setValues} />
        <div className="modal-actions">
          <button className="arcade-button secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="arcade-button primary" type="submit" disabled={busy}>Add Exercise</button>
        </div>
      </form>
    </div>
  );
}
