# Push Notifications — v1.1 Spec

Status: **deferred from v1.0**. App Store submission for v1.0 ships without push. This doc is the blueprint for adding push in the first post-launch update.

## Current environment (as of v1.0)

- Capacitor: `^8.1.0` (core, cli, ios, android)
- iOS deployment target: `15.0`
- App ID: `com.eddytrains.app`
- App name: `EddyTrains`
- Live URL served by Capacitor (webDir `out` is placeholder; `server.url` loads `https://app.cmpdcollective.com`)
- No push SDK installed, no service worker, no `push_subscriptions` table, no APNs/FCM config
- `admin_notifications` table = in-app trainer alerts (bell icon), **not** push — do not conflate

## v1.0 submission rules (do NOT change before shipping)

- Push Notifications capability in Xcode → **off**
- `aps-environment` entitlement → **not present**
- App Store Connect "uses push?" → **No**
- No APNs key, no Firebase project needed yet

Adding push post-launch is a capability toggle + new build, not a re-review blocker.

## Notification list

### Client-facing
| # | Trigger | Timing | Tap action |
|---|---------|--------|-----------|
| 1 | New message from your trainer | Instant on message insert | Open `/messages` thread |
| 2 | Trainer assigned you a new program | Instant on `client_programs` insert | Open `/programs/[id]` |
| 3 | Tomorrow's workout reminder | 7pm local night before scheduled workout | Open `/schedule` |
| 4 | Streak-save warning | 6pm local if no workout today and streak ≥ 3 | Open `/workout/today` |
| 5 | Workout missed | 9pm local on a scheduled-but-not-completed day | Open dashboard |
| 6 | PR celebration | 1 hr after workout complete if a PR was hit | Open `/progress` |
| 7 | Weekly recap ready | Sunday 7pm local | Open `/week` (when built) |
| 8 | Pascal misses you | 5+ days no log-in | Open dashboard |
| 9 | Goal milestone hit | Instant on goal progress ≥ 100% | Open `/goals` |

### Trainer-facing
| # | Trigger | Timing | Tap action |
|---|---------|--------|-----------|
| 10 | Client completed a workout | Instant on workout_log insert with completed_at | Open `/users/[id]` |
| 11 | Client sent a message | Instant | Open `/users/[id]` messages tab |
| 12 | Client hit a PR | Instant | Open `/users/[id]` progress tab |
| 13 | Client missed 3+ scheduled workouts | Daily 8am local check | Open `/users/[id]` |
| 14 | New client joined your org | Instant on signup via invite | Open `/users/[id]` |

## Infra checklist

### Louis's config work (~30 min)
- [ ] Apple Developer → Keys → create APNs Authentication Key (`.p8`), record Key ID + Team ID
- [ ] Firebase project → add Android app (`com.eddytrains.app`) → download `google-services.json`
- [ ] In Xcode → Signing & Capabilities → **enable Push Notifications**
- [ ] In Xcode → enable **Background Modes → Remote notifications**
- [ ] Confirm `aps-environment` appears in the generated entitlements file

### Build work (~6 hrs)
- [ ] `npm install @capacitor/push-notifications`
- [ ] `npx cap sync ios && npx cap sync android`
- [ ] Add `google-services.json` to `android/app/`
- [ ] Supabase migration: `push_subscriptions(id, user_id, platform, token, created_at, last_seen_at, revoked_at)` with RLS (user can insert/update/delete own rows; service role can read all)
- [ ] `/api/notifications/register` — receives `{ platform, token }`, upserts by token
- [ ] `/api/notifications/send` — unified sender that dispatches APNs + FCM + Web Push based on platform
- [ ] `public/sw.js` service worker for PWA Web Push (non-native users)
- [ ] Client: permission-prompt flow on first app launch (day 2, not day 0 — less friction)
- [ ] Supabase triggers / Edge Functions for each instant-fire item (1, 2, 6, 9, 10, 11, 12, 14)
- [ ] Scheduled Edge Function (pg_cron) for time-based items (3, 4, 5, 7, 8, 13)
- [ ] `/profile/notifications` preferences page — per-category on/off toggles
- [ ] iOS: notification category actions ("Log workout", "Reply") — optional polish
- [ ] Deep-link handling: map notification payload `route` field → `router.push()`

### Testing
- [ ] APNs sandbox token test via CLI (`apn-push` or similar)
- [ ] FCM test send from Firebase console
- [ ] Web Push test in Chrome DevTools
- [ ] End-to-end: trigger each notification type in staging

## Design notes

- **Ask permission late.** First launch is too soon — users don't know the value yet. Prompt after their 1st workout completion, or on day 2.
- **Every push needs an opt-out.** iOS reviewers flag apps where notification preferences aren't controllable in-app.
- **Respect Do Not Disturb windows.** No pushes between 10pm and 7am user-local time unless user explicitly opts in to late reminders.
- **Dedupe by (user_id, category, date).** Don't send the same streak-save warning twice in one evening if the user opens the app between checks.
- **Pascal voice for client pushes.** Title lines can be pascal-flavored ("Pascal's wondering where you've been 👋" — no emoji in app code per project rules, but notification body text is user-facing content, not code; use sparingly if desired).

## Timeline estimate

- Your config work: 30 min
- Build + all 14 triggers + prefs UI: 6 hrs
- QA on real devices: 1 hr
- **Total: ~1 focused day**

## Open questions

- Do trainers want pushes on desktop too? (Web Push handles this — no extra work.)
- Should client's pushes be silenced when their trainer is impersonating them? (Probably yes — check impersonation cookie in sender.)
- Marketing/re-engagement pushes (new features, challenges) — separate category, default OFF.
