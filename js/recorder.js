// js/recorder.js
import { pickSupportedMimeType } from './mime.js';

export class Recorder {
  #mediaRecorder = null;
  #chunks = [];
  #mimeType = null;

  constructor(stream) {
    this.#mimeType = pickSupportedMimeType(
      (type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)
    );
    if (!this.#mimeType) {
      throw new Error('No supported recording format on this browser');
    }
    this.#mediaRecorder = new MediaRecorder(stream, { mimeType: this.#mimeType });
    this.#mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.#chunks.push(e.data);
    };
  }

  get canPause() {
    return typeof this.#mediaRecorder.pause === 'function';
  }

  start() {
    this.#chunks = [];
    this.#mediaRecorder.start();
  }

  pause() {
    this.#mediaRecorder.pause();
  }

  resume() {
    this.#mediaRecorder.resume();
  }

  /** Resolves with the recorded Blob once the recorder has flushed. */
  stop() {
    return new Promise((resolve) => {
      this.#mediaRecorder.onstop = () => {
        resolve(new Blob(this.#chunks, { type: this.#mimeType }));
      };
      this.#mediaRecorder.stop();
    });
  }
}
