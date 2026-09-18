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
    // browser choose its default resolution and doing our own cover-crop
    // to the screen (see mirrorToCanvas) matches the native camera's
    // framing much more closely.
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

/**
 * Draws a mirrored, cropped-to-fill copy of `sourceStream`'s video onto
 * `canvas`, continuously, so what's on screen and what gets recorded are
 * pixel-identical (recording straight from the camera track while only
 * mirroring the on-screen `<video>` via CSS meant the saved file didn't
 * match what the person saw while framing the shot). Returns a MediaStream
 * (canvas video track + the source's audio track(s)) suitable for
 * MediaRecorder, plus a `stop()` to release the hidden helper `<video>`
 * this creates internally.
 */
export function mirrorToCanvas(sourceStream, canvas) {
  const video = document.createElement('video');
  video.srcObject = sourceStream;
  video.muted = true;
  video.playsInline = true;
  // Kept in the DOM at full/real size, nearly (not fully) transparent, and
  // stacked behind the visible canvas — NOT shrunk to 1x1px with
  // opacity:0. That combination gets treated as "not actually visible" by
  // iOS Safari's power-saving heuristics, which silently stop decoding new
  // frames into a video like that after a few seconds (audio keeps playing
  // since it's an unrelated track) — the exact "video freezes ~5s in,
  // audio plays to the end" symptom this caused during a real recording.
  video.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; opacity:0.01; z-index:-1; pointer-events:none;';
  document.body.appendChild(video);
  video.play().catch(() => {});

  const ctx = canvas.getContext('2d');
  let frameHandle = null;
  let stopped = false;
  // requestVideoFrameCallback fires once per actual new camera frame
  // (matching the camera's real capture rate, typically ~30fps); plain
  // requestAnimationFrame fires at the display's refresh rate, which on
  // newer iPhones (ProMotion, up to 120Hz) redraws and re-encodes far more
  // often than needed — extra CPU load that risked destabilizing longer
  // recordings. Fall back to rAF where rVFC isn't available.
  const useVideoFrameCallback = typeof video.requestVideoFrameCallback === 'function';

  function resizeCanvasToDisplaySize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round((rect.width || canvas.clientWidth || 1) * dpr);
    const height = Math.round((rect.height || canvas.clientHeight || 1) * dpr);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  }

  function drawCoverFrame() {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const cw = canvas.width;
    const ch = canvas.height;
    if (!vw || !vh || !cw || !ch) return;

    // Crop the source frame to the canvas's aspect ratio (like CSS
    // object-fit: cover) before drawing, so on-screen framing and the
    // recorded frame match exactly.
    const videoRatio = vw / vh;
    const canvasRatio = cw / ch;
    let sx, sy, sw, sh;
    if (videoRatio > canvasRatio) {
      sh = vh;
      sw = vh * canvasRatio;
      sx = (vw - sw) / 2;
      sy = 0;
    } else {
      sw = vw;
      sh = vw / canvasRatio;
      sx = 0;
      sy = (vh - sh) / 2;
    }

    ctx.save();
    ctx.translate(cw, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, cw, ch);
    ctx.restore();
  }

  function scheduleNextFrame() {
    if (stopped) return;
    if (useVideoFrameCallback) {
      frameHandle = video.requestVideoFrameCallback(onFrame);
    } else {
      frameHandle = requestAnimationFrame(onFrame);
    }
  }

  function onFrame() {
    resizeCanvasToDisplaySize();
    drawCoverFrame();
    scheduleNextFrame();
  }

  video.addEventListener('loadedmetadata', () => {
    resizeCanvasToDisplaySize();
  });
  window.addEventListener('resize', resizeCanvasToDisplaySize);

  // Size the canvas to its real on-screen (portrait) dimensions *before*
  // capturing a stream from it. captureStream() locks in whatever the
  // canvas's width/height happen to be at that exact call — if that's
  // still the HTML default (300x150, landscape), the recording comes out
  // squished, because later frames get drawn at the correct portrait size
  // into a track whose declared dimensions never updated to match.
  resizeCanvasToDisplaySize();
  scheduleNextFrame();

  const canvasStream = canvas.captureStream(30);
  sourceStream.getAudioTracks().forEach((track) => canvasStream.addTrack(track));

  return {
    stream: canvasStream,
    stop() {
      stopped = true;
      if (frameHandle !== null) {
        if (useVideoFrameCallback) video.cancelVideoFrameCallback(frameHandle);
        else cancelAnimationFrame(frameHandle);
      }
      frameHandle = null;
      window.removeEventListener('resize', resizeCanvasToDisplaySize);
      video.pause();
      video.srcObject = null;
      video.remove();
    },
  };
}
