import { useCallback, useEffect, useRef, useState } from 'react';
import pdfjsLib from './pdfjs.js';
import PdfPage from './PdfPage.jsx';
import { buildEditedPdf } from './savePdf.js';
import { OpenIcon, TextIcon, PenIcon, UndoIcon, SaveIcon } from './icons.jsx';

const FONT_SIZES = [8, 10, 12, 14, 16, 18, 24, 32, 48];
const STROKE_WIDTHS = [1, 2, 3, 5, 8, 12];

export default function App() {
  const [file, setFile] = useState(null); // { name, bytes }
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pages, setPages] = useState([]);
  const [tool, setTool] = useState(null); // 'text' | 'draw' | null
  const [color, setColor] = useState('#1a1a1a');
  const [fontSize, setFontSize] = useState(14);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [activeId, setActiveId] = useState(null);
  const [history, setHistory] = useState([]); // ids of added items, newest last
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [width, setWidth] = useState(800);
  const [docKey, setDocKey] = useState(0);
  const inputRef = useRef(null);
  const mainRef = useRef(null);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(200, e.contentRect.width - 32)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const openFile = useCallback(async (f) => {
    if (!f) return;
    setError('');
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      // pdf.js takes ownership of the buffer it gets, so give it a copy.
      const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
      setPdfDoc((old) => {
        old?.destroy();
        return doc;
      });
      setFile({ name: f.name, bytes });
      setDocKey((k) => k + 1);
      setPages(Array.from({ length: doc.numPages }, () => ({ rotation: 0, texts: [], strokes: [] })));
      setHistory([]);
      setActiveId(null);
      mainRef.current?.scrollTo(0, 0);
    } catch (e) {
      setError(`Could not open file: ${e.message}`);
    }
  }, []);

  const updatePage = useCallback(
    (i, fn) => setPages((ps) => ps.map((p, j) => (j === i ? fn(p) : p))),
    [],
  );

  const undo = () => {
    const ids = [...history];
    // Skip ids of items that were already removed (e.g. empty text boxes).
    while (ids.length) {
      const id = ids.pop();
      const has = (p) => p.texts.some((t) => t.id === id) || p.strokes.some((s) => s.id === id);
      if (pages.some(has)) {
        setPages((ps) =>
          ps.map((p) =>
            has(p)
              ? { ...p, texts: p.texts.filter((t) => t.id !== id), strokes: p.strokes.filter((s) => s.id !== id) }
              : p,
          ),
        );
        break;
      }
    }
    setHistory(ids);
  };

  useEffect(() => {
    const onKey = (e) => {
      const typing = e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Toolbar color / size also restyle the selected text box.
  const patchActive = (patch) => {
    if (!activeId) return;
    setPages((ps) =>
      ps.map((p) =>
        p.texts.some((t) => t.id === activeId)
          ? { ...p, texts: p.texts.map((t) => (t.id === activeId ? { ...t, ...patch } : t)) }
          : p,
      ),
    );
  };

  const save = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError('');
    try {
      const out = await buildEditedPdf(file.bytes, pages);
      const url = URL.createObjectURL(new Blob([out], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.replace(/\.pdf$/i, '') + '-edited.pdf';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(`Could not save: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const toggleTool = (t) => setTool((cur) => (cur === t ? null : t));

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = [...e.dataTransfer.files].find((x) => x.type === 'application/pdf' || /\.pdf$/i.test(x.name));
    if (f) openFile(f);
  };

  return (
    <div
      className={`app${dragOver ? ' drag-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragOver(false)}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          openFile(e.target.files[0]);
          e.target.value = '';
        }}
      />

      <header className="toolbar">
        <button className="icon-btn" title="Open PDF" onClick={() => inputRef.current.click()}>
          <OpenIcon />
        </button>
        {file && <span className="file-name" title={file.name}>{file.name}</span>}

        <div className="tools">
          <button
            className={`icon-btn${tool === 'text' ? ' on' : ''}`}
            title="Add text"
            disabled={!file}
            onClick={() => toggleTool('text')}
          >
            <TextIcon />
          </button>
          <button
            className={`icon-btn${tool === 'draw' ? ' on' : ''}`}
            title="Draw"
            disabled={!file}
            onClick={() => toggleTool('draw')}
          >
            <PenIcon />
          </button>
          <span className="sep" />
          <label className="color" title="Color">
            <input
              type="color"
              value={color}
              disabled={!file}
              onChange={(e) => {
                setColor(e.target.value);
                patchActive({ color: e.target.value });
              }}
            />
          </label>
          {tool === 'draw' ? (
            <select
              title="Line width"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
            >
              {STROKE_WIDTHS.map((w) => (
                <option key={w} value={w}>
                  {w} px
                </option>
              ))}
            </select>
          ) : (
            <select
              title="Font size"
              value={fontSize}
              disabled={!file}
              onChange={(e) => {
                setFontSize(Number(e.target.value));
                patchActive({ size: Number(e.target.value) });
              }}
            >
              {FONT_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s} pt
                </option>
              ))}
            </select>
          )}
          <span className="sep" />
          <button className="icon-btn" title="Undo (Ctrl+Z)" disabled={!history.length} onClick={undo}>
            <UndoIcon />
          </button>
        </div>

        <button className="save-btn" disabled={!file || busy} onClick={save} title="Save (Ctrl+S)">
          <SaveIcon />
          <span>{busy ? 'Saving…' : 'Save'}</span>
        </button>
      </header>

      {error && (
        <div className="error" onClick={() => setError('')}>
          {error}
        </div>
      )}

      <main ref={mainRef} className="viewer">
        {!pdfDoc ? (
          <div className="empty">
            <button className="open-big" onClick={() => inputRef.current.click()}>
              Open PDF
            </button>
            <p>or drop a file here</p>
          </div>
        ) : (
          pages.map((state, i) => (
            <PdfPage
              key={`${docKey}-${i}`}
              pdfDoc={pdfDoc}
              index={i}
              state={state}
              width={width}
              tool={tool}
              color={color}
              fontSize={fontSize}
              strokeWidth={strokeWidth}
              activeId={activeId}
              setActiveId={setActiveId}
              onChange={(fn) => updatePage(i, fn)}
              onAdded={(id) => setHistory((h) => [...h, id])}
            />
          ))
        )}
      </main>
    </div>
  );
}
