# App Store screenshot set

Six slides at 1320x2868, the 6.9 inch iPhone size. One set at that size covers
every iPhone, because Apple scales down but never up.

Concepts and copy generated with Gemini 4 Carbon via OpenRouter, briefed on the
screenshot strategies of the Health & Fitness top charts, then fact checked
against this codebase. Two slides were rewritten because the model described
features that do not exist; see **Corrections** at the bottom.

## Build them

```
node marketing/appstore/build-slides.mjs
```

Renders to `marketing/appstore/out/`. Each slide looks for a real capture at
`marketing/appstore/screenshots/<n>.png`. If one is missing the slide still
renders, with a placeholder naming the screen to capture, so the layout can be
reviewed before the screens are reachable. Apple requires screenshots to show
the real app, so **a slide with a placeholder in it must not be uploaded**.

Edit the copy in `slides.json` and re-run. Nothing else needs touching.

## What the research said

- Leading fitness apps keep headlines between three and six words in heavy sans-serif type so shoppers can read every caption directly from the search results grid without tapping.
- Captions sit in the top 20 to 25 percent of the canvas above the device bezel because users scan horizontally across the top third of the gallery first.
- Pure workout loggers like Strong, Hevy, and Fitbod bleed the bottom quarter of the iPhone off the lower edge so small set tables and weight inputs scale up to readable sizes.
- Serious training tools like Whoop, Fitbod, and Ladder rely on near-black backgrounds to signal intensity and make bright data lines pop at thumbnail scale.
- Apps like Caliber, MyFitnessPal, and Hevy pull one crucial UI row or metric out of the device as a zoomed floating callout card to prove utility without visual clutter.
- High-converting sets pair a restrained dark UI with a single high-contrast accent color reserved strictly for active buttons, personal record tags, and upward chart lines.
- Coach-led platforms like Ladder, Peloton, Centr, and Nike Training Club establish trainer structure on slide one, whereas self-serve loggers open straight on the live set sheet.
- Habit-driven apps like Freeletics and Whoop favor self-contained compositions over split cross-slide panoramas so the first three thumbnails read cleanly side by side in search.
- Top trackers populate every screen with realistic working weights, familiar compound lifts, and multi-week trend curves instead of empty states or placeholder zeros.
- Slide one always sells the daily workout workflow, while slides four through six handle retention mechanics like lift history, body photos, streaks, and reminders.

**The first three slides carry it.** Most App Store visitors decide whether to download from the three portrait thumbnails visible in search results or on initial page load without ever swiping right. Slides one through three must therefore close the deal alone by showing coach-built structure on slide one, inline set logging on slide two, and hard strength progress on slide three.

**Caption voice.** Top-performing fitness captions use blunt imperative verbs and concrete gym nouns that state what the lifter actually does rather than pitching vague lifestyle promises. Every line reads like a direct cue on the gym floor, cutting filler words so the message lands in under two seconds.

## The slides

### 1. YOUR COACH'S PLAN, READY TO LIFT

> Every exercise and target laid out in your coach's exact order.

- **Screen to capture**: Today's Workout screen showing a coach-assigned session with ordered exercises, set counts, and target reps.
- **Composition**: Heavy white Sora headline stacked in the top 22 percent over a pure #000000 canvas, zinc grey subhead beneath. iPhone framed straight-on and cropped off the bottom edge below the fourth exercise card so UI typography reads clearly from search thumbnails.
- **Accent**: The #FACC15 signal yellow 'Start Workout' button at the top of the session list and the word 'COACH'S' set in yellow in the headline.
- **Accent word in headline**: `COACH'S`

### 2. BEAT YOUR LAST SESSION

> Last session's numbers sit inline. Feel a haptic on every PB.

- **Screen to capture**: Active Set Logging screen on Barbell Bench Press with previous weights and reps shown inline beside current set inputs.
- **Composition**: Headline aligned top center. Device pushed down and bled off the bottom edge, with an enlarged floating UI row callout overlapping the middle of the screen at 125 percent scale to spotlight the inline zinc grey 'Last' numbers next to today's heavier logged set.
- **Accent**: A crisp #FACC15 'PB' badge illuminated on the completed top set inside the zoomed callout row.
- **Accent word in headline**: `BEAT`

### 3. WATCH YOUR NUMBERS CLIMB

> Lift charts and estimated 1RMs you and your coach both see.

- **Screen to capture**: Lift Progress detail screen showing an Estimated 1RM line chart for Squat above chronological exercise history.
- **Composition**: Clean top-down hierarchy on #000000. Straight-on iPhone frame cropped near the bottom bezel so the 1RM graph fills the upper half of the screen and full past session entries remain legible underneath.
- **Accent**: The upward #FACC15 trend line and glowing peak 1RM data point cutting across the dark zinc chart grid.
- **Accent word in headline**: `CLIMB`

### 4. SEE THE WORK STACK UP

> Tap through full-screen progress photos and track your goals.

- **Screen to capture**: Full-screen chronological Progress Photos viewer with story-style tap indicators at the top, paired with an active Goals tracking card.
- **Composition**: Heavy white Sora headline centered at top over pure #000000, zinc grey subhead beneath. Device framed straight-on and bled off the bottom, showing a dated full-screen check-in photo with segmented tap bars at the top and a clean Goals progress card overlapping the lower third of the frame.
- **Accent**: The #FACC15 active story segment bar above the check-in photo and the goal progress fill bar on the card below.
- **Accent word in headline**: `STACK`

### 5. SHOW UP. LEVEL UP PASCAL.

> A custom 20-stage pixel character plus weekday gym reminders.

- **Screen to capture**: Pascal character progression and customisation screen with a scheduled weekday workout reminder banner.
- **Composition**: Headline at top. The dark app screen showcases Pascal in crisp pixel art with customisable slots and his 20-stage progression track, while a native device notification banner floats just above the top screen edge showing a scheduled 6:00 AM training reminder.
- **Accent**: The #FACC15 stage level-up bar beneath Pascal.
- **Accent word in headline**: `PASCAL`

### 6. YOUR COACH SEES EVERY SET

> Your coach reviews your logged history and adjusts your program.

- **Screen to capture**: Completed Workout summary and Session History view showing logged working sets alongside an updated coach-assigned training block.
- **Composition**: High-trust closing slide. Heavy white Sora headline stacked at top over a pure #000000 canvas with a zinc grey subhead. Straight-on iPhone cropped below the lower third showing completed sets recorded in history above the next adjusted workout block from the coach.
- **Accent**: The #FACC15 completed session checkmark badge in the UI and the word 'COACH' set in yellow in the headline.
- **Accent word in headline**: `COACH`

## Capturing the real screens

All six screens sit behind a login, so this needs a demo client account with a
real assigned program and logged history. The same account is the one App Store
review needs, so it is worth creating properly once.

Capture on the **iPhone 17 Pro Max** simulator, which is exactly 1320x2868:

```
xcrun simctl io booted screenshot marketing/appstore/screenshots/1.png
```

Populate the screens with real working weights and familiar compound lifts.
The research was blunt about this: top trackers never ship empty states or
placeholder zeros, and an empty chart reads as a dead app.

## Listing copy

**Subtitle** (27/30)

```
Coach-Led Gym & Workout Log
```

**Promotional text** (159/170)

```
Your coach builds the program. You log every set. Track PBs, 1RM charts, photos, and full lift history. Invite based for clients, with self serve for trainers.
```

The full description, keywords and age rating answers are in
`docs/APP-STORE-SUBMISSION.md`.

## Corrections

Gemini's first pass claimed two things the app does not do. Both were caught by
checking the source, and both would have been worse than embarrassing on a live
listing.

**Slide 6 claimed offline logging.** The original headline was BUILT FOR BAD GYM
WIFI, with "keep logging in dead zones". There is no offline queue. `saveProgress`
posts straight to Supabase and a set entered without a connection is lost. The app
only warns you. Shipping that claim would have been a straight lie to customers and
a stream of support mail. Replaced with the real differentiator against Strong and
Hevy: the coach is on the other end.

**Slide 4 claimed a side by side photo comparison.** There is no comparison view.
`ProgressPicturesClient` renders a chronological story-style viewer you tap
through. Rewritten to describe only that.

If the offline outbox ever gets built, slide 6 becomes true and is worth
revisiting. Until then it stays out.
