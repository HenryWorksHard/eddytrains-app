// Fails if the picker's filter vocabulary has drifted from the live library.
//
// The filters broke once already by going stale: the chips were written
// against a 102-exercise seed file and the library grew to 1,463 rows from a
// different source, so ten of eleven category chips matched nothing and
// nobody noticed because an empty list looks like "no results".
//
// Run after any exercise import:  npm run check:filters
import {
  MUSCLE_GROUPS, EQUIPMENT_GROUPS, matchesMuscleGroup, matchesEquipmentGroup,
} from '../src/data/exercise-filters.ts';

const URL = process.env.EXERCISES_URL ?? 'https://app.cmpdcollective.com/api/exercises';
const res = await fetch(URL);
if (!res.ok) { console.error(`Could not read ${URL}: ${res.status}`); process.exit(1); }
const { exercises } = await res.json();
console.log(`Checking ${exercises.length} exercises from ${URL}\n`);

let failed = false;

const report = (kind, groups, matcher, field) => {
  console.log(`${kind}:`);
  // Two different faults, and only one of them is this file's problem.
  // `unreachable` is a value the library uses that no group lists: a real
  // vocabulary hole, and a build failure. `blank` is a row that carries no
  // value at all, which is a gap in the library itself and gets reported but
  // does not fail the check, since no vocabulary can fix it.
  const unreachable = [];
  const blank = [];
  for (const ex of exercises) {
    const vals = ex[field] ?? [];
    if (vals.length === 0) blank.push(ex);
    else if (!groups.some((g) => matcher(vals, g.id))) unreachable.push(ex);
  }
  for (const g of groups) {
    const n = exercises.filter((ex) => matcher(ex[field] ?? [], g.id)).length;
    const flag = n === 0 ? '  <- MATCHES NOTHING' : '';
    if (n === 0) failed = true;
    console.log(`  ${String(n).padStart(5)}  ${g.label}${flag}`);
  }
  console.log();
  if (unreachable.length) {
    failed = true;
    const vocab = new Set();
    for (const ex of unreachable) for (const v of ex[field] ?? []) vocab.add(v);
    console.log(`  ${unreachable.length} exercise(s) use a value no group lists.`);
    console.log(`  Unmapped: ${[...vocab].map((v) => JSON.stringify(v)).join(', ')}`);
    console.log(`  Add each to a group in src/data/exercise-filters.ts.`);
  }
  if (blank.length) {
    console.log(`  ${blank.length} exercise(s) have no ${field} at all, so no filter can reach them.`);
    console.log(`  Fix in the library, not here: ${blank.slice(0, 8).map((e) => e.name).join(', ')}${blank.length > 8 ? ', ...' : ''}`);
  }
  if (!unreachable.length && !blank.length) console.log(`  All ${exercises.length} reachable.`);
  console.log();
};

report('Muscle groups', MUSCLE_GROUPS, matchesMuscleGroup, 'primaryMuscles');
report('Equipment groups', EQUIPMENT_GROUPS, matchesEquipmentGroup, 'equipment');

if (failed) { console.error('FAIL: the picker has chips that find nothing, or values no chip covers.'); process.exit(1); }
console.log('OK: every exercise is reachable and every chip finds something.');
