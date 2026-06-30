export default function RemoveExerciseModal({ exercise, onClose, onConfirm, busy }) {
  if (!exercise) return null;

  return (
    <div className="modal-backdrop modal-backdrop-top" role="presentation" onMouseDown={onClose}>
      <div className="cyber-modal confirm-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="confirm-symbol">?</div>
        <h2>Remove Exercise?</h2>
        <p>
          Remove <strong>{exercise.name}</strong> from the wheel? Existing logs will be preserved.
        </p>
        <div className="modal-actions">
          <button className="arcade-button secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="arcade-button danger" type="button" onClick={onConfirm} disabled={busy}>
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

