// js/camera.js
export class CameraError extends Error {
  constructor(cause) {
    super('Camera unavailable');
    this.cause = cause;
  }
}

/**
 * Camera profiles offered in Settings.
 *
 * Resolution and field of view pull against each other on a phone's front
 * camera, and how they trade off is device-specific — so this is a choice
 * the person makes and verifies, not something guessed here. Two attempts
 * to simply pick a "better" resolution both shipped regressions (a
 * zoomed-in frame once, a sideways-recorded file the next time), which is
 * exactly why these are selectable and why the ⓘ diagnostics panel reports
 * the finished file's real dimensions.
 *
 * `wide` asks for nothing at all and takes the camera's default — on the
 * device this was built against that's 480x640: low-resolution, but the
 * widest framing and the only profile confirmed to record right-side-up.
 * The 16:9 profiles are typically the camera's own high-resolution video
 * modes, and are already the shape Reels/Shorts want — but on a 4:3 sensor
 * they're produced by cropping, so expect a tighter frame.
 */
export const QUALITY_PROFILES = {
  wide: {},
  hd: { width: { ideal: 720 }, height: { ideal: 1280 } },
  max: { width: { ideal: 1080 }, height: { ideal: 1920 } },
};

export async function acquireFrontCameraStream(quality = 'wide') {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', ...(QUALITY_PROFILES[quality] ?? {}) },
      audio: true,
    });
  } catch (err) {
    throw new CameraError(err);
  }
}

export function stopStream(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}
