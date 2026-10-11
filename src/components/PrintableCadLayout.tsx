import React, { useMemo } from 'react';
import { ModularItem, CutListPart, HardwareBOMLine, WallType, ProjectType } from '../types';
import {
  getShutterLayout,
  hasShutterDoors,
  getEffectiveDepthMm,
  resolveEffectiveProjectType,
  isClosetEligible,
  getEffectiveClosetLayout,
  calculateMaterialUsage,
  aggregateHardwareBOM,
  getClosetCompartmentHeight,
} from '../utils/calculator';

interface PrintableCadLayoutProps {
  items: ModularItem[];
  cutList: CutListPart[];
  hardwareBOM: HardwareBOMLine[];
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
const ROW_GAP_PX = 0; // Loft/Overhead/Floor sit directly on top of each other on the real wall, flush with no gap
const LABEL_SPACE_PX = 26; // room for the item name above + dims below each box
const ITEM_GAP_MM = 40;

const isLoftCategory = (i: ModularItem) => i.category === 'loft' || i.category === 'kitchen_loft';
const isOverheadCategory = (i: ModularItem) => i.category === 'kitchen_overhead';
// Skirting/pelmet runners and dummy filler panels clutter a wardrobe's own
// wall elevation (they're thin strips, not real cabinet modules) - pulled
// out of every room's main drawing and printed together on one dedicated
// page at the end instead.
// Matches the common misspelling "skerting" too, alongside the correct
// "skirting" - factory sheets and site staff use both interchangeably.
const isFillerPanel = (i: ModularItem) => {
  const desc = i.description.toLowerCase();
  return i.category === 'dummy' || desc.includes('skirting') || desc.includes('skerting');
};

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
export const PrintableCadLayout: React.FC<PrintableCadLayoutProps> = ({ items, cutList, hardwareBOM, projectName, projectType, active }) => {
  const rooms = useMemo(() => {
    const seen: string[] = [];
    items.forEach((i) => {
      if (!seen.includes(i.room)) seen.push(i.room);
    });
    return seen;
  }, [items]);

  const fillerItems = useMemo(() => items.filter(isFillerPanel), [items]);

  // Project-wide high-level summary - printed once at the very top, ahead
  // of every room's own elevation drawings, so whoever's holding the
  // printout (factory floor, client sign-off) sees the whole job's scale
  // before drilling into any one room. Total Sq.ft mirrors the Analytics
  // Report's own definition (every item's elevation face area, not panel
  // material); Total Sheets comes from the exact same cut list the Cutting
  // List tab nests, so it matches that tab exactly.
  const totalAreaSqFt = useMemo(
    () => Number(items.reduce((s, i) => s + i.widthFt * i.heightFt * (i.quantity || 1), 0).toFixed(1)),
    [items]
  );
  const totalSheets = useMemo(() => calculateMaterialUsage(cutList).totalSheets, [cutList]);

  // Complete hardware details (hinges, handles, drawer/tandem channels,
  // shelf supports, minifix, skirting clips, sliding track, dowels, ...) -
  // the exact same per-hardware-code aggregation the Hardware BOM tab
  // itself shows, so the printed totals always match that tab precisely
  // instead of drifting out of sync with a separately-maintained list.
  const hardwareSummary = useMemo(() => aggregateHardwareBOM(hardwareBOM), [hardwareBOM]);

  return (
    <div className={active ? 'hidden print:block bg-white text-slate-900' : 'hidden'}>
      {/* High-Level Project Summary - its own page, before the first room */}
      <div className="break-after-page p-8">
        <h1 className="text-2xl font-black text-slate-900">{projectName}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Project CAD Layout - {projectType === 'semi' ? 'Semi Modular (Civil-built)' : 'Full Modular (Factory prefab)'} mode
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="border border-slate-300 rounded-xl p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Rooms</div>
            <div className="text-3xl font-black text-slate-900 mt-1">{rooms.length}</div>
          </div>
          <div className="border border-slate-300 rounded-xl p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Total Units</div>
            <div className="text-3xl font-black text-slate-900 mt-1">{items.length}</div>
          </div>
          <div className="border border-slate-300 rounded-xl p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Total Sq.ft</div>
            <div className="text-3xl font-black text-slate-900 mt-1">{totalAreaSqFt.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Cabinet face area, not panel material</div>
          </div>
          <div className="border border-slate-300 rounded-xl p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Total Sheets</div>
            <div className="text-3xl font-black text-slate-900 mt-1">{totalSheets}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">8x4ft boards, from the real cut list</div>
          </div>
        </div>
        <div className="mt-6 text-xs text-slate-500">
          <span className="font-bold text-slate-700">Rooms in this project:</span> {rooms.join(', ')}
        </div>

        {/* Complete Hardware Details - hinges, handles, drawer/tandem
            channels, shelf supports, minifix, skirting clips, sliding
            track, dowels, etc. - everything the factory needs to pull
            hardware stock for the whole job before cutting even starts. */}
        {hardwareSummary.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-700 border-b-2 border-slate-900 pb-1.5">
              Complete Hardware Details
            </h2>
            <table className="w-full text-xs mt-3 border-collapse">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-300">
                  <th className="py-1.5 pr-3">Hardware</th>
                  <th className="py-1.5 pr-3">Code</th>
                  <th className="py-1.5 text-right">Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hardwareSummary.map((h) => (
                  <tr key={`${h.hardwareCode}-${h.unit}`}>
                    <td className="py-1.5 pr-3 font-semibold text-slate-800">{h.hardwareName}</td>
                    <td className="py-1.5 pr-3 font-mono text-slate-400">{h.hardwareCode}</td>
                    <td className="py-1.5 text-right font-mono font-bold text-slate-900">
                      {h.totalQuantity.toLocaleString()} {h.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rooms.map((room, roomIdx) => {
        const roomItems = items.filter((i) => i.room === room && !isFillerPanel(i));
        const walls = WALL_ORDER.filter((w) => roomItems.some((i) => i.wall === w));

        return (
          <div
            key={room}
            style={{ pageBreakAfter: roomIdx < rooms.length - 1 || fillerItems.length > 0 ? 'always' : 'auto' }}
            className="p-6"
          >
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
              // Pseudo-3D isometric top sliver on the stack's topmost row -
              // the same "receding top deck" cue used on the Wardrobe Design
              // Sheets, so the whole attached Loft+Wardrobe stack reads as
              // one real 3D cabinet instead of a flat rectangle.
              const ROOF_DEPTH = 14;
              const ROOF_SKEW = 10;
              const TOP_Y = 10 + ROOF_DEPTH;
              const svgHeight = rowHeightsPx.reduce((s, h) => s + h, 0) + ROW_GAP_PX * (rows.length - 1) + 20 + ROOF_DEPTH;
              const topRowWidthPx = rowWidthMm(rows[0].items) * scaleX;

              let rowTopY = TOP_Y;

              // Loft/Overhead sits directly above the Floor unit on the real
              // wall - a single summed number told you the stack's total
              // height but not which part of it was which, so this is now a
              // segmented dimension instead: one bracket per row, each
              // labeled with just that row's own height, stacked top to
              // bottom in the same order they're actually drawn - matching
              // a real factory elevation's own "Loft height / Wardrobe
              // height" split dimension line, on top of the per-row W×H×D
              // captions already under each box.
              const rowDims: { topY: number; bottomY: number; heightMm: number; label: string }[] = [];
              {
                let y = TOP_Y;
                rows.forEach((r, i) => {
                  const bottomY = y + rowHeightsPx[i] - 14;
                  rowDims.push({ topY: y, bottomY, heightMm: Math.max(...r.items.map((it) => it.heightMm)), label: r.label });
                  y += rowHeightsPx[i] + ROW_GAP_PX;
                });
              }
              const totalHeightMm = rowDims.reduce((s, r) => s + r.heightMm, 0);

              return (
                <div key={wall} className="mb-6 break-inside-avoid">
                  <h3 className="text-sm font-bold uppercase tracking-wide mb-1 text-slate-700">
                    {WALL_LABEL[wall]} — {wallItems.length} unit(s)
                  </h3>
                  <svg
                    width={rows.length > 1 ? svgWidth + 60 : svgWidth}
                    height={svgHeight}
                    viewBox={`0 0 ${rows.length > 1 ? svgWidth + 60 : svgWidth} ${svgHeight}`}
                    className="border border-slate-400"
                  >
                    <polygon
                      points={`20,${TOP_Y} ${20 + topRowWidthPx},${TOP_Y} ${20 + topRowWidthPx + ROOF_SKEW},${TOP_Y - ROOF_DEPTH} ${20 + ROOF_SKEW},${TOP_Y - ROOF_DEPTH}`}
                      fill="#e2e8f0"
                      stroke="#0f172a"
                      strokeWidth={0.8}
                    />
                    {rows.length > 1 && (
                      <g>
                        {rowDims.map((rd, i) => (
                          <g key={i}>
                            <line x1={svgWidth + 10} y1={rd.topY} x2={svgWidth + 10} y2={rd.bottomY} stroke="#dc2626" strokeWidth={0.8} />
                            <line x1={svgWidth + 7} y1={rd.topY} x2={svgWidth + 13} y2={rd.topY} stroke="#dc2626" strokeWidth={0.8} />
                            <line x1={svgWidth + 7} y1={rd.bottomY} x2={svgWidth + 13} y2={rd.bottomY} stroke="#dc2626" strokeWidth={0.8} />
                            <text
                              x={svgWidth + 22}
                              y={(rd.topY + rd.bottomY) / 2}
                              textAnchor="middle"
                              fontSize="8"
                              fontWeight="bold"
                              fill="#dc2626"
                              transform={`rotate(-90, ${svgWidth + 22}, ${(rd.topY + rd.bottomY) / 2})`}
                            >
                              {rd.label} {rd.heightMm}
                            </text>
                          </g>
                        ))}
                        <text x={svgWidth + 22} y={svgHeight - 4} textAnchor="middle" fontSize="7" fill="#64748b">
                          Total {totalHeightMm}mm
                        </text>
                      </g>
                    )}
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

                            const pType = resolveEffectiveProjectType(item, projectType);
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
                                        {w > 40 && doorHeightPx > 34 && (
                                          <text x={sx + shutterWpx / 2} y={doorTopY + 11} textAnchor="middle" fontSize="6" fontWeight="bold" fill="#0f172a" letterSpacing="0.3">
                                            SHUTTER
                                          </text>
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
                                    const drawerLabel = item.drawerType === 'tandem' ? 'TANDEM BOX' : 'DRAWER';
                                    return (
                                      <g key={dIdx}>
                                        {dIdx > 0 && <line x1={boxX} y1={dy} x2={boxX + w} y2={dy} stroke="#0f172a" strokeWidth={0.6} />}
                                        {w > 50 && drawerHpx > 24 && (
                                          <text x={boxX + w / 2} y={dy + 9} textAnchor="middle" fontSize="6" fontWeight="bold" fill="#0f172a" letterSpacing="0.3">
                                            {drawerLabel}
                                          </text>
                                        )}
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
                                {/* This unit is a wardrobe/dressing category but won't get a
                                    box fabricated (Semi Modular with no Depth entered, or an
                                    explicit per-item Semi override) - flag it right here so it's
                                    obvious why no "Wardrobe Design Sheet" / inner closet view is
                                    printed for it below, instead of it just silently missing. */}
                                {isClosetEligible(item) && !(pType === 'full' && item.depthMm > 0) && (
                                  <text x={boxX + w / 2} y={floorLineY + 20} textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#b45309">
                                    ⚠ No Depth - shutter only, no inner closet view
                                  </text>
                                )}
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

            {/* Wardrobe Design Sheets - a wardrobe/dressing unit built with a
                real box gets its own factory-style design sheet printed here:
                an Outer View (shutter/drawer front elevation, as closed) and
                an Inner View (hanger rod/shelf/drawer layout, as open) for
                the SAME unit stacked together, each fully dimensioned - the
                overall box width/height/depth ("outer" measurements, same
                numbers as the Outer View and the schedule table below) and
                every column's own width plus what each of its compartments
                actually is ("inner" measurements) - so the factory floor has
                both the exterior look and the real interior cutting/assembly
                intent on one sheet, not just a plain box outline. */}
            {(() => {
              const closetItems = roomItems.filter((item) => {
                const pType = resolveEffectiveProjectType(item, projectType);
                return isClosetEligible(item) && pType === 'full' && item.depthMm > 0;
              });
              if (closetItems.length === 0) return null;
              // Both views are capped on width AND height (not just width)
              // so a tall narrow wardrobe still fits two views side by side
              // on one screen/page instead of one of them running off the
              // bottom - a real CAD sheet never lets a single elevation
              // dictate the whole page.
              const MAX_VIEW_WIDTH = 300;
              const MAX_VIEW_HEIGHT = 560;
              const DIM_GUTTER = 30; // left-side height-dimension gutter, shared by both views
              const LABEL_GUTTER = 56; // right-side room/depth callout gutter, shared by both views
              const ROOF_DEPTH = 16; // pseudo-3D isometric top sliver, like a real cabinet drawing's receding top edge
              const ROOF_SKEW = 12;

              return (
                <div className="mt-4 break-inside-avoid">
                  <h3 className="text-sm font-bold uppercase tracking-wide mb-2 text-slate-700 border-t-2 border-slate-900 pt-3">
                    Wardrobe Design Sheets - Outer (Shutter) &amp; Inner (Closet) Views
                  </h3>
                  <div className="flex flex-col gap-6">
                    {closetItems.map((item) => {
                      const dScale = Math.min(MAX_VIEW_WIDTH / item.widthMm, MAX_VIEW_HEIGHT / item.heightMm);
                      const SHEET_WIDTH = item.widthMm * dScale;
                      const boxHeightPx = item.heightMm * dScale;
                      const innerX = 18 * dScale;
                      const innerY = 18 * dScale;
                      const innerW = Math.max(100, item.widthMm - 36);
                      const innerH = Math.max(100, item.heightMm - 36);
                      const layout = getEffectiveClosetLayout(item);
                      const showsShutters = hasShutterDoors(item) && item.drawerCount === 0;
                      const { count: shutterCount, widths: shutterWidths, gapMm } = getShutterLayout(item);

                      // Height dimension bracket on the left of a drawing -
                      // matches the reference sheet's own left-side "2330"
                      // style total-height callout.
                      const heightDim = (totalHeightPx: number, labelMm: number) => (
                        <g>
                          <line x1={DIM_GUTTER - 6} y1={0} x2={DIM_GUTTER - 6} y2={totalHeightPx} stroke="#0f172a" strokeWidth={0.8} />
                          <line x1={DIM_GUTTER - 9} y1={0} x2={DIM_GUTTER - 3} y2={0} stroke="#0f172a" strokeWidth={0.8} />
                          <line x1={DIM_GUTTER - 9} y1={totalHeightPx} x2={DIM_GUTTER - 3} y2={totalHeightPx} stroke="#0f172a" strokeWidth={0.8} />
                          <text
                            x={DIM_GUTTER - 11}
                            y={totalHeightPx / 2}
                            textAnchor="middle"
                            fontSize="8"
                            fontWeight="bold"
                            fill="#0f172a"
                            transform={`rotate(-90, ${DIM_GUTTER - 11}, ${totalHeightPx / 2})`}
                          >
                            {labelMm}
                          </text>
                        </g>
                      );

                      // Width dimension row under a drawing, broken into one
                      // segment per value passed in - matches the reference
                      // sheet's "100 | 2100 | 660" style breakdown line.
                      const widthDim = (segmentsMm: number[], atY: number, originX: number) => {
                        let acc = 0;
                        return (
                          <g>
                            {segmentsMm.map((segMm, i) => {
                              const x1 = originX + acc * dScale;
                              acc += segMm;
                              const x2 = originX + acc * dScale;
                              return (
                                <g key={i}>
                                  <line x1={x1} y1={atY} x2={x2} y2={atY} stroke="#0f172a" strokeWidth={0.8} />
                                  <line x1={x1} y1={atY - 3} x2={x1} y2={atY + 3} stroke="#0f172a" strokeWidth={0.8} />
                                  <line x1={x2} y1={atY - 3} x2={x2} y2={atY + 3} stroke="#0f172a" strokeWidth={0.8} />
                                  <text x={(x1 + x2) / 2} y={atY + 11} textAnchor="middle" fontSize="7.5" fill="#334155">
                                    {segMm}
                                  </text>
                                </g>
                              );
                            })}
                          </g>
                        );
                      };

                      // Room + Depth callout, matching the reference sheet's
                      // bold red "GBR D 450+20" side label.
                      const roomDepthLabel = (atY: number) => (
                        <text
                          x={DIM_GUTTER + SHEET_WIDTH + 14}
                          y={atY}
                          fontSize="10"
                          fontWeight="bold"
                          fill="#dc2626"
                          transform={`rotate(-90, ${DIM_GUTTER + SHEET_WIDTH + 14}, ${atY})`}
                        >
                          {item.room} · D {item.depthMm}
                        </text>
                      );

                      // Pseudo-3D isometric top sliver - a cabinet's real
                      // top deck receding up and to the right, same visual
                      // trick the reference sheet's own drawings use to
                      // read as a real 3D box instead of a flat rectangle.
                      const roofShape = (
                        <polygon
                          points={`0,0 ${SHEET_WIDTH},0 ${SHEET_WIDTH + ROOF_SKEW},${-ROOF_DEPTH} ${ROOF_SKEW},${-ROOF_DEPTH}`}
                          fill="#e2e8f0"
                          stroke="#0f172a"
                          strokeWidth={0.8}
                        />
                      );

                      // ---- OUTER VIEW (shutter/drawer front, as closed) ----
                      const outerDimY = boxHeightPx + 16;
                      const outerSvgH = ROOF_DEPTH + outerDimY + 14;
                      const outerSvgW = DIM_GUTTER + SHEET_WIDTH + LABEL_GUTTER;

                      // ---- INNER VIEW (open closet layout) ----
                      const innerDimY = boxHeightPx + 16;
                      const innerSvgH = ROOF_DEPTH + innerDimY + 14;
                      const innerSvgW = outerSvgW;

                      return (
                        <div key={item.id} className="break-inside-avoid">
                          <div className="text-[10px] font-bold text-slate-800">
                            #{item.sNo} {item.description} - {item.widthMm}×{item.heightMm}×{item.depthMm}mm
                          </div>

                          {/* Outer + Inner views side by side, so the whole
                              design sheet for one wardrobe fits in a single
                              screen/page instead of the two views stacking
                              across a page break. */}
                          <div className="flex flex-row flex-wrap gap-6 mt-1">
                          <div>
                          <div className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Outer View (Shutter/Drawer Front, Closed)</div>
                          <svg width={outerSvgW} height={outerSvgH} viewBox={`0 0 ${outerSvgW} ${outerSvgH}`} className="border border-slate-300">
                            <g transform={`translate(0, ${ROOF_DEPTH})`}>
                            <g transform={`translate(${DIM_GUTTER}, 0)`}>
                              {roofShape}
                              <rect x={0} y={0} width={SHEET_WIDTH} height={boxHeightPx} fill="#ffffff" stroke="#0f172a" strokeWidth={1.2} />
                              {showsShutters &&
                                (() => {
                                  let acc = 0;
                                  return Array.from({ length: shutterCount }).map((_, sIdx) => {
                                    const shutterWidthMm = shutterWidths[sIdx];
                                    const sx = acc * dScale;
                                    const spx = shutterWidthMm * dScale;
                                    acc += shutterWidthMm + gapMm;
                                    return (
                                      <g key={sIdx}>
                                        {sIdx > 0 && <line x1={sx} y1={0} x2={sx} y2={boxHeightPx} stroke="#0f172a" strokeWidth={0.8} />}
                                        <text x={sx + spx / 2} y={boxHeightPx / 2} textAnchor="middle" fontSize="8" fontWeight="bold" fill="#334155">
                                          SHUTTER
                                        </text>
                                        <text x={sx + spx / 2} y={boxHeightPx / 2 + 11} textAnchor="middle" fontSize="7" fill="#64748b">
                                          {shutterWidthMm}×{item.heightMm - 20}
                                        </text>
                                      </g>
                                    );
                                  });
                                })()}
                              {item.drawerCount > 0 &&
                                Array.from({ length: item.drawerCount }).map((_, dIdx) => {
                                  const drawerHpx = boxHeightPx / item.drawerCount;
                                  const drawerHmm = Math.round(item.heightMm / item.drawerCount);
                                  const dy = dIdx * drawerHpx;
                                  return (
                                    <g key={dIdx}>
                                      {dIdx > 0 && <line x1={0} y1={dy} x2={SHEET_WIDTH} y2={dy} stroke="#0f172a" strokeWidth={0.8} />}
                                      <text x={SHEET_WIDTH / 2} y={dy + drawerHpx / 2} textAnchor="middle" fontSize="8" fontWeight="bold" fill="#334155">
                                        {item.drawerType === 'tandem' ? 'TANDEM BOX' : 'DRAWER'}
                                      </text>
                                      <text x={SHEET_WIDTH / 2} y={dy + drawerHpx / 2 + 11} textAnchor="middle" fontSize="7" fill="#64748b">
                                        {item.widthMm}×{drawerHmm}
                                      </text>
                                    </g>
                                  );
                                })}
                              {widthDim([item.widthMm], outerDimY, 0)}
                            </g>
                            {heightDim(boxHeightPx, item.heightMm)}
                            {roomDepthLabel(boxHeightPx / 2)}
                            </g>
                          </svg>
                          </div>

                          {/* Inner View */}
                          <div>
                          <div className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Inner View (Hanger Rod / Shelf / Drawer Layout, Open)</div>
                          <svg width={innerSvgW} height={innerSvgH} viewBox={`0 0 ${innerSvgW} ${innerSvgH}`} className="border border-slate-300">
                            <g transform={`translate(0, ${ROOF_DEPTH})`}>
                            <g transform={`translate(${DIM_GUTTER}, 0)`}>
                              {roofShape}
                              <rect x={0} y={0} width={SHEET_WIDTH} height={boxHeightPx} fill="#ffffff" stroke="#0f172a" strokeWidth={1.2} />
                              <rect x={innerX} y={innerY} width={innerW * dScale} height={innerH * dScale} fill="#fffbeb" stroke="#92400e" strokeWidth={0.8} />
                              {(() => {
                                let colAcc = 0;
                                return layout.columns.map((col, colIdx) => {
                                  const colX = innerX + colAcc * dScale;
                                  const colW = col.widthMm * dScale;
                                  const isLast = colIdx === layout.columns.length - 1;
                                  colAcc += col.widthMm;
                                  const boundary = !isLast && (
                                    <line
                                      key={`bnd-${colIdx}`}
                                      x1={colX + colW}
                                      y1={innerY}
                                      x2={colX + colW}
                                      y2={innerY + innerH * dScale}
                                      stroke="#0f172a"
                                      strokeWidth={1.2}
                                    />
                                  );
                                  const sortedShelves = [...col.shelvesMm].sort((a, b) => a - b);
                                  const bounds = [0, ...sortedShelves, innerH];
                                  const rodSet = new Set(col.rodCompartments);
                                  const splitSet = new Set(col.splitCompartments ?? []);
                                  const subCellDrawerSet = new Set(col.drawerSubCells ?? []);
                                  const drawerSet = new Set(col.drawerCompartments);

                                  const compLabel = (
                                    labelX: number,
                                    topMm: number,
                                    bottomMm: number,
                                    text: string,
                                    rotate: boolean
                                  ) => {
                                    const compHpx = (bottomMm - topMm) * dScale;
                                    if (compHpx < 16) return null; // too short a band to letter without overlap
                                    const midY = innerY + ((topMm + bottomMm) / 2) * dScale;
                                    return (
                                      <text
                                        x={labelX}
                                        y={midY}
                                        textAnchor="middle"
                                        fontSize="6.5"
                                        fontWeight="bold"
                                        fill="#78350f"
                                        transform={rotate ? `rotate(-90, ${labelX}, ${midY})` : undefined}
                                      >
                                        {text}
                                      </text>
                                    );
                                  };

                                  // The compartment's own clear height, same
                                  // reference-drawing convention as "1123" /
                                  // "950" on the GBR sheet: the raw gap between
                                  // its two shelf bounds MINUS the 18mm shelf
                                  // panel sitting at the upper bound (see
                                  // getClosetCompartmentHeight) - printed
                                  // small, tucked against the column's left
                                  // edge so it doesn't collide with the
                                  // HANGER ROD / SHELF / DRAWER label.
                                  const compHeightLabel = (x: number, topMm: number, bottomMm: number, idx: number) => {
                                    const compHpx = (bottomMm - topMm) * dScale;
                                    if (compHpx < 20) return null;
                                    const heightMm = Math.round(getClosetCompartmentHeight(bounds, idx));
                                    return (
                                      <text x={x} y={innerY + bottomMm * dScale - 3} fontSize="5.5" fill="#64748b">
                                        {heightMm}
                                      </text>
                                    );
                                  };

                                  return (
                                    <g key={col.id}>
                                      {bounds.slice(0, -1).map((top, compIdx) => {
                                        const bottom = bounds[compIdx + 1];
                                        if (rodSet.has(compIdx)) {
                                          const rodY = Math.min(bottom - 60, top + 120);
                                          return (
                                            <g key={`rod-${colIdx}-${compIdx}`}>
                                              <line
                                                x1={colX + 4}
                                                y1={innerY + rodY * dScale}
                                                x2={colX + colW - 4}
                                                y2={innerY + rodY * dScale}
                                                stroke="#0f172a"
                                                strokeWidth={1}
                                                opacity={0.6}
                                              />
                                              {compLabel(colX + colW / 2, top, bottom, 'HANGER ROD', colW < 70)}
                                              {compHeightLabel(colX + 2, top, bottom, compIdx)}
                                            </g>
                                          );
                                        }
                                        if (splitSet.has(compIdx)) {
                                          const midX = colX + colW / 2;
                                          return (
                                            <g key={`split-${colIdx}-${compIdx}`}>
                                              <line
                                                x1={midX}
                                                y1={innerY + top * dScale + 1}
                                                x2={midX}
                                                y2={innerY + bottom * dScale - 1}
                                                stroke="#0f172a"
                                                strokeWidth={1}
                                                opacity={0.7}
                                              />
                                              {([0, 1] as const).map((subIdx) => {
                                                const cellX = subIdx === 0 ? colX : midX;
                                                const isDrawer = subCellDrawerSet.has(`${compIdx}:${subIdx}`);
                                                return (
                                                  <g key={subIdx}>
                                                    {isDrawer && (
                                                      <rect
                                                        x={cellX + 2}
                                                        y={innerY + top * dScale + 2}
                                                        width={Math.max(0, colW / 2 - 4)}
                                                        height={Math.max(0, (bottom - top) * dScale - 4)}
                                                        fill="#fce7f3"
                                                        stroke="#db2777"
                                                        strokeDasharray="3,3"
                                                        strokeWidth={0.8}
                                                      />
                                                    )}
                                                    {compLabel(cellX + colW / 4, top, bottom, isDrawer ? 'DRAWER' : 'SHELF', true)}
                                                  </g>
                                                );
                                              })}
                                              {compHeightLabel(colX + 2, top, bottom, compIdx)}
                                            </g>
                                          );
                                        }
                                        const isDrawer = drawerSet.has(compIdx);
                                        return (
                                          <g key={`comp-${colIdx}-${compIdx}`}>
                                            {isDrawer && (
                                              <rect
                                                x={colX + 2}
                                                y={innerY + top * dScale + 2}
                                                width={Math.max(0, colW - 4)}
                                                height={Math.max(0, (bottom - top) * dScale - 4)}
                                                fill="#fce7f3"
                                                stroke="#db2777"
                                                strokeDasharray="3,3"
                                                strokeWidth={0.8}
                                              />
                                            )}
                                            {compLabel(colX + colW / 2, top, bottom, isDrawer ? 'DRAWER' : 'SHELF', colW < 70)}
                                            {compHeightLabel(colX + 2, top, bottom, compIdx)}
                                          </g>
                                        );
                                      })}
                                      {sortedShelves.map((yMm, idx) => (
                                        <line
                                          key={`h-${colIdx}-${idx}`}
                                          x1={colX}
                                          y1={innerY + yMm * dScale}
                                          x2={colX + colW}
                                          y2={innerY + yMm * dScale}
                                          stroke="#0f172a"
                                          strokeWidth={0.8}
                                        />
                                      ))}
                                      {boundary}
                                    </g>
                                  );
                                });
                              })()}
                              {widthDim(
                                layout.columns.map((c) => c.widthMm),
                                innerDimY,
                                innerX
                              )}
                            </g>
                            {heightDim(boxHeightPx, item.heightMm)}
                            {roomDepthLabel(boxHeightPx / 2)}
                            </g>
                          </svg>
                          </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

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
                  const pType = resolveEffectiveProjectType(item, projectType);
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

      {/* Skirting & Filler Panels - thin pelmet/skirting runners and dummy
          cover panels pulled out of every room's own wall elevation above
          (they're not real cabinet modules, just strips), listed together
          on one dedicated page instead of cluttering each wardrobe's
          drawing. */}
      {fillerItems.length > 0 && (
        <div className="p-6">
          <div className="flex items-baseline justify-between border-b-2 border-slate-900 pb-2 mb-4">
            <h1 className="text-xl font-bold">{projectName}</h1>
            <h2 className="text-lg font-bold">Skirting &amp; Filler Panels</h2>
          </div>
          <div className="flex flex-wrap gap-6">
            {fillerItems.map((item) => {
              const fScale = Math.min(260 / Math.max(item.widthMm, 1), 80 / Math.max(item.heightMm, 1), 0.3);
              const fw = item.widthMm * fScale;
              const fh = Math.max(6, item.heightMm * fScale);
              return (
                <div key={item.id} className="text-center">
                  <svg width={fw + 20} height={fh + 30} viewBox={`0 0 ${fw + 20} ${fh + 30}`}>
                    <rect x={10} y={10} width={fw} height={fh} fill="#f1f5f9" stroke="#0f172a" strokeWidth={1} />
                  </svg>
                  <div className="text-[9px] font-semibold text-slate-700 mt-1">
                    #{item.sNo} {item.description}
                  </div>
                  <div className="text-[8px] text-slate-500">
                    {item.room} · {item.wall.toUpperCase()} · {item.widthMm}×{item.heightMm}
                    {item.depthMm > 0 ? `×${item.depthMm}` : ''}mm
                  </div>
                </div>
              );
            })}
          </div>

          <table className="w-full text-[10px] border-collapse mt-6">
            <thead>
              <tr className="border-b-2 border-slate-900">
                <th className="text-left py-1 pr-2">#</th>
                <th className="text-left py-1 pr-2">Room</th>
                <th className="text-left py-1 pr-2">Item / Panel Description</th>
                <th className="text-left py-1 pr-2">Wall</th>
                <th className="text-right py-1 pr-2">Width (mm)</th>
                <th className="text-right py-1 pr-2">Length (mm)</th>
                <th className="text-right py-1">Depth (mm)</th>
              </tr>
            </thead>
            <tbody>
              {fillerItems.map((item) => (
                <tr key={item.id} className="border-b border-slate-300">
                  <td className="py-1 pr-2">{item.sNo}</td>
                  <td className="py-1 pr-2">{item.room}</td>
                  <td className="py-1 pr-2">{item.description}</td>
                  <td className="py-1 pr-2 uppercase">{item.wall}</td>
                  <td className="py-1 pr-2 text-right font-mono">{item.widthMm}</td>
                  <td className="py-1 pr-2 text-right font-mono">{item.heightMm}</td>
                  <td className="py-1 text-right font-mono">{item.depthMm > 0 ? item.depthMm : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-[9px] text-slate-400 mt-3">Printed {new Date().toLocaleDateString()}</p>
        </div>
      )}
    </div>
  );
};
