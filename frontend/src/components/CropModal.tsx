'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface CropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'move' | null;

const MIN_SIZE = 20;
const HANDLE_RADIUS = 8;

interface CropModalProps {
  file: File;
  onConfirm: (cropped: File) => void;
  onSkip: () => void;
}

/** Clamp value between min and max. */
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/** Detect which handle (or 'move') is under the pointer, given canvas coords. */
function hitHandle(crop: CropBox, x: number, y: number): Handle {
  const corners: Array<{ handle: Handle; cx: number; cy: number }> = [
    { handle: 'nw', cx: crop.x, cy: crop.y },
    { handle: 'ne', cx: crop.x + crop.w, cy: crop.y },
    { handle: 'sw', cx: crop.x, cy: crop.y + crop.h },
    { handle: 'se', cx: crop.x + crop.w, cy: crop.y + crop.h },
  ];
  for (const { handle, cx, cy } of corners) {
    if (Math.abs(x - cx) <= HANDLE_RADIUS && Math.abs(y - cy) <= HANDLE_RADIUS) {
      return handle;
    }
  }
  if (x >= crop.x && x <= crop.x + crop.w && y >= crop.y && y <= crop.y + crop.h) {
    return 'move';
  }
  return null;
}

export default function CropModal({ file, onConfirm, onSkip }: CropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<CropBox>({ x: 0, y: 0, w: 0, h: 0 });
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });

  // Interaction state stored in refs so event handlers don't go stale
  const dragRef = useRef<{
    handle: Handle;
    startX: number;
    startY: number;
    startCrop: CropBox;
  } | null>(null);

  // ---------- Load image and compute initial canvas & crop ----------
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const MAX_W = Math.min(window.innerWidth - 64, 800);
      const MAX_H = Math.min(window.innerHeight - 200, 600);
      const scale = Math.min(MAX_W / img.naturalWidth, MAX_H / img.naturalHeight, 1);
      const dw = Math.round(img.naturalWidth * scale);
      const dh = Math.round(img.naturalHeight * scale);
      setCanvasSize({ w: dw, h: dh });

      // Default: largest centered square
      const side = Math.min(dw, dh);
      setCrop({
        x: Math.round((dw - side) / 2),
        y: Math.round((dh - side) / 2),
        w: side,
        h: side,
      });
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // ---------- Draw ----------
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || canvasSize.w === 0) return;
    canvas.width = canvasSize.w;
    canvas.height = canvasSize.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background image
    ctx.drawImage(img, 0, 0, canvasSize.w, canvasSize.h);

    // Dim outside crop
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);

    // Clear crop area to show image
    ctx.clearRect(crop.x, crop.y, crop.w, crop.h);
    ctx.drawImage(img, 0, 0, canvasSize.w, canvasSize.h);

    // Crop border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(crop.x + 0.5, crop.y + 0.5, crop.w - 1, crop.h - 1);

    // Rule-of-thirds lines
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 2; i++) {
      const rx = crop.x + (crop.w * i) / 3;
      const ry = crop.y + (crop.h * i) / 3;
      ctx.beginPath(); ctx.moveTo(rx, crop.y); ctx.lineTo(rx, crop.y + crop.h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(crop.x, ry); ctx.lineTo(crop.x + crop.w, ry); ctx.stroke();
    }

    // Corner handles
    const corners = [
      { x: crop.x, y: crop.y },
      { x: crop.x + crop.w, y: crop.y },
      { x: crop.x, y: crop.y + crop.h },
      { x: crop.x + crop.w, y: crop.y + crop.h },
    ];
    ctx.fillStyle = '#fff';
    for (const { x, y } of corners) {
      ctx.beginPath();
      ctx.arc(x, y, HANDLE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [crop, canvasSize]);

  useEffect(() => { draw(); }, [draw]);

  // ---------- Pointer cursor ----------
  const getCursor = (canvas: HTMLCanvasElement, x: number, y: number) => {
    const h = hitHandle(crop, x, y);
    if (h === 'move') return 'move';
    if (h === 'nw' || h === 'se') return 'nwse-resize';
    if (h === 'ne' || h === 'sw') return 'nesw-resize';
    return 'crosshair';
  };

  // ---------- Pointer events ----------
  const getCanvasXY = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = getCanvasXY(e);
    const handle = hitHandle(crop, x, y);
    if (!handle) {
      // Start a new selection
      dragRef.current = { handle: 'se', startX: x, startY: y, startCrop: { x, y, w: 0, h: 0 } };
      setCrop({ x, y, w: 0, h: 0 });
      return;
    }
    dragRef.current = { handle, startX: x, startY: y, startCrop: { ...crop } };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) {
      const { x, y } = getCanvasXY(e);
      e.currentTarget.style.cursor = getCursor(e.currentTarget, x, y);
      return;
    }
    const { x, y } = getCanvasXY(e);
    const dx = x - dragRef.current.startX;
    const dy = y - dragRef.current.startY;
    const sc = dragRef.current.startCrop;
    const cw = canvasSize.w;
    const ch = canvasSize.h;
    const h = dragRef.current.handle;

    setCrop((prev) => {
      if (h === 'move') {
        return {
          ...prev,
          x: clamp(sc.x + dx, 0, cw - sc.w),
          y: clamp(sc.y + dy, 0, ch - sc.h),
        };
      }
      if (h === 'nw') {
        const newX = clamp(sc.x + dx, 0, sc.x + sc.w - MIN_SIZE);
        const newY = clamp(sc.y + dy, 0, sc.y + sc.h - MIN_SIZE);
        return { x: newX, y: newY, w: sc.x + sc.w - newX, h: sc.y + sc.h - newY };
      }
      if (h === 'ne') {
        const newY = clamp(sc.y + dy, 0, sc.y + sc.h - MIN_SIZE);
        const newW = clamp(sc.w + dx, MIN_SIZE, cw - sc.x);
        return { ...prev, y: newY, w: newW, h: sc.y + sc.h - newY };
      }
      if (h === 'sw') {
        const newX = clamp(sc.x + dx, 0, sc.x + sc.w - MIN_SIZE);
        const newH = clamp(sc.h + dy, MIN_SIZE, ch - sc.y);
        return { ...prev, x: newX, w: sc.x + sc.w - newX, h: newH };
      }
      if (h === 'se') {
        const newW = clamp(sc.w + dx, MIN_SIZE, cw - sc.x);
        const newH = clamp(sc.h + dy, MIN_SIZE, ch - sc.y);
        return { ...prev, w: newW, h: newH };
      }
      return prev;
    });
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  // ---------- Keyboard ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
      if (e.key === 'Enter') handleCrop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crop, canvasSize, file]);

  // ---------- Crop action ----------
  const handleCrop = useCallback(() => {
    const img = imgRef.current;
    if (!img || canvasSize.w === 0 || crop.w < 1 || crop.h < 1) {
      onSkip();
      return;
    }
    const scaleX = img.naturalWidth / canvasSize.w;
    const scaleY = img.naturalHeight / canvasSize.h;

    const offscreen = document.createElement('canvas');
    offscreen.width = Math.round(crop.w * scaleX);
    offscreen.height = Math.round(crop.h * scaleY);
    const ctx = offscreen.getContext('2d');
    if (!ctx) { onSkip(); return; }

    ctx.drawImage(
      img,
      Math.round(crop.x * scaleX),
      Math.round(crop.y * scaleY),
      offscreen.width,
      offscreen.height,
      0, 0,
      offscreen.width,
      offscreen.height,
    );

    offscreen.toBlob(
      (blob) => {
        if (!blob) { onSkip(); return; }
        const croppedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
        onConfirm(croppedFile);
      },
      'image/jpeg',
      0.92,
    );
  }, [crop, canvasSize, file, onConfirm, onSkip]);

  if (canvasSize.w === 0) {
    // Still loading
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
        <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Crop image"
    >
      <p className="text-white text-sm mb-3 select-none">
        Drag the corners to adjust the crop area
      </p>

      <canvas
        ref={canvasRef}
        width={canvasSize.w}
        height={canvasSize.h}
        className="touch-none rounded select-none"
        style={{ cursor: 'crosshair', maxWidth: '100%' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      <div className="flex gap-3 mt-4">
        <button
          type="button"
          onClick={onSkip}
          className="px-4 py-2 text-sm bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={handleCrop}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
        >
          Crop
        </button>
      </div>
    </div>
  );
}
