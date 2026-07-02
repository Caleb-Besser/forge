import {
  exerciseIconAsset,
  exerciseIconLabel,
} from "../../lib/workoutLogUtils";

export default function ExerciseIconSlot({ exercise, large = false }) {
  const src = exerciseIconAsset(exercise);
  const label = exerciseIconLabel(exercise);

  return (
    <span className={`exercise-icon-slot ${large ? "large" : ""}`} aria-hidden="true">
      {src ? <img src={src} alt="" loading="lazy" /> : label}
    </span>
  );
}
