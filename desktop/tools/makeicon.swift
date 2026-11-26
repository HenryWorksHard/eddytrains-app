import AppKit
import CoreGraphics
import ImageIO
import Foundation

// Builds a .iconset from one square source image.
//
// A macOS icon is not an edge-to-edge square like the iOS asset: the artwork
// sits in a rounded rect inset from the canvas, so it lines up with every other
// icon in the Dock. The source artwork itself is not recomposed, only masked
// and inset.
//
// usage: makeicon <source.png> <output.iconset>

let args = CommandLine.arguments
guard args.count == 3 else {
    FileHandle.standardError.write("usage: makeicon <source.png> <out.iconset>\n".data(using: .utf8)!)
    exit(2)
}

let sourceURL = URL(fileURLWithPath: args[1])
let outURL = URL(fileURLWithPath: args[2])

guard let source = NSImage(contentsOf: sourceURL),
      let sourceCG = source.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    FileHandle.standardError.write("cannot read \(sourceURL.path)\n".data(using: .utf8)!)
    exit(1)
}

try? FileManager.default.createDirectory(at: outURL, withIntermediateDirectories: true)

// Apple's grid: on a 1024 canvas the icon body is 824 wide with a 185.4 corner
// radius. Expressed as ratios so every size derives from the same proportions.
let bodyRatio: CGFloat = 824.0 / 1024.0
let radiusRatio: CGFloat = 185.4 / 824.0

let variants: [(name: String, pixels: Int)] = [
    ("icon_16x16",      16), ("icon_16x16@2x",    32),
    ("icon_32x32",      32), ("icon_32x32@2x",    64),
    ("icon_128x128",   128), ("icon_128x128@2x", 256),
    ("icon_256x256",   256), ("icon_256x256@2x", 512),
    ("icon_512x512",   512), ("icon_512x512@2x",1024),
]

let colorSpace = CGColorSpaceCreateDeviceRGB()

for variant in variants {
    let size = CGFloat(variant.pixels)
    guard let ctx = CGContext(
        data: nil, width: variant.pixels, height: variant.pixels,
        bitsPerComponent: 8, bytesPerRow: 0, space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { continue }

    ctx.interpolationQuality = .high

    let body = (size * bodyRatio).rounded()
    let origin = ((size - body) / 2).rounded()
    let rect = CGRect(x: origin, y: origin, width: body, height: body)
    let radius = body * radiusRatio

    let path = CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil)
    ctx.addPath(path)
    ctx.clip()
    ctx.draw(sourceCG, in: rect)

    guard let image = ctx.makeImage() else { continue }
    let dest = outURL.appendingPathComponent("\(variant.name).png")
    guard let writer = CGImageDestinationCreateWithURL(
        dest as CFURL, "public.png" as CFString, 1, nil
    ) else { continue }
    CGImageDestinationAddImage(writer, image, nil)
    CGImageDestinationFinalize(writer)
}

print("wrote \(variants.count) sizes to \(outURL.lastPathComponent)")
