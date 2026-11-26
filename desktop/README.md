# CMPD for Mac

A native Mac app for app.cmpdcollective.com. One window, the real site inside it,
and the desktop behaviour a browser tab cannot give you: its own Dock icon, its
own window, a saved sign-in, and Cmd+P / Cmd+R / file pickers that work.

Around 350 KB. Launches instantly. No Electron, no node_modules, no bundled
Chromium: it is Swift and WKWebView, which is the same engine Safari uses and is
already on every Mac.

## Build

```
./build.sh
```

Produces `build/CMPD.app` and `build/CMPD-1.0.0.dmg`. Needs nothing but the
Xcode Command Line Tools, which are already installed if `swiftc` runs.

```
./build.sh --sign
```

Same, but signed with a Developer ID certificate. See "Signing" below.

## Install

**On your own Mac**, copy `build/CMPD.app` straight into `/Applications`. A file
built locally carries no quarantine flag, so it just opens.

**On anyone else's Mac**, send them `CMPD-1.0.0.dmg`. They open it, drag CMPD to
Applications, and then need one Gatekeeper approval, because the app is not
notarised:

1. Open CMPD from Applications. macOS refuses and offers to move it to the Bin.
   Click **Done**, not "Move to Bin".
2. Open **System Settings > Privacy & Security**, scroll to the bottom, and
   click **Open Anyway** next to the note about CMPD.
3. Open CMPD again and click **Open**.

Once per Mac. After that it opens like anything else.

The Terminal equivalent, if they would rather:

```
xattr -dr com.apple.quarantine /Applications/CMPD.app && open /Applications/CMPD.app
```

## Signing

The build is ad-hoc signed by default, which is why the step above exists.
Removing it entirely needs two things from the paid Apple Developer account:

1. A **Developer ID Application** certificate, created at
   developer.apple.com > Certificates, downloaded and double-clicked into the
   keychain. Then `./build.sh --sign`.
2. **Notarisation** — Apple scans the signed app and issues a ticket:

   ```
   xcrun notarytool submit build/CMPD-1.0.0.dmg \
     --apple-id <your-apple-id> --team-id <your-team-id> \
     --password <an-app-specific-password> --wait
   xcrun stapler staple build/CMPD-1.0.0.dmg
   ```

   The app-specific password comes from appleid.apple.com, not your Apple ID
   password.

After that the DMG installs on any Mac with no warning at all. Worth doing once
if this ever goes to more people than the two of you; not worth it for two.

Note that an "Apple Development" certificate is **not** enough. It signs for
machines in your own provisioning profile, so it would still be blocked on
anyone else's Mac, while being an extra thing that expires. Ad-hoc is the more
honest default until there is a Developer ID.

## Keyboard

| | |
|---|---|
| Cmd+R / Cmd+Shift+R | Reload / reload ignoring cache |
| Cmd+[ / Cmd+] | Back / forward (two-finger swipe also works) |
| Cmd+Shift+H | Back to the dashboard |
| Cmd+N | A second window, for working across two clients at once |
| Cmd+P | Print the current page |
| Cmd+Shift+B | Open the current page in the real browser |
| Cmd + / Cmd - / Cmd 0 | Zoom, remembered between launches |
| Cmd+Ctrl+F | Full screen |

## What it handles, and why each one is deliberate

Wrapping a web app in a WKWebView is five lines. Most of this code is the part
after that, where a naive wrapper silently breaks things:

- **Downloads.** The client progress PDF export goes through jsPDF's
  `doc.save()`, which makes a blob URL and clicks a download anchor. WebKit
  drops that on the floor unless a `WKDownloadDelegate` is attached, so the
  export button would look dead. Saves to Downloads, uniquifies the name rather
  than overwriting the last export, and reveals the file in Finder.
- **File pickers.** Setting any `uiDelegate` replaces WebKit's built-in open
  panel. Not reimplementing it would break progress pictures, the profile photo
  and the organisation logo upload all at once.
- **Staying signed in.** The on-disk `websiteDataStore` keeps the Supabase
  session cookie across launches. With the default in-memory store you would
  sign in every morning, which matters more than usual here: the median gap
  between client sign-ins is about 100 days.
- **Off-domain navigation stays in the window.** Sign-in and Stripe checkout both
  redirect away and back, so sending every external URL to the browser would
  break both. Only `target="_blank"` popups and non-web schemes (`mailto:`,
  `tel:`) are handed to the system.
- **JavaScript dialogs.** With a `uiDelegate` set and no alert handlers,
  `confirm()` silently returns false, which makes every confirm-before-delete
  button appear broken while actually doing nothing.
- **The Edit menu.** A web view gets Cut/Copy/Paste/Select All through the
  standard menu selectors. An AppKit app built without a menu bar is one where
  Cmd+C does nothing at all.
- **Offline.** A failed load shows a readable dark page with a Try again button
  instead of a blank white window.
- **No white flash.** The window, the content view and the web view's
  over-scroll area are all `#000`, matching `--background` in globals.css.

It is also not detected as a native app: `useIsNativeApp` looks for
`window.Capacitor`, which this does not inject. That is correct here. The App
Store payment rules that hide billing in the iOS build do not apply to a Mac app
distributed outside the App Store, so billing stays visible and usable.

## Layout

```
Sources/
  main.swift                   NSApplication, no nib
  AppDelegate.swift            lifecycle, window list
  MainMenu.swift               the menu bar
  BrowserWindowController.swift  window, web view, all four delegates
  LoadBar.swift                3px progress bar
  Config.swift                 URL, bundle id, colours, sizes
tools/makeicon.swift           iOS icon -> macOS rounded-rect .iconset
build.sh                       compile, bundle, sign, package
```

Pointing the app at a different deployment is `home` and `primaryHost` in
`Config.swift`.
