import { supabase } from "../supabaseClient";
import {
  canonicalExerciseName,
  defaultRoutine,
  defaultWorkoutSchedule,
  trackingTypeFor,
} from "./seedRoutine";

const seedRequests = new Map();

function assertResult(error) {
  if (error) throw error;
}

function normalizedExerciseName(name) {
  return canonicalExerciseName(name).toLocaleLowerCase();
}

async function seedWeeklyRoutine(userId) {
  const { count, error: workoutCountError } = await supabase
    .from("routine_workouts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_active", true);
  assertResult(workoutCountError);
  if (count) return;

  const { data: existing, error: existingError } = await supabase
    .from("exercises")
    .select("id, name, position")
    .eq("user_id", userId)
    .eq("is_active", true);
  assertResult(existingError);

  const exerciseByName = new Map(
    (existing ?? []).map((exercise) => [normalizedExerciseName(exercise.name), exercise]),
  );
  let nextCatalogPosition = (existing ?? []).reduce(
    (highest, exercise) => Math.max(highest, exercise.position),
    0,
  ) + 1;

  for (const definition of defaultRoutine) {
    const key = definition.name.toLocaleLowerCase();
    const match = exerciseByName.get(key);
    if (match) {
      exerciseByName.set(key, match);
      continue;
    }
    const { data: inserted, error } = await supabase
      .from("exercises")
      .insert({
        user_id: userId,
        name: definition.name,
        type: definition.type,
        position: nextCatalogPosition++,
        default_weight: null,
        default_sets: 1,
        is_superset: false,
      })
      .select()
      .single();
    assertResult(error);
    exerciseByName.set(key, inserted);
  }

  const { data: workouts, error: workoutsError } = await supabase
    .from("routine_workouts")
    .insert(defaultWorkoutSchedule.map((workout) => ({
      user_id: userId,
      name: workout.name,
      weekday: workout.weekday,
    })))
    .select();
  assertResult(workoutsError);

  const links = workouts.flatMap((workout) => {
    const definition = defaultWorkoutSchedule.find((item) => item.weekday === workout.weekday);
    return definition.exercises.map((name, index) => ({
      workout_id: workout.id,
      exercise_id: exerciseByName.get(name.toLocaleLowerCase()).id,
      position: index + 1,
    }));
  });
  const { error: linksError } = await supabase.from("routine_workout_exercises").insert(links);
  assertResult(linksError);
}

export function ensureDefaultWeeklyRoutine(userId) {
  if (!seedRequests.has(userId)) {
    seedRequests.set(
      userId,
      seedWeeklyRoutine(userId).finally(() => seedRequests.delete(userId)),
    );
  }
  return seedRequests.get(userId);
}

export async function getExercisesWithPartsAndRecentLogs(userId, exerciseIds = null) {
  let exerciseQuery = supabase
    .from("exercises")
    .select("*, exercise_parts(*)")
    .eq("user_id", userId)
    .order("position")
    .order("position", { referencedTable: "exercise_parts" });
  if (exerciseIds) {
    exerciseQuery = exerciseQuery.in("id", exerciseIds);
  } else {
    exerciseQuery = exerciseQuery.eq("is_active", true);
  }
  const { data: exercises, error } = await exerciseQuery;
  assertResult(error);

  if (!exercises?.length) return [];

  const loadedExerciseIds = exercises.map((exercise) => exercise.id);
  const { data: logs, error: logsError } = await supabase
    .from("exercise_logs")
    .select("*, exercise_log_sets(*)")
    .eq("user_id", userId)
    .in("exercise_id", loadedExerciseIds)
    .order("performed_at", { ascending: false })
    .limit(Math.max(45, loadedExerciseIds.length * 5));
  assertResult(logsError);

  const logsByExercise = {};
  for (const log of logs ?? []) {
    logsByExercise[log.exercise_id] ??= [];
    if (logsByExercise[log.exercise_id].length < 5) {
      sortLogSets(log);
      logsByExercise[log.exercise_id].push(log);
    }
  }

  return exercises.map((exercise) => ({
    ...exercise,
    recent_logs: logsByExercise[exercise.id] ?? [],
  }));
}

function dayRangeFromDate(dateValue) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) throw new Error("Choose a valid workout date.");

  const [, year, month, day] = match.map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function sortLogSets(log) {
  log.exercise_log_sets?.sort((a, b) => {
    if ((a.set_number ?? 0) !== (b.set_number ?? 0)) {
      return (a.set_number ?? 0) - (b.set_number ?? 0);
    }
    return (a.exercise_part_id ?? "").localeCompare(b.exercise_part_id ?? "");
  });
}

export async function getDailyWorkoutDashboard(userId, selectedDate) {
  const weekday = new Date(`${selectedDate}T12:00:00`).getDay();
  const { start, end } = dayRangeFromDate(selectedDate);
  const { data: workout, error: workoutError } = await supabase
    .from("routine_workouts")
    .select("id, name, weekday")
    .eq("user_id", userId)
    .eq("weekday", weekday)
    .eq("is_active", true)
    .maybeSingle();
  assertResult(workoutError);

  let links = [];
  if (workout) {
    const { data, error: linksError } = await supabase
      .from("routine_workout_exercises")
      .select("exercise_id, position")
      .eq("workout_id", workout.id)
      .order("position");
    assertResult(linksError);
    links = data ?? [];
  }

  const { data: dailyLogs, error } = await supabase
    .from("exercise_logs")
    .select("*, exercise_log_sets(*)")
    .eq("user_id", userId)
    .gte("performed_at", start)
    .lt("performed_at", end)
    .order("performed_at", { ascending: false });
  assertResult(error);

  const scheduledIds = new Set(links.map((link) => link.exercise_id));
  const historicalIds = (dailyLogs ?? [])
    .map((log) => log.exercise_id)
    .filter((id, index, ids) => !scheduledIds.has(id) && ids.indexOf(id) === index);
  const displayLinks = [
    ...links.map((link) => ({ ...link, in_workout: true })),
    ...historicalIds.map((exerciseId, index) => ({
      exercise_id: exerciseId,
      position: links.length + index + 1,
      in_workout: false,
    })),
  ];
  const exerciseIds = displayLinks.map((link) => link.exercise_id);
  if (!exerciseIds.length) return { workout, exercises: [] };

  const exercises = await getExercisesWithPartsAndRecentLogs(userId, exerciseIds);
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const dailyLogByExercise = {};
  for (const log of dailyLogs ?? []) {
    if (dailyLogByExercise[log.exercise_id]) continue;
    sortLogSets(log);
    dailyLogByExercise[log.exercise_id] = log;
  }

  return {
    workout: workout ?? {
      id: null,
      name: "Logged Workout",
      weekday,
      historical: true,
    },
    exercises: displayLinks
      .map((link) => {
        const exercise = exerciseById.get(link.exercise_id);
        return exercise
          ? {
              ...exercise,
              position: link.position,
              workout_id: workout?.id ?? null,
              in_workout: link.in_workout,
              selected_log: dailyLogByExercise[exercise.id] ?? null,
            }
          : null;
      })
      .filter(Boolean),
  };
}

export async function createExercise(userId, workoutId, values, position) {
  const { data: catalogExercises, error: catalogError } = await supabase
    .from("exercises")
    .select("id, name, position")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("position", { ascending: false });
  assertResult(catalogError);

  const existing = (catalogExercises ?? []).find(
    (exercise) => exercise.name.trim().toLocaleLowerCase()
      === values.name.trim().toLocaleLowerCase(),
  );
  if (existing) {
    const { error: linkError } = await supabase.from("routine_workout_exercises").insert({
      workout_id: workoutId,
      exercise_id: existing.id,
      position,
    });
    assertResult(linkError);
    return existing;
  }

  const { data, error } = await supabase
    .from("exercises")
    .insert({
      user_id: userId,
      name: values.name.trim(),
      type: values.type,
      position: (catalogExercises?.[0]?.position ?? 0) + 1,
      default_weight: null,
      default_sets: 1,
      is_superset: values.type === "superset",
    })
    .select()
    .single();
  assertResult(error);

  const partNames =
    values.type === "superset"
      ? [values.partA || "Part A", values.partB || "Part B"]
      : values.type === "mobility"
        ? values.parts.filter(Boolean)
        : [];

  if (partNames.length) {
    const { error: partsError } = await supabase.from("exercise_parts").insert(
      partNames.map((name, index) => ({
        exercise_id: data.id,
        name: name.trim(),
        position: index + 1,
        tracking_type: trackingTypeFor(values.type),
      })),
    );
    assertResult(partsError);
  }

  const { error: linkError } = await supabase.from("routine_workout_exercises").insert({
    workout_id: workoutId,
    exercise_id: data.id,
    position,
  });
  assertResult(linkError);
  return data;
}

export async function updateExercise(exerciseId, values) {
  const { error } = await supabase
    .from("exercises")
    .update({
      name: values.name.trim(),
      type: values.type,
      default_weight: null,
      default_sets: 1,
      is_superset: values.type === "superset",
    })
    .eq("id", exerciseId);
  assertResult(error);

  const desiredParts =
    values.type === "superset"
      ? [values.partA || "Part A", values.partB || "Part B"]
      : values.type === "mobility"
        ? values.parts.filter(Boolean)
        : [];

  if (desiredParts.length) {
    const { data: currentParts, error: partsReadError } = await supabase
      .from("exercise_parts")
      .select("id, position")
      .eq("exercise_id", exerciseId)
      .order("position");
    assertResult(partsReadError);

    for (const [index, name] of desiredParts.entries()) {
      const existing = currentParts[index];
      if (existing) {
        const { error: partUpdateError } = await supabase
          .from("exercise_parts")
          .update({
            name: name.trim(),
            tracking_type: trackingTypeFor(values.type),
          })
          .eq("id", existing.id);
        assertResult(partUpdateError);
      } else {
        const { error: partInsertError } = await supabase.from("exercise_parts").insert({
          exercise_id: exerciseId,
          name: name.trim(),
          position: index + 1,
          tracking_type: trackingTypeFor(values.type),
        });
        assertResult(partInsertError);
      }
    }
  }
}

export async function moveExerciseTo(workoutId, exerciseId, targetExerciseId) {
  const { data: exercises, error } = await supabase
    .from("routine_workout_exercises")
    .select("exercise_id, position")
    .eq("workout_id", workoutId)
    .order("position");
  assertResult(error);

  const currentIndex = (exercises ?? []).findIndex(
    (exercise) => exercise.exercise_id === exerciseId,
  );
  const targetIndex = (exercises ?? []).findIndex(
    (exercise) => exercise.exercise_id === targetExerciseId,
  );
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= exercises.length) return false;
  if (currentIndex === targetIndex) return false;

  const current = exercises[currentIndex];
  const targetPosition = exercises[targetIndex].position;
  const temporaryPosition = Math.max(...exercises.map((exercise) => exercise.position)) + 1000;

  const { error: parkError } = await supabase
    .from("routine_workout_exercises")
    .update({ position: temporaryPosition })
    .eq("workout_id", workoutId)
    .eq("exercise_id", current.exercise_id);
  assertResult(parkError);

  const shifted = currentIndex < targetIndex
    ? exercises.slice(currentIndex + 1, targetIndex + 1)
    : exercises.slice(targetIndex, currentIndex).reverse();

  for (const exercise of shifted) {
    const position = exercise.position + (currentIndex < targetIndex ? -1 : 1);
    const { error: shiftError } = await supabase
      .from("routine_workout_exercises")
      .update({ position })
      .eq("workout_id", workoutId)
      .eq("exercise_id", exercise.exercise_id);
    assertResult(shiftError);
  }

  const { error: currentError } = await supabase
    .from("routine_workout_exercises")
    .update({ position: targetPosition })
    .eq("workout_id", workoutId)
    .eq("exercise_id", current.exercise_id);
  assertResult(currentError);

  return true;
}

export async function removeExerciseFromWorkout(workoutId, exerciseId) {
  const { error } = await supabase
    .from("routine_workout_exercises")
    .delete()
    .eq("workout_id", workoutId)
    .eq("exercise_id", exerciseId);
  assertResult(error);
}

function performedAtFromDate(dateValue) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) throw new Error("Choose a valid workout date.");

  const [, year, month, day] = match.map(Number);
  const performedAt = new Date(year, month - 1, day, 12);
  if (
    performedAt.getFullYear() !== year ||
    performedAt.getMonth() !== month - 1 ||
    performedAt.getDate() !== day
  ) {
    throw new Error("Choose a valid workout date.");
  }

  return performedAt.toISOString();
}

async function findExerciseLogForDate(userId, exerciseId, performedDate) {
  const { start, end } = dayRangeFromDate(performedDate);
  const { data, error } = await supabase
    .from("exercise_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("exercise_id", exerciseId)
    .gte("performed_at", start)
    .lt("performed_at", end)
    .order("performed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  assertResult(error);
  return data;
}

async function replaceLogSets(logId, sets) {
  const { error: deleteError } = await supabase
    .from("exercise_log_sets")
    .delete()
    .eq("exercise_log_id", logId);
  assertResult(deleteError);

  if (!sets.length) return;

  const { error: setsError } = await supabase.from("exercise_log_sets").insert(
    sets.map((set) => ({ ...set, exercise_log_id: logId })),
  );
  assertResult(setsError);
}

export async function saveExerciseLogWithSets(
  userId,
  exerciseId,
  sets,
  performedDate,
  notes = "",
  feeling = null,
) {
  const existing = await findExerciseLogForDate(userId, exerciseId, performedDate);
  if (existing) {
    const { error } = await supabase
      .from("exercise_logs")
      .update({
        performed_at: performedAtFromDate(performedDate),
        notes: notes || null,
        feeling,
      })
      .eq("id", existing.id);
    assertResult(error);
    await replaceLogSets(existing.id, sets);
    return { id: existing.id };
  }

  const { data: log, error } = await supabase
    .from("exercise_logs")
    .insert({
      user_id: userId,
      exercise_id: exerciseId,
      performed_at: performedAtFromDate(performedDate),
      notes: notes || null,
      feeling,
    })
    .select()
    .single();
  assertResult(error);

  const { error: setsError } = await supabase.from("exercise_log_sets").insert(
    sets.map((set) => ({ ...set, exercise_log_id: log.id })),
  );
  assertResult(setsError);
  return log;
}

export const createExerciseLogWithSets = saveExerciseLogWithSets;

export async function updateExerciseLogWithSets(
  logId,
  sets,
  notes = "",
  feeling = null,
) {
  const { data: log, error } = await supabase
    .from("exercise_logs")
    .update({ notes: notes || null, feeling })
    .eq("id", logId)
    .select()
    .single();
  assertResult(error);
  await replaceLogSets(logId, sets);
  return log;
}

export async function deleteExerciseLog(logId) {
  const { error } = await supabase
    .from("exercise_logs")
    .delete()
    .eq("id", logId);
  assertResult(error);
}
