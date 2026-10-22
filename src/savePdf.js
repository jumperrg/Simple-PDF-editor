import {
  PDFDocument,
  degrees,
  rgb,
  LineCapStyle,
  TextRenderingMode,
  pushGraphicsState,
  popGraphicsState,
  setTextRenderingMode,
  setCharacterSqueeze,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { loadFontBytes, LINE_HEIGHT } from './font.js';

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/**
 * Applies the edits to the original PDF bytes and returns the new PDF bytes.
 * All annotation coordinates are stored in PDF user space, so they map 1:1.
 */
export async function buildEditedPdf(originalBytes, pages) {
  const doc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
  doc.registerFontkit(fontkit);

  const needsFont = pages.some((p) => p.texts.some((t) => t.text.trim()) || p.ocr?.lines.length);
  let font, baseline, ascent, descent;
  if (needsFont) {
    const fontBytes = await loadFontBytes();
    font = await doc.embedFont(fontBytes, { subset: true });
    // Distance from the top of a CSS line box to the first baseline (in em),
    // matching how the browser lays out the text on screen.
    const fk = fontkit.create(new Uint8Array(fontBytes));
    ascent = fk.ascent / fk.unitsPerEm;
    descent = -fk.descent / fk.unitsPerEm;
    baseline = (LINE_HEIGHT - (ascent + descent)) / 2 + ascent;
  }

  const pdfPages = doc.getPages();
  pages.forEach((state, i) => {
    const page = pdfPages[i];
    if (!page) return;

    if (state.rotation) {
      page.setRotation(degrees((page.getRotation().angle + state.rotation) % 360));
    }

    for (const s of state.strokes) {
      if (!s.points.length) continue;
      // drawSvgPath flips the y axis, so negate y to stay in user space.
      const path = s.points
        .map(([x, y], j) => `${j ? 'L' : 'M'}${x} ${-y}`)
        .join(' ');
      const d = s.points.length === 1 ? `${path} L${s.points[0][0]} ${-s.points[0][1]}` : path;
      page.drawSvgPath(d, {
        x: 0,
        y: 0,
        borderColor: hexToRgb(s.color),
        borderWidth: s.width,
        borderLineCap: LineCapStyle.Round,
      });
    }

    // Recognized text of scanned pages: invisible but selectable/searchable.
    for (const l of state.ocr?.lines ?? []) {
      const size = l.h / (ascent + descent);
      const rad = (state.ocr.angle * Math.PI) / 180;
      const off = ascent * size;
      let natural;
      try {
        natural = font.widthOfTextAtSize(l.text, size);
      } catch {
        continue; // characters the font can't encode
      }
      page.pushOperators(
        pushGraphicsState(),
        setTextRenderingMode(TextRenderingMode.Invisible),
        setCharacterSqueeze((100 * l.w) / (natural || 1)),
      );
      page.drawText(l.text, {
        x: l.x + off * Math.sin(rad),
        y: l.y - off * Math.cos(rad),
        size,
        font,
        rotate: degrees(state.ocr.angle),
      });
      page.pushOperators(popGraphicsState());
    }

    for (const t of state.texts) {
      const text = t.text.replace(/\r/g, '').replace(/\t/g, '    ');
      if (!text.trim()) continue;
      const rad = (t.angle * Math.PI) / 180;
      const off = baseline * t.size;
      page.drawText(text, {
        x: t.x + off * Math.sin(rad),
        y: t.y - off * Math.cos(rad),
        size: t.size,
        font,
        color: hexToRgb(t.color),
        lineHeight: t.size * LINE_HEIGHT,
        rotate: degrees(t.angle),
      });
    }
  });

  return doc.save();
}
