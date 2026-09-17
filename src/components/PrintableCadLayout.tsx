import React, { useMemo } from 'react';
import { ModularItem, WallType } from '../types';

interface PrintableCadLayoutProps {
  items: ModularItem[];
  projectName: string;
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

// A light-theme, room-by-room AutoCAD-style elevation drawing meant only for
// printing: every room's units, grouped by wall, drawn to scale with
// dimension labels, on a white background regardless of the interactive
// canvas's current theme. Rendered off-screen (hidden via CSS) and shown
// only inside the print stylesheet, so a print never carries the app chrome
// (header, tabs, toolbars) or whatever dark/blueprint theme is on screen.
export const PrintableCadLayout: React.FC<PrintableCadLayoutProps> = ({ items, projectName }) => {
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
              const svgWidth = Math.min(CANVAS_MAX_WIDTH, naturalWidth);
              const scaleX = svgWidth / wallWidthMm;
              const svgHeight = maxHeightMm * scaleX + 60;

              let x = 140 * scaleX;
              return (
                <div key={wall} className="mb-6 break-inside-avoid">
                  <h3 className="text-sm font-bold uppercase tracking-wide mb-1 text-slate-700">
                    {WALL_LABEL[wall]} — {wallItems.length} unit(s)
                  </h3>
                  <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="border border-slate-400">
                    {wallItems.map((item) => {
                      const w = item.widthMm * scaleX;
                      const h = item.heightMm * scaleX;
                      const boxX = x;
                      const boxY = svgHeight - 30 - h;
                      x += w + 40 * scaleX;
                      return (
                        <g key={item.id}>
                          <rect
                            x={boxX}
                            y={boxY}
                            width={w}
                            height={h}
                            fill="#ffffff"
                            stroke="#0f172a"
                            strokeWidth={1.2}
                          />
                          <text
                            x={boxX + w / 2}
                            y={boxY + h / 2 - 5}
                            textAnchor="middle"
                            fontSize="9"
                            fontWeight="bold"
                            fill="#0f172a"
                          >
                            #{item.sNo} {item.description.slice(0, 18)}
                          </text>
                          <text
                            x={boxX + w / 2}
                            y={boxY + h / 2 + 9}
                            textAnchor="middle"
                            fontSize="8"
                            fill="#475569"
                          >
                            {item.widthMm} × {item.heightMm}
                            {item.depthMm > 0 ? ` × ${item.depthMm}` : ''} mm
                          </text>
                          {/* Floor line */}
                          <line
                            x1={boxX}
                            y1={svgHeight - 28}
                            x2={boxX + w}
                            y2={svgHeight - 28}
                            stroke="#0f172a"
                            strokeWidth={1}
                          />
                        </g>
                      );
                    })}
                    {/* Floor baseline across the whole wall */}
                    <line x1={0} y1={svgHeight - 28} x2={svgWidth} y2={svgHeight - 28} stroke="#94a3b8" strokeWidth={0.75} />
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
                  <th className="text-right py-1">Depth (mm)</th>
                </tr>
              </thead>
              <tbody>
                {roomItems.map((item) => (
                  <tr key={item.id} className="border-b border-slate-300">
                    <td className="py-1 pr-2">{item.sNo}</td>
                    <td className="py-1 pr-2">{item.description}</td>
                    <td className="py-1 pr-2 uppercase">{item.wall}</td>
                    <td className="py-1 pr-2 text-right font-mono">{item.widthMm}</td>
                    <td className="py-1 pr-2 text-right font-mono">{item.heightMm}</td>
                    <td className="py-1 text-right font-mono">{item.depthMm > 0 ? item.depthMm : '-'}</td>
                  </tr>
                ))}
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
