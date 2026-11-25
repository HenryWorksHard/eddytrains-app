// The small vocabularies the builder needs that are not derived from the
// exercise library itself.
//
// These used to live in `exercises.json` alongside a 102-exercise seed list.
// That file was 110 KB, 72 KB of it the seed list, and it shipped in the
// client bundle on every page that touched the workout builder. The seed list
// is gone (see the note in ExerciseSelector about its slug ids); this is the
// 200 bytes that were actually being used.

export type IntensityType = { id: string; label: string; unit: string };

export const INTENSITY_TYPES: IntensityType[] = [
  { id: 'percentage', label: '% of 1RM', unit: '%' },
  { id: 'rir', label: 'RIR (Reps in Reserve)', unit: 'RIR' },
  { id: 'rpe', label: 'RPE (Rate of Perceived Exertion)', unit: 'RPE' },
  { id: 'failure', label: 'Train to Failure', unit: '' },
];
