// The filter vocabulary for the exercise picker.
//
// WHY THIS FILE EXISTS. The picker used to build its filter chips from
// `exercises.json`, a 102-exercise file written before the real library
// landed in Supabase. The two vocabularies never matched:
//
//   - The chips were body parts (chest, back, legs). The `category` column
//     holds exercise TYPE (strength, stretching, cardio, mobility). So ten of
//     the eleven category chips matched NOTHING: 45 of 1,463 exercises were
//     reachable by any of them, and picking "Chest" returned an empty list.
//   - Equipment chips were slugs like `smith`, `bands`, `foam_roller`; the
//     library says "smith machine", "band", "roller". Three chips matched
//     nothing and only 716 of 1,463 exercises were reachable at all.
//
// Body part lives in `primary_muscles`, so that is what the muscle groups
// below read. Both vocabularies are messy because the library was imported
// from several sources: "quads" and "quadriceps", "delts" and "deltoids" and
// "front_delts", "body weight" and "bodyweight". Every spelling that appears
// is listed, so the groups match on exact normalised strings rather than on a
// substring guess that would put "upper back" under "back" and also under
// "upper chest".
//
// KEEPING IT HONEST. `npm run check:filters` re-reads the live library and
// fails if any exercise is unreachable by every group, or if a group matches
// nothing. Run it after any library import. A new spelling is a one-line
// addition here, not a silent hole in the picker.

/** Lower-cases and treats `_` as a space, so `front_delts` === `front delts`. */
export const normalise = (s: string) => s.toLowerCase().replace(/_/g, ' ').trim();

export type FilterGroup = {
  id: string;
  label: string;
  /** Every spelling in the live library that belongs to this group. */
  members: string[];
};

/**
 * Body-part groups, read from `primaryMuscles`.
 *
 * Ordered the way a trainer scans a program: push, pull, arms, core, legs.
 */
export const MUSCLE_GROUPS: FilterGroup[] = [
  { id: 'chest', label: 'Chest', members: [
    'pectorals', 'chest', 'upper chest', 'lower chest', 'serratus anterior',
  ]},
  { id: 'back', label: 'Back', members: [
    'lats', 'upper back', 'back', 'rhomboids', 'traps', 'lower trapezius',
    'middle trapezius', 'levator scapulae', 'spine', 'lower back',
    'quadratus lumborum',
  ]},
  { id: 'shoulders', label: 'Shoulders', members: [
    'delts', 'deltoids', 'shoulders', 'front delts', 'medial delts',
    'lateral deltoid', 'rear delts', 'rear deltoid', 'rear deltoids',
    'rotator cuff', 'supraspinatus',
  ]},
  { id: 'biceps', label: 'Biceps', members: ['biceps'] },
  { id: 'triceps', label: 'Triceps', members: ['triceps'] },
  { id: 'forearms', label: 'Forearms', members: ['forearms', 'grip'] },
  { id: 'core', label: 'Core', members: [
    'abs', 'core', 'obliques', 'rectus abdominis', 'transverse abdominis',
    'hip flexors',
  ]},
  { id: 'glutes', label: 'Glutes', members: [
    'glutes', 'gluteus medius', 'abductors', 'adductors',
  ]},
  { id: 'quads', label: 'Quads', members: [
    'quads', 'quadriceps', 'vastus medialis',
  ]},
  { id: 'hamstrings', label: 'Hamstrings', members: ['hamstrings'] },
  { id: 'calves', label: 'Calves', members: ['calves', 'tibialis anterior'] },
  { id: 'neck', label: 'Neck', members: ['deep neck flexors'] },
  { id: 'cardio', label: 'Cardio', members: [
    'cardiovascular system', 'cardio',
  ]},
  { id: 'fullbody', label: 'Full Body', members: [
    'full body', 'legs', 'arms',
  ]},
];

/**
 * Equipment groups, read from `equipment`.
 *
 * A few library rows carry a sentence rather than a name ("dumbbell (used as
 * handles for deeper range)"), so those are listed under the equipment they
 * actually need rather than being left unreachable.
 */
export const EQUIPMENT_GROUPS: FilterGroup[] = [
  { id: 'bodyweight', label: 'Bodyweight', members: [
    'body weight', 'bodyweight', 'assisted', 'assisted (towel)',
    'body weight (with resistance band)',
  ]},
  { id: 'dumbbell', label: 'Dumbbell', members: [
    'dumbbell', 'dumbbell, exercise ball', 'dumbbell, exercise ball, tennis ball',
    'dumbbell (used as handles for deeper range)',
  ]},
  { id: 'barbell', label: 'Barbell', members: [
    'barbell', 'ez barbell', 'olympic barbell', 'trap bar',
    'ez barbell, exercise ball', 'weighted',
  ]},
  { id: 'cable', label: 'Cable', members: ['cable', 'rope'] },
  { id: 'machine', label: 'Machine', members: [
    'leverage machine', 'machine', 'smith machine', 'sled machine', 'sled',
    'upper body ergometer', 'skierg machine', 'stationary bike',
    'elliptical machine', 'stepmill machine',
  ]},
  { id: 'band', label: 'Resistance Band', members: [
    'band', 'bands', 'resistance band',
  ]},
  { id: 'kettlebell', label: 'Kettlebell', members: ['kettlebell'] },
  { id: 'ball', label: 'Ball', members: [
    'stability ball', 'medicine ball', 'medicineball', 'bosu ball',
  ]},
  { id: 'bench', label: 'Bench & Box', members: ['bench', 'box'] },
  { id: 'pullupbar', label: 'Pull-up Bar', members: ['pullupbar'] },
  { id: 'roller', label: 'Roller', members: ['roller', 'wheel roller'] },
  { id: 'other', label: 'Other', members: [
    'battle ropes', 'sandbag', 'hammer', 'tire',
  ]},
];

// Reverse lookups, built once. Membership is a Map hit rather than a scan of
// every group's array for every exercise on every keystroke.
const buildIndex = (groups: FilterGroup[]) => {
  const index = new Map<string, string[]>();
  for (const g of groups) {
    for (const m of g.members) {
      const key = normalise(m);
      const existing = index.get(key);
      if (existing) existing.push(g.id);
      else index.set(key, [g.id]);
    }
  }
  return index;
};

const MUSCLE_INDEX = buildIndex(MUSCLE_GROUPS);
const EQUIPMENT_INDEX = buildIndex(EQUIPMENT_GROUPS);

/** True when any of `muscles` belongs to `groupId`. */
export function matchesMuscleGroup(muscles: string[], groupId: string): boolean {
  for (const m of muscles) {
    if (MUSCLE_INDEX.get(normalise(m))?.includes(groupId)) return true;
  }
  return false;
}

/** True when any of `equipment` belongs to `groupId`. */
export function matchesEquipmentGroup(equipment: string[], groupId: string): boolean {
  for (const e of equipment) {
    if (EQUIPMENT_INDEX.get(normalise(e))?.includes(groupId)) return true;
  }
  return false;
}

/**
 * The weight type a set should default to, from the exercise's own equipment.
 *
 * This used to look the exercise up by id in `exercises.json`, which keys on
 * slugs (`barbell_bench_press`) while everything from the library carries a
 * Supabase UUID. The lookup therefore never hit, and every exercise silently
 * defaulted to `freeweight`, so a barbell lift came in asking for the wrong
 * kind of number and Eddy fixed it by hand each time.
 */
export function defaultWeightType(equipment: string[] | undefined): string {
  const eq = (equipment ?? []).map(normalise);
  const has = (...names: string[]) => names.some((n) => eq.includes(n));

  // Order matters where an exercise lists more than one: a smith machine row
  // that also says "barbell" is still a smith machine.
  if (has('smith machine')) return 'smith_machine';
  if (has('barbell', 'ez barbell', 'olympic barbell', 'trap bar')) return 'plate_loaded';
  if (has('cable', 'rope')) return 'cable';
  if (has('leverage machine', 'machine', 'sled machine', 'sled')) return 'machine';
  if (has('kettlebell')) return 'kettlebell';
  if (has('band', 'bands', 'resistance band')) return 'resistance_band';
  if (has('medicine ball', 'medicineball')) return 'medicine_ball';
  if (has('body weight', 'bodyweight', 'assisted', 'pullupbar')) return 'bodyweight';
  return 'freeweight'; // dumbbells and anything unrecognised
}
