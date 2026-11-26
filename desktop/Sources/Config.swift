import AppKit

/// Everything that is specific to this app, in one place. Pointing the desktop
/// app at a different deployment is a change to `home` and `primaryHost` only.
enum Config {
    static let appName = "CMPD"
    static let bundleID = "com.cmpdcollective.desktop"
    static let version = "1.0.0"

    /// `/dashboard` role-routes on the server: trainers land on the admin
    /// dashboard, clients on theirs, and anyone signed out is redirected to
    /// `/login`. So one entry point is correct for both Louis and Eddy.
    static let home = URL(string: "https://app.cmpdcollective.com/dashboard")!
    static let primaryHost = "app.cmpdcollective.com"

    /// The in-page error view's Retry button navigates here. Intercepted in the
    /// navigation policy, never actually loaded.
    static let retryScheme = "cmpd-retry"

    /// Matches `--background` in the app's globals.css, whose default theme is
    /// dark. Used for the window and the web view's over-scroll area so launch
    /// and rubber-banding never flash white.
    static let pageBackground = NSColor(srgbRed: 0, green: 0, blue: 0, alpha: 1)

    /// #FACC15, the brand yellow. Drives the load bar.
    static let brandYellow = NSColor(srgbRed: 0.980, green: 0.800, blue: 0.082, alpha: 1)

    static let defaultWindowSize = CGSize(width: 1280, height: 860)
    static let minimumWindowSize = CGSize(width: 820, height: 560)
}
