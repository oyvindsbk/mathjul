"use client";

import { useEffect, useRef } from "react";

interface WeekContextMenuProps {
  x: number;
  y: number;
  weekStart: Date;
  onAiPlan: (weekStart: Date) => void;
  onClose: () => void;
}

export function WeekContextMenu({ x, y, weekStart, onAiPlan, onClose }: WeekContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const style: React.CSSProperties = {
    position: "fixed",
    top: y,
    left: x,
    zIndex: 100,
  };

  return (
    <div
      ref={ref}
      style={style}
      className="bg-white border border-gray-200 rounded-lg shadow-xl py-1 w-56"
      role="menu"
    >
      <button
        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors"
        onClick={() => { onAiPlan(weekStart); onClose(); }}
        role="menuitem"
      >
        <span className="text-base">✨</span>
        Planlegg uke for meg
      </button>
    </div>
  );
}
