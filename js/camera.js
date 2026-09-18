// js/camera.js
export class CameraError extends Error {
  constructor(cause) {
    super('Camera unavailable');
    this.cause = cause;
  }
}

export async function acquireFrontCameraStream() {
  try {
    // No explicit width/height: asking for a specific (tall) resolution
    // makes some browsers pick a digitally-cropped/zoomed-in readout from
    // the sensor to hit that exact aspect ratio, instead of the sensor's
    // natural wide field of view the native camera app uses. Letting the
    // browser choose its default resolution and relying on CSS
    // (object-fit: cover) to fit the preview to the screen matches the
    // native camera's framing much more closely.
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: true,
    });
  } catch (err) {
    throw new CameraError(err);
  }
}

export function stopStream(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}
