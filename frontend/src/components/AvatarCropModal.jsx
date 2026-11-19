import { useEffect, useRef, useState } from 'react';
import { X, ZoomIn } from 'lucide-react';

const VIEW = 240;
const OUT = 192;

export default function AvatarCropModal({ src, onCancel, onSave }) {
  const imgRef = useRef(null);
  const dragRef = useRef(null);

  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [src]);

  useEffect(() => {
    if (!src) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [src, onCancel]);

  if (!src) return null;

  const baseScale = natural.w && natural.h ? Math.max(VIEW / natural.w, VIEW / natural.h) : 1;
  const scale = baseScale * zoom;
  const dw = natural.w * scale;
  const dh = natural.h * scale;

  function clampOffset(nx, ny, nextDw = dw, nextDh = dh) {
    const maxX = Math.max(0, (nextDw - VIEW) / 2);
    const maxY = Math.max(0, (nextDh - VIEW) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, nx)),
      y: Math.min(maxY, Math.max(-maxY, ny)),
    };
  }

  function handlePointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y };
  }

  function handlePointerMove(e) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset(clampOffset(dragRef.current.ox + dx, dragRef.current.oy + dy));
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  function handleZoomChange(nextZoom) {
    const nextScale = baseScale * nextZoom;
    setZoom(nextZoom);
    setOffset((prev) => clampOffset(prev.x, prev.y, natural.w * nextScale, natural.h * nextScale));
  }

  function handleSave() {
    const img = imgRef.current;
    if (!img || !natural.w) return;
    const canvas = document.createElement('canvas');
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext('2d');

    const ratio = OUT / VIEW;
    const x = ((VIEW - dw) / 2 + offset.x) * ratio;
    const y = ((VIEW - dh) / 2 + offset.y) * ratio;

    ctx.drawImage(img, x, y, dw * ratio, dh * ratio);
    onSave(canvas.toDataURL('image/jpeg', 0.88));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel?.();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surf p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h2 id="crop-modal-title" className="text-lg font-bold">Crop profile photo</h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close crop dialog"
            className="rounded-lg p-1 text-mute hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mt-3 text-xs text-mute">Drag to reposition and use the slider to zoom.</p>

        <div
          className="relative mx-auto mt-4 cursor-grab touch-none select-none overflow-hidden rounded-full border-2 border-pri bg-bg active:cursor-grabbing"
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <img
            ref={imgRef}
            src={src}
            alt="Crop preview"
            draggable={false}
            onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            style={{
              width: dw || 'auto',
              height: dh || 'auto',
              maxWidth: 'none',
              transform: `translate(${(VIEW - dw) / 2 + offset.x}px, ${(VIEW - dh) / 2 + offset.y}px)`,
            }}
          />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <ZoomIn size={16} className="shrink-0 text-mute" aria-hidden="true" />
          <input
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            aria-label="Zoom"
            onChange={(e) => handleZoomChange(Number(e.target.value))}
            className="w-full accent-pri"
          />
          <span className="w-10 text-right text-xs text-mute">{zoom.toFixed(1)}x</span>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn" onClick={handleSave}>Save photo</button>
        </div>
      </div>
    </div>
  );
}