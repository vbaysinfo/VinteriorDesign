import React, { useRef, useState } from 'react';
import { ModularItem, ClosetLayout, ClosetColumn } from '../types';
import { getEffectiveClosetLayout, makeClosetColumnId, CLOSET_ROD_OVERHEAD_SHELF_MM } from '../utils/calculator';
import { Plus, RotateCcw, Columns as ColumnsIcon, Rows, Shirt, Archive, SplitSquareHorizontal } from 'lucide-react';

interface ClosetInteriorEditorProps {
  item: ModularItem;
  onUpdateItem: (updated: ModularItem) => void;
}

const DISPLAY_WIDTH_PX = 380;
const MIN_COLUMN_SPACING_MM = 250;
const MIN_SHELF_SPACING_MM = 150;
const DIVIDER_THICKNESS_MM = 18;

// Interactive diagram of a wardrobe/dressing unit's interior - independent
// full-height columns, each either a hanging rod or its own shelves (some
// of which can be converted into real drawer boxes). Auto-laid-out from
// the item's own width/height until the user touches something, at which
// point the layout is saved on the item itself (closetLayout) and stops
// auto-regenerating on every width/height edit. All drag math works in mm
// (the item's own real dimensions), so what's shown here is exactly what
// generateCutListForItem in calculator.ts will actually cut.
export const ClosetInteriorEditor: React.FC<ClosetInteriorEditorProps> = ({ item, onUpdateItem }) => {
  const layout = getEffectiveClosetLayout(item);
  const innerWidthMm = Math.max(100, item.widthMm - 2 * DIVIDER_THICKNESS_MM);
  const innerHeightMm = Math.max(100, item.heightMm - 2 * DIVIDER_THICKNESS_MM);
  const scale = DISPLAY_WIDTH_PX / innerWidthMm;
  const displayHeightPx = innerHeightMm * scale;

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ type: 'col' | 'shelf'; colIdx: number; shelfIdx?: number } | null>(null);
  const [, forceTick] = useState(0);

  const isCustomized = !!item.closetLayout;

  const commit = (columns: ClosetColumn[]) => {
    onUpdateItem({ ...item, closetLayout: { columns } });
  };

  const getSvgPoint = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { xMm: 0, yMm: 0 };
    return { xMm: (clientX - rect.left) / scale, yMm: (clientY - rect.top) / scale };
  };

  // Cumulative left edge (mm) of each column.
  const colOffsets: number[] = [];
  {
    let acc = 0;
    for (const col of layout.columns) {
      colOffsets.push(acc);
      acc += col.widthMm;
    }
  }

  const handleColumnBoundaryDown = (colIdx: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { type: 'col', colIdx };
  };

  const handleShelfDown = (colIdx: number, shelfIdx: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { type: 'shelf', colIdx, shelfIdx };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const { xMm, yMm } = getSvgPoint(e.clientX, e.clientY);
    const columns = layout.columns.map((c) => ({ ...c, shelvesMm: [...c.shelvesMm], drawerCompartments: [...c.drawerCompartments] }));

    if (drag.type === 'col') {
      // Dragging the boundary AFTER column `colIdx` - resizes it and its
      // right-hand neighbor, keeping every other column's width fixed.
      const left = columns[drag.colIdx];
      const right = columns[drag.colIdx + 1];
      const pairStart = colOffsets[drag.colIdx];
      const pairTotal = left.widthMm + right.widthMm;
      const newLeftWidth = Math.round(
        Math.min(Math.max(xMm - pairStart, MIN_COLUMN_SPACING_MM), pairTotal - MIN_COLUMN_SPACING_MM)
      );
      left.widthMm = newLeftWidth;
      right.widthMm = pairTotal - newLeftWidth;
      commit(columns);
    } else if (drag.shelfIdx !== undefined) {
      const col = columns[drag.colIdx];
      const shelves = col.shelvesMm;
      const lower = drag.shelfIdx === 0 ? MIN_SHELF_SPACING_MM : shelves[drag.shelfIdx - 1] + MIN_SHELF_SPACING_MM;
      const upper =
        drag.shelfIdx === shelves.length - 1 ? innerHeightMm - MIN_SHELF_SPACING_MM : shelves[drag.shelfIdx + 1] - MIN_SHELF_SPACING_MM;
      shelves[drag.shelfIdx] = Math.round(Math.min(Math.max(yMm, lower), upper));
      commit(columns);
    }
    forceTick((t) => t + 1);
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const updateColumn = (colIdx: number, patch: Partial<ClosetColumn>) => {
    const columns = layout.columns.map((c, i) => (i === colIdx ? { ...c, ...patch } : c));
    commit(columns);
  };

  const toggleColumnType = (colIdx: number) => {
    const col = layout.columns[colIdx];
    if (col.type === 'shelves') {
      updateColumn(colIdx, {
        type: 'hanging_rod',
        shelvesMm: [CLOSET_ROD_OVERHEAD_SHELF_MM],
        drawerCompartments: [],
        splitCompartments: [],
        drawerSubCells: [],
      });
    } else {
      updateColumn(colIdx, { type: 'shelves', shelvesMm: [], drawerCompartments: [], splitCompartments: [], drawerSubCells: [] });
    }
  };

  // Shifts compartment-index references by +1 at/after `insertedAt` (a new
  // shelf was inserted there) or merges/shifts them down by 1 when the
  // compartments at `shelfIdx`/`shelfIdx+1` are being merged back into one
  // (a shelf was removed) - keeps split/drawer flags pointing at the same
  // physical compartment across edits.
  const shiftCompartments = (indices: number[], insertedAt: number) => indices.map((d) => (d >= insertedAt ? d + 1 : d));
  const shiftSubCellKeys = (keys: string[], insertedAt: number) =>
    keys.map((k) => {
      const [c, s] = k.split(':');
      const ci = parseInt(c, 10);
      return `${ci >= insertedAt ? ci + 1 : ci}:${s}`;
    });
  const mergeCompartments = (indices: number[], shelfIdx: number) =>
    indices.filter((d) => d !== shelfIdx && d !== shelfIdx + 1).map((d) => (d > shelfIdx + 1 ? d - 1 : d));
  const mergeSubCellKeys = (keys: string[], shelfIdx: number) =>
    keys
      .filter((k) => {
        const ci = parseInt(k.split(':')[0], 10);
        return ci !== shelfIdx && ci !== shelfIdx + 1;
      })
      .map((k) => {
        const [c, s] = k.split(':');
        const ci = parseInt(c, 10);
        return `${ci > shelfIdx + 1 ? ci - 1 : ci}:${s}`;
      });

  const addShelf = (colIdx: number) => {
    const col = layout.columns[colIdx];
    const shelves = [...col.shelvesMm].sort((a, b) => a - b);
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
    if (bestGap < MIN_SHELF_SPACING_MM * 2) return;
    const newPos = Math.round((edges[bestGapIdx] + edges[bestGapIdx + 1]) / 2);
    // Inserting a shelf shifts every drawer-compartment index at or after
    // the new shelf's position up by one, so existing drawer conversions
    // keep pointing at the same physical compartment.
    const newShelves = [...shelves, newPos].sort((a, b) => a - b);
    const insertedAt = newShelves.indexOf(newPos);
    updateColumn(colIdx, {
      shelvesMm: newShelves,
      drawerCompartments: shiftCompartments(col.drawerCompartments, insertedAt),
      splitCompartments: shiftCompartments(col.splitCompartments ?? [], insertedAt),
      drawerSubCells: shiftSubCellKeys(col.drawerSubCells ?? [], insertedAt),
    });
  };

  const removeShelf = (colIdx: number, shelfIdx: number) => {
    const col = layout.columns[colIdx];
    const shelves = [...col.shelvesMm];
    shelves.splice(shelfIdx, 1);
    // Merging two compartments into one - drop any drawer/split flag on
    // either side of the removed shelf and shift the rest down.
    updateColumn(colIdx, {
      shelvesMm: shelves,
      drawerCompartments: mergeCompartments(col.drawerCompartments, shelfIdx),
      splitCompartments: mergeCompartments(col.splitCompartments ?? [], shelfIdx),
      drawerSubCells: mergeSubCellKeys(col.drawerSubCells ?? [], shelfIdx),
    });
  };

  const toggleDrawer = (colIdx: number, compIdx: number) => {
    const col = layout.columns[colIdx];
    const isDrawer = col.drawerCompartments.includes(compIdx);
    const next = isDrawer ? col.drawerCompartments.filter((d) => d !== compIdx) : [...col.drawerCompartments, compIdx];
    updateColumn(colIdx, { drawerCompartments: next });
  };

  // A compartment is either a single whole-width drawer OR split into two
  // half-width cells - never both, so splitting one clears any whole-width
  // drawer flag it had, and vice versa (toggleDrawer only ever runs on a
  // non-split compartment, since split ones hide that button).
  const toggleSplit = (colIdx: number, compIdx: number) => {
    const col = layout.columns[colIdx];
    const splitSet = new Set(col.splitCompartments ?? []);
    const subCells = new Set(col.drawerSubCells ?? []);
    if (splitSet.has(compIdx)) {
      splitSet.delete(compIdx);
      subCells.delete(`${compIdx}:0`);
      subCells.delete(`${compIdx}:1`);
      updateColumn(colIdx, { splitCompartments: Array.from(splitSet), drawerSubCells: Array.from(subCells) });
    } else {
      splitSet.add(compIdx);
      updateColumn(colIdx, {
        splitCompartments: Array.from(splitSet),
        drawerCompartments: col.drawerCompartments.filter((d) => d !== compIdx),
      });
    }
  };

  const toggleSubCellDrawer = (colIdx: number, compIdx: number, subIdx: 0 | 1) => {
    const col = layout.columns[colIdx];
    const key = `${compIdx}:${subIdx}`;
    const subCells = new Set(col.drawerSubCells ?? []);
    if (subCells.has(key)) subCells.delete(key);
    else subCells.add(key);
    updateColumn(colIdx, { drawerSubCells: Array.from(subCells) });
  };

  const addColumn = () => {
    let bestIdx = 0;
    let bestWidth = -Infinity;
    layout.columns.forEach((c, i) => {
      if (c.widthMm > bestWidth) {
        bestWidth = c.widthMm;
        bestIdx = i;
      }
    });
    if (bestWidth < MIN_COLUMN_SPACING_MM * 2) return;
    const half = Math.round(bestWidth / 2);
    const columns = [...layout.columns];
    const original = columns[bestIdx];
    columns.splice(
      bestIdx,
      1,
      { ...original, widthMm: half },
      { id: makeClosetColumnId(), widthMm: bestWidth - half, type: 'shelves', shelvesMm: [], drawerCompartments: [] }
    );
    commit(columns);
  };

  const removeColumn = (colIdx: number) => {
    if (layout.columns.length <= 1) return;
    const columns = [...layout.columns];
    const removed = columns.splice(colIdx, 1)[0];
    // Give the removed column's width to its left neighbor (or the right
    // one, if it was the first column) so the total stays correct.
    const mergeIdx = colIdx > 0 ? colIdx - 1 : 0;
    columns[mergeIdx] = { ...columns[mergeIdx], widthMm: columns[mergeIdx].widthMm + removed.widthMm };
    commit(columns);
  };

  const resetToAuto = () => {
    onUpdateItem({ ...item, closetLayout: undefined });
  };

  return (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
      <div className="flex items-center justify-between font-semibold text-slate-900 pb-2 border-b border-slate-200">
        <span className="flex items-center gap-1.5">
          <ColumnsIcon className="w-4 h-4 text-cyan-600" />
          Closet Interior Design
        </span>
        {isCustomized && (
          <button onClick={resetToAuto} className="text-[11px] text-cyan-700 underline hover:text-cyan-900 flex items-center gap-1">
            <RotateCcw className="w-3 h-3" />
            Reset to auto
          </button>
        )}
      </div>

      <p className="text-[11px] text-slate-500">
        Drag a column edge or shelf line to resize it - the gap (compartment height, shown in mm under each band) follows the drag, down
        to a {MIN_SHELF_SPACING_MM}mm minimum. Click a column's icon to switch it between Shelves and Hanging Rod. Click a compartment's
        drawer icon to turn it into a real drawer, or its split icon to divide it with a vertical shelf into a left/right pair.
        {!isCustomized && ' (auto-fit from width & height)'}
      </p>

      <div className="flex justify-center bg-white rounded-lg border border-slate-300 p-3 overflow-x-auto">
        <svg
          ref={svgRef}
          width={DISPLAY_WIDTH_PX}
          height={displayHeightPx}
          viewBox={`0 0 ${DISPLAY_WIDTH_PX} ${displayHeightPx}`}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="touch-none select-none"
        >
          <rect x={0} y={0} width={DISPLAY_WIDTH_PX} height={displayHeightPx} fill="#fef3c7" stroke="#92400e" strokeWidth="2" />

          {layout.columns.map((col, colIdx) => {
            const colXMm = colOffsets[colIdx];
            const colXPx = colXMm * scale;
            const colWPx = col.widthMm * scale;

            if (col.type === 'hanging_rod') {
              const rodYMm = Math.min(innerHeightMm - 60, (col.shelvesMm[0] ?? 0) + 120);
              return (
                <g key={col.id}>
                  {col.shelvesMm.length > 0 && (
                    <line
                      x1={colXPx}
                      y1={col.shelvesMm[0] * scale}
                      x2={colXPx + colWPx}
                      y2={col.shelvesMm[0] * scale}
                      stroke="#0891b2"
                      strokeWidth="3"
                    />
                  )}
                  {/* Hanging rod symbol */}
                  <line x1={colXPx + 8} y1={rodYMm * scale} x2={colXPx + colWPx - 8} y2={rodYMm * scale} stroke="#64748b" strokeWidth="2.5" />
                  <circle cx={colXPx + 8} cy={rodYMm * scale} r="3" fill="#64748b" />
                  <circle cx={colXPx + colWPx - 8} cy={rodYMm * scale} r="3" fill="#64748b" />
                  {/* A couple of hanger glyphs for readability */}
                  {Array.from({ length: Math.max(1, Math.floor(colWPx / 26)) }).map((_, hIdx, arr) => {
                    const hx = colXPx + ((hIdx + 1) * colWPx) / (arr.length + 1);
                    return (
                      <path
                        key={hIdx}
                        d={`M ${hx - 7} ${rodYMm * scale + 14} L ${hx} ${rodYMm * scale + 4} L ${hx + 7} ${rodYMm * scale + 14}`}
                        stroke="#94a3b8"
                        strokeWidth="1.3"
                        fill="none"
                      />
                    );
                  })}
                </g>
              );
            }

            const sortedShelves = [...col.shelvesMm].sort((a, b) => a - b);
            const bounds = [0, ...sortedShelves, innerHeightMm];

            return (
              <g key={col.id}>
                {/* Compartments - drawer ones get a tinted fill + a drawer-pull
                    line, split ones get a mid-height vertical sub-divider and
                    two independent half-width drawer toggles instead of one. */}
                {bounds.slice(0, -1).map((top, compIdx) => {
                  const bottom = bounds[compIdx + 1];
                  const compHeightMm = Math.round(bottom - top);
                  const isSplit = (col.splitCompartments ?? []).includes(compIdx);
                  const isDrawer = !isSplit && col.drawerCompartments.includes(compIdx);
                  const compMidY = ((top + bottom) / 2) * scale;
                  const midXPx = colXPx + colWPx / 2;
                  const gapLabel = (
                    <text x={colXPx + 3} y={bottom * scale - 4} fontSize="7" fill="#94a3b8">
                      {compHeightMm}mm
                    </text>
                  );

                  if (isSplit) {
                    const leftDrawer = (col.drawerSubCells ?? []).includes(`${compIdx}:0`);
                    const rightDrawer = (col.drawerSubCells ?? []).includes(`${compIdx}:1`);
                    return (
                      <g key={compIdx}>
                        {([0, 1] as const).map((subIdx) => {
                          const isD = subIdx === 0 ? leftDrawer : rightDrawer;
                          const cellX = subIdx === 0 ? colXPx : midXPx;
                          const cx = subIdx === 0 ? colXPx + colWPx / 4 : colXPx + (3 * colWPx) / 4;
                          return (
                            <g key={subIdx}>
                              {isD && (
                                <>
                                  <rect
                                    x={cellX + 3}
                                    y={top * scale + 3}
                                    width={Math.max(0, colWPx / 2 - 6)}
                                    height={Math.max(0, (bottom - top) * scale - 6)}
                                    fill="#fce7f3"
                                    stroke="#db2777"
                                    strokeWidth="1"
                                  />
                                  <rect x={cx - 10} y={compMidY - 1.5} width="20" height="3" rx="1.5" fill="#db2777" />
                                </>
                              )}
                              <g
                                className="cursor-pointer"
                                role="button"
                                aria-label={`Toggle drawer, ${subIdx === 0 ? 'left' : 'right'} half of compartment ${compIdx + 1}, column ${colIdx + 1}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSubCellDrawer(colIdx, compIdx, subIdx);
                                }}
                              >
                                <circle cx={cx} cy={top * scale + 12} r="7" fill="#fff" stroke={isD ? '#db2777' : '#0891b2'} strokeWidth="1.3" />
                                <Archive x={cx - 5} y={top * scale + 7} width={10} height={10} color={isD ? '#db2777' : '#0891b2'} />
                              </g>
                            </g>
                          );
                        })}
                        {/* Mid-height vertical sub-divider */}
                        <line
                          x1={midXPx}
                          y1={top * scale + 2}
                          x2={midXPx}
                          y2={bottom * scale - 2}
                          stroke="#0891b2"
                          strokeWidth="2.5"
                          strokeDasharray="4 2"
                        />
                        {/* Un-split toggle, top-left */}
                        <g
                          className="cursor-pointer"
                          role="button"
                          aria-label={`Un-split compartment ${compIdx + 1}, column ${colIdx + 1}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSplit(colIdx, compIdx);
                          }}
                        >
                          <circle cx={colXPx + 12} cy={top * scale + 12} r="7" fill="#ecfeff" stroke="#0891b2" strokeWidth="1.3" />
                          <text x={colXPx + 12} y={top * scale + 15} textAnchor="middle" fontSize="9" fill="#0891b2" fontWeight="bold">
                            ×
                          </text>
                        </g>
                        {gapLabel}
                      </g>
                    );
                  }

                  return (
                    <g key={compIdx}>
                      {isDrawer && (
                        <>
                          <rect
                            x={colXPx + 3}
                            y={top * scale + 3}
                            width={Math.max(0, colWPx - 6)}
                            height={Math.max(0, (bottom - top) * scale - 6)}
                            fill="#fce7f3"
                            stroke="#db2777"
                            strokeWidth="1"
                          />
                          <rect x={colXPx + colWPx / 2 - 14} y={compMidY - 1.5} width="28" height="3" rx="1.5" fill="#db2777" />
                        </>
                      )}
                      {/* Drawer / Shelf toggle button for this compartment */}
                      <g
                        className="cursor-pointer"
                        role="button"
                        aria-label={`Toggle drawer, compartment ${compIdx + 1}, column ${colIdx + 1}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDrawer(colIdx, compIdx);
                        }}
                      >
                        <circle cx={colXPx + colWPx - 12} cy={top * scale + 12} r="8" fill="#fff" stroke={isDrawer ? '#db2777' : '#0891b2'} strokeWidth="1.3" />
                        <Archive x={colXPx + colWPx - 17} y={top * scale + 7} width={10} height={10} color={isDrawer ? '#db2777' : '#0891b2'} />
                      </g>
                      {/* Split-into-two toggle, top-left - only offered for a
                          plain open/shelf compartment (a whole drawer or an
                          already-split cell hides this). */}
                      {!isDrawer && (
                        <g
                          className="cursor-pointer"
                          role="button"
                          aria-label={`Split compartment ${compIdx + 1}, column ${colIdx + 1}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSplit(colIdx, compIdx);
                          }}
                        >
                          <circle cx={colXPx + 12} cy={top * scale + 12} r="7" fill="#fff" stroke="#64748b" strokeWidth="1.3" />
                          <SplitSquareHorizontal x={colXPx + 7} y={top * scale + 7} width={10} height={10} color="#64748b" />
                        </g>
                      )}
                      {gapLabel}
                    </g>
                  );
                })}

                {/* Shelf lines (draggable) */}
                {sortedShelves.map((yMm, shelfIdx) => (
                  <g key={`shelf-${shelfIdx}`}>
                    <line x1={colXPx} y1={yMm * scale} x2={colXPx + colWPx} y2={yMm * scale} stroke="#0891b2" strokeWidth="3" />
                    <rect
                      x={colXPx}
                      y={yMm * scale - 7}
                      width={colWPx}
                      height={14}
                      fill="transparent"
                      className="cursor-row-resize"
                      onPointerDown={handleShelfDown(colIdx, shelfIdx)}
                    />
                    <g
                      className="cursor-pointer"
                      role="button"
                      aria-label={`Remove shelf ${shelfIdx + 1}, column ${colIdx + 1}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeShelf(colIdx, shelfIdx);
                      }}
                    >
                      <circle cx={colXPx + colWPx / 2} cy={yMm * scale} r="6" fill="#fff" stroke="#0891b2" strokeWidth="1.3" />
                      <text x={colXPx + colWPx / 2} y={yMm * scale + 3} textAnchor="middle" fontSize="8" fill="#0891b2" fontWeight="bold">
                        ×
                      </text>
                    </g>
                  </g>
                ))}
              </g>
            );
          })}

          {/* Column boundaries (draggable + removable), drawn last so their
              hit-areas sit on top of shelf/drawer content at the edges. */}
          {layout.columns.map((col, colIdx) => {
            if (colIdx === layout.columns.length - 1) return null;
            const boundaryXMm = colOffsets[colIdx] + col.widthMm;
            const boundaryXPx = boundaryXMm * scale;
            return (
              <g key={`boundary-${col.id}`}>
                <line x1={boundaryXPx} y1={0} x2={boundaryXPx} y2={displayHeightPx} stroke="#92400e" strokeWidth="3" />
                <rect
                  x={boundaryXPx - 8}
                  y={0}
                  width={16}
                  height={displayHeightPx}
                  fill="transparent"
                  className="cursor-col-resize"
                  onPointerDown={handleColumnBoundaryDown(colIdx)}
                />
              </g>
            );
          })}

          {/* Column headers - type toggle + remove, drawn above the box */}
          {layout.columns.map((col, colIdx) => {
            const colXMm = colOffsets[colIdx];
            const colXPx = colXMm * scale;
            const colWPx = col.widthMm * scale;
            return (
              <g key={`header-${col.id}`}>
                <g
                  className="cursor-pointer"
                  role="button"
                  aria-label={`Switch column ${colIdx + 1} between Shelves and Hanging Rod (currently ${col.type === 'hanging_rod' ? 'Hanging Rod' : 'Shelves'})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleColumnType(colIdx);
                  }}
                >
                  <rect x={colXPx + colWPx / 2 - 11} y={-2} width={22} height={18} rx={4} fill="#fff" stroke="#92400e" strokeWidth="1" />
                  {col.type === 'hanging_rod' ? (
                    <Shirt x={colXPx + colWPx / 2 - 7} y={2} width={14} height={14} color="#92400e" />
                  ) : (
                    <Rows x={colXPx + colWPx / 2 - 7} y={2} width={14} height={14} color="#92400e" />
                  )}
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={addColumn}
          className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 transition"
        >
          <Plus className="w-3 h-3" />
          Add Column
        </button>
        {layout.columns.map(
          (col, colIdx) =>
            col.type === 'shelves' && (
              <button
                key={col.id}
                onClick={() => addShelf(colIdx)}
                className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-cyan-100 hover:bg-cyan-200 text-cyan-800 transition"
              >
                <Plus className="w-3 h-3" />
                Shelf in Col {colIdx + 1}
              </button>
            )
        )}
        {layout.columns.length > 1 && (
          <select
            value=""
            onChange={(e) => {
              const idx = parseInt(e.target.value, 10);
              if (!isNaN(idx)) removeColumn(idx);
            }}
            className="text-[11px] font-semibold px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
          >
            <option value="">Remove column…</option>
            {layout.columns.map((col, idx) => (
              <option key={col.id} value={idx}>
                Column {idx + 1} ({col.type === 'hanging_rod' ? 'Rod' : 'Shelves'})
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <Shirt className="w-3 h-3 text-amber-700" /> Hanging rod column
        </span>
        <span className="flex items-center gap-1">
          <Rows className="w-3 h-3 text-cyan-700" /> Shelves column (drag shelf ↕, click × to remove)
        </span>
        <span className="flex items-center gap-1">
          <Archive className="w-3 h-3 text-rose-700" /> Click a compartment's icon to toggle Drawer / Shelf
        </span>
        <span className="flex items-center gap-1">
          <SplitSquareHorizontal className="w-3 h-3 text-slate-600" /> Split a compartment with a vertical shelf (left/right drawers)
        </span>
      </div>
    </div>
  );
};
