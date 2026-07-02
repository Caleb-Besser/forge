export const WORKOUT_FEELINGS = [
  { value: "great", emoji: "✨", label: "Great" },
  { value: "good", emoji: "🙂", label: "Good" },
  { value: "okay", emoji: "😐", label: "Okay" },
  { value: "tough", emoji: "😮‍💨", label: "Tough" },
  { value: "rough", emoji: "🫠", label: "Rough" },
];

export function workoutFeeling(value) {
  return WORKOUT_FEELINGS.find((feeling) => feeling.value === value) ?? null;
}
