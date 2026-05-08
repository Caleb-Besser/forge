function TimeAmountInputBox({ duration, setDuration }) {
  function handleDurationChange(field, value) {
    const maxValues = {
      hours: 999,
      minutes: 59,
      seconds: 59,
    };

    const cleanedValue = value.replace(/\D/g, "");
    const numberValue = cleanedValue === "" ? 0 : Number(cleanedValue);
    const clampedValue = Math.min(numberValue, maxValues[field]);

    setDuration({
      ...duration,
      [field]: clampedValue,
    });
  }

  function formatDurationValue(value) {
    return String(value ?? 0).padStart(2, "0");
  }

  return (
    <div className="measurement-field time-field">
      <span className="measurement-label-text">Time</span>

      <div className="time-amount-input" aria-label="Duration input">
        <div className="time-input-group">
          <input
            className="time-input"
            type="text"
            inputMode="numeric"
            value={formatDurationValue(duration.hours)}
            onChange={(e) => handleDurationChange("hours", e.target.value)}
            onFocus={(e) => e.target.select()}
            aria-label="Hours"
          />
          <span className="time-input-label">hr</span>
        </div>

        <span className="time-separator">:</span>

        <div className="time-input-group">
          <input
            className="time-input"
            type="text"
            inputMode="numeric"
            value={formatDurationValue(duration.minutes)}
            onChange={(e) => handleDurationChange("minutes", e.target.value)}
            onFocus={(e) => e.target.select()}
            aria-label="Minutes"
          />
          <span className="time-input-label">min</span>
        </div>

        <span className="time-separator">:</span>

        <div className="time-input-group">
          <input
            className="time-input"
            type="text"
            inputMode="numeric"
            value={formatDurationValue(duration.seconds)}
            onChange={(e) => handleDurationChange("seconds", e.target.value)}
            onFocus={(e) => e.target.select()}
            aria-label="Seconds"
          />
          <span className="time-input-label">sec</span>
        </div>
      </div>
    </div>
  );
}

export default TimeAmountInputBox;
