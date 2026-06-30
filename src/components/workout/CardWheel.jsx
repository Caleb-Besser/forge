import { useEffect, useRef, useState } from "react";
import ExerciseCard from "./ExerciseCard";

const animationDuration = 440;

export default function CardWheel({
  exercises,
  selectedIndex,
  onSelect,
  onEdit,
  onLog,
  busy,
}) {
  const dragStart = useRef(null);
  const animationTimer = useRef(null);
  const wheelAccumulator = useRef(0);
  const [direction, setDirection] = useState("forward");
  const [animating, setAnimating] = useState(false);
  const selected = exercises[selectedIndex];
  const previous = exercises[(selectedIndex - 1 + exercises.length) % exercises.length];
  const next = exercises[(selectedIndex + 1) % exercises.length];

  useEffect(() => {
    return () => window.clearTimeout(animationTimer.current);
  }, []);

  function move(step) {
    if (animating || exercises.length < 2) return;

    setDirection(step > 0 ? "forward" : "backward");
    setAnimating(true);
    onSelect((selectedIndex + step + exercises.length) % exercises.length);

    window.clearTimeout(animationTimer.current);
    animationTimer.current = window.setTimeout(() => {
      setAnimating(false);
      wheelAccumulator.current = 0;
    }, animationDuration);
  }

  function pointerUp(event) {
    if (dragStart.current == null) return;
    const distance = event.clientY - dragStart.current;
    if (Math.abs(distance) > 45) move(distance < 0 ? 1 : -1);
    dragStart.current = null;
  }

  function handleWheel(event) {
    if (event.target.closest(".log-form")) {
      wheelAccumulator.current = 0;
      return;
    }
    event.preventDefault();
    if (animating) return;

    wheelAccumulator.current += event.deltaY;
    if (Math.abs(wheelAccumulator.current) < 24) return;
    move(wheelAccumulator.current > 0 ? 1 : -1);
  }

  return (
    <section
      className={`card-wheel wheel-motion-${direction} ${animating ? "is-animating" : ""}`}
      onWheel={handleWheel}
      onPointerDown={(event) => {
        if (
          event.target.closest(".log-form") ||
          event.target.closest("button")
        ) {
          dragStart.current = null;
          wheelAccumulator.current = 0;
          return;
        }
        dragStart.current = event.clientY;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={pointerUp}
      onPointerCancel={() => {
        dragStart.current = null;
      }}
    >
      <div className="wheel-stack">
        <button
          key={previous.id}
          className="stack-tab stack-tab-top"
          type="button"
          onClick={() => move(-1)}
          aria-label={`Previous exercise: ${previous.name}`}
        >
          <span className="stack-direction">Previous</span>
          <span className="stack-title">{previous.name}</span>
        </button>
      </div>

      <div className="wheel-card-stage" key={selected.id}>
        <ExerciseCard
          exercise={selected}
          onEdit={() => onEdit(selected)}
          onLog={(sets, performedDate) => onLog(selected, sets, performedDate)}
          busy={busy}
        />
      </div>

      <div className="wheel-stack bottom-stack">
        <button
          key={next.id}
          className="stack-tab stack-tab-bottom"
          type="button"
          onClick={() => move(1)}
          aria-label={`Next exercise: ${next.name}`}
        >
          <span className="stack-direction">Next</span>
          <span className="stack-title">{next.name}</span>
        </button>
      </div>
    </section>
  );
}
