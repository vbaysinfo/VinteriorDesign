import React, { useMemo } from 'react';
import { CutListPart } from '../types';
import { generateSheetNestingLayouts, SHEET_LENGTH_MM, SHEET_WIDTH_MM } from '../utils/calculator';

interface PrintableCuttingListProps {
  cutList: CutListPart[];
  projectName: string;
  active: boolean;
}

// Black & white, room-grouped print of every sheet the factory needs to
// cut - not just whatever room the Active Room selector happens to be
// filtered to on screen. Nesting mixes parts from different rooms onto the
// same physical sheet to minimize waste, so a "per room" printout can't
// literally split a sheet in two; instead sheets are grouped under whichever
// room contributes the most area to them, and every piece is labeled with
// its own room so a sheet serving several rooms still reads correctly.
// Rendered off-screen and shown only inside the print stylesheet, same
// pattern as PrintableCadLayout - white background regardless of the
// interactive canvas's dark theme, and no fill colors at all (a factory
// floor printer is almost always black & white).
export const PrintableCuttingList: React.FC<PrintableCuttingListProps> = ({ cutList, projectName, active }) => {
  const { layouts } = useMemo(() => generateSheetNestingLayouts(cutList), [cutList]);

  const { roomOrder, sheetsByRoom } = useMemo(() => {
    const order: string[] = [];
    const byRoom = new Map<string, typeof layouts>();
    layouts.forEach((sheet) => {
      const areaByRoom = new Map<string, number>();
      sheet.parts.forEach((p) => areaByRoom.set(p.room, (areaByRoom.get(p.room) || 0) + p.w * p.h));
      let primaryRoom = sheet.parts[0]?.room || 'Unassigned';
      let maxArea = -1;
      areaByRoom.forEach((area, room) => {
        if (area > maxArea) {
          maxArea = area;
          primaryRoom = room;
        }
      });
      if (!order.includes(primaryRoom)) order.push(primaryRoom);
      byRoom.set(primaryRoom, [...(byRoom.get(primaryRoom) || []), sheet]);
    });
    return { roomOrder: order, sheetsByRoom: byRoom };
  }, [layouts]);

  const totalSheets = layouts.length;
  let printedIndex = 0;

  return (
    <div className={active ? 'hidden print:block bg-white text-slate-900' : 'hidden'}>
      {roomOrder.map((room) => {
        const roomSheets = sheetsByRoom.get(room) || [];
        return roomSheets.map((sheet, sheetIdxInRoom) => {
          printedIndex++;
          const isVeryLastPage = printedIndex === totalSheets;
          const roomsOnSheet = Array.from(new Set(sheet.parts.map((p) => p.room)));

          return (
            <div key={sheet.sheetId} style={{ pageBreakAfter: isVeryLastPage ? 'auto' : 'always' }} className="p-6">
              <div className="flex items-baseline justify-between border-b-2 border-slate-900 pb-2 mb-3">
                <h1 className="text-lg font-bold">{projectName} — Factory Cutting List</h1>
                <h2 className="text-base font-bold">
                  Room: {room}
                  {sheetIdxInRoom === 0 && ` (${roomSheets.length} sheet${roomSheets.length > 1 ? 's' : ''})`}
                </h2>
              </div>

              <div className="flex items-baseline justify-between mb-2">
                <div>
                  <span className="text-sm font-bold">{sheet.sheetId}</span>
                  <span className="text-xs text-slate-500 ml-2">
                    {sheet.materialName} — {sheet.thicknessMm}mm — Standard Board {sheet.sheetWidthMm} × {sheet.sheetHeightMm}mm
                  </span>
                  {roomsOnSheet.length > 1 && (
                    <span className="text-xs text-slate-500 ml-2">• Shared with: {roomsOnSheet.filter((r) => r !== room).join(', ')}</span>
                  )}
                </div>
                <div className="text-xs font-mono text-slate-600">
                  {sheet.parts.length} pieces • {sheet.utilizationPercent}% direct yield • {sheet.recoveryPercent}% total recovery
                </div>
              </div>

              <svg
                width="100%"
                viewBox={`-30 -20 ${SHEET_LENGTH_MM + 60} ${SHEET_WIDTH_MM + 50}`}
                className="border border-slate-900"
                style={{ maxHeight: '150mm' }}
              >
                <rect x={0} y={0} width={SHEET_LENGTH_MM} height={SHEET_WIDTH_MM} fill="#ffffff" stroke="#0f172a" strokeWidth={3} />

                {sheet.offcuts.map((offcut) => (
                  <g key={offcut.id}>
                    <rect
                      x={offcut.x}
                      y={offcut.y}
                      width={offcut.w}
                      height={offcut.h}
                      fill="#ffffff"
                      stroke="#64748b"
                      strokeWidth={1.5}
                      strokeDasharray={offcut.isUsable ? '10 6' : '4 8'}
                    />
                    {offcut.isUsable && offcut.w >= 260 && offcut.h >= 70 && (
                      <text x={offcut.x + offcut.w / 2} y={offcut.y + offcut.h / 2} textAnchor="middle" dominantBaseline="central" fontSize="18" fill="#475569">
                        REUSABLE: {offcut.w}×{offcut.h}mm ({offcut.recommendedUse})
                      </text>
                    )}
                  </g>
                ))}

                {sheet.parts.map((p) => {
                  const canFitFull = p.w >= 260 && p.h >= 160;
                  const canFitTwoLines = p.h >= 70 && p.w >= 90;
                  const canFitOneLine = p.h >= 34 && p.w >= 60;
                  return (
                    <g key={p.partId}>
                      <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="#ffffff" stroke="#0f172a" strokeWidth={2} />
                      {canFitFull ? (
                        <>
                          <text x={p.x + p.w / 2} y={p.y + p.h / 2 - 32} textAnchor="middle" fontSize="16" fill="#334155">
                            {p.room} • {p.itemName.length > 24 ? `${p.itemName.slice(0, 23)}…` : p.itemName}
                          </text>
                          <text x={p.x + p.w / 2} y={p.y + p.h / 2 - 4} textAnchor="middle" fontSize="20" fontWeight="bold" fill="#0f172a">
                            {p.partName}
                          </text>
                          <text x={p.x + p.w / 2} y={p.y + p.h / 2 + 26} textAnchor="middle" fontSize="18" fontWeight="bold" fontFamily="monospace" fill="#0f172a">
                            {p.w} × {p.h} mm {p.rotated ? '(rotated)' : ''}
                          </text>
                        </>
                      ) : canFitTwoLines ? (
                        <>
                          <text x={p.x + p.w / 2} y={p.y + p.h / 2 - 10} textAnchor="middle" fontSize="13" fontWeight="bold" fill="#0f172a">
                            {p.partName}
                          </text>
                          <text x={p.x + p.w / 2} y={p.y + p.h / 2 + 10} textAnchor="middle" fontSize="12" fontFamily="monospace" fill="#0f172a">
                            {p.w} × {p.h} mm
                          </text>
                        </>
                      ) : (
                        canFitOneLine && (
                          <text x={p.x + p.w / 2} y={p.y + p.h / 2} textAnchor="middle" dominantBaseline="central" fontSize="11" fontFamily="monospace" fill="#0f172a">
                            {p.w} × {p.h} mm
                          </text>
                        )
                      )}
                    </g>
                  );
                })}
              </svg>

              <p className="text-[9px] text-slate-400 mt-2">
                Printed {new Date().toLocaleDateString()} • Sheet {printedIndex} of {totalSheets} • Usable offcut {sheet.offcutAreaSqMt} m² • Scrap {sheet.scrapAreaSqMt} m²
              </p>
            </div>
          );
        });
      })}
    </div>
  );
};
