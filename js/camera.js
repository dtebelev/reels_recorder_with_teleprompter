// js/camera.js
export class CameraError extends Error {
  constructor(cause) {
    super('Camera unavailable');
    this.cause = cause;
  }
}

export async function acquireFrontCameraStream() {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1920 } },
      audio: true,
    });
  } catch (err) {
    throw new CameraError(err);
  }
}

export function stopStream(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}
