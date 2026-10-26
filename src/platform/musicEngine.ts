import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus, type AudioMetadata } from 'expo-audio';

// Plays songs with the operating system's own media player (so playback survives the screen locking). Two players are used: one does the
// work, the other only while crossfading, when it holds the next song while the two overlap. This mirrors the web app's engine.

type Deck = { player: AudioPlayer; trackId: string | null; duration: number; subscription: { remove: () => void } | null };

export type EngineEvents = {
  time: (position: number, duration: number) => void;
  playing: (playing: boolean) => void;
  buffering: (buffering: boolean) => void;
  /** The song finished by itself and nothing took over; the player decides what comes next. */
  ended: () => void;
  /** A crossfade finished: the next song is already playing, so the queue only needs to move on. */
  advanced: (trackId: string) => void;
  error: (message: string) => void;
};

export type TrackSource = { uri: string; duration: number; metadata: AudioMetadata };

export const MAX_CROSSFADE_SECONDS = 12;
const FADE_TICK_MS = 80;
const LOAD_TIMEOUT_MS = 10_000;

export class MusicEngine {
  private readonly decks: [Deck, Deck];
  private active = 0;
  private volumeValue = 1;
  private mutedValue = false;
  private rateValue = 1;
  private crossfadeSeconds = 0;
  private token = 0;
  private lastPosition = 0;
  private fade: { timer: ReturnType<typeof setInterval>; from: number; to: number; startedAt: number; length: number; trackId: string } | null = null;
  private preparing = false;
  /** Songs being opened by `load` (it reports their failure itself) and the song whose failure was already reported. */
  private loading = 0;
  private failedTrackId: string | null = null;
  private readonly events: EngineEvents;
  private readonly sourceOf: (trackId: string) => TrackSource | null;
  private readonly peekNext: () => string | null;

  constructor(events: EngineEvents, sourceOf: (trackId: string) => TrackSource | null, peekNext: () => string | null) {
    this.events = events;
    this.sourceOf = sourceOf;
    this.peekNext = peekNext;
    void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix', allowsRecording: false, shouldRouteThroughEarpiece: false }).catch(() => undefined);
    const make = (): Deck => ({ player: createAudioPlayer(null, { updateInterval: 250 }), trackId: null, duration: 0, subscription: null });
    this.decks = [make(), make()];
    this.decks.forEach((deck, position) => { deck.subscription = deck.player.addListener('playbackStatusUpdate', (status) => this.onStatus(position, status)); });
  }

  private get deck(): Deck { return this.decks[this.active]; }
  private get standby(): Deck { return this.decks[1 - this.active]; }

  get trackId(): string | null { return this.deck.trackId; }
  get playing(): boolean { return this.deck.player.playing; }
  position(): number { return this.deck.player.currentTime; }
  duration(): number { return this.deck.duration > 0 ? this.deck.duration : this.deck.player.duration; }

  // --- the players' status ---------------------------------------------------------------------------------------------------------

  private onStatus(position: number, status: AudioStatus): void {
    if (this.active !== position) return;
    const deck = this.decks[position];
    if (status.error) {
      // A failure while opening is reported once, by `load`; a player keeps its error status, so later updates must not repeat it.
      if (this.loading === 0 && this.failedTrackId !== deck.trackId) { this.failedTrackId = deck.trackId; this.events.error('This song could not be played.'); }
      return;
    }
    if (status.isLoaded && status.duration > 0) deck.duration = status.duration;
    this.lastPosition = status.currentTime;
    this.events.time(status.currentTime, this.duration());
    this.events.playing(status.playing);
    this.events.buffering(status.isBuffering && !status.playing);
    if (status.didJustFinish && !this.fade) this.events.ended();
    else this.maybePrepare();
  }

  private applyVolume(): void {
    const level = this.mutedValue ? 0 : this.volumeValue;
    if (!this.fade) {
      this.deck.player.volume = level;
      this.standby.player.volume = 0;
    }
    this.deck.player.setPlaybackRate(this.rateValue);
    this.standby.player.setPlaybackRate(this.rateValue);
  }

  setVolume(value: number): void { this.volumeValue = Math.min(1, Math.max(0, value)); this.applyVolume(); }
  setMuted(muted: boolean): void { this.mutedValue = muted; this.applyVolume(); }
  setRate(rate: number): void { this.rateValue = rate; this.applyVolume(); }
  setCrossfade(seconds: number): void { this.crossfadeSeconds = Math.min(MAX_CROSSFADE_SECONDS, Math.max(0, seconds)); }

  // --- loading and transport ---------------------------------------------------------------------------------------------------------

  private waitUntilLoaded(deck: Deck, token: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const check = (): void => {
        if (token !== this.token) { resolve(); return; }
        const status = deck.player.currentStatus;
        if (status.error) { reject(new Error('This song could not be played.')); return; }
        if (status.isLoaded) { resolve(); return; }
        if (Date.now() - started > LOAD_TIMEOUT_MS) { reject(new Error('This song took too long to open.')); return; }
        setTimeout(check, 40);
      };
      check();
    });
  }

  /** Loads a song and (by default) starts it. Rejects if the file cannot be opened. */
  async load(trackId: string, startAt = 0, autoplay = true): Promise<void> {
    this.cancelFade();
    const token = ++this.token;
    const source = this.sourceOf(trackId);
    if (!source) throw new Error('That song is not available.');
    this.standby.player.pause();
    this.standby.trackId = null;
    this.events.buffering(true);
    const deck = this.deck;
    deck.trackId = trackId;
    deck.duration = source.duration;
    this.failedTrackId = null;
    this.loading += 1;
    deck.player.pause();
    deck.player.replace({ uri: source.uri });
    this.applyVolume();
    try {
      await this.waitUntilLoaded(deck, token);
    } catch (error) {
      this.failedTrackId = trackId;
      if (token === this.token) this.events.buffering(false);
      throw error;
    } finally {
      this.loading -= 1;
    }
    if (token !== this.token) return;
    if (startAt > 0) await deck.player.seekTo(startAt).catch(() => undefined);
    this.lastPosition = startAt;
    this.events.time(startAt, source.duration);
    this.events.buffering(false);
    deck.player.setActiveForLockScreen(true, source.metadata, { showSeekBackward: true, showSeekForward: true, seekBackwardIntervalSeconds: 10, seekForwardIntervalSeconds: 10 });
    if (autoplay) this.play();
  }

  play(): void {
    if (this.fade) this.standby.player.play();
    this.deck.player.play();
  }

  pause(): void {
    this.deck.player.pause();
    if (this.fade) this.standby.player.pause();
    this.events.playing(false);
  }

  seek(seconds: number): void {
    const duration = this.duration();
    const target = Math.min(Math.max(0, seconds), duration > 0 ? Math.max(0, duration - 0.25) : seconds);
    this.cancelFade();
    this.lastPosition = target;
    void this.deck.player.seekTo(target).catch(() => undefined);
    this.events.time(target, duration);
  }

  stop(): void {
    this.cancelFade();
    this.token += 1;
    for (const deck of this.decks) {
      deck.player.pause();
      deck.player.clearLockScreenControls();
      deck.trackId = null;
      deck.duration = 0;
    }
    this.lastPosition = 0;
    this.events.playing(false);
  }

  /** Updates the lock-screen card (title, artist, cover) for the song that is playing. */
  updateMetadata(metadata: AudioMetadata): void { this.deck.player.updateLockScreenMetadata(metadata); }

  // --- crossfade -----------------------------------------------------------------------------------------------------------------------

  private maybePrepare(): void {
    if (this.crossfadeSeconds <= 0 || this.fade || this.preparing || !this.deck.player.playing) return;
    const duration = this.duration();
    if (duration <= 0) return;
    const remaining = duration - this.position();
    const next = this.peekNext();
    if (next && next !== this.deck.trackId && remaining <= this.crossfadeSeconds + 0.3 && remaining > 0.2) void this.startFade(next);
  }

  private async startFade(trackId: string): Promise<void> {
    const token = this.token;
    const source = this.sourceOf(trackId);
    if (!source) return;
    this.preparing = true;
    try {
      const from = this.active;
      const to = 1 - this.active;
      const incoming = this.decks[to];
      incoming.trackId = trackId;
      incoming.duration = source.duration;
      incoming.player.volume = 0;
      incoming.player.replace({ uri: source.uri });
      try { await this.waitUntilLoaded(incoming, token); } catch { incoming.trackId = null; return; }
      if (token !== this.token || this.fade) return;
      incoming.player.setPlaybackRate(this.rateValue);
      incoming.player.play();
      const length = Math.max(1, Math.min(this.crossfadeSeconds, this.duration() - this.position()));
      const startedAt = Date.now();
      const level = this.mutedValue ? 0 : this.volumeValue;
      const timer = setInterval(() => {
        const progress = Math.min(1, (Date.now() - startedAt) / (length * 1000));
        // Equal-power curves keep the loudness steady through the overlap instead of dipping in the middle.
        this.decks[from].player.volume = level * Math.cos((progress * Math.PI) / 2);
        this.decks[to].player.volume = level * Math.sin((progress * Math.PI) / 2);
        if (progress >= 1) this.finishFade();
      }, FADE_TICK_MS);
      this.fade = { timer, from, to, startedAt, length, trackId };
    } finally {
      this.preparing = false;
    }
  }

  private finishFade(): void {
    const fade = this.fade;
    if (!fade) return;
    clearInterval(fade.timer);
    this.fade = null;
    const outgoing = this.decks[fade.from];
    outgoing.player.pause();
    outgoing.player.clearLockScreenControls();
    outgoing.trackId = null;
    this.active = fade.to;
    this.applyVolume();
    const source = this.sourceOf(fade.trackId);
    if (source) this.deck.player.setActiveForLockScreen(true, source.metadata, { showSeekBackward: true, showSeekForward: true, seekBackwardIntervalSeconds: 10, seekForwardIntervalSeconds: 10 });
    this.events.advanced(fade.trackId);
  }

  private cancelFade(): void {
    const fade = this.fade;
    if (!fade) return;
    clearInterval(fade.timer);
    this.fade = null;
    const incoming = this.decks[fade.to];
    incoming.player.pause();
    incoming.trackId = null;
    this.applyVolume();
  }

  dispose(): void {
    this.stop();
    for (const deck of this.decks) { deck.subscription?.remove(); deck.player.remove(); }
  }
}
