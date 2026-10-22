import { useEffect, useMemo, useRef, useState } from 'react';
import pdfjsLib from './pdfjs.js';
import { FONT_FAMILY, LINE_HEIGHT } from './font.js';
import { recognizePage } from './ocr.js';
import { RotateLeftIcon, RotateRightIcon, MoveIcon, CloseIcon, ScanIcon } from './icons.jsx';

const MAX_SCALE = 1.6;
const SNAP_PX = 6;
let nextId = 1;
const uid = () => `a${nextId++}`;

export default function PdfPage({
  pdfDoc,
  index,
  state,
  width,
  tool,
  color,
  fontSize,
  strokeWidth,
  activeId,
  setActiveId,
  onChange,
  onAdded,
}) {
  const [page, setPage] = useState(null);
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState(null);
  const [guides, setGuides] = useState(null); // { x?, y? } in screen px
  const [hasText, setHasText] = useState(null); // does the PDF page carry real text?
  const [ocrBusy, setOcrBusy] = useState(false);
  const textLayerRef = useRef(null);
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    let alive = true;
    pdfDoc.getPage(index + 1).then((p) => alive && setPage(p));
    return () => {
      alive = false;
    };
  }, [pdfDoc, index]);

  // Only render pages near the viewport.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), {
      rootMargin: '800px 0px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const rotation = page ? (page.rotate + state.rotation) % 360 : 0;
  const viewport = useMemo(() => {
    if (!page) return null;
    const base = page.getViewport({ scale: 1, rotation });
    return page.getViewport({ scale: Math.min(MAX_SCALE, width / base.width), rotation });
  }, [page, rotation, width]);

  useEffect(() => {
    if (!page || !viewport || !visible) return;
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    const task = page.render({
      canvas,
      canvasContext: canvas.getContext('2d'),
      viewport,
      transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
    });
    task.promise.catch(() => {});
    return () => task.cancel();
  }, [page, viewport, visible]);

  // Invisible, selectable text from the PDF itself, positioned over the canvas.
  useEffect(() => {
    if (!page || !viewport || !visible) return;
    const container = textLayerRef.current;
    container.replaceChildren();
    const layer = new pdfjsLib.TextLayer({
      textContentSource: page.streamTextContent(),
      container,
      viewport,
    });
    layer
      .render()
      .then(() => setHasText(layer.textContentItemsStr.some((t) => t.trim())))
      .catch(() => {});
    return () => layer.cancel();
  }, [page, viewport, visible]);

  const runOcr = async () => {
    setOcrBusy(true);
    try {
      const ocr = await recognizePage(page, rotation);
      onChange((s) => ({ ...s, ocr }));
    } catch (e) {
      console.error(e);
      alert(`Text recognition failed: ${e.message}`);
    } finally {
      setOcrBusy(false);
    }
  };

  const localPoint = (e) => {
    const r = overlayRef.current.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const toPdf = (pt) => viewport.convertToPdfPoint(pt[0], pt[1]);

  const rotate = (delta) => onChange((s) => ({ ...s, rotation: (s.rotation + delta + 360) % 360 }));

  const updateText = (id, patch) =>
    onChange((s) => ({ ...s, texts: s.texts.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  const removeText = (id) => onChange((s) => ({ ...s, texts: s.texts.filter((t) => t.id !== id) }));

  // Magnet: pull a text box's top-left onto the edges of other boxes nearby.
  const snap = (id, angle, sx, sy, off) => {
    const g = {};
    if (!off) {
      let bx = SNAP_PX, by = SNAP_PX;
      for (const t of state.texts) {
        if (t.id === id || t.angle !== angle) continue;
        const [ox, oy] = viewport.convertToViewportPoint(t.x, t.y);
        if (Math.abs(ox - sx) < bx) (bx = Math.abs(ox - sx)), (g.x = ox);
        if (Math.abs(oy - sy) < by) (by = Math.abs(oy - sy)), (g.y = oy);
      }
    }
    return { sx: g.x ?? sx, sy: g.y ?? sy, guides: g };
  };

  const onPointerDown = (e) => {
    if (e.target !== overlayRef.current && tool !== 'draw') return;
    if (e.button !== 0) return;
    if (tool === 'draw') {
      e.preventDefault();
      overlayRef.current.setPointerCapture(e.pointerId);
      setDraft({ id: uid(), color, width: strokeWidth, points: [toPdf(localPoint(e))] });
    } else if (tool === 'text') {
      e.preventDefault();
      // The I-beam cursor's hotspot is its middle, so center the first line on it.
      const [px, py] = localPoint(e);
      const id = uid();
      const p = snap(id, rotation, px, py - (fontSize * viewport.scale * LINE_HEIGHT) / 2, e.altKey);
      const [x, y] = toPdf([p.sx, p.sy]);
      const t = { id, x, y, text: '', size: fontSize, color, angle: rotation, fresh: true };
      onChange((s) => ({ ...s, texts: [...s.texts, t] }));
      onAdded(t.id);
      setActiveId(t.id);
    } else {
      setActiveId(null);
    }
  };

  const onPointerMove = (e) => {
    if (!draft) return;
    const p = toPdf(localPoint(e));
    setDraft((d) => d && { ...d, points: [...d.points, p] });
  };

  const onPointerUp = () => {
    if (!draft) return;
    const stroke = draft;
    setDraft(null);
    onChange((s) => ({ ...s, strokes: [...s.strokes, stroke] }));
    onAdded(stroke.id);
  };

  const size = viewport ? { width: viewport.width, height: viewport.height } : { width, height: width * 1.3 };
  const scale = viewport?.scale ?? 1;

  const strokePath = (s) =>
    s.points
      .map((p, j) => {
        const [x, y] = viewport.convertToViewportPoint(p[0], p[1]);
        return `${j ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ') + (s.points.length === 1 ? ' l0.01 0' : '');

  return (
    <div className="page-wrap" ref={wrapRef}>
      <div className="page-bar">
        <span className="page-num">{index + 1}</span>
        {hasText === false && !state.ocr && (
          <button className="text-btn" disabled={ocrBusy} onClick={runOcr} title="Make the text of this scanned page selectable">
            <ScanIcon />
            <span>{ocrBusy ? 'Recognizing…' : 'Recognize text'}</span>
          </button>
        )}
        <button className="icon-btn small" title="Rotate left" onClick={() => rotate(-90)}>
          <RotateLeftIcon />
        </button>
        <button className="icon-btn small" title="Rotate right" onClick={() => rotate(90)}>
          <RotateRightIcon />
        </button>
      </div>
      <div
        className="page"
        style={size}
        onPointerDown={(e) => !tool && !e.target.closest('.textbox') && setActiveId(null)}
      >
        <canvas ref={canvasRef} style={size} />
        <div
          ref={textLayerRef}
          className="textLayer"
          style={{ '--scale-factor': scale, '--total-scale-factor': scale }}
        />
        {viewport && state.ocr && (
          <div className="ocrLayer">
            {state.ocr.lines.map((l, i) => (
              <OcrLine key={i} line={l} viewport={viewport} turn={rotation - state.ocr.angle} />
            ))}
          </div>
        )}
        {viewport && (
          <div
            ref={overlayRef}
            className={`overlay tool-${tool || 'none'}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <svg className="ink" width={size.width} height={size.height}>
              {[...state.strokes, ...(draft ? [draft] : [])].map((s) => (
                <path
                  key={s.id}
                  d={strokePath(s)}
                  stroke={s.color}
                  strokeWidth={s.width * scale}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </svg>
            {state.texts.map((t) => (
              <TextBox
                key={t.id}
                item={t}
                viewport={viewport}
                rotation={rotation}
                active={activeId === t.id}
                disabled={tool === 'draw'}
                onFocus={() => setActiveId(t.id)}
                onChange={(patch) => updateText(t.id, patch)}
                onRemove={() => removeText(t.id)}
                localPoint={localPoint}
                snap={(sx, sy, off) => {
                  const r = snap(t.id, t.angle, sx, sy, off);
                  setGuides(r.guides);
                  return [r.sx, r.sy];
                }}
                onDragEnd={() => setGuides(null)}
              />
            ))}
            {guides?.x !== undefined && <div className="guide v" style={{ left: guides.x }} />}
            {guides?.y !== undefined && <div className="guide h" style={{ top: guides.y }} />}
          </div>
        )}
      </div>
    </div>
  );
}

const measureCtx = document.createElement('canvas').getContext('2d');

function OcrLine({ line, viewport, turn }) {
  const [vx, vy] = viewport.convertToViewportPoint(line.x, line.y);
  const fs = line.h * viewport.scale;
  measureCtx.font = `${fs}px sans-serif`;
  const sx = (line.w * viewport.scale) / (measureCtx.measureText(line.text).width || 1);
  return (
    <>
      <span
        style={{
          left: vx,
          top: vy,
          fontSize: fs,
          transform: `rotate(${turn}deg) scaleX(${sx})`,
        }}
      >
        {line.text}
      </span>
      <br />
    </>
  );
}

function TextBox({ item, viewport, rotation, active, disabled, onFocus, onChange, onRemove, localPoint, snap, onDragEnd }) {
  const ref = useRef(null);
  const drag = useRef(null);
  const [vx, vy] = viewport.convertToViewportPoint(item.x, item.y);

  useEffect(() => {
    if (item.fresh) {
      ref.current?.focus();
      onChange({ fresh: false });
    }
  }, [item.fresh]); // eslint-disable-line react-hooks/exhaustive-deps

  const startDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const [px, py] = localPoint(e);
    drag.current = { dx: px - vx, dy: py - vy };
  };
  const moveDrag = (e) => {
    if (!drag.current) return;
    const [px, py] = localPoint(e);
    const [sx, sy] = snap(px - drag.current.dx, py - drag.current.dy, e.altKey);
    const [x, y] = viewport.convertToPdfPoint(sx, sy);
    onChange({ x, y });
  };
  const endDrag = () => {
    drag.current = null;
    onDragEnd();
  };

  return (
    <div
      className={`textbox${active ? ' active' : ''}${disabled ? ' disabled' : ''}`}
      style={{
        left: vx,
        top: vy,
        transform: `rotate(${rotation - item.angle}deg)`,
        fontSize: item.size * viewport.scale,
        color: item.color,
        fontFamily: FONT_FAMILY,
        lineHeight: LINE_HEIGHT,
      }}
    >
      <div className="textbox-tools">
        <button
          className="tb-btn"
          title="Move (hold Alt to disable snapping)"
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <MoveIcon />
        </button>
        <button className="tb-btn" title="Delete" onMouseDown={(e) => e.preventDefault()} onClick={onRemove}>
          <CloseIcon />
        </button>
      </div>
      {/* Grid trick: the hidden mirror sizes the box, the textarea fills it. */}
      <div className="grow" data-value={item.text + ' '}>
        <textarea
          ref={ref}
          rows={1}
          cols={10}
          spellCheck={false}
          value={item.text}
          placeholder="Text"
          onFocus={onFocus}
          onChange={(e) => onChange({ text: e.target.value })}
          onBlur={() => !item.text.trim() && onRemove()}
          onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
        />
      </div>
    </div>
  );
}
