import { supabase } from "../supabaseClient";
import {
  defaultRoutine,
  defaultRoutineAliases,
  retiredDefaultExerciseNames,
  trackingTypeFor,
} from "./seedRoutine";

const seedRequests = new Map();

function assertResult(error) {
  if (error) throw error;
}

function normalizedExerciseName(name) {
  return name.trim().toLocaleLowerCase();
}

function canonicalDefaultName(name) {
  const normalized = normalizedExerciseName(name);
  return defaultRoutineAliases[normalized] ?? name.trim();
}

function defaultExerciseForName(name) {
  const canonicalName = canonicalDefaultName(name);
  return defaultRoutine.find(
    (exercise) => normalizedExerciseName(exercise.name) === normalizedExerciseName(canonicalName),
  );
}

async function seedRoutine(userId) {
  const { count, error: countError } = await supabase
    .from("exercises")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  assertResult(countError);
  if (count) return;

  const exerciseRows = defaultRoutine.map((exercise, index) => ({
    user_id: userId,
    name: exercise.name,
    type: exercise.type,
    position: index + 1,
    default_weight: exercise.defaultWeight ?? null,
    default_sets: exercise.defaultSets ?? 3,
    is_superset: exercise.type === "superset",
  }));

  const { data: inserted, error } = await supabase
    .from("exercises")
    .insert(exerciseRows)
    .select();
  assertResult(error);

  const parts = inserted.flatMap((row) => {
    const source = defaultRoutine[row.position - 1];
    return (source.parts ?? []).map((name, index) => ({
      exercise_id: row.id,
      name,
      position: index + 1,
      tracking_type: trackingTypeFor(row.type),
    }));
  });

  if (parts.length) {
    const { error: partsError } = await supabase.from("exercise_parts").insert(parts);
    assertResult(partsError);
  }
}

export function seedDefaultRoutineIfEmpty(userId) {
  if (!seedRequests.has(userId)) {
    seedRequests.set(
      userId,
      seedRoutine(userId).finally(() => {
        seedRequests.delete(userId);
      }),
    );
  }

  return seedRequests.get(userId);
}

export async function addMissingDefaultExercises(userId) {
  const { data: existing, error } = await supabase
    .from("exercises")
    .select("id, name, position, is_active")
    .eq("user_id", userId);
  assertResult(error);

  const existingNames = new Set(
    (existing ?? [])
      .filter((exercise) => exercise.is_active)
      .map((exercise) => normalizedExerciseName(canonicalDefaultName(exercise.name))),
  );
  const missing = defaultRoutine.filter(
    (exercise) => !existingNames.has(normalizedExerciseName(exercise.name)),
  );
  if (!missing.length) return 0;

  let nextPosition = (existing ?? []).reduce(
    (highest, exercise) => Math.max(highest, exercise.position),
    0,
  ) + 1;

  const rows = missing.map((exercise) => ({
    user_id: userId,
    name: exercise.name,
    type: exercise.type,
    position: nextPosition++,
    default_weight: exercise.defaultWeight ?? null,
    default_sets: exercise.defaultSets ?? 3,
    is_superset: exercise.type === "superset",
  }));

  const { error: insertError } = await supabase.from("exercises").insert(rows);
  if (insertError?.code !== "23505") assertResult(insertError);
  return rows.length;
}

export async function syncDefaultRoutine(userId) {
  const { data: rows, error } = await supabase
    .from("exercises")
    .select("id, name, position, is_active")
    .eq("user_id", userId)
    .eq("is_active", true);
  assertResult(error);

  const activeRows = rows ?? [];
  const canonicalDefaults = new Set(
    defaultRoutine.map((exercise) => normalizedExerciseName(exercise.name)),
  );
  const retiredDefaults = new Set(
    retiredDefaultExerciseNames.map((name) => normalizedExerciseName(name)),
  );
  let changed = 0;

  for (const row of activeRows) {
    const canonicalName = canonicalDefaultName(row.name);
    const defaultExercise = defaultExerciseForName(canonicalName);

    if (
      defaultExercise &&
      normalizedExerciseName(row.name) !== normalizedExerciseName(defaultExercise.name)
    ) {
      const { error: updateError } = await supabase
        .from("exercises")
        .update({
          name: defaultExercise.name,
          type: defaultExercise.type,
          default_weight: defaultExercise.defaultWeight ?? null,
          default_sets: defaultExercise.defaultSets ?? 3,
          is_superset: defaultExercise.type === "superset",
        })
        .eq("id", row.id);
      if (updateError?.code !== "23505") assertResult(updateError);
      changed += updateError ? 0 : 1;
    }

    if (
      retiredDefaults.has(normalizedExerciseName(row.name)) &&
      !canonicalDefaults.has(normalizedExerciseName(canonicalName))
    ) {
      const { error: deactivateError } = await supabase
        .from("exercises")
        .update({ is_active: false })
        .eq("id", row.id);
      assertResult(deactivateError);
      changed += 1;
    }
  }

  const { data: refreshed, error: refreshError } = await supabase
    .from("exercises")
    .select("id, name, position")
    .eq("user_id", userId)
    .eq("is_active", true);
  assertResult(refreshError);

  const rowsByCanonicalName = new Map();
  const customRows = [];

  for (const row of refreshed ?? []) {
    const canonicalName = canonicalDefaultName(row.name);
    if (canonicalDefaults.has(normalizedExerciseName(canonicalName))) {
      rowsByCanonicalName.set(normalizedExerciseName(canonicalName), row);
    } else {
      customRows.push(row);
    }
  }

  const orderedRows = [
    ...defaultRoutine
      .map((exercise) => rowsByCanonicalName.get(normalizedExerciseName(exercise.name)))
      .filter(Boolean),
    ...customRows.sort((a, b) => a.position - b.position),
  ];

  const needsReorder = orderedRows.some((row, index) => row.position !== index + 1);
  if (!needsReorder) return changed;

  for (const [index, row] of orderedRows.entries()) {
    const temporaryPosition = 1000 + index;
    if (row.position === temporaryPosition) continue;
    const { error: updateError } = await supabase
      .from("exercises")
      .update({ position: temporaryPosition })
      .eq("id", row.id);
    assertResult(updateError);
  }

  for (const [index, row] of orderedRows.entries()) {
    const position = index + 1;
    const { error: updateError } = await supabase
      .from("exercises")
      .update({ position })
      .eq("id", row.id);
    assertResult(updateError);
    if (row.position !== position) changed += 1;
  }

  return changed;
}

export async function reconcileAliasedExercises(userId) {
  const { data: exercises, error } = await supabase
    .from("exercises")
    .select("id, name, position, created_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at");
  assertResult(error);

  const groups = new Map();
  for (const exercise of exercises ?? []) {
    const canonicalName = canonicalDefaultName(exercise.name);
    if (normalizedExerciseName(canonicalName) === normalizedExerciseName(exercise.name)) continue;
    const key = normalizedExerciseName(canonicalName);
    groups.set(key, [...(groups.get(key) ?? []), exercise]);
  }

  // Include already-canonical rows in alias groups so old and new names converge.
  for (const exercise of exercises ?? []) {
    const key = normalizedExerciseName(canonicalDefaultName(exercise.name));
    if (!groups.has(key)) continue;
    const group = groups.get(key);
    if (!group.some((row) => row.id === exercise.id)) group.push(exercise);
  }

  let reconciled = 0;
  for (const [canonicalKey, group] of groups) {
    const canonical = defaultRoutine.find(
      (exercise) => normalizedExerciseName(exercise.name) === canonicalKey,
    );
    if (!canonical || !group.length) continue;

    const ids = group.map((exercise) => exercise.id);
    const { data: logs, error: logsError } = await supabase
      .from("exercise_logs")
      .select("id, exercise_id")
      .eq("user_id", userId)
      .in("exercise_id", ids);
    assertResult(logsError);

    const logCounts = (logs ?? []).reduce((counts, log) => {
      counts[log.exercise_id] = (counts[log.exercise_id] ?? 0) + 1;
      return counts;
    }, {});
    const survivor = [...group].sort((a, b) => (
      (logCounts[b.id] ?? 0) - (logCounts[a.id] ?? 0)
      || new Date(a.created_at) - new Date(b.created_at)
    ))[0];
    const duplicateIds = ids.filter((id) => id !== survivor.id);

    if (duplicateIds.length) {
      const { error: moveLogsError } = await supabase
        .from("exercise_logs")
        .update({ exercise_id: survivor.id })
        .in("exercise_id", duplicateIds)
        .eq("user_id", userId);
      assertResult(moveLogsError);

      const { error: deactivateError } = await supabase
        .from("exercises")
        .update({ is_active: false })
        .in("id", duplicateIds);
      assertResult(deactivateError);
    }

    const { error: updateError } = await supabase
      .from("exercises")
      .update({
        name: canonical.name,
        type: canonical.type,
        default_weight: canonical.defaultWeight ?? null,
        default_sets: canonical.defaultSets ?? 3,
        is_superset: canonical.type === "superset",
      })
      .eq("id", survivor.id);
    assertResult(updateError);
    reconciled += duplicateIds.length || survivor.name !== canonical.name ? 1 : 0;
  }

  return reconciled;
}

export async function deactivateDuplicateExercises(userId) {
  const { data: rows, error } = await supabase
    .from("exercises")
    .select("id, name, created_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at");
  assertResult(error);

  const seenNames = new Set();
  const duplicateIds = [];
  const defaultNames = new Set(
    defaultRoutine.map((exercise) => normalizedExerciseName(exercise.name)),
  );

  for (const row of rows ?? []) {
    const normalizedName = normalizedExerciseName(canonicalDefaultName(row.name));
    if (!defaultNames.has(normalizedName)) continue;
    if (seenNames.has(normalizedName)) {
      duplicateIds.push(row.id);
    } else {
      seenNames.add(normalizedName);
    }
  }

  if (!duplicateIds.length) return 0;

  const { error: updateError } = await supabase
    .from("exercises")
    .update({ is_active: false })
    .in("id", duplicateIds);
  assertResult(updateError);
  return duplicateIds.length;
}

export async function deactivateLegacyLateralRaiseSuperset(userId) {
  const { data: rows, error } = await supabase
    .from("exercises")
    .select("id, name")
    .eq("user_id", userId)
    .eq("is_active", true);
  assertResult(error);

  const legacyIds = (rows ?? [])
    .filter((row) => row.name.trim().toLocaleLowerCase() === "lateral raise superset")
    .map((row) => row.id);

  if (!legacyIds.length) return 0;

  const { error: updateError } = await supabase
    .from("exercises")
    .update({ is_active: false })
    .in("id", legacyIds);
  assertResult(updateError);
  return legacyIds.length;
}

export async function getExercisesWithPartsAndRecentLogs(userId) {
  const { data: exercises, error } = await supabase
    .from("exercises")
    .select("*, exercise_parts(*)")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("position")
    .order("position", { referencedTable: "exercise_parts" });
  assertResult(error);

  if (!exercises?.length) return [];

  const exerciseIds = exercises.map((exercise) => exercise.id);
  const { data: logs, error: logsError } = await supabase
    .from("exercise_logs")
    .select("*, exercise_log_sets(*)")
    .eq("user_id", userId)
    .in("exercise_id", exerciseIds)
    .order("performed_at", { ascending: false })
    .limit(Math.max(45, exerciseIds.length * 5));
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
  const exercises = await getExercisesWithPartsAndRecentLogs(userId);
  if (!exercises.length) return [];

  const { start, end } = dayRangeFromDate(selectedDate);
  const exerciseIds = exercises.map((exercise) => exercise.id);
  const { data: dailyLogs, error } = await supabase
    .from("exercise_logs")
    .select("*, exercise_log_sets(*)")
    .eq("user_id", userId)
    .in("exercise_id", exerciseIds)
    .gte("performed_at", start)
    .lt("performed_at", end)
    .order("performed_at", { ascending: false });
  assertResult(error);

  const dailyLogByExercise = {};
  for (const log of dailyLogs ?? []) {
    if (dailyLogByExercise[log.exercise_id]) continue;
    sortLogSets(log);
    dailyLogByExercise[log.exercise_id] = log;
  }

  return exercises.map((exercise) => ({
    ...exercise,
    selected_log: dailyLogByExercise[exercise.id] ?? null,
  }));
}

export async function createExercise(userId, values, position) {
  const { data, error } = await supabase
    .from("exercises")
    .insert({
      user_id: userId,
      name: values.name.trim(),
      type: values.type,
      position,
      default_weight: values.defaultWeight || null,
      default_sets: values.type === "cardio" ? 1 : Number(values.defaultSets) || 1,
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
  return data;
}

export async function updateExercise(exerciseId, values) {
  const { error } = await supabase
    .from("exercises")
    .update({
      name: values.name.trim(),
      type: values.type,
      default_weight: values.defaultWeight || null,
      default_sets: values.type === "cardio" ? 1 : Number(values.defaultSets) || 1,
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

export async function moveExerciseTo(userId, exerciseId, targetExerciseId) {
  const { data: exercises, error } = await supabase
    .from("exercises")
    .select("id, position")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("position");
  assertResult(error);

  const currentIndex = (exercises ?? []).findIndex((exercise) => exercise.id === exerciseId);
  const targetIndex = (exercises ?? []).findIndex((exercise) => exercise.id === targetExerciseId);
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= exercises.length) return false;
  if (currentIndex === targetIndex) return false;

  const current = exercises[currentIndex];
  const targetPosition = exercises[targetIndex].position;
  const temporaryPosition = Math.max(...exercises.map((exercise) => exercise.position)) + 1000;

  const { error: parkError } = await supabase
    .from("exercises")
    .update({ position: temporaryPosition })
    .eq("id", current.id);
  assertResult(parkError);

  const shifted = currentIndex < targetIndex
    ? exercises.slice(currentIndex + 1, targetIndex + 1)
    : exercises.slice(targetIndex, currentIndex).reverse();

  for (const exercise of shifted) {
    const position = exercise.position + (currentIndex < targetIndex ? -1 : 1);
    const { error: shiftError } = await supabase
      .from("exercises")
      .update({ position })
      .eq("id", exercise.id);
    assertResult(shiftError);
  }

  const { error: currentError } = await supabase
    .from("exercises")
    .update({ position: targetPosition })
    .eq("id", current.id);
  assertResult(currentError);

  return true;
}

export async function deactivateExercise(exerciseId) {
  const { error } = await supabase
    .from("exercises")
    .update({ is_active: false })
    .eq("id", exerciseId);
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
) {
  const existing = await findExerciseLogForDate(userId, exerciseId, performedDate);
  if (existing) {
    const { error } = await supabase
      .from("exercise_logs")
      .update({
        performed_at: performedAtFromDate(performedDate),
        notes: notes || null,
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

export async function updateExerciseLogWithSets(logId, sets, notes = "") {
  const { data: log, error } = await supabase
    .from("exercise_logs")
    .update({ notes: notes || null })
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
