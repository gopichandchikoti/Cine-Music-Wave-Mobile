# Feature parity with the web app

Every capability of the web app (`Cine Music Wave Web`, Watch and Music) and what exists on the phone. The web app was read from its source and run in Edge as the visual reference.

**Status words**

- **Checked**: exercised on the Android emulator and seen working (details and evidence in `VALIDATION.md`).
- **Built**: implemented, type-checked and linted, but not exercised on a device in this delivery. Treat as unverified.
- **Different**: works, but not the way the web does it, for the reason given.
- **Not available**: not in the mobile app, with the reason.

The only platform that has been run is Android (emulator `CineMusicWave_TestPhone`, a Pixel 9 Pro XL stand-in). iOS is not built (`IOS_SETUP.md`).

## Shared shell

| Capability | Status | Notes |
| --- | --- | --- |
| Login page (brand, welcome text, fields, providers, create-account link, notice) | Checked | Same layout and copy as `AuthGate`. Sign-in, providers and create account are disabled and say online sign-in is planned. |
| Skip Login (bottom bar, "Continue offline as Chendu") | Checked | Selects the device-local profile `local-test-chendu`. No account, token or network. Not authentication. |
| Remember the profile and the last mode (Watch or Music) across launches | Checked | Cold start after force-stop lands on the same mode and profile. |
| Return to login | Checked | Pauses playback (position kept), shows the login page; Skip Login restores the same profile, queue, likes and collections. Nothing is deleted. |
| Account chip: avatar, greeting text, menu (My profile, Settings, Return to login) | Checked (chip, menu, Return to login). Built (My profile and Settings dialogs) | Greeting text hides at 760 dp and below, as in the web's CSS. |
| Watch / Music mode switch | Checked | The Music mini player shows in Watch. Moving between modes while a song plays was not timed separately. |
| Responsive layouts | Checked at 448 dp (phone), 744 dp (small tablet), 997 dp (phone landscape, Music), 1600 dp (Watch wide) | Same breakpoints as the web: Music compact at 860 dp, Watch phone at 640 dp and tablet at 1000 dp. Not run on a real tablet. |
| Liquid-glass look (blur, rim, glow, gradients) | Checked, with one difference | See "Known differences". |
| Reduced motion, screen reader labels | Built | Labels and roles are set on controls; not tested with TalkBack. |

## Device library (replaces the web's server catalog)

| Capability | Status | Notes |
| --- | --- | --- |
| Find audio and video through Android MediaStore | Checked | Only what Android lets the app see. No all-files permission. |
| Read tags, embedded cover art, durations, track lists, video frames | Checked | Native Kotlin module `wave-media`. |
| Permission states: allowed, denied, partial, blocked | Checked | Denied shows the access panel with Grant media access (real Android dialog seen); partial explains that only selected videos are shared and offers Open settings; recovery after granting is seen. |
| Cached catalog kept while access is off | Checked | Rows from the phone's library are hidden, kept in SQLite, and return when access returns. Music Home shows a notice with Allow access or Open settings. |
| Files and folders the user picks by hand (document picker, persisted grants) | Built | Not exercised. These stay visible without library permission. |
| Rescan / Refresh | Checked (Watch Refresh after granting) | |
| Unavailable file (moved or deleted) | Built | Player says so and the row is hidden but kept. Not exercised on a device. |

## Watch

| Capability | Status | Notes |
| --- | --- | --- |
| Top bar and sections (Home, Movies, TV Series, My List), search field, refresh | Checked | Phone, tablet and wide arrangements. |
| Billboard with Play or Resume, More info, add to My List | Checked (Play, Resume, layout). Built (More info from the billboard and My List toggle) | |
| Rails: Continue Watching, Recently Added, TV Series | Checked | Continue Watching appears after partial viewing and disappears after finishing. The language and genre rails need a larger library than the test clips and were not seen. |
| Title cards, NEW badge, progress bar, scroll arrows | Checked (cards, arrows, progress) | |
| Title page: summary, episodes with thumbnails, season picker, similar titles, My List | Checked (open, episodes and thumbnails). Built (season picker, similar titles, My List) | |
| Search results page | Built | Layout matches the web's; not exercised after the last changes. |
| Movies, TV Series, My List pages | Built | |
| Resume from where you stopped, progress saved every 10 s and on close | Checked | "Resume S1:E2" appears and the saved place is used. |
| Video player: control bar, playback, time display, back | Checked | Real video frames in the release APK with the network off. Seeking by dragging, previous/next episode and volume: Built, not exercised. |
| Audio tracks (language) menu | Checked | Lists the container's tracks (Tamil, Telugu in the test file); the selected marker moves. The audible switch was not measured separately. |
| Subtitle tracks menu | Built | The test clips have no subtitle tracks. |
| Picture modes (fit, fill, crop, black-bar crop) | Built | Same `layoutPicture` maths as the web. Menu button seen; modes not exercised. |
| Playback speed | Built | Button seen; menu not exercised. |
| Fullscreen (landscape lock, hidden system bars, wide control bar) | Checked | Back leaves fullscreen, back again closes the player. |
| Error card with retry when a file cannot be played | Built | |
| External subtitle files (`.srt`, `.vtt`) beside the video | Not available | Only subtitle tracks inside the file are read. The web reads sidecar files through its server. |
| Hover cards and muted preview clips on cards | Not available | No hover on a phone, and preview clips need the web's transcoding server. |
| Keyboard shortcuts in the player | Not available | Hardware keyboards are not a target of this delivery. |
| Audio delay and sound-check loudness tools | Not available | They need a transcoding server or a native audio chain. |
| Posters and artwork from the web's catalog | Different | Posters are frames taken from the video file itself (and embedded covers for music). |

## Music

| Capability | Status | Notes |
| --- | --- | --- |
| Home: mood chips, Speed dial, Listen again, Quick picks, Made for you (daily mixes) | Checked (Speed dial, Listen again, Quick picks, mood chips). Built (Made for you, mood pages, daily mix pages) | Energise and Workout use title and tempo-tag rules because loudness is not analysed (see below). |
| Search with filters (artist, album, language, genre, year, liked) | Checked (page layout). Built (filter combinations) | |
| Library: All overview (Playlists, Recently added, On repeat, Singers shelves) and the sections Playlists, Albums & films, Singers, Songs, Radios as section buttons; filter box and sort | Checked (All overview, section buttons, layout). Built (the other sections' sorts and filtering, since the new buttons) | Different from the web: the web has tabs and no overview. Owner-requested (2026-10-26). |
| Album, singer, mix and mood pages | Checked (album with and without a cover, singer). Built (mix, mood) | On phones the album and singer pages are full-bleed, picture-tinted pages (Different from the web, owner-requested); wide layouts keep the web's headers. The singer page's star saves the singer's radio. |
| Liking a song and the Liked Songs playlist | Checked (like, and the Liked Songs tile with its count) | |
| Playlists: create, rename inline, add songs from the track menu, reorder by drag handle, delete with confirmation, mosaic cover | Checked | Create, rename, add, reorder and delete all worked, and the playlist and its order survived an app restart. |
| Track menu (play next, add to queue, add to playlist, like, start radio, go to album, go to singer) | Checked (menu, add to playlist, like). Built (the rest) | |
| Mini player and the dock (compact); sidebar and player bar (wide) | Checked | Different from the web: on phones the bottom tab bar is replaced by a floating dock (Home and Your Library button, mini player pill, Search button). Owner-requested (2026-10-26). |
| Dark and light theme for Music and Watch | Checked | Not in the web app. Account menu or Settings, Theme; kept on the phone; default dark; sign-in stays dark; Watch's player and title page stay dark. Following the phone's setting: Not available. |
| Now Playing: cover tint from the song, seek bar, transport, like, shuffle, repeat, volume | Checked (layout, tint, transport, like). Built (shuffle and repeat modes) | |
| Up next (queue) sheet with reorder, remove and clear | Checked (sheet). Built (reorder inside it) | |
| Lyrics sheet | Checked (sheet and empty state) | Only lyrics inside the file are read (USLT). The web also reads `.lrc` files beside the song: Not available. |
| Related songs sheet | Checked | |
| Playback settings: sleep timer, crossfade, autoplay, speed | Built | The panel and logic are in place; the timers and crossfade were not exercised. |
| Radio (from a song, album or singer) and saved radios | Built | |
| Autoplay after the queue ends | Built | |
| Remember queue and place, put back paused after a restart | Checked | A failed restore never starts playback on its own (fixed during validation). |
| Playback with the screen off, lock-screen card | Checked (audio kept playing; media session shows PLAYING with seek buttons) | Lock-screen next/previous buttons are Not available: Android only adds them for playlist players. The card has 10-second seek buttons. |
| Keyboard shortcuts, desktop media keys | Not available | |
| Loudness analysis for mixes and sound check | Not available | Needs a server-side analysis pass. |

## Known differences from the web

1. **Glass saturation.** The web saturates what is behind its glass (`backdrop-filter: saturate(1.9)`). React Native on Android blurs through `expo-blur`, which has no saturate step, so glass panes are slightly less vivid.
2. **Album page back arrow.** The web places it mid-page because of a flex quirk; the mobile app puts it at the top.
3. **Poster sources, subtitles and lyrics** come from the files themselves (see above).
4. **Lock-screen buttons** are seek buttons, not next/previous.
5. **Fonts** (DM Sans, DM Mono, Fraunces) and icons (lucide) are bundled, not fetched.
6. **Owner-requested redesign (2026-10-26).** A light theme, the phone dock, the full-bleed singer and album pages and the Library overview do not exist in the web app. Music Moments (a friends feed) is Not available: it needs accounts and a server.

## Not done in this delivery

iOS build and device tests; a physical Android phone; TalkBack and reduced-motion runs; long-running battery and memory checks; online accounts and sync (`docs/FUTURE_ONLINE_BACKEND_PLAN.md`).
