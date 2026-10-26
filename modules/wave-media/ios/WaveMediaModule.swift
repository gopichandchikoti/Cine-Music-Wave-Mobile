import AVFoundation
import CryptoKit
import ExpoModulesCore
import MediaPlayer
import UIKit
import UniformTypeIdentifiers

// iOS counterpart of the Android WaveMedia module. NOT BUILT OR RUN: this repository was developed on Windows, which cannot compile or
// sign iOS apps (see IOS_SETUP.md). It follows the same JavaScript contract (modules/wave-media/index.ts) so the screens need no changes.
//
// What iOS can honestly offer, per Apple's rules:
//  - songs from the user's Music library that are downloaded and not DRM-protected (MPMediaQuery, after the user allows access),
//  - audio and video files and folders the user picks in the Files app (security-scoped access that is saved and restored),
//  - no whole-iPhone scan, no private app folders, no streaming-service downloads. Photos videos are not wired up yet.

public class WaveMediaModule: Module {
  private var pendingPick: Promise?
  private var pickerDelegate: PickerDelegate?
  private let defaults = UserDefaults(suiteName: "wave-sources") ?? .standard

  public func definition() -> ModuleDefinition {
    Name("WaveMedia")

    AsyncFunction("list") { (kind: String, offset: Int, limit: Int) -> [[String: Any?]] in
      guard offset >= 0, (1...1000).contains(limit) else { throw Exception(name: "InvalidPage", description: "Invalid page") }
      return Array(self.allRows(kind: kind).dropFirst(offset).prefix(limit))
    }

    AsyncFunction("readTags") { (uris: [String], kind: String) -> [[String: Any?]] in
      var result: [[String: Any?]] = []
      for text in uris.prefix(64) { result.append(await self.readOne(text, kind: kind)) }
      return result
    }

    AsyncFunction("artwork") { (uri: String, kind: String, key: String, maxPx: Int) -> String? in
      await self.artwork(uri, kind: kind, key: key, maxPx: min(max(maxPx, 64), 1600))
    }

    AsyncFunction("lyrics") { (_: String) -> String? in nil }
    AsyncFunction("contentRect") { (_: String) -> [String: Double]? in nil }
    AsyncFunction("dominantColor") { (uri: String) -> [Int]? in self.dominantColor(uri) }

    AsyncFunction("exists") { (uri: String) -> Bool in
      guard let url = URL(string: uri), url.isFileURL else { return false }
      let scoped = url.startAccessingSecurityScopedResource()
      defer { if scoped { url.stopAccessingSecurityScopedResource() } }
      return FileManager.default.isReadableFile(atPath: url.path)
    }

    AsyncFunction("requestScan") { (_: [String]) -> Int in 0 }

    AsyncFunction("pickedFolders") { () -> [[String: Any?]] in self.pickedRows() }

    AsyncFunction("pick") { (folder: Bool, promise: Promise) in
      guard self.pendingPick == nil else { promise.reject("PICK_BUSY", "A picker is already open"); return }
      self.pendingPick = promise
      DispatchQueue.main.async {
        let types: [UTType] = folder ? [.folder] : [.audio, .movie]
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: types, asCopy: false)
        picker.allowsMultipleSelection = true
        let delegate = PickerDelegate { urls in self.finishPick(urls) }
        self.pickerDelegate = delegate
        picker.delegate = delegate
        self.appContext?.utilities?.currentViewController()?.present(picker, animated: true)
      }
    }
  }

  // MARK: rows

  private func allRows(kind: String) -> [[String: Any?]] {
    var rows = pickedRows().filter { ($0["kind"] as? String) == kind }
    if kind == "audio", MPMediaLibrary.authorizationStatus() == .authorized {
      for item in MPMediaQuery.songs().items ?? [] {
        guard let url = item.assetURL, !item.hasProtectedAsset else { continue }
        rows.append(row(url: url, kind: "audio", name: item.title ?? url.lastPathComponent, folder: item.albumTitle ?? "", size: 0, modified: item.dateAdded, duration: item.playbackDuration, key: "ipod:\(item.persistentID)"))
      }
    }
    return rows
  }

  private func row(url: URL, kind: String, name: String, folder: String, size: Int, modified: Date, duration: Double, key: String) -> [String: Any?] {
    ["key": key, "kind": kind, "uri": url.absoluteString, "name": String(name.prefix(512)), "folder": String(folder.prefix(512)), "size": size,
     "modified": Int(modified.timeIntervalSince1970 * 1000), "added": Int(modified.timeIntervalSince1970 * 1000), "mime": "", "duration": duration, "width": 0, "height": 0]
  }

  private func sha(_ text: String) -> String {
    SHA256.hash(data: Data(text.utf8)).map { String(format: "%02x", $0) }.joined().prefix(32).description
  }

  // MARK: picked files and folders

  private func finishPick(_ urls: [URL]) {
    let promise = pendingPick
    pendingPick = nil
    pickerDelegate = nil
    for url in urls {
      if let bookmark = try? url.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil) {
        defaults.set(bookmark, forKey: "source:\(sha(url.absoluteString))")
      }
    }
    promise?.resolve(pickedRows())
  }

  private func pickedRows() -> [[String: Any?]] {
    var rows: [[String: Any?]] = []
    for (name, value) in defaults.dictionaryRepresentation() where name.hasPrefix("source:") {
      guard let data = value as? Data else { continue }
      var stale = false
      guard let url = try? URL(resolvingBookmarkData: data, options: [], relativeTo: nil, bookmarkDataIsStale: &stale) else { continue }
      let scoped = url.startAccessingSecurityScopedResource()
      defer { if scoped { url.stopAccessingSecurityScopedResource() } }
      walk(url, folder: "", rows: &rows, depth: 0)
    }
    return rows
  }

  private func walk(_ url: URL, folder: String, rows: inout [[String: Any?]], depth: Int) {
    guard depth <= 12, rows.count < 3000 else { return }
    let values = try? url.resourceValues(forKeys: [.isDirectoryKey, .contentTypeKey, .fileSizeKey, .contentModificationDateKey])
    if values?.isDirectory == true {
      let children = (try? FileManager.default.contentsOfDirectory(at: url, includingPropertiesForKeys: nil)) ?? []
      for child in children { walk(child, folder: folder.isEmpty ? url.lastPathComponent : "\(folder)/\(url.lastPathComponent)", rows: &rows, depth: depth + 1) }
      return
    }
    guard let type = values?.contentType else { return }
    let kind = type.conforms(to: .audio) ? "audio" : type.conforms(to: .movie) ? "video" : nil
    guard let kind else { return }
    rows.append(row(url: url, kind: kind, name: url.lastPathComponent, folder: folder, size: values?.fileSize ?? 0, modified: values?.contentModificationDate ?? Date(), duration: 0, key: "doc:\(sha(url.absoluteString))"))
  }

  // MARK: tags and pictures

  private func withAccess<T>(_ text: String, _ body: (URL) async -> T) async -> T? {
    guard let url = URL(string: text) else { return nil }
    let scoped = url.startAccessingSecurityScopedResource()
    defer { if scoped { url.stopAccessingSecurityScopedResource() } }
    return await body(url)
  }

  private func readOne(_ text: String, kind: String) async -> [String: Any?] {
    await withAccess(text) { url in
      var result: [String: Any?] = ["uri": text, "readable": false]
      let asset = AVURLAsset(url: url)
      guard let duration = try? await asset.load(.duration) else { return result }
      result["readable"] = true
      result["duration"] = duration.seconds.isFinite ? duration.seconds : 0
      let metadata = (try? await asset.load(.commonMetadata)) ?? []
      func string(_ key: AVMetadataKey) -> String? {
        guard let item = AVMetadataItem.metadataItems(from: metadata, filteredByIdentifier: AVMetadataItem.identifier(forKey: key.rawValue, keySpace: .common) ?? .commonIdentifierTitle).first else { return nil }
        return item.stringValue.map { String($0.prefix(512)) }
      }
      result["title"] = string(.commonKeyTitle)
      result["artist"] = string(.commonKeyArtist)
      result["album"] = string(.commonKeyAlbumName)
      result["hasCover"] = metadata.contains { $0.commonKey == .commonKeyArtwork }
      result["hasLyrics"] = false
      if kind == "video", let track = try? await asset.loadTracks(withMediaType: .video).first, let size = try? await track.load(.naturalSize) {
        result["width"] = Int(abs(size.width)); result["height"] = Int(abs(size.height))
        let audio = (try? await asset.loadTracks(withMediaType: .audio)) ?? []
        var tracks: [[String: Any?]] = []
        for item in audio { tracks.append(["mime": "audio/mp4a-latm", "language": (try? await item.load(.languageCode)) ?? nil, "channels": 2]) }
        result["audioTracks"] = tracks
        result["subtitleTracks"] = [] as [[String: Any?]]
      }
      return result
    } ?? ["uri": text, "readable": false]
  }

  private func cacheFile(_ key: String, _ maxPx: Int) -> URL {
    let folder = (FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first ?? URL(fileURLWithPath: NSTemporaryDirectory())).appendingPathComponent("artwork", isDirectory: true)
    try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    return folder.appendingPathComponent("\(sha(key))-\(maxPx).jpg")
  }

  private func artwork(_ text: String, kind: String, key: String, maxPx: Int) async -> String? {
    let target = cacheFile(key, maxPx)
    if FileManager.default.fileExists(atPath: target.path) { return target.absoluteString }
    return await withAccess(text) { url -> String? in
      let asset = AVURLAsset(url: url)
      var image: UIImage?
      if kind == "audio" {
        let metadata = (try? await asset.load(.commonMetadata)) ?? []
        if let data = try? await metadata.first(where: { $0.commonKey == .commonKeyArtwork })?.load(.dataValue) { image = UIImage(data: data) }
      } else {
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: maxPx, height: maxPx)
        let seconds = ((try? await asset.load(.duration))?.seconds ?? 10) * 0.12
        if let frame = try? generator.copyCGImage(at: CMTime(seconds: max(1, seconds), preferredTimescale: 600), actualTime: nil) { image = UIImage(cgImage: frame) }
      }
      guard let picture = image else { return nil }
      let scale = min(1, CGFloat(maxPx) / max(picture.size.width, picture.size.height))
      let size = CGSize(width: picture.size.width * scale, height: picture.size.height * scale)
      let resized = UIGraphicsImageRenderer(size: size).image { _ in picture.draw(in: CGRect(origin: .zero, size: size)) }
      guard let jpeg = resized.jpegData(compressionQuality: 0.88), (try? jpeg.write(to: target)) != nil else { return nil }
      return target.absoluteString
    }
  }

  private func dominantColor(_ text: String) -> [Int]? {
    guard let url = URL(string: text), let data = try? Data(contentsOf: url), let image = UIImage(data: data)?.cgImage else { return nil }
    let side = 24
    var pixels = [UInt8](repeating: 0, count: side * side * 4)
    guard let context = CGContext(data: &pixels, width: side, height: side, bitsPerComponent: 8, bytesPerRow: side * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return nil }
    context.draw(image, in: CGRect(x: 0, y: 0, width: side, height: side))
    var r = 0.0, g = 0.0, b = 0.0, total = 0.0
    for index in stride(from: 0, to: pixels.count, by: 4) {
      let red = Double(pixels[index]), green = Double(pixels[index + 1]), blue = Double(pixels[index + 2])
      let high = max(red, green, blue), low = min(red, green, blue)
      let weight = 0.15 + (high == 0 ? 0 : (high - low) / high) * 2 + (high > 40 ? 0.4 : 0)
      r += red * weight; g += green * weight; b += blue * weight; total += weight
    }
    return total > 0 ? [Int(r / total), Int(g / total), Int(b / total)] : nil
  }
}

private final class PickerDelegate: NSObject, UIDocumentPickerDelegate {
  private let done: ([URL]) -> Void
  init(done: @escaping ([URL]) -> Void) { self.done = done }
  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) { done(urls) }
  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { done([]) }
}
