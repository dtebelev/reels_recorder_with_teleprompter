// js/recorder.js
import { pickSupportedMimeType } from './mime.js';
import { logEvent } from './diagnostics.js';

// Emit data periodically instead of buffering the whole take until stop().
// Two reasons: a take that dies partway still has everything up to that
// point, and the chunk timeline in the diagnostics log shows whether the
// recorder kept producing data through a freeze.
const TIMESLICE_MS = 1000;

export class Recorder {
  #mediaRecorder = null;
  #chunks = [];
  #mimeType = null;
  #bytes = 0;
  #stopRequested = false;
  #resolveStopped = () => {};
  #stopped = new Promise((resolve) => { this.#resolveStopped = resolve; });

  constructor(stream) {
    this.#mimeType = pickSupportedMimeType(
      (type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)
    );
    if (!this.#mimeType) {
      throw new Error('No supported recording format on this browser');
    }
    logEvent('формат', this.#mimeType);
    this.#watchTracks(stream);

    this.#mediaRecorder = new MediaRecorder(stream, { mimeType: this.#mimeType });
    this.#mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.#chunks.push(e.data);
        this.#bytes += e.data.size;
      }
    };
    this.#mediaRecorder.onerror = (e) => {
      logEvent('ОШИБКА РЕКОРДЕРА', e?.error?.name ?? e?.error ?? 'неизвестно');
    };
    // Registered up front, not inside stop(): iOS can stop the recorder on
    // its own (camera interrupted, track ended) long before the user taps
    // Стоп, and that `stop` event would otherwise be missed — leaving stop()
    // waiting forever on an event that already happened.
    this.#mediaRecorder.onstop = () => {
      if (!this.#stopRequested) logEvent('РЕКОРДЕР ОСТАНОВИЛСЯ САМ');
      logEvent('запись остановлена', `${this.#chunks.length} фрагментов, ${Math.round(this.#bytes / 1024)} КБ`);
      this.#resolveStopped();
    };
  }

  /** A video track that goes `mute` stops delivering frames while the
   * stream stays "live" — that's what a frozen picture with continuing
   * audio looks like from JS, and it's the single most useful signal for
   * telling an OS/camera-side stall apart from an encoding problem. */
  #watchTracks(stream) {
    const [videoTrack] = stream.getVideoTracks();
    if (videoTrack) {
      const s = typeof videoTrack.getSettings === 'function' ? videoTrack.getSettings() : {};
      logEvent('видеодорожка', `${s.width ?? '?'}x${s.height ?? '?'} @${s.frameRate ?? '?'}fps`);
      videoTrack.addEventListener('mute', () => logEvent('ВИДЕОДОРОЖКА ЗАМОЛЧАЛА (mute)'));
      videoTrack.addEventListener('unmute', () => logEvent('видеодорожка возобновилась'));
      videoTrack.addEventListener('ended', () => logEvent('ВИДЕОДОРОЖКА ЗАВЕРШИЛАСЬ (ended)'));
    } else {
      logEvent('ВНИМАНИЕ', 'в потоке нет видеодорожки');
    }

    const [audioTrack] = stream.getAudioTracks();
    if (audioTrack) {
      audioTrack.addEventListener('mute', () => logEvent('аудиодорожка mute'));
      audioTrack.addEventListener('ended', () => logEvent('аудиодорожка ended'));
    }
  }

  get canPause() {
    return typeof this.#mediaRecorder.pause === 'function';
  }

  start() {
    this.#chunks = [];
    this.#bytes = 0;
    this.#mediaRecorder.start(TIMESLICE_MS);
    logEvent('запись начата');
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
