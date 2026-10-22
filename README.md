# PDF Easy Editor

Minimal in-browser PDF editor (Vite + React). Nothing is uploaded — all work happens locally.

```
npm install
npm run dev
```

- **Open** – toolbar button or drag & drop a PDF
- **Text** – click on a page to add a text field; hover it to move (✥) or delete (×)
- **Draw** – freehand pen; color and line width in the toolbar
- **Rotate** – ↺ / ↻ above each page rotates only that page
- **Undo** – Ctrl+Z, **Save** – Ctrl+S (downloads `<name>-edited.pdf`)

Rendering: pdf.js · Saving: pdf-lib (DejaVu Sans embedded, so Cyrillic etc. work).
