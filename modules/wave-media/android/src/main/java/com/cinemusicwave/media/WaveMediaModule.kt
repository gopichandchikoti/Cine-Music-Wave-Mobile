package com.cinemusicwave.media

import android.app.Activity
import android.content.ContentResolver
import android.content.Intent
import android.database.Cursor
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.provider.DocumentsContract
import android.provider.MediaStore
import android.provider.OpenableColumns
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.charset.Charset
import java.security.MessageDigest
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * On-device media for Cine Music Wave: lists what Android's MediaStore already indexed (so only permitted files are ever seen), reads tags,
 * embedded covers and video frames, and offers the system file picker for sources the user chooses by hand. It never writes to, renames or
 * deletes an original file; cached artwork lives in the app's private folder.
 */
class WaveMediaModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext)
  private var pendingPick: Promise? = null
  private val preferences get() = context.getSharedPreferences("wave-sources", 0)

  override fun definition() = ModuleDefinition {
    Name("WaveMedia")

    /** One page of MediaStore rows (cheap columns only). Positions are stable while the library does not change. */
    AsyncFunction("list") { kind: String, offset: Int, limit: Int ->
      require(offset >= 0 && limit in 1..1000) { "Invalid page" }
      listPage(kind, offset, limit)
    }

    /** Reads tags, cover and track information for files, in the same order as the given addresses. */
    AsyncFunction("readTags") { uris: List<String>, kind: String ->
      require(kind == "audio" || kind == "video") { "kind must be audio or video" }
      require(uris.size <= 64) { "Too many files at once" }
      uris.map { readOne(localUri(it), kind) }
    }

    /** A cached JPEG for an album cover (embedded picture) or a video poster; returns a file address, or null when there is none. */
    AsyncFunction("artwork") { uri: String, kind: String, key: String, maxPx: Int ->
      require(maxPx in 64..1600) { "Invalid size" }
      artwork(localUri(uri), kind, key, maxPx)
    }

    /** Lyrics stored inside the song (ID3 USLT), or null. */
    AsyncFunction("lyrics") { uri: String -> readLyrics(localUri(uri)) }

    /** Where the real picture sits inside baked-in black bars, as fractions of the frame; null when there are none. */
    AsyncFunction("contentRect") { uri: String -> contentRect(localUri(uri)) }

    /** The colour that stands out most in a cover picture (saturated, not too dark), for tinting the full-screen player. */
    AsyncFunction("dominantColor") { uri: String -> dominantColor(localUri(uri)) }

    AsyncFunction("exists") { uri: String ->
      try { context.contentResolver.openAssetFileDescriptor(localUri(uri), "r")?.use { true } ?: false } catch (_: Exception) { false }
    }

    /** Asks Android to index files that were copied in from a computer (used by the test fixtures). */
    AsyncFunction("requestScan") { paths: List<String> ->
      val files = paths.filter { it.startsWith("/sdcard/") || it.startsWith("/storage/") }.take(200)
      val latch = CountDownLatch(files.size)
      MediaScannerConnection.scanFile(context, files.toTypedArray(), null) { _, _ -> latch.countDown() }
      latch.await(30, TimeUnit.SECONDS)
      files.size
    }

    /** Lets the user choose audio/video files, or a folder, when media permission is not (fully) granted. */
    AsyncFunction("pick") { folder: Boolean, promise: Promise ->
      check(pendingPick == null) { "A picker is already open" }
      pendingPick = promise
      val intent = Intent(if (folder) Intent.ACTION_OPEN_DOCUMENT_TREE else Intent.ACTION_OPEN_DOCUMENT).apply {
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        if (!folder) {
          type = "*/*"
          putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("audio/*", "video/*"))
          putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
          addCategory(Intent.CATEGORY_OPENABLE)
        }
      }
      appContext.throwingActivity.startActivityForResult(intent, PICK_REQUEST)
    }

    /** Files from folders chosen earlier (their access was kept by Android until the user revokes it). */
    AsyncFunction("pickedFolders") {
      val rows = mutableListOf<Map<String, Any?>>()
      for ((name, value) in preferences.all) if (name.startsWith("folder:") && value is String) {
        try {
          val tree = localUri(value)
          walkTree(tree, DocumentsContract.getTreeDocumentId(tree), "", rows, 0)
        } catch (_: Exception) { /* a revoked folder simply contributes nothing; its catalogued files turn unavailable */ }
      }
      rows
    }

    OnActivityResult { _, (requestCode, resultCode, intent) ->
      if (requestCode == PICK_REQUEST) {
        val promise = pendingPick
        pendingPick = null
        if (resultCode != Activity.RESULT_OK || intent == null) promise?.resolve(emptyList<Map<String, Any?>>())
        else Thread {
          try {
            val uris = mutableListOf<Uri>()
            intent.data?.let { uris.add(it) }
            intent.clipData?.let { clip -> for (i in 0 until min(clip.itemCount, 500)) uris.add(clip.getItemAt(i).uri) }
            val rows = mutableListOf<Map<String, Any?>>()
            for (uri in uris.distinct()) {
              try { context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) } catch (_: Exception) { /* one-shot grant */ }
              if (DocumentsContract.isTreeUri(uri)) {
                preferences.edit().putString("folder:${sha(uri.toString())}", uri.toString()).apply()
                walkTree(uri, DocumentsContract.getTreeDocumentId(uri), "", rows, 0)
              } else documentRow(uri, "")?.let { rows.add(it) }
            }
            promise?.resolve(rows)
          } catch (error: Exception) {
            promise?.reject("PICK_FAILED", "The selected source is unavailable. Select it again.", error)
          }
        }.start()
      }
    }
  }

  // --- MediaStore ----------------------------------------------------------------------------------------------------------------

  private fun collection(kind: String): Uri = when (kind) {
    "audio" -> MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
    "video" -> MediaStore.Video.Media.EXTERNAL_CONTENT_URI
    else -> throw IllegalArgumentException("kind must be audio or video")
  }

  private fun projection(kind: String): Array<String> {
    val columns = mutableListOf("_id", "_display_name", "_size", "date_modified", "date_added", "mime_type", "duration")
    if (Build.VERSION.SDK_INT >= 29) columns.add("relative_path")
    if (kind == "audio") {
      columns.addAll(listOf("title", "artist", "album", "track", "year", "composer"))
      if (Build.VERSION.SDK_INT >= 30) columns.addAll(listOf("album_artist", "genre", "disc_number"))
    } else {
      columns.addAll(listOf("width", "height"))
    }
    return columns.toTypedArray()
  }

  private fun listPage(kind: String, offset: Int, limit: Int): List<Map<String, Any?>> {
    val base = collection(kind)
    val selection = if (kind == "audio") "COALESCE(is_ringtone, 0) = 0 AND COALESCE(is_notification, 0) = 0 AND COALESCE(is_alarm, 0) = 0" else null
    val rows = mutableListOf<Map<String, Any?>>()
    context.contentResolver.query(base, projection(kind), selection, null, "_id ASC")?.use { cursor ->
      if (cursor.moveToPosition(offset)) do {
        val id = cursor.lng("_id") ?: continue
        val folder = cursor.str("relative_path") ?: ""
        rows.add(mapOf(
          "key" to "$kind:$id",
          "kind" to kind,
          "uri" to android.content.ContentUris.withAppendedId(base, id).toString(),
          "name" to (cursor.str("_display_name") ?: "Untitled").take(512),
          "folder" to folder.trimEnd('/').take(512),
          "size" to (cursor.lng("_size") ?: 0L),
          "modified" to (cursor.lng("date_modified") ?: 0L) * 1000,
          "added" to (cursor.lng("date_added") ?: 0L) * 1000,
          "mime" to (cursor.str("mime_type") ?: ""),
          "duration" to ((cursor.lng("duration") ?: 0L) / 1000.0),
          "width" to (cursor.lng("width") ?: 0L),
          "height" to (cursor.lng("height") ?: 0L),
          "title" to cursor.str("title")?.take(512),
          "artist" to cursor.str("artist")?.take(512),
          "album" to cursor.str("album")?.take(512),
          "albumArtist" to cursor.str("album_artist")?.take(512),
          "genre" to cursor.str("genre")?.take(512),
          "year" to cursor.str("year"),
          "track" to cursor.str("track"),
          "disc" to cursor.str("disc_number"),
          "composer" to cursor.str("composer")?.take(512),
        ))
      } while (rows.size < limit && cursor.moveToNext())
    }
    return rows
  }

  private fun Cursor.str(name: String): String? {
    val index = getColumnIndex(name)
    return if (index >= 0 && !isNull(index)) getString(index) else null
  }

  private fun Cursor.lng(name: String): Long? {
    val index = getColumnIndex(name)
    return if (index >= 0 && !isNull(index)) getLong(index) else null
  }

  // --- tags, tracks, covers ----------------------------------------------------------------------------------------------------------

  private fun readOne(uri: Uri, kind: String): Map<String, Any?> {
    val result = mutableMapOf<String, Any?>("uri" to uri.toString(), "readable" to false)
    val retriever = MediaMetadataRetriever()
    try {
      retriever.setDataSource(context, uri)
      result["readable"] = true
      fun tag(name: String, key: Int, limit: Int = 512) { retriever.extractMetadata(key)?.take(limit)?.let { result[name] = it } }
      tag("title", MediaMetadataRetriever.METADATA_KEY_TITLE)
      tag("artist", MediaMetadataRetriever.METADATA_KEY_ARTIST)
      tag("albumArtist", MediaMetadataRetriever.METADATA_KEY_ALBUMARTIST)
      tag("album", MediaMetadataRetriever.METADATA_KEY_ALBUM)
      tag("genre", MediaMetadataRetriever.METADATA_KEY_GENRE)
      tag("composer", MediaMetadataRetriever.METADATA_KEY_COMPOSER)
      tag("date", MediaMetadataRetriever.METADATA_KEY_DATE, 64)
      tag("year", MediaMetadataRetriever.METADATA_KEY_YEAR, 16)
      tag("track", MediaMetadataRetriever.METADATA_KEY_CD_TRACK_NUMBER, 16)
      tag("disc", MediaMetadataRetriever.METADATA_KEY_DISC_NUMBER, 16)
      result["duration"] = (retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toDoubleOrNull() ?: 0.0) / 1000.0
      if (kind == "audio") {
        result["hasCover"] = retriever.embeddedPicture != null
        result["hasLyrics"] = id3Lyrics(uri) != null
      } else {
        val rotation = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
        val width = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 0
        val height = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 0
        val turned = rotation == 90 || rotation == 270
        result["width"] = if (turned) height else width
        result["height"] = if (turned) width else height
        result["hasCover"] = false
        result.putAll(trackInfo(uri))
      }
    } catch (_: Exception) {
      /* readable stays false: the file keeps its MediaStore facts and is shown with fallbacks */
    } finally {
      try { retriever.release() } catch (_: Exception) { /* nothing to release */ }
    }
    return result
  }

  /** Audio and text tracks inside a video, in container order (the order the player lists them in). */
  private fun trackInfo(uri: Uri): Map<String, Any?> {
    val audio = mutableListOf<Map<String, Any?>>()
    val subtitles = mutableListOf<Map<String, Any?>>()
    val extractor = MediaExtractor()
    try {
      extractor.setDataSource(context, uri, null)
      for (index in 0 until extractor.trackCount) {
        val format = extractor.getTrackFormat(index)
        val mime = format.getString(MediaFormat.KEY_MIME) ?: continue
        val language = if (format.containsKey(MediaFormat.KEY_LANGUAGE)) format.getString(MediaFormat.KEY_LANGUAGE) else null
        if (mime.startsWith("audio/")) {
          val channels = if (format.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) format.getInteger(MediaFormat.KEY_CHANNEL_COUNT) else 0
          audio.add(mapOf("mime" to mime, "language" to language, "channels" to channels))
        } else if (mime.startsWith("text/") || mime == "application/x-subrip" || mime == "application/ttml+xml") {
          subtitles.add(mapOf("mime" to mime, "language" to language))
        }
      }
    } catch (_: Exception) {
      /* a container the extractor cannot open still plays; it just lists no tracks here */
    } finally {
      try { extractor.release() } catch (_: Exception) { /* nothing to release */ }
    }
    return mapOf("audioTracks" to audio, "subtitleTracks" to subtitles)
  }

  private fun artDirectory(): File = File(context.filesDir, "artwork").apply { mkdirs() }

  private fun artwork(uri: Uri, kind: String, key: String, maxPx: Int): String? {
    val target = File(artDirectory(), "${sha(key)}-$maxPx.jpg")
    if (target.exists() && target.length() > 0) return Uri.fromFile(target).toString()
    val retriever = MediaMetadataRetriever()
    var bitmap: Bitmap? = null
    try {
      retriever.setDataSource(context, uri)
      bitmap = if (kind == "audio") {
        val bytes = retriever.embeddedPicture ?: return null
        decodeScaled(bytes, maxPx)
      } else {
        posterFrame(retriever, maxPx)
      }
      val picture = bitmap ?: return null
      val temporary = File(target.parentFile, "${target.name}.tmp")
      temporary.outputStream().use { picture.compress(Bitmap.CompressFormat.JPEG, 88, it) }
      if (!temporary.renameTo(target)) { temporary.delete(); return null }
      return Uri.fromFile(target).toString()
    } catch (_: Exception) {
      return null
    } finally {
      bitmap?.recycle()
      try { retriever.release() } catch (_: Exception) { /* nothing to release */ }
    }
  }

  private fun decodeScaled(bytes: ByteArray, maxPx: Int): Bitmap? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
    var sample = 1
    while (bounds.outWidth / (sample * 2) >= maxPx && bounds.outHeight / (sample * 2) >= maxPx) sample *= 2
    val decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample }) ?: return null
    val longest = max(decoded.width, decoded.height)
    if (longest <= maxPx) return decoded
    val ratio = maxPx.toFloat() / longest
    val scaled = Bitmap.createScaledBitmap(decoded, max(1, (decoded.width * ratio).roundToInt()), max(1, (decoded.height * ratio).roundToInt()), true)
    if (scaled !== decoded) decoded.recycle()
    return scaled
  }

  /** The brightest of a few early frames, so a poster is never a black opening. */
  private fun posterFrame(retriever: MediaMetadataRetriever, maxWidth: Int): Bitmap? {
    val durationUs = (retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L) * 1000
    val rotation = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
    var width = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 16
    var height = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 9
    if (rotation == 90 || rotation == 270) { val swap = width; width = height; height = swap }
    val outWidth = min(maxWidth, max(64, width))
    val outHeight = max(36, (outWidth.toLong() * height / max(1, width)).toInt())
    var best: Bitmap? = null
    var bestLuma = -1.0
    for (fraction in listOf(0.12, 0.3, 0.5)) {
      val at = max(1_000_000L, (durationUs * fraction).toLong())
      val frame = (try {
        if (Build.VERSION.SDK_INT >= 27) retriever.getScaledFrameAtTime(at, MediaMetadataRetriever.OPTION_CLOSEST_SYNC, outWidth, outHeight)
        else retriever.getFrameAtTime(at, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
      } catch (_: Exception) { null }) ?: continue
      val luma = meanLuma(frame)
      if (luma > bestLuma) { best?.recycle(); best = frame; bestLuma = luma } else frame.recycle()
      if (bestLuma > 40) break
    }
    return best
  }

  private fun meanLuma(frame: Bitmap): Double {
    val small = Bitmap.createScaledBitmap(frame, 16, 9, true)
    var total = 0.0
    for (y in 0 until 9) for (x in 0 until 16) {
      val pixel = small.getPixel(x, y)
      total += 0.2126 * ((pixel shr 16) and 0xff) + 0.7152 * ((pixel shr 8) and 0xff) + 0.0722 * (pixel and 0xff)
    }
    if (small !== frame) small.recycle()
    return total / (16 * 9)
  }

  private fun contentRect(uri: Uri): Map<String, Any?>? {
    val retriever = MediaMetadataRetriever()
    try {
      retriever.setDataSource(context, uri)
      val durationUs = (retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L) * 1000
      var top = 1.0; var bottom = 0.0; var left = 1.0; var right = 0.0
      var seen = 0
      for (fraction in listOf(0.2, 0.4, 0.6, 0.8)) {
        val frame = (try {
          if (Build.VERSION.SDK_INT >= 27) retriever.getScaledFrameAtTime((durationUs * fraction).toLong(), MediaMetadataRetriever.OPTION_CLOSEST_SYNC, 192, 108)
          else retriever.getFrameAtTime((durationUs * fraction).toLong(), MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
        } catch (_: Exception) { null }) ?: continue
        val w = frame.width; val h = frame.height
        val rowDark = BooleanArray(h) { y -> (0 until w).all { x -> luma(frame.getPixel(x, y)) < 18 } }
        val columnDark = BooleanArray(w) { x -> (0 until h).all { y -> luma(frame.getPixel(x, y)) < 18 } }
        val firstRow = rowDark.indexOfFirst { !it }
        val lastRow = rowDark.indexOfLast { !it }
        val firstColumn = columnDark.indexOfFirst { !it }
        val lastColumn = columnDark.indexOfLast { !it }
        frame.recycle()
        if (firstRow < 0 || firstColumn < 0) continue // an all-black frame says nothing
        seen += 1
        top = min(top, firstRow.toDouble() / h); bottom = max(bottom, (lastRow + 1).toDouble() / h)
        left = min(left, firstColumn.toDouble() / w); right = max(right, (lastColumn + 1).toDouble() / w)
      }
      if (seen == 0) return null
      val rect = mapOf("x" to left, "y" to top, "w" to right - left, "h" to bottom - top)
      return if ((right - left) * (bottom - top) > 0.97 || right - left <= 0.2 || bottom - top <= 0.2) null else rect
    } catch (_: Exception) {
      return null
    } finally {
      try { retriever.release() } catch (_: Exception) { /* nothing to release */ }
    }
  }

  private fun dominantColor(uri: Uri): List<Int>? {
    try {
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
      if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
      var sample = 1
      while (bounds.outWidth / (sample * 2) >= 96 && bounds.outHeight / (sample * 2) >= 96) sample *= 2
      val decoded = context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample }) } ?: return null
      val small = Bitmap.createScaledBitmap(decoded, 24, 24, true)
      var r = 0.0; var g = 0.0; var b = 0.0; var total = 0.0
      for (y in 0 until 24) for (x in 0 until 24) {
        val pixel = small.getPixel(x, y)
        if ((pixel ushr 24) < 200) continue
        val red = (pixel shr 16) and 0xff; val green = (pixel shr 8) and 0xff; val blue = pixel and 0xff
        val high = max(red, max(green, blue)); val low = min(red, min(green, blue))
        val saturation = if (high == 0) 0.0 else (high - low).toDouble() / high
        val weight = 0.15 + saturation * 2 + (if (high > 40) 0.4 else 0.0)
        r += red * weight; g += green * weight; b += blue * weight; total += weight
      }
      if (small !== decoded) small.recycle()
      decoded.recycle()
      return if (total > 0) listOf((r / total).roundToInt(), (g / total).roundToInt(), (b / total).roundToInt()) else null
    } catch (_: Exception) {
      return null
    }
  }

  private fun luma(pixel: Int): Int = ((0.2126 * ((pixel shr 16) and 0xff)) + (0.7152 * ((pixel shr 8) and 0xff)) + (0.0722 * (pixel and 0xff))).toInt()

  // --- lyrics inside an MP3 (ID3v2 USLT) -----------------------------------------------------------------------------------------------

  private fun readLyrics(uri: Uri): String? = id3Lyrics(uri)

  private fun id3Lyrics(uri: Uri): String? {
    try {
      context.contentResolver.openInputStream(uri)?.use { input ->
        val header = ByteArray(10)
        if (input.read(header) != 10 || header[0] != 'I'.code.toByte() || header[1] != 'D'.code.toByte() || header[2] != '3'.code.toByte()) return null
        val version = header[3].toInt()
        if (version < 3 || version > 4) return null
        val size = ((header[6].toInt() and 0x7f) shl 21) or ((header[7].toInt() and 0x7f) shl 14) or ((header[8].toInt() and 0x7f) shl 7) or (header[9].toInt() and 0x7f)
        val tag = ByteArray(min(size, 1_500_000))
        var read = 0
        while (read < tag.size) { val n = input.read(tag, read, tag.size - read); if (n <= 0) break; read += n }
        var position = 0
        while (position + 10 <= read) {
          val id = String(tag, position, 4, Charsets.ISO_8859_1)
          if (id[0] == '\u0000') break
          val frameSize = if (version == 4) ((tag[position + 4].toInt() and 0x7f) shl 21) or ((tag[position + 5].toInt() and 0x7f) shl 14) or ((tag[position + 6].toInt() and 0x7f) shl 7) or (tag[position + 7].toInt() and 0x7f)
          else ((tag[position + 4].toInt() and 0xff) shl 24) or ((tag[position + 5].toInt() and 0xff) shl 16) or ((tag[position + 6].toInt() and 0xff) shl 8) or (tag[position + 7].toInt() and 0xff)
          if (frameSize <= 0 || position + 10 + frameSize > read) break
          if (id == "USLT" && frameSize > 5) return decodeUslt(tag, position + 10, frameSize)
          position += 10 + frameSize
        }
      }
    } catch (_: Exception) { /* no readable lyrics */ }
    return null
  }

  private fun decodeUslt(tag: ByteArray, start: Int, length: Int): String? {
    val encoding = tag[start].toInt()
    val charset: Charset = when (encoding) { 1 -> Charsets.UTF_16; 2 -> Charsets.UTF_16BE; 3 -> Charsets.UTF_8; else -> Charsets.ISO_8859_1 }
    var cursor = start + 4 // encoding byte and the 3-byte language
    val wide = encoding == 1 || encoding == 2
    // skip the content descriptor, which ends with a terminator the width of the encoding
    while (cursor < start + length) {
      if (wide) { if (cursor + 1 < start + length && tag[cursor].toInt() == 0 && tag[cursor + 1].toInt() == 0) { cursor += 2; break }; cursor += 2 }
      else { if (tag[cursor].toInt() == 0) { cursor += 1; break }; cursor += 1 }
    }
    if (cursor >= start + length) return null
    val text = String(tag, cursor, start + length - cursor, charset).replace("\u0000", "").trim()
    return if (text.length >= 8) text.take(100_000) else null
  }

  // --- documents the user picked ----------------------------------------------------------------------------------------------------

  private fun documentRow(uri: Uri, folder: String): Map<String, Any?>? {
    val mime = context.contentResolver.getType(uri) ?: return null
    val kind = if (mime.startsWith("audio/")) "audio" else if (mime.startsWith("video/")) "video" else return null
    var name = "Untitled"
    var size = 0L
    var modified = 0L
    context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE, DocumentsContract.Document.COLUMN_LAST_MODIFIED), null, null, null)?.use {
      if (it.moveToFirst()) {
        name = it.getString(0) ?: name
        size = if (it.isNull(1)) 0L else it.getLong(1)
        modified = if (it.isNull(2)) 0L else it.getLong(2)
      }
    }
    val now = System.currentTimeMillis()
    return mapOf(
      "key" to "doc:${sha(uri.toString())}", "kind" to kind, "uri" to uri.toString(), "name" to name.take(512), "folder" to folder.take(512),
      "size" to size, "modified" to (if (modified > 0) modified else now), "added" to now, "mime" to mime, "duration" to 0.0, "width" to 0L, "height" to 0L,
    )
  }

  private fun walkTree(tree: Uri, parent: String, folder: String, output: MutableList<Map<String, Any?>>, depth: Int) {
    if (depth > 12 || output.size >= 3000) return
    val children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, parent)
    context.contentResolver.query(children, arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_MIME_TYPE, DocumentsContract.Document.COLUMN_DISPLAY_NAME), null, null, null)?.use { cursor ->
      while (cursor.moveToNext() && output.size < 3000) {
        val id = cursor.getString(0)
        val childName = cursor.getString(2) ?: ""
        if (cursor.getString(1) == DocumentsContract.Document.MIME_TYPE_DIR) walkTree(tree, id, if (folder.isEmpty()) childName else "$folder/$childName", output, depth + 1)
        else documentRow(DocumentsContract.buildDocumentUriUsingTree(tree, id), folder)?.let { output.add(it) }
      }
    }
  }

  // --- helpers -----------------------------------------------------------------------------------------------------------------------

  private fun localUri(value: String): Uri {
    require(value.length <= 8192) { "Address too long" }
    val uri = Uri.parse(value)
    require(uri.scheme == "content" || uri.scheme == "file") { "Local files only" }
    // A path address may only name a picture this module cached itself, never the app's database, settings or any other file.
    if (uri.scheme == "file") require(isCachedArtwork(uri)) { "Only cached pictures can be read by path" }
    return uri
  }

  /** True for a file directly inside the artwork cache, after links and ".." have been resolved. */
  private fun isCachedArtwork(uri: Uri): Boolean {
    val path = uri.path ?: return false
    return try { File(path).canonicalFile.parentFile == artDirectory().canonicalFile } catch (_: Exception) { false }
  }

  private fun sha(input: String): String = MessageDigest.getInstance("SHA-256").digest(input.toByteArray()).joinToString("") { "%02x".format(it) }.take(32)

  companion object {
    private const val PICK_REQUEST = 9321
  }
}
