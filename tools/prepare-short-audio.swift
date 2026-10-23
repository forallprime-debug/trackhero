import Foundation
import AVFoundation

// Copy AAC packets from the existing playback files, preserving the song's start.
@main struct ShortAudio {
 static func main() async throws {
  for id in ["anna", "egor", "princes", "mia", "heir"] {
   let input = URL(fileURLWithPath: "Music/\(id)-playback.m4a")
   let output = URL(fileURLWithPath: "Music/\(id)-90.m4a")
   if FileManager.default.fileExists(atPath: output.path) { try FileManager.default.removeItem(at: output) }
   let asset = AVURLAsset(url: input)
   guard let session = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetPassthrough) else { fatalError("Cannot export \(id)") }
   session.outputURL = output
   session.outputFileType = .m4a
   session.shouldOptimizeForNetworkUse = true
   session.timeRange = CMTimeRange(start: .zero, duration: CMTime(seconds: 90.1, preferredTimescale: 48000))
   await session.export()
   guard session.status == .completed else { throw session.error ?? NSError(domain:"ShortAudio",code:1) }
   let duration = try await AVURLAsset(url: output).load(.duration)
   print("\(id): \(CMTimeGetSeconds(duration)) seconds")
  }
 }
}
