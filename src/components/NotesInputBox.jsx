function NotesInputBox({ note, setNote }) {
  return (
    <label className="notes-field">
      <div className="notes-field-header">
        <span className="measurement-label-text">Notes</span>
        <span className="notes-helper-text">Optional</span>
      </div>

      <textarea
        className="notes-input-box"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add form notes, how it felt, pain, setup, etc."
        rows="4"
      />
    </label>
  );
}

export default NotesInputBox;
