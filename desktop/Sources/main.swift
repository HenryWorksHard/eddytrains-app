import AppKit

// No storyboard and no nib: the app is assembled in code so the whole thing
// builds with swiftc and needs no Xcode project. `delegate` is held by a
// top-level binding so it outlives launch.
let delegate = AppDelegate()
let app = NSApplication.shared
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
