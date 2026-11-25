-- Backfill equipment and primary_muscles on the hand-added exercises.
--
-- The bulk-imported library (1,417 rows) carries both columns. The 46 rows
-- added by hand carry neither, and they are the ones that matter: Deadlift,
-- Barbell Back Squat, Barbell Row, Lat Pulldown, Overhead Press, Leg Press,
-- Face Pull, Hammer Curl. Every one of them is in a real client program.
--
-- With both columns empty they are invisible to every filter in the exercise
-- picker, so the only way to reach the most common lift in the gym is to
-- type its name exactly. They also default to the wrong weight type, because
-- that is derived from equipment.
--
-- Values use the library's own vocabulary ("smith machine", "body weight",
-- "leverage machine") so the filter groups in src/data/exercise-filters.ts
-- match them without a special case.
--
-- SAFE TO RE-RUN. Every statement only fills a column that is still empty,
-- so a second run is a no-op and nothing already set is overwritten.

begin;

-- Equipment, grouped by the value being written.
update exercises set equipment = array['barbell'] where (equipment is null or cardinality(equipment) = 0) and name in (
  'Barbell Back Squat', 'Barbell Bicep Curl', 'Barbell Forearm Curls', 'Barbell Row',
  'Deadlift', 'Incline Bench Press', 'Overhead Press', 'Romanian Deadlift'
);

update exercises set equipment = array['dumbbell'] where (equipment is null or cardinality(equipment) = 0) and name in (
  'Bulgarian Split Squat', 'Dumbbell Alternating Bicep Curl', 'Dumbbell Lateral Raises',
  'Dumbbell Rear Delt Fly', 'Dumbbell Shrugs', 'Dumbbell Skull Crushers', 'Hammer Curl',
  'Incline Dumbbell Press', 'Lateral Raise'
);

update exercises set equipment = array['cable'] where (equipment is null or cardinality(equipment) = 0) and name in (
  'Cable Chest Fly', 'Face Pull', 'Lat Pulldown', 'Rope Tricep Extension',
  'Seated Cable Row', 'Seated Row (Neutral Grip)', 'Seated Row (Wide Grip)',
  'Single Arm Lat Pulldown', 'Tricep Pushdown'
);

update exercises set equipment = array['leverage machine'] where (equipment is null or cardinality(equipment) = 0) and name in (
  'Leg Curl', 'Leg Extension', 'Leg Extensions', 'Leg Press', 'Lying Hamstring Curl',
  'Plate Loaded Row Machine', 'Seated Calf Raise', 'Standing Calf Raise'
);

update exercises set equipment = array['body weight'] where (equipment is null or cardinality(equipment) = 0) and name in (
  'Back Extensions', 'Dips (Bodyweight)', 'Sissy Squats',
  'Standing Calf Raise (Single Leg)', 'Walking', 'Wall Tib Raises'
);

update exercises set equipment = array['pullupbar'] where (equipment is null or cardinality(equipment) = 0) and name in (
  'Hanging Leg Raises', 'Pull-ups (Overhand)', 'Pull-ups (Underhand)'
);

update exercises set equipment = array['machine']        where (equipment is null or cardinality(equipment) = 0) and name = 'Pec Deck / Cable Fly';
update exercises set equipment = array['wheel roller']   where (equipment is null or cardinality(equipment) = 0) and name = 'Ab Roller';
update exercises set equipment = array['stepmill machine'] where (equipment is null or cardinality(equipment) = 0) and name = 'Steps';

-- Primary muscles, for the 17 rows that have none. One statement each, since
-- no two of them share a list.
update exercises set primary_muscles = array['quads','glutes','hamstrings'] where (primary_muscles is null or cardinality(primary_muscles) = 0) and name = 'Barbell Back Squat';
update exercises set primary_muscles = array['forearms']                     where (primary_muscles is null or cardinality(primary_muscles) = 0) and name = 'Barbell Forearm Curls';
update exercises set primary_muscles = array['lats','upper back','biceps']   where (primary_muscles is null or cardinality(primary_muscles) = 0) and name = 'Barbell Row';
update exercises set primary_muscles = array['hamstrings','glutes','lower back'] where (primary_muscles is null or cardinality(primary_muscles) = 0) and name = 'Deadlift';
update exercises set primary_muscles = array['rear delts','rhomboids','rotator cuff'] where (primary_muscles is null or cardinality(primary_muscles) = 0) and name = 'Face Pull';
update exercises set primary_muscles = array['biceps','forearms']            where (primary_muscles is null or cardinality(primary_muscles) = 0) and name = 'Hammer Curl';
update exercises set primary_muscles = array['pectorals','front delts','triceps'] where (primary_muscles is null or cardinality(primary_muscles) = 0) and name = 'Incline Bench Press';
update exercises set primary_muscles = array['lats','biceps']                where (primary_muscles is null or cardinality(primary_muscles) = 0) and name = 'Lat Pulldown';
update exercises set primary_muscles = array['medial delts']                 where (primary_muscles is null or cardinality(primary_muscles) = 0) and name = 'Lateral Raise';
update exercises set primary_muscles = array['hamstrings']                   where (primary_muscles is null or cardinality(primary_muscles) = 0) and name = 'Leg Curl';
update exercises set primary_muscles = array['quads']                        where (primary_muscles is null or cardinality(primary_muscles) = 0) and name = 'Leg Extension';
update exercises set primary_muscles = array['quads','glutes']               where (primary_muscles is null or cardinality(primary_muscles) = 0) and name = 'Leg Press';
update exercises set primary_muscles = array['front delts','triceps']        where (primary_muscles is null or cardinality(primary_muscles) = 0) and name = 'Overhead Press';
update exercises set primary_muscles = array['lats','upper back']            where (primary_muscles is null or cardinality(primary_muscles) = 0) and name = 'Plate Loaded Row Machine';
update exercises set primary_muscles = array['hamstrings','glutes']          where (primary_muscles is null or cardinality(primary_muscles) = 0) and name = 'Romanian Deadlift';
update exercises set primary_muscles = array['lats','upper back','biceps']   where (primary_muscles is null or cardinality(primary_muscles) = 0) and name = 'Seated Cable Row';
update exercises set primary_muscles = array['triceps']                      where (primary_muscles is null or cardinality(primary_muscles) = 0) and name = 'Tricep Pushdown';

-- Refuse to commit if anything is still unreachable by a filter.
do $$
declare missing_eq int; missing_mu int;
begin
  select count(*) into missing_eq from exercises where equipment is null or cardinality(equipment) = 0;
  select count(*) into missing_mu from exercises where primary_muscles is null or cardinality(primary_muscles) = 0;
  if missing_eq > 0 or missing_mu > 0 then
    raise exception 'Backfill incomplete: % row(s) still have no equipment, % still have no primary_muscles', missing_eq, missing_mu;
  end if;
end $$;

commit;
