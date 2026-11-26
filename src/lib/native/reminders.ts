// Workout reminders, scheduled on the device.
//
// WHY LOCAL AND NOT PUSH. Push notifications need an APNs key, a Firebase
// project and a server that decides who to wake and when. Local
// notifications need none of that: iOS holds the schedule itself and fires
// even with no network and the app closed. So reminders work the day the app
// is installed, and nothing here blocks on Apple-side configuration.
//
// The trade-off is honest and worth stating: the schedule lives on the one
// device that set it. Reinstall the app or switch phones and it has to be set
// again. That is also why the preference is in localStorage rather than in
// `profiles`: a row in Postgres would imply the reminder follows the account
// across devices, and it does not. Push, when it lands, is what makes that
// true (see docs/push-notifications-v1.1.md).
//
// iOS caps a single app at 64 pending local notifications. One weekly
// repeating notification per selected weekday is 7 at the very most, so the
// cap is never in play.

import { isNative } from './index';

/** 0 = Sunday, matching `Date.prototype.getDay`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat',
};

export type ReminderPrefs = {
  enabled: boolean;
  /** Days to fire on. Empty means nothing is scheduled. */
  days: Weekday[];
  /** 24-hour local time, "HH:MM". */
  time: string;
};

export const DEFAULT_REMINDERS: ReminderPrefs = {
  enabled: false,
  days: [1, 3, 5],
  time: '17:30',
};

const STORAGE_KEY = 'cmpd-workout-reminders';

// A fixed id block, so rescheduling replaces our own notifications instead of
// stacking duplicates. id = BASE + weekday keeps it stable across launches.
const ID_BASE = 4200;

export function loadReminderPrefs(): ReminderPrefs {
  if (typeof window === 'undefined') return DEFAULT_REMINDERS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_REMINDERS;
    const parsed = JSON.parse(raw) as Partial<ReminderPrefs>;
    // Validate rather than trust: a stale or hand-edited value should not be
    // able to put the settings UI into a state it cannot render.
    const days = Array.isArray(parsed.days)
      ? ([...new Set(parsed.days)].filter(
          (d): d is Weekday => Number.isInteger(d) && d >= 0 && d <= 6,
        ))
      : DEFAULT_REMINDERS.days;
    const time = typeof parsed.time === 'string' && /^\d{2}:\d{2}$/.test(parsed.time)
      ? parsed.time
      : DEFAULT_REMINDERS.time;
    return { enabled: parsed.enabled === true, days, time };
  } catch {
    return DEFAULT_REMINDERS;
  }
}

export function saveReminderPrefs(prefs: ReminderPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Private mode or blocked storage. The schedule below still applies for
    // this launch; it just will not be remembered.
  }
}

/** 'granted' | 'denied' | 'unsupported'. Asks the OS only when undecided. */
export async function requestReminderPermission(): Promise<
  'granted' | 'denied' | 'unsupported'
> {
  if (!isNative()) return 'unsupported';
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const current = await LocalNotifications.checkPermissions();
    if (current.display === 'granted') return 'granted';
    if (current.display === 'denied') return 'denied';
    const asked = await LocalNotifications.requestPermissions();
    return asked.display === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

/** What the notification says. Varied so it does not read like a cron job. */
const BODIES = [
  'Your session is waiting. Open CMPD and get after it.',
  'Training day. Let us get the work in.',
  'Time to train. Your program is ready.',
];

/**
 * Clears our existing reminders and schedules the current preference.
 *
 * Always cancels first. Capacitor's `schedule` with a reused id replaces on
 * iOS but appends on some Android versions, and cancelling our own fixed id
 * block is cheap insurance against a user ending up with two buzzes.
 */
export async function applyReminders(prefs: ReminderPrefs): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');

    const ids = ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((d) => ({
      id: ID_BASE + d,
    }));
    await LocalNotifications.cancel({ notifications: ids });

    if (!prefs.enabled || prefs.days.length === 0) return true;

    const [hourStr, minuteStr] = prefs.time.split(':');
    const hour = Number(hourStr);
    const minute = Number(minuteStr);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return false;

    await LocalNotifications.schedule({
      notifications: prefs.days.map((day, i) => ({
        id: ID_BASE + day,
        title: 'CMPD',
        body: BODIES[i % BODIES.length],
        // `on` with a weekday repeats weekly at that local time, and iOS
        // re-evaluates it against the device clock, so it survives a
        // timezone change without us rescheduling.
        schedule: {
          on: { weekday: day + 1, hour, minute }, // plugin weekday is 1-based
          allowWhileIdle: true,
        },
      })),
    });
    return true;
  } catch (e) {
    console.debug('[native] could not schedule reminders', e);
    return false;
  }
}

/** Cancels everything we scheduled. Used when the toggle goes off. */
export async function clearReminders(): Promise<void> {
  await applyReminders({ ...loadReminderPrefs(), enabled: false });
}

/**
 * Re-applies the saved schedule on launch.
 *
 * iOS keeps pending notifications across launches, so this is normally a
 * no-op. It matters after an app update or a permission change, where the
 * pending queue can be dropped while our localStorage preference survives
 * and would otherwise silently stop firing.
 */
export async function rehydrateReminders(): Promise<void> {
  if (!isNative()) return;
  const prefs = loadReminderPrefs();
  if (!prefs.enabled) return;
  const permission = await requestReminderPermission();
  if (permission !== 'granted') return;
  await applyReminders(prefs);
}
