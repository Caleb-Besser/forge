import assert from "node:assert/strict";
import test from "node:test";
import {
  draftFromLog,
  durationInputToSeconds,
  formatDurationInput,
  secondsToClock,
  setsFromDraft,
  trendMeta,
  trendScore,
} from "./workoutLogUtils.js";
import { workoutFeeling } from "./workoutFeelings.js";

test("duration helpers convert between form and storage formats", () => {
  assert.equal(formatDurationInput("1234"), "12:34");
  assert.equal(durationInputToSeconds("12:34"), 754);
  assert.equal(secondsToClock(754), "12:34");
});

test("weighted logs can be edited without changing their stored values", () => {
  const exercise = { type: "weighted", exercise_parts: [] };
  const log = {
    exercise_log_sets: [
      { set_number: 1, weight: 25, reps: 10 },
      { set_number: 2, weight: 25, reps: 9 },
    ],
  };

  const draft = draftFromLog(exercise, log);
  assert.deepEqual(setsFromDraft(exercise, draft), log.exercise_log_sets);
});

test("trend helpers compare total weighted work", () => {
  const exercise = { type: "weighted" };
  const current = {
    exercise_log_sets: [{ weight: 30, reps: 10 }],
  };
  const previous = {
    exercise_log_sets: [{ weight: 25, reps: 10 }],
  };

  assert.equal(trendScore(exercise, current), 300);
  assert.deepEqual(trendMeta(exercise, current, previous), {
    direction: "up",
    symbol: "↑",
    label: "Improved from previous log",
  });
});

test("unknown feelings stay safely unrendered", () => {
  assert.equal(workoutFeeling("good")?.label, "Good");
  assert.equal(workoutFeeling("not-a-real-feeling"), null);
});
