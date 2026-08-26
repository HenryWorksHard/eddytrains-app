-- Rehab staples the exercise library was missing.
--
-- The six injury catalog programs are built on these; without them the
-- programs can only be written out of general strength movements, which
-- misses the actual rehab work (cuff isometrics, craniocervical flexion,
-- terminal knee extension, isometric abduction, the McGill trunk set).
--
-- Additive and idempotent. Applied to production 2026-08-26.

insert into public.exercises (name, category, muscle_group, equipment, primary_muscles, difficulty, tags)
values
 ('Chin Tuck (Craniocervical Flexion)','rehabilitation','neck',ARRAY['body weight'],ARRAY['deep neck flexors'],'beginner',ARRAY['rehab','neck']),
 ('Wall Angel','mobility','shoulders',ARRAY['body weight'],ARRAY['lower trapezius','serratus anterior'],'beginner',ARRAY['rehab','posture']),
 ('Band Pull-Apart','strength','shoulders',ARRAY['band'],ARRAY['rear deltoids','rhomboids'],'beginner',ARRAY['rehab','posture']),
 ('Prone Y Raise','strength','shoulders',ARRAY['body weight','dumbbell'],ARRAY['lower trapezius'],'beginner',ARRAY['rehab','scapular']),
 ('Prone T Raise','strength','shoulders',ARRAY['body weight','dumbbell'],ARRAY['middle trapezius','rhomboids'],'beginner',ARRAY['rehab','scapular']),
 ('Shoulder Scaption Raise','strength','shoulders',ARRAY['dumbbell'],ARRAY['supraspinatus','deltoids'],'beginner',ARRAY['rehab','cuff']),
 ('Isometric Shoulder External Rotation (Wall)','rehabilitation','shoulders',ARRAY['body weight'],ARRAY['rotator cuff'],'beginner',ARRAY['rehab','isometric']),
 ('Shoulder Wall Slide','mobility','shoulders',ARRAY['body weight'],ARRAY['serratus anterior','lower trapezius'],'beginner',ARRAY['rehab','scapular']),
 ('Wall Sit','strength','legs',ARRAY['body weight'],ARRAY['quadriceps'],'beginner',ARRAY['rehab','isometric']),
 ('Spanish Squat','strength','legs',ARRAY['band'],ARRAY['quadriceps'],'beginner',ARRAY['rehab','isometric','knee']),
 ('Terminal Knee Extension (Band)','rehabilitation','legs',ARRAY['band'],ARRAY['vastus medialis','quadriceps'],'beginner',ARRAY['rehab','knee']),
 ('Eccentric Step-Down','strength','legs',ARRAY['body weight'],ARRAY['quadriceps','gluteus medius'],'intermediate',ARRAY['rehab','knee']),
 ('Nordic Hamstring Curl','strength','legs',ARRAY['body weight'],ARRAY['hamstrings'],'advanced',ARRAY['rehab','eccentric']),
 ('Clamshell','strength','glutes',ARRAY['body weight','band'],ARRAY['gluteus medius'],'beginner',ARRAY['rehab','hip']),
 ('Copenhagen Plank','strength','core',ARRAY['body weight'],ARRAY['adductors'],'advanced',ARRAY['rehab','hip']),
 ('Isometric Hip Abduction (Wall Press)','rehabilitation','glutes',ARRAY['body weight'],ARRAY['gluteus medius'],'beginner',ARRAY['rehab','isometric','hip']),
 ('Side Plank','strength','core',ARRAY['body weight'],ARRAY['obliques','quadratus lumborum'],'beginner',ARRAY['rehab','core']),
 ('McGill Curl-Up','strength','core',ARRAY['body weight'],ARRAY['rectus abdominis'],'beginner',ARRAY['rehab','core','back']),
 ('Suitcase Carry','strength','core',ARRAY['dumbbell','kettlebell'],ARRAY['obliques','grip'],'beginner',ARRAY['rehab','carry'])
on conflict do nothing;
