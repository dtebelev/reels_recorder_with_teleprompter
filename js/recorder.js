// js/recorder.js
import { listSupportedMimeTypes } from './mime.js';
import { logEvent } from './diagnostics.js';

// Emit data periodically instead of buffering the whole take until stop().
// Two reasons: a take that dies partway still has everything up to that
// point, and the chunk timeline in the diagnostics log shows whether the
// recorder kept producing data through a freeze.
const TIMESLICE_MS = 1000;

// iOS Safari has been seen to accept a format, report 'recording', and then
// silently produce nothing at all — no data, no error, no stop event. With
// a 1s timeslice real data shows up well within this window, so silence
// past it means this attempt is dead and the next one should take over.
const STALL_TIMEOUT_MS = 3000;

export class Recorder {
  #stream = null;
  #attempts = [];
  #attemptIndex = 0;
  #mediaRecorder = null;
  #chunks = [];
  #mimeType = null;
  #bytes = 0;
  #stopRequested = false;
  #stopped = null;
  #stallTimer = null;

  constructor(stream) {
    const mimeTypes = listSupportedMimeTypes(
      (type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)
    );
    if (mimeTypes.length === 0) {
      throw new Error('No supported recording format on this browser');
    }
    this.#stream = stream;
    // Every supported format with sound first; the very last resort drops
    // the audio track, because a silent stalled-audio take beats no take.
    this.#attempts = mimeTypes.map((mimeType) => ({ mimeType, audio: true }));
    if (stream.getAudioTracks().length > 0) {
      this.#attempts.push({ mimeType: mimeTypes[0], audio: false });
    }
    this.#watchTracks(stream);
    this.#createRecorder();
  }

  #createRecorder() {
    const { mimeType, audio } = this.#attempts[this.#attemptIndex];
    this.#mimeType = mimeType;
    logEvent('формат', audio ? mimeType : `${mimeType} (БЕЗ ЗВУКА)`);
    const stream = audio ? this.#stream : new MediaStream(this.#stream.getVideoTracks());
    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    this.#mediaRecorder = mediaRecorder;

    let resolveStopped;
    this.#stopped = new Promise((resolve) => { resolveStopped = resolve; });

    // Handlers ignore events from a recorder that has since been replaced.
    const current = () => this.#mediaRecorder === mediaRecorder;
    mediaRecorder.ondataavailable = (e) => {
      if (!current() || e.data.size === 0) return;
      if (this.#chunks.length === 0) logEvent('первый фрагмент', `${Math.round(e.data.size / 1024)} КБ`);
      this.#chunks.push(e.data);
      this.#bytes += e.data.size;
    };
    mediaRecorder.onerror = (e) => {
      logEvent('ОШИБКА РЕКОРДЕРА', e?.error?.name ?? e?.error ?? 'неизвестно');
    };
    // Registered up front, not inside stop(): iOS can stop the recorder on
    // its own (camera interrupted, track ended) long before the user taps
    // Стоп, and that `stop` event would otherwise be missed — leaving stop()
    // waiting forever on an event that already happened.
    mediaRecorder.onstop = () => {
      if (!current()) return;
      if (!this.#stopRequested) logEvent('РЕКОРДЕР ОСТАНОВИЛСЯ САМ');
      logEvent('запись остановлена', `${this.#chunks.length} фрагментов, ${Math.round(this.#bytes / 1024)} КБ`);
      resolveStopped();
    };
  }

  /** A video track that goes `mute` stops delivering frames while the
   * stream stays "live" — that's what a frozen picture with continuing
   * audio looks like from JS, and it's the single most useful signal for
   * telling an OS/camera-side stall apart from an encoding problem. A track
   * that is *already* muted when recording starts never fires `mute`, so
   * the starting state is logged too. */
  #watchTracks(stream) {
    const [videoTrack] = stream.getVideoTracks();
    if (videoTrack) {
      const s = typeof videoTrack.getSettings === 'function' ? videoTrack.getSettings() : {};
      logEvent('видеодорожка', `${s.width ?? '?'}x${s.height ?? '?'} @${s.frameRate ?? '?'}fps, ${describeTrack(videoTrack)}`);
      videoTrack.addEventListener('mute', () => logEvent('ВИДЕОДОРОЖКА ЗАМОЛЧАЛА (mute)'));
      videoTrack.addEventListener('unmute', () => logEvent('видеодорожка возобновилась'));
      videoTrack.addEventListener('ended', () => logEvent('ВИДЕОДОРОЖКА ЗАВЕРШИЛАСЬ (ended)'));
    } else {
      logEvent('ВНИМАНИЕ', 'в потоке нет видеодорожки');
    }

    const [audioTrack] = stream.getAudioTracks();
    if (audioTrack) {
      logEvent('аудиодорожка', describeTrack(audioTrack));
      audioTrack.addEventListener('mute', () => logEvent('аудиодорожка mute'));
      audioTrack.addEventListener('unmute', () => logEvent('аудиодорожка unmute'));
      audioTrack.addEventListener('ended', () => logEvent('аудиодорожка ended'));
    } else {
      logEvent('ВНИМАНИЕ', 'в потоке нет аудиодорожки');
    }
  }

  get canPause() {
    return typeof this.#mediaRecorder.pause === 'function';
  }

  start() {
    this.#chunks = [];
    this.#bytes = 0;
    this.#mediaRecorder.start(TIMESLICE_MS);
    logEvent('запись начата', this.#mediaRecorder.state);
    this.#armStallCheck();
  }

  #armStallCheck() {
    clearTimeout(this.#stallTimer);
    this.#stallTimer = setTimeout(() => this.#checkStall(), STALL_TIMEOUT_MS);
  }

  /** Swaps a recorder that has produced nothing for the next attempt. Only
   * ever happens while no data exists yet, so nothing recorded is lost —
   * the take just starts a few seconds late. */
  #checkStall() {
    if (this.#stopRequested || this.#bytes > 0) return;
    if (this.#mediaRecorder.state === 'paused') {
      this.#armStallCheck(); // can't judge silence while paused; look again later
      return;
    }
    logEvent('НЕТ ДАННЫХ', `${STALL_TIMEOUT_MS / 1000}с без фрагментов, состояние ${this.#mediaRecorder.state}`);
    if (this.#attemptIndex + 1 >= this.#attempts.length) {
      logEvent('ВСЕ ВАРИАНТЫ ЗАПИСИ ИСЧЕРПАНЫ');
      return;
    }
    const dead = this.#mediaRecorder;
    this.#attemptIndex += 1;
    this.#createRecorder();
    try {
      if (dead.state !== 'inactive') dead.stop();
    } catch {
      // A stalled recorder may refuse even this; it's been replaced either way.
    }
    try {
      this.start();
    } catch (err) {
      logEvent('не удалось перезапустить', err?.name ?? err);
    }
  }

  pause() {
    if (this.#mediaRecorder.state !== 'recording') return;
    this.#mediaRecorder.pause();
    logEvent('пауза');
  }

  resume() {
    if (this.#mediaRecorder.state !== 'paused') return;
    this.#mediaRecorder.resume();
    logEvent('продолжение');
  }

  /** Resolves with the recorded Blob once the recorder has flushed, or —
   * if it never confirms within `timeoutMs` — with whatever chunks arrived
   * so far (the 1s timeslice means that's nearly the whole take). Resolves
   * with null only when nothing at all was recorded. */
  async stop(timeoutMs) {
    this.#stopRequested = true;
    clearTimeout(this.#stallTimer);
    if (this.#mediaRecorder.state !== 'inactive') {
      try {
        this.#mediaRecorder.stop();
      } catch (err) {
        logEvent('ошибка stop()', err?.name ?? err);
      }
    } else {
      logEvent('рекордер уже был остановлен');
    }
    let timer;
    const timedOut = await Promise.race([
      this.#stopped.then(() => false),
      new Promise((resolve) => { timer = setTimeout(() => resolve(true), timeoutMs); }),
    ]);
    clearTimeout(timer);
    if (timedOut) {
      logEvent('stop не подтвердился', `беру ${this.#chunks.length} фрагментов, ${Math.round(this.#bytes / 1024)} КБ`);
    }
    if (this.#chunks.length === 0) return null;
    return new Blob(this.#chunks, { type: this.#mimeType });
  }
}

function describeTrack(track) {
  return `${track.readyState}${track.muted ? ', MUTED' : ''}${track.enabled ? '' : ', disabled'}`;
}
