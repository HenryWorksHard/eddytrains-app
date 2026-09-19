# Generates SQL for six injury-rehab catalog programs.
# 4 days/week, 30-45min sessions, full-body coverage with injury emphasis.
import json, random, string
random.seed(7)

def nid(): return ''.join(random.choices(string.ascii_lowercase+string.digits, k=7))

def S(name, sets, reps, rir=2, rest=90, wt='freeweight', note=''):
    return dict(name=name, sets=sets, reps=reps, itype='rir', ival=str(rir), rest=rest,
                restb='90-120' if rest >= 90 else '60-90', wt=wt, note=note)
def T(name, sets, secs, rest=60, note=''):
    return dict(name=name, sets=sets, reps='1', itype='time', ival=str(secs), rest=rest,
                restb='60-90', wt='bodyweight', note=note)
def BW(name, sets, reps, rir=2, rest=60, note=''):
    return S(name, sets, reps, rir, rest, 'bodyweight', note)

def warm(items):
    out = []
    for i, (nm, note) in enumerate(items):
        out.append(dict(id=nid(), order=i, category='stretching', exerciseName=nm,
                        exerciseId='@@'+nm+'@@', notes=note,
                        sets=[dict(id=nid(), setNumber=1, reps='10', notes='',
                                   weightType='freeweight', restBracket='30-60', restSeconds=60,
                                   intensityType='rir', intensityValue='3')]))
    return out

PAIN = ("Train inside the pain rules: up to about 4/10 discomfort during a set is acceptable, "
        "it should settle within 24 hours, and it must not be worse the next morning. If it is, "
        "drop the load or shorten the range and build again from there. Stop and get assessed for "
        "sharp pain, the joint giving way, numbness or pins and needles.")

W_SHOULDER = warm([("Chest And Front Of Shoulder Stretch","Hold 30s each side"),
                   ("Upper Back Stretch","Hold 30s"),
                   ("Scapula Push-Up","10 slow reps")])
W_LOWER    = warm([("World Greatest Stretch","5 each side"),
                   ("Hug Knees To Chest","Hold 30s"),
                   ("Ankle Circles","10 each direction")])
W_BACK     = warm([("Standing Pelvic Tilt","10 slow reps"),
                   ("Hug Knees To Chest","Hold 30s"),
                   ("Sphinx","Hold 30s, breathe out at the top")])
W_NECK     = warm([("Neck Side Stretch","Hold 30s each side, no forcing"),
                   ("Upper Back Stretch","Hold 30s"),
                   ("Spine Twist","8 each side")])
W_HIP      = warm([("Seated Glute Stretch","Hold 30s each side"),
                   ("Intermediate Hip Flexor And Quad Stretch","Hold 30s each side"),
                   ("World Greatest Stretch","5 each side")])
W_KNEE     = warm([("Ankle Circles","10 each direction"),
                   ("Hamstring Stretch","Hold 30s each side"),
                   ("Intermediate Hip Flexor And Quad Stretch","Hold 30s each side")])

PHASES = {6:[[1,2],[3,4],[5,6]], 8:[[1,2],[3,4,5],[6,7,8]],
          10:[[1,2,3],[4,5,6,7],[8,9,10]], 12:[[1,2,3],[4,5,6,7],[8,9,10,11,12]]}

WT = {'Leg Press':'machine','Leg Curl':'machine','Leg Extension':'machine','Lat Pulldown':'machine',
      'Seated Cable Row':'cable','Face Pulls':'cable','Cable Standing Shoulder External Rotation':'cable',
      'Pallof Press':'cable','Band Pull-Apart':'resistance_band','Terminal Knee Extension (Band)':'resistance_band',
      'Monster Walk':'resistance_band','Spanish Squat':'resistance_band'}
BODY = {'Scapula Push-Up','Prone Y Raise','Prone T Raise','Incline Push-Up','Push-Up','Glute Bridge',
        'Dead Bug','Bird Dog','Clamshell','Side Hip Abduction','Bodyweight Standing Calf Raise',
        'Shoulder Wall Slide','Wall Angel','Chin Tuck (Craniocervical Flexion)','McGill Curl-Up',
        'Eccentric Step-Down','Nordic Hamstring Curl','Bench Hip Extension','Side Bridge Hip Abduction',
        'Spanish Squat'}

def E(name, sets, reps, rir=2, rest=90, note=''):
    wt = 'bodyweight' if name in BODY else WT.get(name, 'freeweight')
    return S(name, sets, reps, rir, rest, wt, note)

P1N = "Phase 1 - settle and activate. Loads stay light on purpose; the job is control and consistency, not effort. " + PAIN
P2N = "Phase 2 - build. Add a little load each week while form and next-day response stay clean. " + PAIN
P3N = "Phase 3 - strengthen and integrate. Heaviest phase; keep 1-2 reps in reserve on the main lifts. " + PAIN

PROGRAMS = []

PROGRAMS.append(dict(slug='shoulder', name='Shoulder Rebuild', weeks=8, emoji='🦾', difficulty='beginner',
 desc=("Eight weeks to restore pain-free overhead strength after impingement, rotator-cuff strain or instability. "
       "Four sessions a week, 30-45 minutes each. Cuff and scapular work is dosed twice a week and paired with "
       "full-body strength so the rest of you keeps progressing while the shoulder recovers. " + PAIN),
 days=[
  dict(dow=1, ord=0, title='Shoulder Focus + Lower Body', warm=W_SHOULDER, ex={
   1:[T('Isometric Shoulder External Rotation (Wall)',4,30,60,'Press into the wall at about 70% effort. Should ease symptoms, not stir them up.'),
      E('Dumbbell Lying External Shoulder Rotation',3,'12-15',3,60,'Elbow tucked, tiny range, very light weight.'),
      E('Scapula Push-Up',3,'12',3,60,'Only the shoulder blades move. Elbows stay locked.'),
      E('Goblet Squat',3,'10',3), E('Glute Bridge',3,'12-15',3,60), E('Dead Bug',3,'8 each side',3,60)],
   2:[E('Cable Standing Shoulder External Rotation',3,'12',2,60,'Slow 3 seconds out, 3 seconds back.'),
      E('Shoulder Scaption Raise',3,'12',2,60,'Thumbs up, raise in the plane of the shoulder blade, stop at shoulder height.'),
      E('Scapula Push-Up',3,'15',2,60), E('Goblet Squat',3,'10',2),
      E('Dumbbell Step-Up',3,'10 each side',2), E('Dead Bug',3,'10 each side',2,60)],
   3:[E('Cable Standing Shoulder External Rotation',4,'10',1,60),
      E('Shoulder Scaption Raise',3,'10',1,60), E('Dumbbell Shoulder Press',3,'8-10',2,90,'Only if pain-free. Stop short of the painful range.'),
      E('Goblet Squat',4,'8',1), E('Bulgarian Split Squat',3,'8 each side',2), E('Dead Bug',3,'10 each side',2,60)]}),
  dict(dow=2, ord=1, title='Upper Pull + Core', warm=W_SHOULDER, ex={
   1:[E('Band Pull-Apart',3,'15',3,60), E('Dumbbell One Arm Bent-Over Row',3,'12 each side',3),
      E('Face Pulls',3,'15',3,60), E('Prone Y Raise',3,'12',3,60,'Light or no weight. Thumbs up, lift from the lower traps.'),
      E('Pallof Press',3,'10 each side',3,60), T('Plank',3,30,60)],
   2:[E('Band Pull-Apart',3,'20',2,60), E('Dumbbell One Arm Bent-Over Row',3,'10 each side',2),
      E('Face Pulls',3,'15',2,60), E('Prone Y Raise',3,'12',2,60),
      E('Pallof Press',3,'12 each side',2,60), T('Farmers Walk',3,40,60)],
   3:[E('Lat Pulldown',4,'8-10',1), E('Dumbbell One Arm Bent-Over Row',4,'8 each side',1),
      E('Face Pulls',3,'15',2,60), E('Prone Y Raise',3,'15',2,60),
      E('Pallof Press',3,'12 each side',2,60), T('Farmers Walk',3,45,60)]}),
  dict(dow=4, ord=2, title='Shoulder Strength + Posterior Chain', warm=W_SHOULDER, ex={
   1:[E('Shoulder Wall Slide',3,'10',3,60,'Back of the hands stay on the wall. Stop where it wants to arch.'),
      E('Dumbbell Lying External Shoulder Rotation',3,'12-15',3,60),
      E('Prone T Raise',3,'12',3,60), E('Romanian Deadlift',3,'10',3),
      E('Leg Curl',3,'12',3), T('Side Plank',3,20,60)],
   2:[E('Shoulder Wall Slide',3,'12',2,60), E('Cable Standing Shoulder External Rotation',3,'12',2,60),
      E('Prone T Raise',3,'12',2,60), E('Romanian Deadlift',3,'10',2),
      E('Leg Curl',3,'12',2), T('Side Plank',3,30,60)],
   3:[E('Shoulder Scaption Raise',3,'12',1,60), E('Cable Standing Shoulder External Rotation',4,'10',1,60),
      E('Prone T Raise',3,'15',2,60), E('Romanian Deadlift',4,'8',1),
      E('Leg Curl',3,'10',1), T('Side Plank',3,40,60)]}),
  dict(dow=5, ord=3, title='Full Body Integration', warm=W_LOWER, ex={
   1:[E('Incline Push-Up',3,'10',3,60,'Hands high enough that the shoulder stays quiet.'),
      E('Seated Cable Row',3,'12',3), E('Dumbbell Step-Up',3,'10 each side',3),
      T('Suitcase Carry',3,30,60,'One side at a time. Stay tall, do not lean.'),
      E('Bird Dog',3,'8 each side',3,60), E('Bodyweight Standing Calf Raise',3,'15',3,60)],
   2:[E('Incline Push-Up',3,'12',2,60), E('Seated Cable Row',3,'10',2),
      E('Dumbbell Step-Up',3,'10 each side',2), T('Suitcase Carry',3,40,60),
      E('Bird Dog',3,'10 each side',2,60), E('Dumbbell Single Leg Calf Raise',3,'12 each side',2,60)],
   3:[E('Push-Up',3,'10',2,60), E('Seated Cable Row',4,'8',1),
      E('Bulgarian Split Squat',3,'8 each side',2), T('Suitcase Carry',3,45,60),
      E('Bird Dog',3,'10 each side',2,60), E('Dumbbell Single Leg Calf Raise',3,'12 each side',1,60)]})]))
print("shoulder defined")

PROGRAMS.append(dict(slug='lower-back', name='Lower Back Reset', weeks=8, emoji='🌱', difficulty='beginner',
 desc=("Eight weeks to build a resilient spine and train around disc, SI-joint and general lower-back pain. "
       "Starts with trunk control and endurance rather than loaded flexion, then layers in hinging and carries. "
       "Four sessions a week, 30-45 minutes each. " + PAIN),
 days=[
  dict(dow=1, ord=0, title='Trunk Control + Core Endurance', warm=W_BACK, ex={
   1:[E('McGill Curl-Up',3,'8 each side',3,60,'Hands under the low back, one knee bent. Head and shoulders barely leave the floor, hold 5s.'),
      E('Bird Dog',3,'8 each side',3,60,'Long, not high. Hold 5 seconds, keep the hips level.'),
      T('Side Plank',3,20,60,'From the knees if the full version bites.'),
      E('Glute Bridge',3,'12-15',3,60), E('Dead Bug',3,'8 each side',3,60),
      E('Bodyweight Standing Calf Raise',3,'15',3,60)],
   2:[E('McGill Curl-Up',3,'10 each side',2,60), E('Bird Dog',3,'10 each side',2,60),
      T('Side Plank',3,30,60), E('Glute Bridge',3,'15',2,60),
      E('Dead Bug',3,'10 each side',2,60), E('Pallof Press',3,'12 each side',2,60)],
   3:[E('McGill Curl-Up',3,'10 each side',2,60), E('Bird Dog',3,'12 each side',2,60),
      T('Side Plank',3,40,60), E('Hip Thrust',3,'10',2),
      E('Dead Bug',3,'12 each side',2,60), E('Pallof Press',3,'12 each side',2,60)]}),
  dict(dow=2, ord=1, title='Lower Body Strength', warm=W_LOWER, ex={
   1:[E('Goblet Squat',3,'10',3), E('Romanian Deadlift',3,'10',3,90,'Light. Hinge from the hips, back stays neutral the whole way.'),
      E('Dumbbell Step-Up',3,'10 each side',3), E('Leg Curl',3,'12',3),
      E('Monster Walk',3,'15 each way',3,60), T('Plank',3,30,60)],
   2:[E('Goblet Squat',3,'10',2), E('Romanian Deadlift',3,'10',2),
      E('Dumbbell Step-Up',3,'10 each side',2), E('Leg Curl',3,'12',2),
      E('Monster Walk',3,'20 each way',2,60), T('Plank',3,45,60)],
   3:[E('Goblet Squat',4,'8',1), E('Romanian Deadlift',4,'8',1),
      E('Bulgarian Split Squat',3,'8 each side',2), E('Leg Curl',3,'10',1),
      E('Monster Walk',3,'20 each way',2,60), T('Plank',3,60,60)]}),
  dict(dow=4, ord=2, title='Hinge + Posterior Chain', warm=W_BACK, ex={
   1:[E('Glute Bridge',3,'15',3,60), E('Bench Hip Extension',3,'10',3,60,'Small range to start. Squeeze the glutes, do not arch the back.'),
      E('Bird Dog',3,'8 each side',3,60), T('Side Plank',3,20,60),
      T('Farmers Walk',3,30,60), E('Leg Curl',3,'12',3)],
   2:[E('Hip Thrust',3,'12',2), E('Bench Hip Extension',3,'12',2,60),
      E('Bird Dog',3,'10 each side',2,60), T('Side Plank',3,30,60),
      T('Farmers Walk',3,40,60), E('Romanian Deadlift',3,'10',2)],
   3:[E('Hip Thrust',4,'10',1), E('Bench Hip Extension',3,'12',2,60),
      E('Bird Dog',3,'12 each side',2,60), T('Side Plank',3,40,60),
      T('Farmers Walk',3,45,60), E('Romanian Deadlift',4,'8',1)]}),
  dict(dow=5, ord=3, title='Full Body Integration', warm=W_LOWER, ex={
   1:[E('Incline Push-Up',3,'10',3,60), E('Dumbbell One Arm Bent-Over Row',3,'12 each side',3,90,'Brace against a bench so the back is supported.'),
      E('Leg Press',3,'12',3), E('Pallof Press',3,'10 each side',3,60),
      T('Suitcase Carry',3,30,60), E('Dead Bug',3,'8 each side',3,60)],
   2:[E('Push-Up',3,'8',2,60), E('Dumbbell One Arm Bent-Over Row',3,'10 each side',2),
      E('Leg Press',3,'12',2), E('Pallof Press',3,'12 each side',2,60),
      T('Suitcase Carry',3,40,60), E('Dead Bug',3,'10 each side',2,60)],
   3:[E('Push-Up',3,'10',2,60), E('Seated Cable Row',4,'8',1),
      E('Leg Press',4,'10',1), E('Pallof Press',3,'12 each side',2,60),
      T('Suitcase Carry',3,45,60), E('Dead Bug',3,'12 each side',2,60)]})]))

PROGRAMS.append(dict(slug='knee', name='Knee Recovery', weeks=10, emoji='🦵', difficulty='beginner',
 desc=("Ten weeks to rebuild strength and confidence after ligament, meniscus or patellar problems. "
       "Isometrics first to calm the joint, then progressive quad loading paired with hip strength - the "
       "combination beats knee work alone. Four sessions a week, 30-45 minutes each. " + PAIN),
 days=[
  dict(dow=1, ord=0, title='Knee Focus + Quadriceps', warm=W_KNEE, ex={
   1:[T('Wall Sit',4,30,60,'Knees at whatever angle is comfortable. This should ease pain, not provoke it.'),
      E('Terminal Knee Extension (Band)',3,'15',3,60,'Band behind the knee, straighten the last few degrees hard.'),
      E('Leg Extension',3,'15',3,90,'Light, partial range if needed. Slow 3 seconds down.'),
      E('Glute Bridge',3,'12-15',3,60), E('Clamshell',3,'15 each side',3,60),
      E('Bodyweight Standing Calf Raise',3,'15',3,60)],
   2:[T('Spanish Squat',4,30,60,'Band behind the knees, shins vertical, sit back into it.'),
      E('Terminal Knee Extension (Band)',3,'15',2,60), E('Leg Extension',3,'12',2),
      E('Glute Bridge',3,'15',2,60), E('Clamshell',3,'20 each side',2,60),
      E('Dumbbell Single Leg Calf Raise',3,'12 each side',2,60)],
   3:[E('Spanish Squat',3,'12',2,60), E('Leg Extension',4,'10',1),
      E('Eccentric Step-Down',3,'8 each side',2,60,'Low step. 3 seconds down, step back up with the other leg.'),
      E('Hip Thrust',3,'10',2), E('Clamshell',3,'20 each side',2,60),
      E('Dumbbell Single Leg Calf Raise',3,'12 each side',1,60)]}),
  dict(dow=2, ord=1, title='Hip + Posterior Chain', warm=W_LOWER, ex={
   1:[E('Romanian Deadlift',3,'10',3), E('Side Hip Abduction',3,'15 each side',3,60),
      E('Monster Walk',3,'15 each way',3,60), E('Leg Curl',3,'12',3),
      E('Dead Bug',3,'8 each side',3,60), T('Plank',3,30,60)],
   2:[E('Romanian Deadlift',3,'10',2), E('Side Hip Abduction',3,'15 each side',2,60),
      E('Monster Walk',3,'20 each way',2,60), E('Leg Curl',3,'12',2),
      E('Dead Bug',3,'10 each side',2,60), T('Plank',3,45,60)],
   3:[E('Romanian Deadlift',4,'8',1), E('Side Hip Abduction',3,'20 each side',2,60),
      E('Monster Walk',3,'20 each way',2,60), E('Nordic Hamstring Curl',3,'5-6',2,90,'Lower as slowly as you can control, push back up with the hands.'),
      E('Dead Bug',3,'12 each side',2,60), T('Plank',3,60,60)]}),
  dict(dow=4, ord=2, title='Knee Loading + Control', warm=W_KNEE, ex={
   1:[T('Wall Sit',4,40,60), E('Leg Press',3,'12',3,90,'Feet high, comfortable depth only.'),
      E('Dumbbell Step-Up',3,'10 each side',3,90,'Low step. Push through the heel, control the way down.'),
      T('Side Plank',3,20,60), E('Clamshell',3,'15 each side',3,60),
      E('Bodyweight Standing Calf Raise',3,'15',3,60)],
   2:[T('Spanish Squat',4,45,60), E('Leg Press',3,'12',2),
      E('Dumbbell Step-Up',3,'10 each side',2), T('Side Plank',3,30,60),
      E('Eccentric Step-Down',3,'8 each side',2,60), E('Dumbbell Single Leg Calf Raise',3,'12 each side',2,60)],
   3:[E('Goblet Squat',4,'8',1), E('Leg Press',4,'10',1),
      E('Bulgarian Split Squat',3,'8 each side',2), T('Side Plank',3,40,60),
      E('Eccentric Step-Down',3,'10 each side',2,60), E('Dumbbell Single Leg Calf Raise',3,'15 each side',1,60)]}),
  dict(dow=5, ord=3, title='Full Body Integration', warm=W_SHOULDER, ex={
   1:[E('Incline Push-Up',3,'10',3,60), E('Seated Cable Row',3,'12',3),
      E('Dumbbell Shoulder Press',3,'10',3), T('Farmers Walk',3,30,60),
      E('Bird Dog',3,'8 each side',3,60), E('Glute Bridge',3,'15',3,60)],
   2:[E('Push-Up',3,'8',2,60), E('Seated Cable Row',3,'10',2),
      E('Dumbbell Shoulder Press',3,'10',2), T('Farmers Walk',3,40,60),
      E('Bird Dog',3,'10 each side',2,60), E('Hip Thrust',3,'12',2)],
   3:[E('Push-Up',3,'10',2,60), E('Lat Pulldown',4,'8',1),
      E('Dumbbell Shoulder Press',3,'8',1), T('Farmers Walk',3,45,60),
      E('Bird Dog',3,'12 each side',2,60), E('Hip Thrust',4,'10',1)]})]))
print("lower-back + knee defined", len(PROGRAMS))

PROGRAMS.append(dict(slug='hip', name='Hip & Glute Rehab', weeks=8, emoji='🍑', difficulty='beginner',
 desc=("Eight weeks to settle hip pain and rebuild strong, stable hips and glutes. Follows the loading order that "
       "works best for gluteal tendon pain: isometric holds first, then controlled abductor loading, then function. "
       "Four sessions a week, 30-45 minutes each. " + PAIN),
 days=[
  dict(dow=1, ord=0, title='Hip Focus - Isometric to Abductor', warm=W_HIP, ex={
   1:[T('Isometric Hip Abduction (Wall Press)',4,30,60,'Press the outside of the knee into a wall at about 70%. Should settle symptoms.'),
      E('Side Hip Abduction',3,'12 each side',3,60,'Lying on your side. Lead with the heel, do not roll back.'),
      E('Glute Bridge',3,'12-15',3,60), E('Clamshell',3,'15 each side',3,60),
      E('Dead Bug',3,'8 each side',3,60), E('Bodyweight Standing Calf Raise',3,'15',3,60)],
   2:[T('Isometric Hip Abduction (Wall Press)',4,45,60), E('Side Hip Abduction',3,'15 each side',2,60),
      E('Hip Thrust',3,'12',2), E('Clamshell',3,'20 each side',2,60),
      E('Dead Bug',3,'10 each side',2,60), E('Monster Walk',3,'20 each way',2,60)],
   3:[E('Side Hip Abduction',3,'20 each side',2,60), E('Hip Thrust',4,'10',1),
      T('Copenhagen Plank',3,20,60,'Top knee on the bench to start. Build to the full version only if it stays quiet.'),
      E('Clamshell',3,'20 each side',2,60), E('Dead Bug',3,'12 each side',2,60),
      E('Monster Walk',3,'20 each way',2,60)]}),
  dict(dow=2, ord=1, title='Lower Body Strength', warm=W_LOWER, ex={
   1:[E('Goblet Squat',3,'10',3), E('Romanian Deadlift',3,'10',3), E('Leg Curl',3,'12',3),
      E('Monster Walk',3,'15 each way',3,60), E('Pallof Press',3,'10 each side',3,60), T('Plank',3,30,60)],
   2:[E('Goblet Squat',3,'10',2), E('Romanian Deadlift',3,'10',2), E('Leg Curl',3,'12',2),
      E('Monster Walk',3,'20 each way',2,60), E('Pallof Press',3,'12 each side',2,60), T('Plank',3,45,60)],
   3:[E('Goblet Squat',4,'8',1), E('Romanian Deadlift',4,'8',1), E('Leg Curl',3,'10',1),
      E('Monster Walk',3,'20 each way',2,60), E('Pallof Press',3,'12 each side',2,60), T('Plank',3,60,60)]}),
  dict(dow=4, ord=2, title='Hip Strength + Function', warm=W_HIP, ex={
   1:[E('Glute Bridge',3,'15',3,60), E('Dumbbell Step-Up',3,'10 each side',3),
      E('Side Bridge Hip Abduction',3,'10 each side',3,60), T('Side Plank',3,20,60),
      E('Bird Dog',3,'8 each side',3,60), E('Leg Press',3,'12',3)],
   2:[E('Hip Thrust',3,'12',2), E('Dumbbell Step-Up',3,'10 each side',2),
      E('Side Bridge Hip Abduction',3,'12 each side',2,60), T('Side Plank',3,30,60),
      E('Bird Dog',3,'10 each side',2,60), E('Leg Press',3,'12',2)],
   3:[E('Hip Thrust',4,'10',1), E('Bulgarian Split Squat',3,'8 each side',2),
      T('Copenhagen Plank',3,25,60), T('Side Plank',3,40,60),
      E('Bird Dog',3,'12 each side',2,60), E('Leg Press',4,'10',1)]}),
  dict(dow=5, ord=3, title='Full Body Integration', warm=W_SHOULDER, ex={
   1:[E('Incline Push-Up',3,'10',3,60), E('Dumbbell One Arm Bent-Over Row',3,'12 each side',3),
      E('Dumbbell Shoulder Press',3,'10',3), T('Farmers Walk',3,30,60),
      T('Suitcase Carry',3,30,60), E('Dead Bug',3,'8 each side',3,60)],
   2:[E('Push-Up',3,'8',2,60), E('Dumbbell One Arm Bent-Over Row',3,'10 each side',2),
      E('Dumbbell Shoulder Press',3,'10',2), T('Farmers Walk',3,40,60),
      T('Suitcase Carry',3,40,60), E('Dead Bug',3,'10 each side',2,60)],
   3:[E('Push-Up',3,'10',2,60), E('Seated Cable Row',4,'8',1),
      E('Dumbbell Shoulder Press',3,'8',1), T('Farmers Walk',3,45,60),
      T('Suitcase Carry',3,45,60), E('Dead Bug',3,'12 each side',2,60)]})]))

PROGRAMS.append(dict(slug='neck', name='Neck & Posture', weeks=6, emoji='🧘', difficulty='beginner',
 desc=("Six weeks to relieve neck and upper-back tension and build posture that holds up all day. Low-load deep "
       "neck flexor training is the backbone - it is the best-supported approach for persistent neck pain - "
       "paired with scapular strength and full-body work. Four sessions a week, 30-45 minutes each. " + PAIN),
 days=[
  dict(dow=1, ord=0, title='Neck Focus + Upper Back', warm=W_NECK, ex={
   1:[E('Chin Tuck (Craniocervical Flexion)',3,'10',3,60,'Lying down. A gentle nod, as if saying yes to a small question. Hold 5s. No jaw clenching.'),
      E('Band Pull-Apart',3,'15',3,60), E('Prone Y Raise',3,'12',3,60),
      E('Face Pulls',3,'15',3,60), E('Dead Bug',3,'8 each side',3,60), T('Plank',3,30,60)],
   2:[E('Chin Tuck (Craniocervical Flexion)',3,'10',2,60,'Hold 10 seconds now.'),
      E('Band Pull-Apart',3,'20',2,60), E('Prone Y Raise',3,'15',2,60),
      E('Face Pulls',3,'15',2,60), E('Dead Bug',3,'10 each side',2,60), T('Plank',3,45,60)],
   3:[E('Chin Tuck (Craniocervical Flexion)',3,'12',2,60,'Hold 10 seconds, try it sitting upright too.'),
      E('Band Pull-Apart',3,'20',2,60), E('Prone Y Raise',3,'15',2,60),
      E('Face Pulls',4,'12',1,60), E('Dead Bug',3,'12 each side',2,60), T('Plank',3,60,60)]}),
  dict(dow=2, ord=1, title='Lower Body + Core', warm=W_LOWER, ex={
   1:[E('Goblet Squat',3,'10',3), E('Romanian Deadlift',3,'10',3), E('Glute Bridge',3,'12-15',3,60),
      E('Pallof Press',3,'10 each side',3,60), T('Side Plank',3,20,60), E('Bodyweight Standing Calf Raise',3,'15',3,60)],
   2:[E('Goblet Squat',3,'10',2), E('Romanian Deadlift',3,'10',2), E('Hip Thrust',3,'12',2),
      E('Pallof Press',3,'12 each side',2,60), T('Side Plank',3,30,60), T('Farmers Walk',3,40,60)],
   3:[E('Goblet Squat',4,'8',1), E('Romanian Deadlift',4,'8',1), E('Hip Thrust',4,'10',1),
      E('Pallof Press',3,'12 each side',2,60), T('Side Plank',3,40,60), T('Farmers Walk',3,45,60)]}),
  dict(dow=4, ord=2, title='Neck Focus + Scapular Strength', warm=W_NECK, ex={
   1:[E('Chin Tuck (Craniocervical Flexion)',3,'10',3,60), E('Wall Angel',3,'10',3,60,'Low back stays flat on the wall. Only go as high as it stays flat.'),
      E('Prone T Raise',3,'12',3,60), E('Dumbbell One Arm Bent-Over Row',3,'12 each side',3),
      E('Scapula Push-Up',3,'12',3,60), E('Dumbbell Shrug',3,'12',3,60,'Light. Straight up, no rolling.')],
   2:[E('Chin Tuck (Craniocervical Flexion)',3,'12',2,60), E('Wall Angel',3,'12',2,60),
      E('Prone T Raise',3,'15',2,60), E('Dumbbell One Arm Bent-Over Row',3,'10 each side',2),
      E('Scapula Push-Up',3,'15',2,60), E('Dumbbell Shrug',3,'12',2,60)],
   3:[E('Chin Tuck (Craniocervical Flexion)',3,'12',2,60), E('Wall Angel',3,'15',2,60),
      E('Prone T Raise',3,'15',2,60), E('Dumbbell One Arm Bent-Over Row',4,'8 each side',1),
      E('Scapula Push-Up',3,'15',2,60), E('Dumbbell Shrug',3,'12',1,60)]}),
  dict(dow=5, ord=3, title='Full Body Integration', warm=W_SHOULDER, ex={
   1:[E('Incline Push-Up',3,'10',3,60), E('Seated Cable Row',3,'12',3),
      E('Dumbbell Step-Up',3,'10 each side',3), T('Suitcase Carry',3,30,60),
      E('Bird Dog',3,'8 each side',3,60), E('Shoulder Wall Slide',3,'10',3,60)],
   2:[E('Push-Up',3,'8',2,60), E('Seated Cable Row',3,'10',2),
      E('Dumbbell Step-Up',3,'10 each side',2), T('Suitcase Carry',3,40,60),
      E('Bird Dog',3,'10 each side',2,60), E('Shoulder Wall Slide',3,'12',2,60)],
   3:[E('Push-Up',3,'10',2,60), E('Lat Pulldown',4,'8',1),
      E('Bulgarian Split Squat',3,'8 each side',2), T('Suitcase Carry',3,45,60),
      E('Bird Dog',3,'12 each side',2,60), E('Dumbbell Shoulder Press',3,'10',2)]})]))

PROGRAMS.append(dict(slug='return', name='Return to Training', weeks=12, emoji='🔁', difficulty='beginner',
 desc=("Twelve weeks to come back to full training after a longer layoff. Deliberately unhurried: tendons, "
       "ligaments and bone re-adapt more slowly than muscle, and rushing that gap is what causes the flare-ups. "
       "Bodyweight and light loading first, then dumbbells, then full compound work. Four sessions a week, "
       "30-45 minutes each. " + PAIN),
 days=[
  dict(dow=1, ord=0, title='Lower Body + Core', warm=W_LOWER, ex={
   1:[E('Goblet Squat',3,'10',4,90,'Very light. This phase is about grooving the pattern, not effort.'),
      E('Dumbbell Step-Up',3,'10 each side',4), T('Wall Sit',3,30,60),
      E('Dead Bug',3,'8 each side',3,60), T('Plank',3,30,60), E('Bodyweight Standing Calf Raise',3,'15',3,60)],
   2:[E('Goblet Squat',3,'10',3), E('Dumbbell Step-Up',3,'10 each side',3), E('Leg Press',3,'12',3),
      E('Dead Bug',3,'10 each side',2,60), T('Plank',3,45,60), E('Dumbbell Single Leg Calf Raise',3,'12 each side',2,60)],
   3:[E('Goblet Squat',4,'8',2), E('Bulgarian Split Squat',3,'8 each side',2), E('Leg Press',4,'10',2),
      E('Dead Bug',3,'12 each side',2,60), T('Plank',3,60,60), E('Dumbbell Single Leg Calf Raise',3,'15 each side',2,60)]}),
  dict(dow=2, ord=1, title='Upper Push + Pull', warm=W_SHOULDER, ex={
   1:[E('Incline Push-Up',3,'10',3,60), E('Dumbbell One Arm Bent-Over Row',3,'12 each side',4),
      E('Dumbbell Shoulder Press',3,'10',4), E('Band Pull-Apart',3,'15',3,60),
      E('Pallof Press',3,'10 each side',3,60), E('Face Pulls',3,'15',3,60)],
   2:[E('Push-Up',3,'8',3,60), E('Dumbbell One Arm Bent-Over Row',3,'10 each side',3),
      E('Dumbbell Shoulder Press',3,'10',3), E('Band Pull-Apart',3,'20',2,60),
      E('Pallof Press',3,'12 each side',2,60), E('Face Pulls',3,'15',2,60)],
   3:[E('Dumbbell Bench Press',4,'8',2), E('Lat Pulldown',4,'8',2),
      E('Dumbbell Shoulder Press',3,'8',2), E('Band Pull-Apart',3,'20',2,60),
      E('Pallof Press',3,'12 each side',2,60), E('Face Pulls',3,'15',2,60)]}),
  dict(dow=4, ord=2, title='Hinge + Posterior Chain', warm=W_LOWER, ex={
   1:[E('Romanian Deadlift',3,'10',4,90,'Light. Own the hinge before you load it.'),
      E('Glute Bridge',3,'15',3,60), E('Leg Curl',3,'12',4),
      E('Bird Dog',3,'8 each side',3,60), T('Side Plank',3,20,60), T('Farmers Walk',3,30,60)],
   2:[E('Romanian Deadlift',3,'10',3), E('Hip Thrust',3,'12',3), E('Leg Curl',3,'12',3),
      E('Bird Dog',3,'10 each side',2,60), T('Side Plank',3,30,60), T('Farmers Walk',3,40,60)],
   3:[E('Romanian Deadlift',4,'8',2), E('Hip Thrust',4,'10',2), E('Leg Curl',3,'10',2),
      E('Bird Dog',3,'12 each side',2,60), T('Side Plank',3,40,60), T('Farmers Walk',3,45,60)]}),
  dict(dow=5, ord=3, title='Full Body Integration', warm=W_LOWER, ex={
   1:[E('Goblet Squat',3,'12',4), E('Seated Cable Row',3,'12',4), E('Incline Push-Up',3,'12',3,60),
      E('Monster Walk',3,'15 each way',3,60), T('Suitcase Carry',3,30,60), T('Plank',3,30,60)],
   2:[E('Bulgarian Split Squat',3,'8 each side',3), E('Seated Cable Row',3,'10',3), E('Push-Up',3,'8',3,60),
      E('Monster Walk',3,'20 each way',2,60), T('Suitcase Carry',3,40,60), T('Plank',3,45,60)],
   3:[E('Goblet Squat',4,'10',2), E('Seated Cable Row',4,'8',2), E('Dumbbell Bench Press',3,'10',2),
      E('Monster Walk',3,'20 each way',2,60), T('Suitcase Carry',3,45,60), T('Plank',3,60,60)]})]))
print("all defined:", [p['slug'] for p in PROGRAMS])
