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
    this.#mediaRecorder.pause();
    logEvent('пауза');
  }

  resume() {
    this.#mediaRecorder.resume();
    logEvent('продолжение');
  }

  /** Resolves with the recorded Blob once the recorder has flushed. */
  stop() {
    return new Promise((resolve) => {
      this.#mediaRecorder.onstop = () => {
        logEvent('запись остановлена', `${this.#chunks.length} фрагментов, ${Math.round(this.#bytes / 1024)} КБ`);
        resolve(new Blob(this.#chunks, { type: this.#mimeType }));
      };
      this.#mediaRecorder.stop();
    });
  }
}
