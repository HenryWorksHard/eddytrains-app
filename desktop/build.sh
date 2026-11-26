#!/bin/bash
#
# Builds CMPD.app and a drag-to-install DMG.
#
#   ./build.sh                 ad-hoc signed, for you and anyone you hand the DMG to
#   ./build.sh --sign          signed with a Developer ID, for a clean double-click install
#
# --sign needs a "Developer ID Application" certificate in your keychain and is
# the first half of notarising; see README.md. Without it the app still runs,
# it just needs one Gatekeeper approval on each Mac.

set -euo pipefail

cd "$(dirname "$0")"

APP_NAME="CMPD"
BUNDLE_ID="com.cmpdcollective.desktop"
VERSION="1.0.0"
MIN_MACOS="13.0"
ICON_SOURCE="../ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"

BUILD="build"
APP="$BUILD/$APP_NAME.app"
CONTENTS="$APP/Contents"

SIGN_IDENTITY="-"
HARDENED=()
if [[ "${1:-}" == "--sign" ]]; then
  SIGN_IDENTITY="$(security find-identity -v -p codesigning \
    | grep "Developer ID Application" | head -1 | awk '{print $2}' || true)"
  if [[ -z "$SIGN_IDENTITY" ]]; then
    echo "error: no 'Developer ID Application' certificate in your keychain." >&2
    echo "       Create one at developer.apple.com, or run without --sign." >&2
    exit 1
  fi
  HARDENED=(--options runtime)
  echo "==> Signing with Developer ID $SIGN_IDENTITY"
fi

echo "==> Cleaning"
rm -rf "$BUILD"
mkdir -p "$CONTENTS/MacOS" "$CONTENTS/Resources"

echo "==> Building icon"
swiftc -O -framework AppKit -framework ImageIO \
  -o "$BUILD/makeicon" tools/makeicon.swift
"$BUILD/makeicon" "$ICON_SOURCE" "$BUILD/$APP_NAME.iconset"
iconutil -c icns "$BUILD/$APP_NAME.iconset" -o "$CONTENTS/Resources/$APP_NAME.icns"

echo "==> Compiling"
swiftc \
  -O -whole-module-optimization \
  -target "arm64-apple-macosx$MIN_MACOS" \
  -framework AppKit -framework WebKit \
  -o "$CONTENTS/MacOS/$APP_NAME" \
  Sources/*.swift

echo "==> Writing Info.plist"
cat > "$CONTENTS/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>              <string>$APP_NAME</string>
  <key>CFBundleDisplayName</key>       <string>$APP_NAME</string>
  <key>CFBundleExecutable</key>        <string>$APP_NAME</string>
  <key>CFBundleIdentifier</key>        <string>$BUNDLE_ID</string>
  <key>CFBundleIconFile</key>          <string>$APP_NAME</string>
  <key>CFBundlePackageType</key>       <string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleVersion</key>           <string>$VERSION</string>
  <key>LSMinimumSystemVersion</key>    <string>$MIN_MACOS</string>
  <key>LSApplicationCategoryType</key> <string>public.app-category.healthcare-fitness</string>
  <key>NSHighResolutionCapable</key>   <true/>
  <key>NSSupportsAutomaticTermination</key>   <false/>
  <key>NSSupportsSuddenTermination</key>      <false/>
</dict>
</plist>
PLIST

echo "==> Signing"
codesign --force --deep "${HARDENED[@]+"${HARDENED[@]}"}" \
  --sign "$SIGN_IDENTITY" --timestamp=none "$APP"
codesign --verify --verbose=1 "$APP" 2>&1 | sed 's/^/    /'

echo "==> Packaging DMG"
STAGE="$BUILD/dmg"
mkdir -p "$STAGE"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
hdiutil create \
  -volname "$APP_NAME" \
  -srcfolder "$STAGE" \
  -ov -format UDZO \
  -quiet \
  "$BUILD/$APP_NAME-$VERSION.dmg"
rm -rf "$STAGE"

SIZE=$(du -sh "$APP" | cut -f1)
DMG_SIZE=$(du -sh "$BUILD/$APP_NAME-$VERSION.dmg" | cut -f1)
echo
echo "    app  $APP  ($SIZE)"
echo "    dmg  $BUILD/$APP_NAME-$VERSION.dmg  ($DMG_SIZE)"
echo
echo "Done. Open the app with:  open '$APP'"
