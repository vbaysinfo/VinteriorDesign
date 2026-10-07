import React, { useRef, useState } from 'react';
import { ModularItem, ClosetLayout } from '../types';
import { getEffectiveClosetLayout } from '../utils/calculator';
import { Plus, RotateCcw, X, Columns, Rows } from 'lucide-react';

interface ClosetInteriorEditorProps {
  item: ModularItem;
  onUpdateItem: (updated: ModularItem) => void;
}

const DISPLAY_WIDTH_PX = 380;
const MIN_SPACING_MM = 150; // smallest allowed column width / shelf clearance
const DIVIDER_THICKNESS_MM = 18;

// Interactive diagram of a wardrobe/dressing unit's interior - vertical
// partitions and horizontal shelves, auto-laid-out from the item's own
// width/height until the user drags something, at which point the layout
// is saved on the item itself (closetLayout) and stops auto-regenerating
// on every width/height edit. Drag math works entirely in mm (the item's
// own real dimensions) and only converts to/from screen pixels for
// rendering, so what's shown here is exactly what generateCutListForItem
// in calculator.ts will actually cut.
export const ClosetInteriorEditor: React.FC<ClosetInteriorEditorProps> = ({ item, onUpdateItem }) => {
  const layout = getEffectiveClosetLayout(item);
  const innerWidthMm = Math.max(100, item.widthMm - 2 * DIVIDER_THICKNESS_MM);
  const innerHeightMm = Math.max(100, item.heightMm - 2 * DIVIDER_THICKNESS_MM);
  const scale = DISPLAY_WIDTH_PX / innerWidthMm;
  const displayHeightPx = innerHeightMm * scale;

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ type: 'v' | 'h'; index: number } | null>(null);
  // Only used to force a re-render while dragging (the committed value lives
  // on item.closetLayout via onUpdateItem, called on every move already).
  const [, forceTick] = useState(0);

  const isCustomized = !!item.closetLayout;

  const commit = (next: ClosetLayout) => {
    onUpdateItem({ ...item, closetLayout: next });
  };

  const getSvgPoint = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { xMm: 0, yMm: 0 };
    return {
      xMm: (clientX - rect.left) / scale,
      yMm: (clientY - rect.top) / scale,
    };
  };

  const handlePointerDown = (type: 'v' | 'h', index: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { type, index };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const { xMm, yMm } = getSvgPoint(e.clientX, e.clientY);
    if (drag.type === 'v') {
      const dividers = [...layout.verticalDividersMm];
      const lower = drag.index === 0 ? MIN_SPACING_MM : dividers[drag.index - 1] + MIN_SPACING_MM;
      const upper = drag.index === dividers.length - 1 ? innerWidthMm - MIN_SPACING_MM : dividers[drag.index + 1] - MIN_SPACING_MM;
      dividers[drag.index] = Math.round(Math.min(Math.max(xMm, lower), upper));
      commit({ ...layout, verticalDividersMm: dividers });
    } else {
      const shelves = [...layout.horizontalShelvesMm];
      const lower = drag.index === 0 ? MIN_SPACING_MM : shelves[drag.index - 1] + MIN_SPACING_MM;
      const upper = drag.index === shelves.length - 1 ? innerHeightMm - MIN_SPACING_MM : shelves[drag.index + 1] - MIN_SPACING_MM;
      shelves[drag.index] = Math.round(Math.min(Math.max(yMm, lower), upper));
      commit({ ...layout, horizontalShelvesMm: shelves });
    }
    forceTick((t) => t + 1);
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const addDivider = () => {
    const dividers = [...layout.verticalDividersMm].sort((a, b) => a - b);
    const edges = [0, ...dividers, innerWidthMm];
    let bestGapIdx = 0;
    let bestGap = -Infinity;
    for (let i = 0; i < edges.length - 1; i++) {
      const gap = edges[i + 1] - edges[i];
      if (gap > bestGap) {
        bestGap = gap;
        bestGapIdx = i;
      }
    }
    if (bestGap < MIN_SPACING_MM * 2) return; // no room for another divider
    const newPos = Math.round((edges[bestGapIdx] + edges[bestGapIdx + 1]) / 2);
    commit({ ...layout, verticalDividersMm: [...dividers, newPos].sort((a, b) => a - b) });
  };

  const addShelf = () => {
    const shelves = [...layout.horizontalShelvesMm].sort((a, b) => a - b);
    const edges = [0, ...shelves, innerHeightMm];
    let bestGapIdx = 0;
    let bestGap = -Infinity;
    for (let i = 0; i < edges.length - 1; i++) {
      const gap = edges[i + 1] - edges[i];
      if (gap > bestGap) {
        bestGap = gap;
        bestGapIdx = i;
      }
    }
    if (bestGap < MIN_SPACING_MM * 2) return;
    const newPos = Math.round((edges[bestGapIdx] + edges[bestGapIdx + 1]) / 2);
    commit({ ...layout, horizontalShelvesMm: [...shelves, newPos].sort((a, b) => a - b) });
  };

  const removeDivider = (index: number) => {
    const dividers = [...layout.verticalDividersMm];
    dividers.splice(index, 1);
    commit({ ...layout, verticalDividersMm: dividers });
  };

  const removeShelf = (index: number) => {
    const shelves = [...layout.horizontalShelvesMm];
    shelves.splice(index, 1);
    commit({ ...layout, horizontalShelvesMm: shelves });
  };

  const resetToAuto = () => {
    onUpdateItem({ ...item, closetLayout: undefined });
  };

  const sortedDividers = [...layout.verticalDividersMm].sort((a, b) => a - b);
  const sortedShelves = [...layout.horizontalShelvesMm].sort((a, b) => a - b);
  const columnCount = sortedDividers.length + 1;
  const shelfRowCount = sortedShelves.length;

  return (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
      <div className="flex items-center justify-between font-semibold text-slate-900 pb-2 border-b border-slate-200">
        <span className="flex items-center gap-1.5">
          <Columns className="w-4 h-4 text-cyan-600" />
          Closet Interior Design
        </span>
        <div className="flex items-center gap-2">
          {isCustomized && (
            <button
              onClick={resetToAuto}
              className="text-[11px] text-cyan-700 underline hover:text-cyan-900 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Reset to auto
            </button>
          )}
        </div>
      </div>

      <p className="text-[11px] text-slate-500">
        Drag any divider or shelf line to reposition it. {columnCount} column{columnCount !== 1 ? 's' : ''} ×{' '}
        {shelfRowCount} shelf row{shelfRowCount !== 1 ? 's' : ''} per column
        {!isCustomized && ' (auto-fit from width & height)'}.
      </p>

      <div className="flex justify-center bg-white rounded-lg border border-slate-300 p-3">
        <svg
          ref={svgRef}
          width={DISPLAY_WIDTH_PX}
          height={displayHeightPx}
          viewBox={`0 0 ${DISPLAY_WIDTH_PX} ${displayHeightPx}`}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="touch-none select-none"
        >
          {/* Outer carcass outline */}
          <rect x={0} y={0} width={DISPLAY_WIDTH_PX} height={displayHeightPx} fill="#fef3c7" stroke="#92400e" strokeWidth="2" />

          {/* Horizontal shelves - span the full width, drawn under the vertical
              dividers so a divider's own hit-handle stays grabbable on top */}
          {sortedShelves.map((yMm, idx) => (
            <g key={`h-${idx}`}>
              <line x1={0} y1={yMm * scale} x2={DISPLAY_WIDTH_PX} y2={yMm * scale} stroke="#0891b2" strokeWidth="3" />
              {/* Wide invisible drag handle */}
              <rect
                x={0}
                y={yMm * scale - 8}
                width={DISPLAY_WIDTH_PX}
                height={16}
                fill="transparent"
                className="cursor-row-resize"
                onPointerDown={handlePointerDown('h', idx)}
              />
              <g
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  removeShelf(idx);
                }}
              >
                <circle cx={DISPLAY_WIDTH_PX - 10} cy={yMm * scale} r="7" fill="#fff" stroke="#0891b2" strokeWidth="1.5" />
                <text x={DISPLAY_WIDTH_PX - 10} y={yMm * scale + 3} textAnchor="middle" fontSize="9" fill="#0891b2" fontWeight="bold">
                  ×
                </text>
              </g>
            </g>
          ))}

          {/* Vertical dividers */}
          {sortedDividers.map((xMm, idx) => (
            <g key={`v-${idx}`}>
              <line x1={xMm * scale} y1={0} x2={xMm * scale} y2={displayHeightPx} stroke="#92400e" strokeWidth="3" />
              <rect
                x={xMm * scale - 8}
                y={0}
                width={16}
                height={displayHeightPx}
                fill="transparent"
                className="cursor-col-resize"
                onPointerDown={handlePointerDown('v', idx)}
              />
              <g
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  removeDivider(idx);
                }}
              >
                <circle cx={xMm * scale} cy={10} r="7" fill="#fff" stroke="#92400e" strokeWidth="1.5" />
                <text x={xMm * scale} y={13} textAnchor="middle" fontSize="9" fill="#92400e" fontWeight="bold">
                  ×
                </text>
              </g>
            </g>
          ))}
        </svg>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={addDivider}
          className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 transition"
        >
          <Plus className="w-3 h-3" />
          Add Vertical Divider
        </button>
        <button
          onClick={addShelf}
          className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-cyan-100 hover:bg-cyan-200 text-cyan-800 transition"
        >
          <Plus className="w-3 h-3" />
          Add Horizontal Shelf
        </button>
      </div>

      <div className="flex items-center gap-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <Columns className="w-3 h-3 text-amber-700" /> Vertical divider (drag ↔, click × to remove)
        </span>
        <span className="flex items-center gap-1">
          <Rows className="w-3 h-3 text-cyan-700" /> Horizontal shelf (drag ↕, click × to remove)
        </span>
      </div>
    </div>
  );
};
