// OCR for scanned pages. Tesseract (and its language data) is loaded on first
// use only, from the CDN, so it costs nothing until someone needs it.
const LANGS = ['eng', 'rus'];
const OCR_SCALE = 3; // ~216 dpi

let workerPromise;
function getWorker() {
  workerPromise ??= import('tesseract.js').then(({ createWorker }) => createWorker(LANGS));
  return workerPromise;
}

/**
 * Recognizes the text of a page as it is currently displayed (so a scan that
 * was rotated upright reads correctly). Returns lines in PDF user space.
 */
export async function recognizePage(page, rotation) {
  const viewport = page.getViewport({ scale: OCR_SCALE, rotation });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise;

  const worker = await getWorker();
  const { data } = await worker.recognize(canvas, {}, { blocks: true });
  canvas.width = canvas.height = 0;

  const lines = [];
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs) {
      for (const line of para.lines) {
        const text = line.text.replace(/\s+/g, ' ').trim();
        if (!text || line.confidence < 30) continue;
        const { x0, y0, x1, y1 } = line.bbox;
        const [x, y] = viewport.convertToPdfPoint(x0, y0);
        lines.push({ text, x, y, w: (x1 - x0) / OCR_SCALE, h: (y1 - y0) / OCR_SCALE });
      }
    }
  }
  return { angle: rotation, lines };
}
