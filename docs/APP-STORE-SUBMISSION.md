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

1. **Deploy the web app first.** The binary loads
   `app.cmpdcollective.com`, so until this branch is merged and deployed, the
   camera, reminder and haptic code does not exist for the app and a reviewer
   would be looking at the old site.
2. Register the bundle ID at developer.apple.com under Identifiers.
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
