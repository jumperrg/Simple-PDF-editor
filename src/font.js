// One font is used both on screen and in the saved PDF, so text looks the
// same in both places and non-Latin scripts (e.g. Cyrillic) are supported.
import fontUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url';

export const FONT_FAMILY = 'EditorSans';
export const LINE_HEIGHT = 1.2;

const face = new FontFace(FONT_FAMILY, `url(${fontUrl})`);
document.fonts.add(face);
face.load().catch(() => {});

let bytesPromise;
export function loadFontBytes() {
  bytesPromise ??= fetch(fontUrl).then((r) => r.arrayBuffer());
  return bytesPromise;
}
