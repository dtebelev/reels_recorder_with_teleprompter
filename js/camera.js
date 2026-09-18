// js/camera.js
export class CameraError extends Error {
  constructor(cause) {
    super('Camera unavailable');
    this.cause = cause;
  }
}

export async function acquireFrontCameraStream() {
  try {
    // 3:4 on purpose — that's the front camera's own native aspect ratio
    // (it was handing back 480x640 when asked for nothing at all). Asking
    // for a *taller* 9:16 frame instead makes the browser digitally crop
    // into the sensor to produce it, which is what made an earlier version
    // look far more zoomed-in than the native camera app. Same shape,
    // higher resolution: better detail, identical field of view. `ideal`
    // rather than `exact` so a device that can't manage it degrades
    // instead of failing outright. The screen crop to 9:16 happens in CSS
    // (object-fit: cover) on the preview.
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1440 } },
      audio: true,
    });
  } catch (err) {
    throw new CameraError(err);
  }
}

export function stopStream(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}
