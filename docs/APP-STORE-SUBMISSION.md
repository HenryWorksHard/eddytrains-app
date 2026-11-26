# App Store submission pack

Everything needed to get CMPD Fitness onto the App Store. Copy the blocks
straight into App Store Connect.

Checked and current as of 26 November 2026.

---

## The facts you will be asked for

| Field | Value |
|---|---|
| App name | CMPD Fitness |
| Bundle ID | `com.eddytrains.app` |
| Apple Team ID | `2CBUGCKX8C` |
| Version | 1.0 |
| Build | 1 |
| Devices | iPhone only (`TARGETED_DEVICE_FAMILY = 1`) |
| Orientation | Portrait only |
| Minimum iOS | 15.0 |
| Primary category | Health & Fitness |
| Privacy Policy URL | `https://app.cmpdcollective.com/privacy` |
| Support URL | `https://app.cmpdcollective.com/support` |
| Copyright | 2026 CMPD Collective |

iPhone only means **no iPad screenshots are required**, and no iPad layout
review. Keep it that way for 1.0.

---

## Already handled in the code

Do not redo these. They are the items Apple rejects for most often.

- **In-app account deletion** (Guideline 5.1.1(v)). Profile, then Delete
  account. Wipes storage objects, clears trainer references, deletes the auth
  user and cascades the data. Required for any app with account creation, and
  reviewers check for it specifically.
- **Guideline 4.8 does not apply.** 4.8 only binds apps that *offer* a
  third-party or social login. This app offers email and password only, which
  is first-party, so there is nothing to match. A Sign in with Apple handler
  is written and wired but deliberately switched off for 1.0: Apple OAuth
  creates a new user keyed on email, which would collide with the existing
  trainer-invited accounts. Leave it off. If it is ever turned on, 4.8 starts
  applying and the button must be present and working before submitting.
- **No payment UI in the app** (Guideline 3.1.1). `useIsNativeApp()` hides
  billing, upgrade prompts and trial CTAs inside the native build. Trainers
  subscribe on the web; clients never transact. Verified on the simulator
  against the live site: the "Personal trainer? Start your free trial" link
  that appears on the web login page is absent in the app build.
- **Camera and photo library purpose strings** are present and specific.
  `NSFaceIDUsageDescription` has been removed because no biometric auth is
  implemented, and an unused purpose string only invites questions.
- **No unused background modes** (Guideline 2.5.4). Nothing is declared,
  because push is not implemented. Do not add `remote-notification` until it
  actually is.
- **App icon** is 1024x1024, RGB, no alpha channel. Alpha is an automatic
  upload rejection.
- **Support page exists** at `/support`. App Store Connect will not accept a
  blank or 404 support URL and reviewers do open it.

---

## The Guideline 4.2 argument

This is the real risk. The app is a Capacitor shell pointed at
`app.cmpdcollective.com`, and Apple rejects shells that are only a website in
a frame. The defence is that the app does things a website cannot, and as of
this build it genuinely does. Nine native plugins are compiled in:

| Plugin | What the user gets |
|---|---|
| Camera | Native camera and library sheet for progress photos and profile picture |
| Local Notifications | Workout reminders scheduled on-device by weekday and time |
| Haptics | Feedback on set confirmation, a distinct pattern for a session best |
| Network | Reliable offline detection, including wifi with no route |
| App | Stale-data refresh on resume, suppressed mid-workout |
| Splash Screen | Native launch experience |
| Status Bar | Native status bar styling |
| Share | Native share sheet for a progress photo |
| Browser | In-app browser for external links |

Reminders are **local, not push**, on purpose. Local notifications need no
APNs key, no Firebase project and no server, so they work the day the app is
installed. Say so if asked: it is a design decision, not a missing feature.

Paste this into **App Review Notes**:

```
CMPD Fitness is the iPhone client for a personal-training platform. Clients
log every set of their program at the gym, and their trainer sees the results.

The app uses the following device capabilities that are not available to a
website:

- Camera and photo library, via the native capture sheet, for progress photos
- Scheduled local notifications for workout reminders, configured per weekday
  and time in Profile > Workout reminders
- Haptic feedback on set confirmation, with a distinct pattern for a personal
  best
- Native network state detection, which warns the user that sets will not
  record when the gym wifi has no route to the internet
- Native share sheet for sharing a progress photo
- App lifecycle handling, which refreshes stale data on resume but never
  during an in-progress workout

Accounts are created by a trainer inviting a client, so a demo account is
provided below. It has an assigned program and logged history so the full
flow is reviewable.

Clients do not make purchases in the app. Trainers subscribe to the platform
on the web, and all billing and upgrade UI is hidden in the iOS build.

Account deletion is available in-app under Profile > Delete account.
```

---

## Demo account for the reviewer

**You must create this before submitting.** Clients are invite-only, so
without it the reviewer hits the login screen and cannot get past it. That is
an automatic rejection and it is the single most common reason this kind of
app comes back.

It needs:

- A client account with a real email you control
- An assigned program with several workouts
- At least two completed workouts with logged sets, so Progress is not empty
- A goal set, so the dashboard renders fully

Then put the credentials in App Store Connect under **Sign-In Information**,
not just in the review notes.

---

## App Privacy questionnaire

The app collects the following. All of it is **linked to the user's
identity** and used for **App Functionality** only. Nothing is used for
tracking, and there are no analytics or advertising SDKs in the build, which
has been verified against the dependency tree.

| Data type | Category | Purpose | Linked | Tracking |
|---|---|---|---|---|
| Email address | Contact Info | App Functionality | Yes | No |
| Name | Contact Info | App Functionality | Yes | No |
| Photos | User Content | App Functionality | Yes | No |
| Health & Fitness | Health & Fitness | App Functionality | Yes | No |
| User ID | Identifiers | App Functionality | Yes | No |

Answer **"No, we do not use data to track you"** on the tracking question.

Health & Fitness gets more scrutiny than the rest, so be precise: the app
stores workout logs, estimated 1RMs and optionally body weight. It does not
read or write Apple Health, and it collects no medical data.

Trainers' card details are handled by Stripe on the web and never in the iOS
app. Declaring Payment Info is defensible either way; if in doubt declare it,
because over-declaring is harmless and under-declaring is not.

---

## Screenshots

Required: **6.9 inch iPhone**, 1320 x 2868 portrait. One set covers every
iPhone size, since Apple scales down. Up to 10, minimum 3, and the first
three are what people actually see.

Suggested order:

1. Today's workout, mid-session, with sets logged
2. Progress, with the charts populated
3. Pascal, at a decent stage
4. Workout reminders turned on in Profile
5. Progress photos

Take them on the iPhone 17 Pro Max simulator, which is exactly 1320 x 2868.
Do not include the status bar clock showing a partial battery or a carrier
name that looks wrong; the simulator's default is clean.

---

## Order of operations

0. **ACCEPT THE APPLE AGREEMENT. Nothing works until you do.**
   Verified 2026-11-26 with a real API call: the App Store Connect key
   authenticates fine, but *every* endpoint returns
   `403 FORBIDDEN.REQUIRED_AGREEMENTS_MISSING_OR_EXPIRED` — `/v1/apps`,
   `/v1/bundleIds`, `/v1/certificates`, `/v1/profiles`, `/v1/users`, all of
   them. This is not an auth problem and no amount of re-keying fixes it.
   Sign in and accept at **https://appstoreconnect.apple.com/business**
   (Agreements, Tax and Banking). Check this before debugging anything else.

1. **Deploy the web app first.** The binary loads
   `app.cmpdcollective.com`, so until this branch is merged and deployed, the
   camera, reminder and haptic code does not exist for the app and a reviewer
   would be looking at the old site.
2. Register the bundle ID at developer.apple.com under Identifiers, and
   **tick Sign In with Apple** while doing it. `App.entitlements` declares
   `com.apple.developer.applesignin`, so if the App ID does not carry that
   capability, provisioning fails and the archive will not sign. The button is
   switched off in the UI for 1.0, but the entitlement still ships, so the
   capability has to exist. (The alternative is deleting the entitlement; the
   capability costs nothing and keeps the door open for 1.1.)
3. Create the app record in App Store Connect.
4. Sign Xcode into the Apple ID. Signing is already Automatic with the team
   set, so certificates and profiles generate on their own.
5. Create the demo client account and fill in Sign-In Information.
6. Fill in the listing: category, age rating, privacy URL, support URL,
   description, keywords.
7. Complete the App Privacy questionnaire from the table above.
8. Upload the screenshots.
9. In Xcode: Product, then Archive, then Distribute App to App Store Connect.
10. Paste the review notes and submit.

Every upload after the first needs `CURRENT_PROJECT_VERSION` bumped. 1.0
build 1 is correct for this one.

---

## Listing copy

Written to Apple's character limits. Paste as is, or change it, but keep
inside the counts or App Store Connect silently truncates.

**App name** (30 max, currently 12)

```
CMPD Fitness
```

**Subtitle** (30 max, currently 27)

```
Your program, your progress
```

**Promotional text** (170 max, currently 139). This is the one field you can
change without shipping a new build, so use it for whatever is current.

```
Every set, every session, tracked against the program your coach built for you. Log it at the rack and watch the numbers move week on week.
```

**Keywords** (100 max, currently 89). Comma separated, no spaces after the
commas, and never repeat a word already in the name or subtitle because Apple
indexes those separately.

```
gym,workout,training,personal trainer,coach,strength,lifting,program,progress,fitness log
```

**Description** (4000 max)

```
CMPD Fitness is where your training actually gets done.

Your coach builds your program. You open the app at the gym, log every set
against it, and you both see exactly what is happening week to week. No
spreadsheets, no screenshots of notes, no guessing what you lifted last time.

WHAT YOU GET

Your program, laid out
See today's session the moment you open the app. Every exercise, every
target, in the order your coach intended.

Logging that keeps up with you
Enter weight and reps between sets. Last session's numbers sit right there,
so you always know what you are chasing. Your previous best is marked, and
the app tells you the moment you beat it.

Progress you can actually see
Charts for every lift you train. Estimated one-rep maxes that update as you
get stronger. A full history for any exercise, going back as far as you have
been training.

Progress photos
Take them in the app and keep them in one place, side by side, so months of
work are easy to see.

Goals that stay in front of you
Set what you are working toward and track how close you are.

Reminders that fit your week
Pick the days and the time you train, and your phone will nudge you. Set on
the device, so they work whether or not you have signal.

BUILT FOR THE GYM FLOOR

Big targets you can hit with chalky hands. Haptic confirmation so you know a
set landed without staring at the screen. And if the gym wifi drops out, the
app tells you straight away rather than quietly losing your work.

FOR CLIENTS OF A CMPD COACH

If you train with a coach on CMPD, your account is set up for you and your
invite arrives by email. Your training data is visible to your coach and to
nobody else.

Questions: contact@cmpdcollective.com
```

**What's New** (4000 max). For 1.0 Apple accepts anything sensible.

```
First release.
```

### Fields that are not copy

- **Category**: Health & Fitness (primary). Leave secondary empty.
- **Age rating**: answer every question No. The app has no objectionable
  content, no web browsing, no user-generated content shared between users.
  That yields 4+.
- **Support URL**: `https://app.cmpdcollective.com/support`
- **Marketing URL**: `https://cmpdcollective.com`
- **Privacy Policy URL**: `https://app.cmpdcollective.com/privacy`
- **Copyright**: `2026 CMPD Collective`

One rule worth not breaking: do not mention pricing, subscriptions, other
platforms, or anything that reads as "also available on the web" in the
description. Apple rejects for it, and the billing flow is already hidden in
the iOS build.

---

## When the .p8 arrives

The API key's Issuer ID and Key ID are already in `.env.local` (gitignored).
The only missing piece is the private key, which App Store Connect lets you
download exactly once at creation. Drop it at the path `ASC_KEY_PATH` names in `.env.local`:

```
~/.appstoreconnect/private_keys/AuthKey_<ASC_KEY_ID>.p8
```

(The real key id is in `.env.local` and in the global CLAUDE.md. It is not
written here, because this repo is public: the id alone cannot authenticate,
but publishing it points an attacker at exactly which key to go after.)

That directory already exists, and it is the path `xcrun altool` and
`notarytool` search by key id, so putting it there makes every Apple tool work
without further flags.

Check it works:

```
node scripts/asc.mjs whoami
```

That mints an ES256 JWT and lists the team's apps. An empty `data` array is the
correct answer right now, because the app record does not exist yet. An
`AUTHENTICATION_FAILED` means the key, the key id and the issuer id do not
belong together.

`scripts/asc.mjs` is a thin generic client, so everything else is one call:

```
node scripts/asc.mjs GET "/v1/bundleIds?filter[identifier]=com.eddytrains.app"
node scripts/asc.mjs POST /v1/bundleIds '{"data":{"type":"bundleIds","attributes":{"identifier":"com.eddytrains.app","name":"CMPD Fitness","platform":"IOS"}}}'
```

If the key is ever lost, it cannot be re-downloaded. Revoke it and make a new
one; nothing in this repo has to change, because the repo is public and holds
no credentials.

### Archive and upload, once the certificate exists

```
xcodebuild -exportArchive \
  -archivePath CMPD.xcarchive \
  -exportOptionsPlist ios/ExportOptions.plist \
  -exportPath build/ \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_KEY_PATH" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID"
```

The three authentication flags are what let Xcode mint the distribution
certificate and provisioning profile through the API rather than through a
signed-in GUI session. `ios/ExportOptions.plist` deliberately sets
`destination: export` so this produces an IPA to inspect rather than shipping
straight to Apple. Upload is a separate, deliberate command.

---

## Traps found and already defused

- **`/support` was behind the auth wall.** The middleware allowlist had
  `/privacy` but not `/support`, so the support URL App Store Connect requires
  redirected to `/login`. Fixed and verified on production, signed out, inside
  the app.
- **`/.well-known/` was behind the auth wall too.**
  `/.well-known/apple-app-site-association` returned `307 -> /login`. Apple
  requires that file to be served with **no redirects**, so universal links
  would have failed silently the moment PR #36 landed. `/.well-known` is now
  public as a class, which is also the right answer for Android app links,
  `security.txt` and ACME challenges.
- **PR #36 (iOS universal links) is stale and conflicting**, last touched July
  2026, and it collides with today's `layout.tsx` and `package.json` changes.
  It is not needed for 1.0: it only makes password-reset emails open the app
  instead of Safari. Leave it for 1.1 and rebase it then.
