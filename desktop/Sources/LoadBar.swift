import AppKit

/// A 3px determinate bar across the top of the window.
///
/// NSProgressIndicator cannot be made this thin, and a spinner over the content
/// would cover the page. This exists so a slow load reads as "loading" rather
/// than "frozen".
final class LoadBar: NSView {
    private let fill = CALayer()

    var value: Double = 0 {
        didSet { layoutFill() }
    }

    init() {
        super.init(frame: .zero)
        wantsLayer = true
        layer?.backgroundColor = NSColor.clear.cgColor
        fill.backgroundColor = Config.brandYellow.cgColor
        fill.anchorPoint = .zero
        layer?.addSublayer(fill)
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    override var isFlipped: Bool { true }

    override func layout() {
        super.layout()
        layoutFill()
    }

    private func layoutFill() {
        let clamped = CGFloat(min(max(value, 0), 1))
        fill.frame = CGRect(x: 0, y: 0, width: bounds.width * clamped, height: bounds.height)
    }
}
