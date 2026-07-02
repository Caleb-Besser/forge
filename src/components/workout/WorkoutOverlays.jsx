import { secondsToClock } from "../../lib/workoutLogUtils";

export function LoadingScreen({ copy }) {
  return (
    <main className="loading-screen">
      <div className="loading-mark">F</div>
      <p>{copy}</p>
    </main>
  );
}

export function BreakTimer({ timer, onQuit }) {
  if (!timer) return null;
  return (
    <div className="break-timer-overlay" role="status">
      <strong>Break {secondsToClock(timer.remaining)}</strong>
      <button type="button" onClick={onQuit}>Quit</button>
    </div>
  );
}

export function CompletionCelebration({ onClose }) {
  return (
    <div className="completion-backdrop" role="presentation" onClick={onClose}>
      <section
        className="completion-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="completion-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="completion-sparkles" aria-hidden="true">
          <span>✦</span><span>★</span><span>✦</span>
        </div>
        <div className="completion-check" aria-hidden="true">✓</div>
        <div className="header-kicker">Day complete</div>
        <h2 id="completion-title">You did it!</h2>
        <p>Every exercise is logged. Nice work showing up for yourself today.</p>
        <button className="soft-button primary" type="button" onClick={onClose}>
          Heck yeah
        </button>
      </section>
    </div>
  );
}
