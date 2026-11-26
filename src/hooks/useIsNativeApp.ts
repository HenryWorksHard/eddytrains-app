'use client';

// Native detection for UI that must differ inside the app store build,
// chiefly the payment and upgrade UI that App Store rules forbid us from
// showing (Guideline 3.1.1).
//
// The detection itself lives in `@/lib/native` and is not duplicated here.
// Two copies of "are we native" that drift apart is the kind of bug that
// ships a Stripe button to an App Store reviewer, so there is one function
// and this file only adapts it to React's rendering rules.

import { useState, useEffect } from 'react';
import { isNative } from '@/lib/native';

/**
 * Hook form. Returns false on the first render even inside the app, then
 * flips true after mount.
 *
 * WHY THE FALSE FIRST RENDER IS DELIBERATE. These pages are server rendered,
 * and the server cannot know the platform. Reading it during render would
 * produce server HTML that disagrees with the client and React would discard
 * the tree. The safe direction to be wrong in is false: a native user may see
 * a payment control for one frame at worst, whereas defaulting to true would
 * hide billing from every web visitor until hydration.
 */
export function useIsNativeApp(): boolean {
  const [native, setNative] = useState(false);

  useEffect(() => {
    setNative(isNative());
  }, []);

  return native;
}

/**
 * Sync form, for event handlers and other code that runs after mount.
 * Always false during server rendering; do not branch rendered output on it.
 */
export function isNativeApp(): boolean {
  return isNative();
}
