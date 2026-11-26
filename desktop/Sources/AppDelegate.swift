import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    /// Open windows, held strongly: an NSWindowController is not retained by
    /// its window, so without this a second window would deallocate at once.
    private var controllers: [BrowserWindowController] = []

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.mainMenu = buildMainMenu()
        newWindow()
        NSApp.activate(ignoringOtherApps: true)
    }

    @discardableResult
    func newWindow() -> BrowserWindowController {
        let controller = BrowserWindowController(url: Config.home)
        controller.onClose = { [weak self] closed in
            self?.controllers.removeAll { $0 === closed }
        }
        controllers.append(controller)
        controller.showWindow(nil)
        return controller
    }

    /// Single-purpose app: closing the last window means you are done with it.
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    /// Clicking the Dock icon with no window open reopens one rather than
    /// doing nothing.
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag { newWindow() }
        return true
    }

    // Cmd+N. Reached through the responder chain, which ends at the app delegate.
    @objc func newDocument(_ sender: Any?) {
        newWindow()
    }
}
