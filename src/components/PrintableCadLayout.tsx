import React, { useMemo } from 'react';
import { ModularItem, WallType, ProjectType } from '../types';
import { getShutterLayout, hasShutterDoors, getEffectiveDepthMm } from '../utils/calculator';

interface PrintableCadLayoutProps {
  items: ModularItem[];
  projectName: string;
  projectType: ProjectType;
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
const TOP_MARGIN = 46; // room for the overall width dimension line
const LEFT_MARGIN = 60; // room for the overall height dimension line
const FLOOR_GAP = 30; // px between the lowest box edge and the floor line

// A light-theme, room-by-room AutoCAD-style elevation drawing meant only for
// printing: every room's units, grouped by wall, drawn to scale with real
// dimension lines (not just text), shutter/door divisions with per-shutter
// widths, and a data table - on a white background regardless of the
// interactive canvas's current theme. Rendered off-screen (hidden via CSS)
// and shown only inside the print stylesheet, so a print never carries the
// app chrome (header, tabs, toolbars) or whatever dark/blueprint theme is
// on screen.
export const PrintableCadLayout: React.FC<PrintableCadLayoutProps> = ({ items, projectName, projectType }) => {
  const rooms = useMemo(() => {
    const seen: string[] = [];
    items.forEach((i) => {
      if (!seen.includes(i.room)) seen.push(i.room);
    });
    return seen;
  }, [items]);

  return (
    <div className="hidden print:block bg-white text-slate-900">
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
              const wallWidthMm = wallItems.reduce((sum, i) => sum + i.widthMm, 0) + (wallItems.length - 1) * 40 + 280;
              const maxHeightMm = Math.max(...wallItems.map((i) => i.heightMm), 2400);
              const naturalWidth = wallWidthMm * SCALE;
              const drawWidth = Math.min(CANVAS_MAX_WIDTH, naturalWidth);
              const scaleX = drawWidth / wallWidthMm;
              const drawHeight = maxHeightMm * scaleX;
              const svgWidth = drawWidth + LEFT_MARGIN + 20;
              const svgHeight = drawHeight + TOP_MARGIN + FLOOR_GAP + 10;
              const floorY = svgHeight - FLOOR_GAP;

              let x = LEFT_MARGIN + 60 * scaleX;
              const wallStartX = x;

              const boxes = wallItems.map((item) => {
                const w = item.widthMm * scaleX;
                const h = item.heightMm * scaleX;
                const boxX = x;
                const boxY = floorY - h;
                x += w + 40 * scaleX;
                return { item, boxX, boxY, w, h };
              });
              const wallEndX = boxes.length > 0 ? boxes[boxes.length - 1].boxX + boxes[boxes.length - 1].w : wallStartX;

              return (
                <div key={wall} className="mb-6 break-inside-avoid">
                  <h3 className="text-sm font-bold uppercase tracking-wide mb-1 text-slate-700">
                    {WALL_LABEL[wall]} — {wallItems.length} unit(s)
                  </h3>
                  <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="border border-slate-400">
                    <defs>
                      <marker id={`arrow-${room}-${wall}`} markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                        <path d="M0,0 L6,3 L0,6 Z" fill="#0f172a" />
                      </marker>
                    </defs>

                    {/* Overall width dimension line */}
                    <line
                      x1={wallStartX}
                      y1={16}
                      x2={wallEndX}
                      y2={16}
                      stroke="#0f172a"
                      strokeWidth={0.75}
                      markerStart={`url(#arrow-${room}-${wall})`}
                      markerEnd={`url(#arrow-${room}-${wall})`}
                    />
                    <text x={(wallStartX + wallEndX) / 2} y={12} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#0f172a">
                      W: {Math.round((wallEndX - wallStartX) / scaleX)}mm
                    </text>

                    {/* Overall height dimension line */}
                    <line
                      x1={24}
                      y1={floorY}
                      x2={24}
                      y2={floorY - drawHeight}
                      stroke="#0f172a"
                      strokeWidth={0.75}
                      markerStart={`url(#arrow-${room}-${wall})`}
                      markerEnd={`url(#arrow-${room}-${wall})`}
                    />
                    <text
                      x={14}
                      y={floorY - drawHeight / 2}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="bold"
                      fill="#0f172a"
                      transform={`rotate(-90, 14, ${floorY - drawHeight / 2})`}
                    >
                      H: {Math.round(maxHeightMm)}mm
                    </text>

                    {boxes.map(({ item, boxX, boxY, w, h }) => {
                      const pType = item.projectType || projectType;
                      const isBoxUnit = getEffectiveDepthMm(item, pType) > 0;
                      const doorHeight = isBoxUnit ? item.heightMm - 20 : item.heightMm;
                      const doorHeightPx = isBoxUnit ? h - 20 * scaleX : h;
                      const doorTopY = boxY + (h - doorHeightPx);

                      return (
                        <g key={item.id}>
                          <rect x={boxX} y={boxY} width={w} height={h} fill="#ffffff" stroke="#0f172a" strokeWidth={1.2} />

                          {/* Shutters / doors, drawn exactly as the real cut list divides them */}
                          {hasShutterDoors(item) && item.drawerCount === 0 && (() => {
                            const { count, shutterWidthMm, gapMm } = getShutterLayout(item);
                            const pitchMm = shutterWidthMm + gapMm;
                            const shutterWpx = shutterWidthMm * scaleX;
                            const pitchPx = pitchMm * scaleX;
                            return Array.from({ length: count }).map((_, sIdx) => {
                              const sx = boxX + sIdx * pitchPx;
                              return (
                                <g key={sIdx}>
                                  {sIdx > 0 && (
                                    <line x1={sx} y1={doorTopY} x2={sx} y2={boxY + h} stroke="#0f172a" strokeWidth={0.6} />
                                  )}
                                  <text
                                    x={sx + shutterWpx / 2}
                                    y={doorTopY + doorHeightPx - 6}
                                    textAnchor="middle"
                                    fontSize="6.5"
                                    fill="#334155"
                                  >
                                    {shutterWidthMm}×{doorHeight}
                                  </text>
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
                                  <text x={boxX + w / 2} y={dy + drawerHpx / 2 + 2} textAnchor="middle" fontSize="6.5" fill="#334155">
                                    {item.widthMm}×{drawerHmm}
                                  </text>
                                </g>
                              );
                            })}

                          {/* Item label above the box */}
                          <text x={boxX + w / 2} y={boxY - 4} textAnchor="middle" fontSize="8" fontWeight="bold" fill="#0f172a">
                            #{item.sNo} {item.description.slice(0, 18)}
                          </text>
                          <text x={boxX + w / 2} y={floorY + 10} textAnchor="middle" fontSize="7.5" fill="#475569">
                            {item.widthMm} × {item.heightMm}
                            {item.depthMm > 0 ? ` × ${item.depthMm}` : ''} mm
                          </text>
                        </g>
                      );
                    })}

                    {/* Floor baseline across the whole wall */}
                    <line x1={0} y1={floorY} x2={svgWidth} y2={floorY} stroke="#94a3b8" strokeWidth={0.75} />
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
                  <th className="text-right py-1 pr-2">Height (mm)</th>
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
                  const { count, shutterWidthMm } = getShutterLayout(item);
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
                        {showsShutters ? `${shutterWidthMm} × ${doorHeight}` : '-'}
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
