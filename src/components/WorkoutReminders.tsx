'use client';

// Workout reminder settings. Renders nothing outside the native app.
//
// WHY IT HIDES ON THE WEB. The schedule is held by iOS, not by us, so on a
// browser there is nothing to schedule and a toggle here would be a control
// that silently does nothing. Web push is a different mechanism with a
// different permission model; when that lands it gets its own UI rather than
// pretending to be this one.

import { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { isNative, hapticImpact } from '@/lib/native';
import {
  DEFAULT_REMINDERS,
  WEEKDAY_LABELS,
  applyReminders,
  loadReminderPrefs,
  requestReminderPermission,
  saveReminderPrefs,
  type ReminderPrefs,
  type Weekday,
} from '@/lib/native/reminders';

// Monday first: a training week starts Monday, not Sunday.
const DAY_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export default function WorkoutReminders() {
  const [mounted, setMounted] = useState(false);
  const [native, setNative] = useState(false);
  const [prefs, setPrefs] = useState<ReminderPrefs>(DEFAULT_REMINDERS);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

  // Read the saved preference after mount, never during render: localStorage
  // does not exist on the server and reading it in render would mismatch
  // hydration.
  useEffect(() => {
    setMounted(true);
    setNative(isNative());
    setPrefs(loadReminderPrefs());
  }, []);

  const persist = async (next: ReminderPrefs) => {
    setPrefs(next);
    saveReminderPrefs(next);
    setBusy(true);
    try {
      await applyReminders(next);
    } finally {
      setBusy(false);
    }
  };

  const toggleEnabled = async () => {
    hapticImpact('light');
    if (!prefs.enabled) {
      const permission = await requestReminderPermission();
      if (permission !== 'granted') {
        setDenied(permission === 'denied');
        return;
      }
      setDenied(false);
    }
    await persist({ ...prefs, enabled: !prefs.enabled });
  };

  const toggleDay = async (day: Weekday) => {
    hapticImpact('light');
    const days = prefs.days.includes(day)
      ? prefs.days.filter((d) => d !== day)
      : [...prefs.days, day].sort((a, b) => a - b);
    await persist({ ...prefs, days });
  };

  const setTime = async (time: string) => {
    await persist({ ...prefs, time });
  };

  // Render nothing until we know the platform, so the web never flashes a
  // control it is about to remove.
  if (!mounted || !native) return null;

  return (
    <div className="border-b border-zinc-800 last:border-b-0">
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          {prefs.enabled ? (
            <Bell className="w-5 h-5 text-yellow-400" />
          ) : (
            <BellOff className="w-5 h-5 text-zinc-400" />
          )}
          <span className="text-white">Workout reminders</span>
          {busy && <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />}
        </div>
        <button
          onClick={toggleEnabled}
          aria-label="Toggle workout reminders"
          aria-pressed={prefs.enabled}
          className={`relative w-12 h-7 rounded-full transition-colors ${
            prefs.enabled ? 'bg-yellow-400' : 'bg-zinc-700'
          }`}
        >
          <div
            className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              prefs.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {denied && (
        <p className="px-4 pb-4 text-sm text-zinc-400">
          Notifications are turned off for CMPD. Turn them on in Settings,
          Notifications, CMPD, then come back here.
        </p>
      )}

      {prefs.enabled && (
        <div className="px-4 pb-4 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">
              Days
            </p>
            <div className="flex gap-1.5">
              {DAY_ORDER.map((day) => {
                const on = prefs.days.includes(day);
                return (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    aria-pressed={on}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                      on
                        ? 'bg-yellow-400 text-black'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {WEEKDAY_LABELS[day]}
                  </button>
                );
              })}
            </div>
            {prefs.days.length === 0 && (
              <p className="mt-2 text-sm text-zinc-500">
                Pick at least one day.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              Time
            </p>
            <input
              type="time"
              value={prefs.time}
              onChange={(e) => void setTime(e.target.value)}
              aria-label="Reminder time"
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white [color-scheme:dark]"
            />
          </div>

          <p className="text-xs text-zinc-500">
            Reminders are set on this phone, so they keep working with no
            signal. They do not follow you to another device.
          </p>
        </div>
      )}
    </div>
  );
}
