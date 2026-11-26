// The one place that knows whether we are inside the native shell.
//
// WHY THIS FILE EXISTS. The iOS app is a Capacitor shell pointed at
// app.cmpdcollective.com, so the same React code runs in Safari and inside
// the app. Every native capability therefore has to be optional: the plugin
// has to be absent-safe on the web, and the web fallback has to stay the
// path that actually runs for most users.
//
// Two rules hold this together:
//
//   1. Plugins are imported DYNAMICALLY, never at module scope. A static
//      `import { Camera } from '@capacitor/camera'` pulls the plugin's web
//      shim into the browser bundle for every visitor who will never use it,
//      and some shims touch `navigator` on load. Dynamic import keeps them
//      out of the first paint and out of SSR.
//
//   2. Every helper returns a value the caller can act on without knowing
//      the platform. `pickImage()` returns a Blob whether it came from the
//      native camera or an `<input type="file">`, so call sites keep one
//      code path instead of branching on platform themselves.
//
// Anything that needs Apple-side configuration (push certificates, APNs
// keys) is deliberately NOT here. Local notifications need no server and no
// certificate, so reminders work the day the app is installed.

/** True only inside the Capacitor shell, never in a browser. */
export function isNative(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as Window & {
    Capacitor?: { isNativePlatform?: () => boolean };
  }).Capacitor;
  if (!cap) return false;
  return cap.isNativePlatform?.() ?? true;
}

/** 'ios' | 'android' | 'web'. Useful where the two native platforms differ. */
export function nativePlatform(): 'ios' | 'android' | 'web' {
  if (typeof window === 'undefined') return 'web';
  const cap = (window as Window & {
    Capacitor?: { getPlatform?: () => string };
  }).Capacitor;
  const p = cap?.getPlatform?.();
  return p === 'ios' || p === 'android' ? p : 'web';
}

/**
 * Swallows a plugin failure so a missing or broken plugin can never take a
 * page down. Native extras are garnish: if haptics fail the set still logs.
 */
async function quietly(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    // Debug, not error: on the web every one of these is expected to fail.
    if (isNative()) console.debug(`[native] ${label} failed`, e);
  }
}

// ---------------------------------------------------------------------------
// Haptics
// ---------------------------------------------------------------------------

export type HapticWeight = 'light' | 'medium' | 'heavy';

/** A tap, for confirming a set was logged or a target was hit. */
export function hapticImpact(weight: HapticWeight = 'light'): void {
  if (!isNative()) return;
  void quietly('haptic impact', async () => {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    const style =
      weight === 'heavy' ? ImpactStyle.Heavy
      : weight === 'medium' ? ImpactStyle.Medium
      : ImpactStyle.Light;
    await Haptics.impact({ style });
  });
}

/** The three-state buzz iOS uses for success / warning / error. */
export function hapticNotify(kind: 'success' | 'warning' | 'error'): void {
  if (!isNative()) return;
  void quietly('haptic notification', async () => {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    const type =
      kind === 'success' ? NotificationType.Success
      : kind === 'warning' ? NotificationType.Warning
      : NotificationType.Error;
    await Haptics.notification({ type });
  });
}

// ---------------------------------------------------------------------------
// Camera and photo library
// ---------------------------------------------------------------------------

export type ImageSourceChoice = 'camera' | 'photos' | 'ask';

/**
 * Converts the plugin's base64 payload into a Blob.
 *
 * Why base64 and not `webPath`: a `capacitor://` webPath has to be fetched
 * back through the local bridge, which is the exact path the 8.x advisory
 * was about, and it fails outright when the page is served from a remote
 * `server.url` like ours. base64 crosses the bridge as plain JSON and needs
 * no second request.
 */
function base64ToBlob(base64: string, mime: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Picks one image and hands back a Blob, or null if the user backed out.
 *
 * Native: the real iOS camera / photo sheet, with the permission prompts the
 * Info.plist strings describe. Web: a hidden `<input type="file">`, created
 * and discarded per call so no markup has to change at the call site.
 */
export async function pickImage(
  source: ImageSourceChoice = 'ask',
): Promise<Blob | null> {
  if (isNative()) {
    try {
      const { Camera, CameraResultType, CameraSource } = await import(
        '@capacitor/camera'
      );
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source:
          source === 'camera' ? CameraSource.Camera
          : source === 'photos' ? CameraSource.Photos
          : CameraSource.Prompt,
        promptLabelHeader: 'Add a photo',
        promptLabelPhoto: 'Choose from library',
        promptLabelPicture: 'Take a photo',
        promptLabelCancel: 'Cancel',
        // Downscale on the device. The canvas pass in compressImage still
        // runs afterwards, but handing it a 12MP original is what makes the
        // picker feel slow on an older phone.
        width: 2000,
        correctOrientation: true,
      });
      if (!photo.base64String) return null;
      return base64ToBlob(photo.base64String, `image/${photo.format || 'jpeg'}`);
    } catch (e) {
      // The plugin throws on cancel as well as on denial, and the two are
      // indistinguishable. Treat both as "no photo" rather than an error.
      console.debug('[native] camera returned no photo', e);
      return null;
    }
  }

  return pickImageViaInput();
}

/** The web path: a throwaway file input. */
function pickImageViaInput(): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(null);

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);

    let settled = false;
    const finish = (value: Blob | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(value);
    };

    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    // A cancelled picker fires no `change` in most browsers. `cancel` covers
    // the ones that support it; the focus fallback covers the rest, so the
    // promise cannot hang forever and leave a button spinning.
    input.addEventListener('cancel', () => finish(null));
    window.addEventListener(
      'focus',
      () => setTimeout(() => finish(input.files?.[0] ?? null), 400),
      { once: true },
    );

    input.click();
  });
}

// ---------------------------------------------------------------------------
// Sharing
// ---------------------------------------------------------------------------

/**
 * Opens the native share sheet, falling back to the Web Share API and then
 * to the clipboard. Returns true if something actually handled it.
 */
export async function shareLink(opts: {
  title: string;
  text?: string;
  url: string;
}): Promise<boolean> {
  if (isNative()) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({
        title: opts.title,
        text: opts.text,
        url: opts.url,
        dialogTitle: opts.title,
      });
      return true;
    } catch {
      return false; // cancelled
    }
  }

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: opts.title, text: opts.text, url: opts.url });
      return true;
    } catch {
      return false;
    }
  }

  try {
    await navigator.clipboard.writeText(opts.url);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Status bar and splash
// ---------------------------------------------------------------------------

/**
 * Matches the status bar to the app's black chrome and dismisses the splash.
 *
 * Both plugins were already configured in capacitor.config.ts but neither was
 * installed, so that config did nothing: `cap sync` reported one plugin, and
 * the splash sat for its full 2s launchShowDuration whether the web view was
 * ready or not. Hiding it on first paint is what removes the dead gap.
 */
export async function primeNativeChrome(): Promise<void> {
  if (!isNative()) return;

  await quietly('status bar', async () => {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    if (nativePlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#000000' });
    }
  });

  await quietly('splash hide', async () => {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  });
}
