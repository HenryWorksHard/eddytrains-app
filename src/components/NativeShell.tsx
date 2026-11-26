'use client';

// Everything the native shell has to do once, on launch, plus the offline
// banner. Mounted from the root layout so it covers every route.
//
// WHY THIS IS NOT A HOOK IN EACH PAGE. The splash screen has to be dismissed
// exactly once, and reminders have to be rehydrated exactly once. A hook
// called per page would fire again on every client navigation. One component
// at the root with an empty dependency array is the only place that runs once
// per app launch.
//
// On the web this renders nothing and costs one effect that returns
// immediately, because every branch is behind `isNative()`.

import { useEffect, useState } from 'react';
import { isNative, primeNativeChrome } from '@/lib/native';
import { rehydrateReminders } from '@/lib/native/reminders';

export default function NativeShell() {
  const [offline, setOffline] = useState(false);

  // Launch tasks. Empty deps on purpose: once per mount of the root layout.
  useEffect(() => {
    if (!isNative()) return;
    void primeNativeChrome();
    void rehydrateReminders();
  }, []);

  // Connectivity. The native Network plugin is more truthful than
  // `navigator.onLine`, which on iOS reports true for a wifi network that has
  // no route to the internet. That is the gym-wifi case exactly: the phone is
  // associated, the captive portal has not been accepted, and the web view
  // silently fails to save a set.
  //
  // The banner warns rather than reassures, deliberately. Set logging has NO
  // offline queue: `saveProgress` in WorkoutClient posts straight to Supabase
  // and a failure while offline is lost. Until there is a real outbox, the
  // honest thing is to tell the user their reps are not being recorded, not
  // to promise a sync that does not exist.
  useEffect(() => {
    let detach: (() => void) | undefined;
    let cancelled = false;

    if (isNative()) {
      void (async () => {
        try {
          const { Network } = await import('@capacitor/network');
          const status = await Network.getStatus();
          if (cancelled) return;
          setOffline(!status.connected);
          const handle = await Network.addListener('networkStatusChange', (s) => {
            setOffline(!s.connected);
          });
          detach = () => void handle.remove();
        } catch {
          // Plugin missing: fall through to the browser events below.
        }
      })();
    }

    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setOffline(true);
    }

    return () => {
      cancelled = true;
      detach?.();
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  // Resume. Coming back after the phone has been locked through a rest period
  // can leave the page showing data from before. A reload on resume is the
  // blunt fix, but it would throw away an in-progress set, so it only runs
  // when the page has been hidden long enough for staleness to be the bigger
  // risk and the user is not mid-workout.
  useEffect(() => {
    if (!isNative()) return;
    let detach: (() => void) | undefined;
    let hiddenAt = 0;

    void (async () => {
      try {
        const { App } = await import('@capacitor/app');
        const handle = await App.addListener('appStateChange', ({ isActive }) => {
          if (!isActive) {
            hiddenAt = Date.now();
            return;
          }
          const away = Date.now() - hiddenAt;
          const onWorkout = window.location.pathname.startsWith('/workout');
          if (hiddenAt && away > 30 * 60 * 1000 && !onWorkout) {
            window.location.reload();
          }
        });
        detach = () => void handle.remove();
      } catch {
        // No plugin, no resume handling. Nothing breaks.
      }
    })();

    return () => detach?.();
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[60] bg-yellow-400 px-4 py-2 text-center text-sm font-semibold text-black"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
    >
      No connection. Sets will not save until you are back online.
    </div>
  );
}
