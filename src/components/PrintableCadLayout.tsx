import React, { useMemo } from 'react';
import { ModularItem, WallType, ProjectType } from '../types';
import { getShutterLayout, hasShutterDoors, getEffectiveDepthMm } from '../utils/calculator';

interface PrintableCadLayoutProps {
  items: ModularItem[];
  projectName: string;
  projectType: ProjectType;
  active: boolean;
}

const WALL_ORDER: WallType[] = ['front', 'left', 'right', 'back'];
const WALL_LABEL: Record<WallType, string> = {
  front: 'Front Wall',
  left: 'Left Wall',
  right: 'Right Wall',
  back: 'Back Wall',
};

// Fixed print scale: mm -> px at this ratio, independent of the on-screen
// zoom/pan state (print output must be consistent every time, not whatever
// the user last left the interactive canvas at).
const SCALE = 0.12;
const CANVAS_MAX_WIDTH = 1000;
const ROW_GAP_PX = 24; // vertical gap between the loft/overhead/floor rows
const LABEL_SPACE_PX = 26; // room for the item name above + dims below each box
const ITEM_GAP_MM = 40;

const isLoftCategory = (i: ModularItem) => i.category === 'loft' || i.category === 'kitchen_loft';
const isOverheadCategory = (i: ModularItem) => i.category === 'kitchen_overhead';

// A light-theme, room-by-room AutoCAD-style elevation drawing meant only for
// printing: every room's units, grouped by wall, drawn to scale with
// shutter/door divisions and per-shutter widths - on a white background
// regardless of the interactive canvas's current theme. Rendered off-screen
// (hidden via CSS) and shown only inside the print stylesheet, so a print
// never carries the app chrome (header, tabs, toolbars) or whatever dark/
// blueprint theme is on screen.
//
// Floor, overhead, and loft units are laid out in three independent rows
// (loft sits at the top of the wall, overhead in the middle, floor units at
// the bottom) instead of one continuous row - a loft physically sits above
// the units below it, not beside them, so summing every item's width into
// one row would double-count the same wall footprint and wildly overstate
// the wall's real width.
export const PrintableCadLayout: React.FC<PrintableCadLayoutProps> = ({ items, projectName, projectType, active }) => {
  const rooms = useMemo(() => {
    const seen: string[] = [];
    items.forEach((i) => {
      if (!seen.includes(i.room)) seen.push(i.room);
    });
    return seen;
  }, [items]);

  return (
    <div className={active ? 'hidden print:block bg-white text-slate-900' : 'hidden'}>
      {rooms.map((room, roomIdx) => {
        const roomItems = items.filter((i) => i.room === room);
        const walls = WALL_ORDER.filter((w) => roomItems.some((i) => i.wall === w));

        return (
          <div key={room} style={{ pageBreakAfter: roomIdx < rooms.length - 1 ? 'always' : 'auto' }} className="p-6">
            <div className="flex items-baseline justify-between border-b-2 border-slate-900 pb-2 mb-4">
              <h1 className="text-xl font-bold">{projectName}</h1>
              <h2 className="text-lg font-bold">Room: {room}</h2>
            </div>

            {walls.map((wall) => {
              const wallItems = roomItems.filter((i) => i.wall === wall);
              const floorRow = wallItems.filter((i) => !isLoftCategory(i) && !isOverheadCategory(i));
              const overheadRow = wallItems.filter(isOverheadCategory);
              const loftRow = wallItems.filter(isLoftCategory);
              const rows = [
                { items: loftRow, label: 'Loft' },
                { items: overheadRow, label: 'Overhead' },
                { items: floorRow, label: 'Floor' },
              ].filter((r) => r.items.length > 0);

              const rowWidthMm = (rowItems: ModularItem[]) =>
                rowItems.reduce((sum, i) => sum + i.widthMm, 0) + Math.max(0, rowItems.length - 1) * ITEM_GAP_MM;
              const maxRowWidthMm = Math.max(...rows.map((r) => rowWidthMm(r.items)), 1000) + 200;
              const drawWidth = Math.min(CANVAS_MAX_WIDTH, maxRowWidthMm * SCALE);
              const scaleX = drawWidth / maxRowWidthMm;

              const rowHeightsPx = rows.map((r) => Math.max(...r.items.map((i) => i.heightMm)) * scaleX + LABEL_SPACE_PX);
              const svgWidth = drawWidth + 40;
              const svgHeight = rowHeightsPx.reduce((s, h) => s + h, 0) + ROW_GAP_PX * (rows.length - 1) + 20;

              let rowTopY = 10;

              return (
                <div key={wall} className="mb-6 break-inside-avoid">
                  <h3 className="text-sm font-bold uppercase tracking-wide mb-1 text-slate-700">
                    {WALL_LABEL[wall]} — {wallItems.length} unit(s)
                  </h3>
                  <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="border border-slate-400">
                    {rows.map((row, rowIdx) => {
                      const rowHeightPx = rowHeightsPx[rowIdx];
                      const floorLineY = rowTopY + rowHeightPx - 14;
                      let x = 20;

                      const rowGroup = (
                        <g key={row.label}>
                          {row.items.length > 1 && (
                            <text x={4} y={rowTopY + rowHeightPx / 2} fontSize="7" fill="#94a3b8" transform={`rotate(-90, 4, ${rowTopY + rowHeightPx / 2})`}>
                              {row.label.toUpperCase()}
                            </text>
                          )}
                          {row.items.map((item) => {
                            const w = item.widthMm * scaleX;
                            const h = item.heightMm * scaleX;
                            const boxX = x;
                            const boxY = floorLineY - h;
                            x += w + ITEM_GAP_MM * scaleX;

                            const pType = item.projectType || projectType;
                            const isBoxUnit = getEffectiveDepthMm(item, pType) > 0;
                            const doorHeight = isBoxUnit ? item.heightMm - 20 : item.heightMm;
                            const doorHeightPx = isBoxUnit ? h - 20 * scaleX : h;
                            const doorTopY = boxY + (h - doorHeightPx);

                            return (
                              <g key={item.id}>
                                <rect x={boxX} y={boxY} width={w} height={h} fill="#ffffff" stroke="#0f172a" strokeWidth={1.2} />

                                {/* Shutters / doors, drawn exactly as the real cut list divides
                                    them - widths can be unequal when the 2D CAD layout's shutter
                                    editor set a per-shutter override, so offsets are walked
                                    cumulatively rather than assuming one fixed pitch. */}
                                {hasShutterDoors(item) && item.drawerCount === 0 && (() => {
                                  const { count, widths, gapMm } = getShutterLayout(item);
                                  let acc = 0;
                                  return Array.from({ length: count }).map((_, sIdx) => {
                                    const shutterWidthMm = widths[sIdx];
                                    const sx = boxX + acc * scaleX;
                                    const shutterWpx = shutterWidthMm * scaleX;
                                    acc += shutterWidthMm + gapMm;
                                    return (
                                      <g key={sIdx}>
                                        {sIdx > 0 && (
                                          <line x1={sx} y1={doorTopY} x2={sx} y2={boxY + h} stroke="#0f172a" strokeWidth={0.6} />
                                        )}
                                        {w > 40 && (
                                          <text x={sx + shutterWpx / 2} y={doorTopY + doorHeightPx - 5} textAnchor="middle" fontSize="6.5" fill="#334155">
                                            {shutterWidthMm}×{doorHeight}
                                          </text>
                                        )}
                                      </g>
                                    );
                                  });
                                })()}

                                {/* Drawer tiers, if this unit has drawers instead of/alongside shutters */}
                                {item.drawerCount > 0 &&
                                  Array.from({ length: item.drawerCount }).map((_, dIdx) => {
                                    const drawerHpx = h / item.drawerCount;
                                    const drawerHmm = Math.round(item.heightMm / item.drawerCount);
                                    const dy = boxY + dIdx * drawerHpx;
                                    return (
                                      <g key={dIdx}>
                                        {dIdx > 0 && <line x1={boxX} y1={dy} x2={boxX + w} y2={dy} stroke="#0f172a" strokeWidth={0.6} />}
                                        {h > 20 && (
                                          <text x={boxX + w / 2} y={dy + drawerHpx / 2 + 2} textAnchor="middle" fontSize="6.5" fill="#334155">
                                            {item.widthMm}×{drawerHmm}
                                          </text>
                                        )}
                                      </g>
                                    );
                                  })}

                                {/* Item label above the box */}
                                <text x={boxX + w / 2} y={boxY - 4} textAnchor="middle" fontSize="8" fontWeight="bold" fill="#0f172a">
                                  #{item.sNo} {item.description.slice(0, 26)}
                                </text>
                                <text x={boxX + w / 2} y={floorLineY + 10} textAnchor="middle" fontSize="7.5" fill="#475569">
                                  {item.widthMm} × {item.heightMm}
                                  {item.depthMm > 0 ? ` × ${item.depthMm}` : ''} mm
                                </text>
                              </g>
                            );
                          })}
                          <line x1={0} y1={floorLineY} x2={svgWidth} y2={floorLineY} stroke="#cbd5e1" strokeWidth={0.75} />
                        </g>
                      );

                      rowTopY += rowHeightPx + ROW_GAP_PX;
                      return rowGroup;
                    })}
                  </svg>
                </div>
              );
            })}

            <table className="w-full text-[10px] border-collapse mt-4">
              <thead>
                <tr className="border-b-2 border-slate-900">
                  <th className="text-left py-1 pr-2">#</th>
                  <th className="text-left py-1 pr-2">Item / Furniture Description</th>
                  <th className="text-left py-1 pr-2">Wall</th>
                  <th className="text-right py-1 pr-2">Width (mm)</th>
                  <th className="text-right py-1 pr-2">Length (mm)</th>
                  <th className="text-right py-1 pr-2">Depth (mm)</th>
                  <th className="text-left py-1 pr-2">Shutters/Doors</th>
                  <th className="text-right py-1">Shutter W × H (mm)</th>
                </tr>
              </thead>
              <tbody>
                {roomItems.map((item) => {
                  const pType = item.projectType || projectType;
                  const isBoxUnit = getEffectiveDepthMm(item, pType) > 0;
                  const doorHeight = isBoxUnit ? item.heightMm - 20 : item.heightMm;
                  const showsShutters = hasShutterDoors(item) && item.drawerCount === 0;
                  const { count, widths } = getShutterLayout(item);
                  const isUniform = widths.every((wid) => wid === widths[0]);
                  return (
                    <tr key={item.id} className="border-b border-slate-300">
                      <td className="py-1 pr-2">{item.sNo}</td>
                      <td className="py-1 pr-2">{item.description}</td>
                      <td className="py-1 pr-2 uppercase">{item.wall}</td>
                      <td className="py-1 pr-2 text-right font-mono">{item.widthMm}</td>
                      <td className="py-1 pr-2 text-right font-mono">{item.heightMm}</td>
                      <td className="py-1 pr-2 text-right font-mono">{item.depthMm > 0 ? item.depthMm : '-'}</td>
                      <td className="py-1 pr-2">
                        {showsShutters ? `${count} shutter${count > 1 ? 's' : ''}` : item.drawerCount > 0 ? `${item.drawerCount} drawer(s)` : '-'}
                      </td>
                      <td className="py-1 text-right font-mono">
                        {showsShutters ? (isUniform ? `${widths[0]} × ${doorHeight}` : `${widths.join('/')} × ${doorHeight}`) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <p className="text-[9px] text-slate-400 mt-3">
              Printed {new Date().toLocaleDateString()} • Room {roomIdx + 1} of {rooms.length}
            </p>
          </div>
        );
      })}
    </div>
  );
};
