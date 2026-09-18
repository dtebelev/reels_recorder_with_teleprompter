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
  // Kept in the DOM (off-screen, invisible) rather than detached: some
  // mobile browsers pause/never start decoding a <video> that's never
  // attached, even when scripted with a live MediaStream.
  video.style.cssText = 'position:absolute; width:1px; height:1px; opacity:0; pointer-events:none;';
  document.body.appendChild(video);
  video.play().catch(() => {});

  const ctx = canvas.getContext('2d');
  let rafId = null;

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

  function tick() {
    resizeCanvasToDisplaySize();
    drawCoverFrame();
    rafId = requestAnimationFrame(tick);
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
  rafId = requestAnimationFrame(tick);

  const canvasStream = canvas.captureStream(30);
  sourceStream.getAudioTracks().forEach((track) => canvasStream.addTrack(track));

  return {
    stream: canvasStream,
    stop() {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      window.removeEventListener('resize', resizeCanvasToDisplaySize);
      video.pause();
      video.srcObject = null;
      video.remove();
    },
  };
}
