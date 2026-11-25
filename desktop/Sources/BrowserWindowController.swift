import AppKit
import WebKit

final class BrowserWindowController: NSWindowController, NSWindowDelegate, NSMenuItemValidation {

    private let webView: WKWebView
    private let loadBar = LoadBar()

    /// WKDownload holds its delegate weakly and does not retain a destination,
    /// so both are tracked here for the life of the transfer.
    private var downloadDestinations: [WKDownload: URL] = [:]

    private var observations: [NSKeyValueObservation] = []

    /// The last URL we meant to be on. `loadHTMLString` for the error page wipes
    /// `webView.url`, so Retry needs its own record of where to go back to.
    private var lastRequestedURL: URL

    /// Only the first window restores its saved frame; later ones cascade off it
    /// instead of landing on top of each other.
    private static var openedWindowCount = 0

    var onClose: ((BrowserWindowController) -> Void)?

    private static let zoomKey = "pageZoom"

    // MARK: - Setup

    init(url: URL) {
        lastRequestedURL = url

        let configuration = WKWebViewConfiguration()
        // The default store is on-disk, which is what keeps the Supabase session
        // cookie across launches. Without it you would sign in every morning.
        configuration.websiteDataStore = .default()
        // Keeps the Safari tokens, so nothing server-side mistakes this for an
        // unsupported browser, and adds a token we can identify in logs.
        configuration.applicationNameForUserAgent =
            "Version/18.0 Safari/605.1.15 \(Config.appName)Desktop/\(Config.version)"

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.allowsBackForwardNavigationGestures = true
        self.webView = webView

        let window = NSWindow(
            contentRect: NSRect(origin: .zero, size: Config.defaultWindowSize),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        super.init(window: window)

        window.title = Config.appName
        window.minSize = Config.minimumWindowSize
        window.backgroundColor = Config.pageBackground
        window.delegate = self
        window.tabbingMode = .disallowed

        if #available(macOS 12.0, *) {
            // Stops the rubber-band area past the end of the page flashing white.
            webView.underPageBackgroundColor = Config.pageBackground
        }
        if #available(macOS 13.3, *) {
            // Right-click, Inspect Element. Worth having when something on the
            // page misbehaves only in here.
            webView.isInspectable = true
        }

        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.pageZoom = CGFloat(UserDefaults.standard.double(forKey: Self.zoomKey)
            .nonZero(fallback: 1.0))

        layout(in: window)
        positionWindow(window)
        observeWebView()

        load(url)
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    private func layout(in window: NSWindow) {
        let content = NSView()
        content.wantsLayer = true
        content.layer?.backgroundColor = Config.pageBackground.cgColor
        window.contentView = content

        for view in [webView, loadBar] {
            view.translatesAutoresizingMaskIntoConstraints = false
            content.addSubview(view)
        }

        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: content.topAnchor),
            webView.bottomAnchor.constraint(equalTo: content.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: content.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: content.trailingAnchor),

            loadBar.topAnchor.constraint(equalTo: content.topAnchor),
            loadBar.leadingAnchor.constraint(equalTo: content.leadingAnchor),
            loadBar.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            loadBar.heightAnchor.constraint(equalToConstant: 3),
        ])
        loadBar.isHidden = true
    }

    private func positionWindow(_ window: NSWindow) {
        let index = Self.openedWindowCount
        Self.openedWindowCount += 1

        if index == 0 {
            window.setFrameAutosaveName("CMPDMainWindow")
            if window.frame.origin == .zero { window.center() }
        } else {
            window.center()
            let offset = CGFloat(index) * 26
            window.setFrameOrigin(NSPoint(x: window.frame.origin.x + offset,
                                          y: window.frame.origin.y - offset))
        }
    }

    private func observeWebView() {
        observations = [
            webView.observe(\.estimatedProgress, options: [.new]) { [weak self] view, _ in
                self?.loadBar.value = view.estimatedProgress
            },
            webView.observe(\.isLoading, options: [.new]) { [weak self] view, _ in
                guard let self else { return }
                if view.isLoading {
                    self.loadBar.isHidden = false
                } else {
                    // Let the bar finish before it disappears, so a fast load
                    // does not read as a flicker.
                    self.loadBar.value = 1
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { [weak self] in
                        guard let self, !self.webView.isLoading else { return }
                        self.loadBar.isHidden = true
                        self.loadBar.value = 0
                    }
                }
            },
            webView.observe(\.title, options: [.new]) { [weak self] view, _ in
                let title = view.title ?? ""
                self?.window?.title = title.isEmpty ? Config.appName : title
            },
        ]
    }

    private func load(_ url: URL) {
        lastRequestedURL = url
        webView.load(URLRequest(url: url))
    }

    // MARK: - Window

    func windowWillClose(_ notification: Notification) {
        observations.forEach { $0.invalidate() }
        observations.removeAll()
        webView.navigationDelegate = nil
        webView.uiDelegate = nil
        onClose?(self)
    }

    // MARK: - Menu actions

    @objc func reloadPage(_ sender: Any?) {
        // After the error page, there is nothing to reload: go back to the URL
        // that failed.
        if webView.url == nil { load(lastRequestedURL) } else { webView.reload() }
    }

    @objc func forceReloadPage(_ sender: Any?) {
        if webView.url == nil { load(lastRequestedURL) }
        else { webView.reloadFromOrigin() }
    }

    @objc func goBackPage(_ sender: Any?) { webView.goBack() }
    @objc func goForwardPage(_ sender: Any?) { webView.goForward() }
    @objc func goHome(_ sender: Any?) { load(Config.home) }

    @objc func zoomIn(_ sender: Any?) { setZoom(webView.pageZoom + 0.1) }
    @objc func zoomOut(_ sender: Any?) { setZoom(webView.pageZoom - 0.1) }
    @objc func resetZoom(_ sender: Any?) { setZoom(1.0) }

    private func setZoom(_ value: CGFloat) {
        let clamped = min(max(value, 0.5), 2.5)
        webView.pageZoom = clamped
        UserDefaults.standard.set(Double(clamped), forKey: Self.zoomKey)
    }

    @objc func printPage(_ sender: Any?) {
        guard let window else { return }
        let info = NSPrintInfo.shared
        info.horizontalPagination = .fit
        info.isHorizontallyCentered = true
        let operation = webView.printOperation(with: info)
        operation.view?.frame = webView.bounds
        operation.runModal(for: window, delegate: nil, didRun: nil, contextInfo: nil)
    }

    @objc func openInBrowser(_ sender: Any?) {
        NSWorkspace.shared.open(webView.url ?? lastRequestedURL)
    }

    func validateMenuItem(_ item: NSMenuItem) -> Bool {
        switch item.action {
        case #selector(goBackPage(_:)):    return webView.canGoBack
        case #selector(goForwardPage(_:)): return webView.canGoForward
        default:                           return true
        }
    }

    // MARK: - Error page

    fileprivate func showError(_ error: Error) {
        let message = (error as NSError).localizedDescription
        let html = """
        <!doctype html>
        <html><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <style>
          :root { color-scheme: dark; }
          html, body { height: 100%; margin: 0; }
          body {
            background: #000; color: #ededed; display: grid; place-items: center;
            font: 15px/1.6 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
            text-align: center; padding: 32px;
          }
          .box { max-width: 30rem; }
          h1 { font-size: 1.35rem; font-weight: 700; margin: 0 0 .6rem; }
          p { color: #a1a1aa; margin: 0 0 1.6rem; }
          code {
            display: block; margin: 0 0 1.6rem; padding: .7rem .9rem;
            background: #18181b; border: 1px solid #27272a; border-radius: 8px;
            color: #71717a; font-size: 12.5px; text-align: left;
          }
          a {
            display: inline-block; background: #FACC15; color: #18181b;
            text-decoration: none; font-weight: 650; padding: .65rem 1.35rem;
            border-radius: 8px;
          }
        </style></head>
        <body><div class="box">
          <h1>Can't reach CMPD</h1>
          <p>You are probably offline, or the site is briefly down.
             Nothing you were working on is lost.</p>
          <code>\(message.htmlEscaped)</code>
          <a href="\(Config.retryScheme)://reload">Try again</a>
        </div></body></html>
        """
        webView.loadHTMLString(html, baseURL: nil)
    }
}

// MARK: - Navigation

extension BrowserWindowController: WKNavigationDelegate {

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }

        // The error page's Try again button.
        if url.scheme == Config.retryScheme {
            decisionHandler(.cancel)
            load(lastRequestedURL)
            return
        }

        // An <a download> link. This is how the client progress PDF leaves the
        // page: jsPDF's doc.save() makes a blob URL and clicks a download
        // anchor. Without this branch WebKit drops it and the button looks dead.
        if navigationAction.shouldPerformDownload {
            decisionHandler(.download)
            return
        }

        // mailto:, tel: and anything else the web view cannot open go to the
        // system. Every http(s) destination stays in the app, including
        // off-domain ones, because sign-in and Stripe checkout both redirect
        // away and back and must land inside the window they started in.
        if let scheme = url.scheme?.lowercased(), scheme != "http", scheme != "https" {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }

        if navigationAction.targetFrame?.isMainFrame ?? false {
            lastRequestedURL = url
        }
        decisionHandler(.allow)
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationResponse: WKNavigationResponse,
        decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void
    ) {
        // A response WebKit cannot render is a file, not a page.
        decisionHandler(navigationResponse.canShowMIMEType ? .allow : .download)
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction,
                 didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse,
                 didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!,
                 withError error: Error) {
        guard !error.isCancellation else { return }
        showError(error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        guard !error.isCancellation else { return }
        showError(error)
    }
}

// MARK: - Downloads

extension BrowserWindowController: WKDownloadDelegate {

    func download(
        _ download: WKDownload,
        decideDestinationUsing response: URLResponse,
        suggestedFilename: String,
        completionHandler: @escaping (URL?) -> Void
    ) {
        let folder = FileManager.default
            .urls(for: .downloadsDirectory, in: .userDomainMask).first
            ?? FileManager.default.homeDirectoryForCurrentUser
                .appendingPathComponent("Downloads", isDirectory: true)

        let name = suggestedFilename.isEmpty ? "download" : suggestedFilename
        let destination = Self.availableURL(in: folder, named: name)
        downloadDestinations[download] = destination
        completionHandler(destination)
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard let url = downloadDestinations.removeValue(forKey: download) else { return }
        // Shows the saved file in Finder, so an export is visibly finished
        // rather than silently somewhere.
        NSWorkspace.shared.activateFileViewerSelecting([url])
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        downloadDestinations.removeValue(forKey: download)
        guard !error.isCancellation, let window else { return }
        let alert = NSAlert()
        alert.messageText = "Download failed"
        alert.informativeText = (error as NSError).localizedDescription
        alert.alertStyle = .warning
        alert.beginSheetModal(for: window)
    }

    /// `report.pdf`, then `report 2.pdf`, rather than clobbering the last export.
    private static func availableURL(in folder: URL, named filename: String) -> URL {
        let candidate = folder.appendingPathComponent(filename)
        guard FileManager.default.fileExists(atPath: candidate.path) else { return candidate }

        let base = candidate.deletingPathExtension().lastPathComponent
        let ext = candidate.pathExtension
        for n in 2...999 {
            let name = ext.isEmpty ? "\(base) \(n)" : "\(base) \(n).\(ext)"
            let next = folder.appendingPathComponent(name)
            if !FileManager.default.fileExists(atPath: next.path) { return next }
        }
        return folder.appendingPathComponent("\(base) \(UUID().uuidString).\(ext)")
    }
}

// MARK: - UI

extension BrowserWindowController: WKUIDelegate {

    /// target="_blank" and window.open. These are "go look at this elsewhere"
    /// links, so they open in the default browser rather than a bare second
    /// window with no menu context.
    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let url = navigationAction.request.url { NSWorkspace.shared.open(url) }
        return nil
    }

    /// Required. Setting any uiDelegate replaces WebKit's built-in file picker,
    /// so without this every <input type="file"> does nothing: progress
    /// pictures, profile photo and the organisation logo upload all break.
    func webView(
        _ webView: WKWebView,
        runOpenPanelWith parameters: WKOpenPanelParameters,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping ([URL]?) -> Void
    ) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = parameters.allowsDirectories
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.resolvesAliases = true

        let finish: (NSApplication.ModalResponse) -> Void = { response in
            completionHandler(response == .OK ? panel.urls : nil)
        }
        if let window { panel.beginSheetModal(for: window, completionHandler: finish) }
        else { finish(panel.runModal()) }
    }

    // Without these three, alert() does nothing and confirm() silently returns
    // false, which makes any confirm-before-delete button look broken.

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping () -> Void) {
        let alert = NSAlert()
        alert.messageText = Config.appName
        alert.informativeText = message
        alert.addButton(withTitle: "OK")
        present(alert) { _ in completionHandler() }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert()
        alert.messageText = Config.appName
        alert.informativeText = message
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")
        present(alert) { completionHandler($0 == .alertFirstButtonReturn) }
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (String?) -> Void) {
        let alert = NSAlert()
        alert.messageText = Config.appName
        alert.informativeText = prompt
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")

        let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 260, height: 24))
        field.stringValue = defaultText ?? ""
        alert.accessoryView = field

        present(alert) { response in
            completionHandler(response == .alertFirstButtonReturn ? field.stringValue : nil)
        }
    }

    private func present(_ alert: NSAlert,
                         _ completion: @escaping (NSApplication.ModalResponse) -> Void) {
        if let window { alert.beginSheetModal(for: window, completionHandler: completion) }
        else { completion(alert.runModal()) }
    }
}

// MARK: - Helpers

private extension Error {
    /// -999 fires on any navigation that is replaced or stopped, which happens
    /// on ordinary redirects. Showing an error page for it would be wrong.
    var isCancellation: Bool {
        let error = self as NSError
        return error.domain == NSURLErrorDomain && error.code == NSURLErrorCancelled
    }
}

private extension Double {
    func nonZero(fallback: Double) -> Double { self == 0 ? fallback : self }
}

private extension String {
    var htmlEscaped: String {
        replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
    }
}
