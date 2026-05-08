function DateInputBox({ dateInput, setDateInput }) {
  return (
    <label className="measurement-field date-field">
      <span className="measurement-label-text">Date</span>
      <input
        className="measurement-control date-input"
        type="date"
        value={dateInput || ""}
        onChange={(e) => setDateInput(e.target.value)}
      />
    </label>
  );
}

export default DateInputBox;
