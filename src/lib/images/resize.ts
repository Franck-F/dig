/**
 * Browser-side image resize → JPEG data URL.
 *
 * Reads a `File`, draws it cover-fit on a `size × size` canvas, and
 * returns the result as a JPEG data URL at 0.85 quality. The same
 * helper backs every avatar / photo upload in the app (mentor profile,
 * mentee onboarding, community settings) so the visual contract — a
 * square crop, white background fill, JPEG compression — stays
 * consistent everywhere.
 *
 * Client-only. Will throw "no canvas context" on environments that
 * don't expose `<canvas>` (which shouldn't happen in any modern
 * browser; the throw is defensive). Caller is responsible for
 * MIME-type checks before calling — this helper assumes the input
 * is already an image.
 */
export function resizeImageToDataUrl(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('image load'));
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('no canvas context'));
            return;
          }
          const ratio = Math.max(size / img.width, size / img.height);
          const w = img.width * ratio;
          const h = img.height * ratio;
          const dx = (size - w) / 2;
          const dy = (size - h) / 2;
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, size, size);
          ctx.drawImage(img, dx, dy, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch (e) {
          reject(e);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
