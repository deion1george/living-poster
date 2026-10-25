// Reads QR codes off camera frames without blocking the AR loop.
import jsQR from 'jsqr';

self.onmessage = ({ data: { id, width, height, pixels } }) => {
  const code = jsQR(new Uint8ClampedArray(pixels), width, height, { inversionAttempts: 'dontInvert' });
  self.postMessage({ id, text: code?.data ?? null });
};
