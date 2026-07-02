import { WORKOUT_FEELINGS } from "../../lib/workoutFeelings";

export default function WorkoutFeelingPrompt({ exerciseName, onChoose }) {
  return (
    <div className="feeling-backdrop">
      <section
        className="feeling-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feeling-title"
      >
        <div className="header-kicker">Log saved locally</div>
        <h2 id="feeling-title">How did that feel?</h2>
        <p>{exerciseName}</p>
        <div className="feeling-options">
          {WORKOUT_FEELINGS.map((feeling) => (
            <button
              key={feeling.value}
              type="button"
              onClick={() => onChoose(feeling.value)}
            >
              <span aria-hidden="true">{feeling.emoji}</span>
              <strong>{feeling.label}</strong>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
