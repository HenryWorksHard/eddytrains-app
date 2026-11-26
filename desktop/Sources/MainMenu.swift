import AppKit

/// The menu bar.
///
/// This is not decoration. A web view gets Cut/Copy/Paste/Select All through
/// the standard `cut:` / `copy:` / `paste:` / `selectAll:` menu selectors, so
/// an app with no Edit menu is an app where Cmd+C does nothing. Same for Cmd+Q
/// and `terminate:`.
///
/// Items that act on the current page leave `target` nil on purpose, so the
/// action travels the responder chain and lands on whichever window is active.
extension AppDelegate {

    func buildMainMenu() -> NSMenu {
        let main = NSMenu()
        main.addItem(appMenu())
        main.addItem(fileMenu())
        main.addItem(editMenu())
        main.addItem(viewMenu())
        main.addItem(historyMenu())
        main.addItem(windowMenu())
        return main
    }

    // MARK: - Builders

    private func submenu(_ title: String, _ build: (NSMenu) -> Void) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: nil, keyEquivalent: "")
        let menu = NSMenu(title: title)
        build(menu)
        item.submenu = menu
        return item
    }

    private func entry(
        _ title: String,
        _ action: Selector?,
        key: String = "",
        modifiers: NSEvent.ModifierFlags = .command,
        target: AnyObject? = nil
    ) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
        if !key.isEmpty { item.keyEquivalentModifierMask = modifiers }
        if let target { item.target = target }
        return item
    }

    // MARK: - Menus

    private func appMenu() -> NSMenuItem {
        submenu(Config.appName) { m in
            m.addItem(entry("About \(Config.appName)",
                            #selector(NSApplication.orderFrontStandardAboutPanel(_:)),
                            target: NSApp))
            m.addItem(.separator())
            m.addItem(entry("Hide \(Config.appName)",
                            #selector(NSApplication.hide(_:)), key: "h", target: NSApp))
            m.addItem(entry("Hide Others",
                            #selector(NSApplication.hideOtherApplications(_:)),
                            key: "h", modifiers: [.command, .option], target: NSApp))
            m.addItem(entry("Show All",
                            #selector(NSApplication.unhideAllApplications(_:)), target: NSApp))
            m.addItem(.separator())
            m.addItem(entry("Quit \(Config.appName)",
                            #selector(NSApplication.terminate(_:)), key: "q", target: NSApp))
        }
    }

    private func fileMenu() -> NSMenuItem {
        submenu("File") { m in
            m.addItem(entry("New Window", #selector(newDocument(_:)), key: "n"))
            m.addItem(.separator())
            m.addItem(entry("Close Window",
                            #selector(NSWindow.performClose(_:)), key: "w"))
            m.addItem(entry("Print...",
                            #selector(BrowserWindowController.printPage(_:)), key: "p"))
            m.addItem(.separator())
            m.addItem(entry("Open Current Page in Browser",
                            #selector(BrowserWindowController.openInBrowser(_:)),
                            key: "b", modifiers: [.command, .shift]))
        }
    }

    private func editMenu() -> NSMenuItem {
        submenu("Edit") { m in
            m.addItem(entry("Undo", Selector(("undo:")), key: "z"))
            m.addItem(entry("Redo", Selector(("redo:")), key: "z",
                            modifiers: [.command, .shift]))
            m.addItem(.separator())
            m.addItem(entry("Cut", #selector(NSText.cut(_:)), key: "x"))
            m.addItem(entry("Copy", #selector(NSText.copy(_:)), key: "c"))
            m.addItem(entry("Paste", #selector(NSText.paste(_:)), key: "v"))
            m.addItem(entry("Paste and Match Style",
                            #selector(NSTextView.pasteAsPlainText(_:)), key: "v",
                            modifiers: [.command, .option, .shift]))
            m.addItem(entry("Delete", #selector(NSText.delete(_:))))
            m.addItem(entry("Select All", #selector(NSText.selectAll(_:)), key: "a"))
        }
    }

    private func viewMenu() -> NSMenuItem {
        submenu("View") { m in
            m.addItem(entry("Reload",
                            #selector(BrowserWindowController.reloadPage(_:)), key: "r"))
            m.addItem(entry("Reload Ignoring Cache",
                            #selector(BrowserWindowController.forceReloadPage(_:)),
                            key: "r", modifiers: [.command, .shift]))
            m.addItem(.separator())
            m.addItem(entry("Actual Size",
                            #selector(BrowserWindowController.resetZoom(_:)), key: "0"))
            m.addItem(entry("Zoom In",
                            #selector(BrowserWindowController.zoomIn(_:)), key: "+"))
            // Cmd+= without Shift is how people actually press "zoom in". Hidden
            // so the menu shows one Zoom In, but the shortcut still fires.
            let altZoomIn = entry("Zoom In",
                                  #selector(BrowserWindowController.zoomIn(_:)), key: "=")
            altZoomIn.isHidden = true
            m.addItem(altZoomIn)
            m.addItem(entry("Zoom Out",
                            #selector(BrowserWindowController.zoomOut(_:)), key: "-"))
            m.addItem(.separator())
            m.addItem(entry("Enter Full Screen",
                            #selector(NSWindow.toggleFullScreen(_:)),
                            key: "f", modifiers: [.command, .control]))
        }
    }

    private func historyMenu() -> NSMenuItem {
        submenu("History") { m in
            m.addItem(entry("Back",
                            #selector(BrowserWindowController.goBackPage(_:)), key: "["))
            m.addItem(entry("Forward",
                            #selector(BrowserWindowController.goForwardPage(_:)), key: "]"))
            m.addItem(.separator())
            m.addItem(entry("Dashboard",
                            #selector(BrowserWindowController.goHome(_:)),
                            key: "h", modifiers: [.command, .shift]))
        }
    }

    private func windowMenu() -> NSMenuItem {
        let item = submenu("Window") { m in
            m.addItem(entry("Minimize",
                            #selector(NSWindow.performMiniaturize(_:)), key: "m"))
            m.addItem(entry("Zoom", #selector(NSWindow.performZoom(_:))))
            m.addItem(.separator())
            m.addItem(entry("Bring All to Front",
                            #selector(NSApplication.arrangeInFront(_:)), target: NSApp))
        }
        // Hands AppKit the menu it appends the open-window list to.
        NSApp.windowsMenu = item.submenu
        return item
    }
}
