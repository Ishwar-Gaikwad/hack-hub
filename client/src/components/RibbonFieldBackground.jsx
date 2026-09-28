import { useEffect, useRef } from 'react';

const COLORS = [
  { at: 0.0432, color: [255, 255, 255] },
  { at: 0.3318, color: [255, 255, 255] },
  { at: 0.3786, color: [120, 184, 249] },
  { at: 0.5814, color: [120, 184, 249] },
  { at: 0.5886, color: [86, 103, 255] },
  { at: 0.7964, color: [86, 103, 255] },
  { at: 0.8, color: [77, 47, 249] },
  { at: 1, color: [77, 47, 249] }
];

function writeColorAt(position, pixels, pixel) {
  const value = Math.max(0, Math.min(1, position));
  let low = 0;
  let high = COLORS.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (COLORS[middle].at < value) low = middle;
    else high = middle;
  }
  const lower = COLORS[low];
  const upper = COLORS[high];
  const span = upper.at - lower.at;
  const amount = span === 0 ? 1 : (value - lower.at) / span;
  pixels[pixel] = lower.color[0] + (upper.color[0] - lower.color[0]) * amount;
  pixels[pixel + 1] = lower.color[1] + (upper.color[1] - lower.color[1]) * amount;
  pixels[pixel + 2] = lower.color[2] + (upper.color[2] - lower.color[2]) * amount;
  pixels[pixel + 3] = 235;
}

export default function RibbonFieldBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { alpha: true });
    if (!canvas || !context) return undefined;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frameId;
    let lastFrame = 0;
    let startedAt;
    let imageData;
    let pixelWidth = 0;
    let pixelHeight = 0;

    const resize = () => {
      // Render at a lower resolution and let CSS scale it for a lightweight full-screen field.
      const renderScale = 0.5;
      pixelWidth = Math.max(1, Math.ceil(window.innerWidth * renderScale));
      pixelHeight = Math.max(1, Math.ceil(window.innerHeight * renderScale));
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      imageData = context.createImageData(pixelWidth, pixelHeight);
    };

    const render = (timestamp) => {
      startedAt ??= timestamp;
      if (!reducedMotion.matches && timestamp - lastFrame < 1000 / 30) {
        frameId = window.requestAnimationFrame(render);
        return;
      }
      lastFrame = timestamp;

      const elapsed = (timestamp - startedAt) / 1000;
      const ph = elapsed * 1.0;
      const amt = 0.0;
      const dir = 1;
      const spin = ph * dir;
      const angle = 38 + Math.sin(spin * 0.6) * 28 * amt;
      const radians = (angle * Math.PI) / 180;
      const axisX = Math.sin(radians);
      const axisY = -Math.cos(radians);
      const crossX = Math.cos(radians);
      const crossY = Math.sin(radians);
      const centerX = pixelWidth * 0.5;
      const centerY = pixelHeight * 0.5;
      const corners = [
        [0, 0], [pixelWidth, 0], [0, pixelHeight], [pixelWidth, pixelHeight]
      ].map(([x, y]) => (x - centerX) * axisX + (y - centerY) * axisY);
      const minProjection = Math.min(...corners);
      const projectionSpan = Math.max(1, Math.max(...corners) - minProjection);
      const crossSpan = Math.max(1, Math.hypot(pixelWidth, pixelHeight));
      const waveClock = 20.75 + ph * 1.2;
      const pixels = imageData.data;

      for (let y = 0; y < pixelHeight; y += 1) {
        const centeredY = y - centerY;
        for (let x = 0; x < pixelWidth; x += 1) {
          const centeredX = x - centerX;
          const projection = centeredX * axisX + centeredY * axisY;
          const cross = ((centeredX * crossX + centeredY * crossY) / crossSpan) + 0.5;
          const waveOffset = (14 / 100) * 0.35 * Math.sin(cross * 2.4 * 2 * Math.PI + waveClock);
          const normalized = (projection - minProjection) / projectionSpan + waveOffset;
          const pixel = (y * pixelWidth + x) * 4;
          writeColorAt(normalized, pixels, pixel);
        }
      }

      context.putImageData(imageData, 0, 0);
      if (!reducedMotion.matches) frameId = window.requestAnimationFrame(render);
    };

    const onMotionPreferenceChange = () => {
      window.cancelAnimationFrame(frameId);
      startedAt = undefined;
      lastFrame = 0;
      frameId = window.requestAnimationFrame(render);
    };

    const onResize = () => {
      resize();
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(render);
    };

    resize();
    frameId = window.requestAnimationFrame(render);
    window.addEventListener('resize', onResize, { passive: true });
    reducedMotion.addEventListener?.('change', onMotionPreferenceChange);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      reducedMotion.removeEventListener?.('change', onMotionPreferenceChange);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="ribbon-field-canvas" />;
}
