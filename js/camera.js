// js/camera.js
export class CameraError extends Error {
  constructor(cause) {
    super('Camera unavailable');
    this.cause = cause;
  }
}

export async function acquireFrontCameraStream() {
  try {
    // Reverted an attempt to raise resolution while keeping the camera's
    // native 3:4 shape (width:1080/height:1440 "ideal"): it reintroduced
    // both a zoomed-in frame AND a sideways-recorded output file. The
    // camera's default negotiated mode (no explicit width/height at all)
    // is the one actually confirmed, via the diagnostics panel, to record
    // a correctly-oriented, correctly-framed portrait file (480x640) — see
    // docs/HANDOFF.md. Lower resolution is a real trade-off, but a correct
    // 480x640 clip beats a sideways or over-zoomed 1080x1440 one. If
    // resolution is revisited, raise it in small steps and confirm both
    // orientation and framing via the ⓘ diagnostics panel after each step,
    // not all at once.
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
