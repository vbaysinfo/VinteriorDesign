import React, { useMemo } from 'react';
import { ModularItem, ProjectType, RoomBoxRow } from '../types';
import { generateRoomBoxSummary, generateActualRoomBoxSummary } from '../utils/calculator';
import { Box, Boxes, Info, ArrowRight, CheckCircle2, XCircle, Layers, AlertTriangle } from 'lucide-react';

interface RoomBoxScheduleProps {
  items: ModularItem[];
  selectedRoom: string;
  projectType: ProjectType;
}

interface MergedRow {
  itemId: string;
  room: string;
  wall: string;
  itemName: string;
  category: string;
  isOverridden: boolean;
  effectiveType: ProjectType;
  semi: RoomBoxRow;
  full: RoomBoxRow;
  actual: RoomBoxRow;
}

const fmtDim = (row: RoomBoxRow) =>
  `${row.boxWidthMm} × ${row.heightMm} × ${row.depthMm} mm`;

const fmtDimFt = (row: RoomBoxRow) =>
  `${row.boxWidthFt}' × ${row.heightFt}' × ${row.depthFt}'`;

export const RoomBoxSchedule: React.FC<RoomBoxScheduleProps> = ({ items, selectedRoom, projectType }) => {
  const semiRows = useMemo(() => generateRoomBoxSummary(items, 'semi'), [items]);
  const fullRows = useMemo(() => generateRoomBoxSummary(items, 'full'), [items]);
  const actualRows = useMemo(() => generateActualRoomBoxSummary(items, projectType), [items, projectType]);

  const merged: MergedRow[] = useMemo(() => {
    return items.map((item, idx) => ({
      itemId: item.id,
      room: item.room,
      wall: item.wall,
      itemName: item.description,
      category: item.category,
      isOverridden: !!item.projectType && item.projectType !== projectType,
      effectiveType: item.projectType || projectType,
      semi: semiRows[idx],
      full: fullRows[idx],
      actual: actualRows[idx],
    }));
  }, [items, semiRows, fullRows, actualRows, projectType]);

  const filtered = selectedRoom === 'ALL' ? merged : merged.filter((r) => r.room === selectedRoom);

  const rooms = Array.from(new Set(filtered.map((r) => r.room)));

  const totalSemiBoxed = filtered.reduce((s, r) => s + r.semi.boxCount, 0);
  const totalFullBoxed = filtered.reduce((s, r) => s + r.full.boxCount, 0);
  const totalActualBoxed = filtered.reduce((s, r) => s + r.actual.boxCount, 0);
  const totalItems = filtered.length;
  const overriddenCount = filtered.filter((r) => r.isOverridden).length;
  const isMixed = overriddenCount > 0;
  const depthMissingRows = filtered.filter((r) => r.actual.depthMissing);

  return (
    <div className="space-y-5">
      {/* Top Summary Cards */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Boxes className="w-6 h-6 text-cyan-600" />
              Room-Wise Box Schedule
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Which units get a factory carcass box, and its Width × Length × Depth — your actual current setup, plus Semi vs Full Modular
              for comparison.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          <div className="bg-slate-900 rounded-xl p-4">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Items</div>
            <div className="text-2xl font-black text-white mt-1">{totalItems}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{selectedRoom === 'ALL' ? `Across ${rooms.length} room(s)` : selectedRoom}</div>
          </div>
          <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
            <div className="text-[11px] font-bold text-cyan-700 uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3 h-3" />
              {isMixed ? 'Mixed Modular Boxed Units' : `${projectType === 'full' ? 'Full' : 'Semi'} Modular Boxed Units (Current)`}
            </div>
            <div className="text-2xl font-black text-cyan-900 mt-1">{totalActualBoxed}</div>
            <div className="text-[11px] text-cyan-700 mt-0.5">
              {isMixed
                ? `${overriddenCount} unit(s) pinned to a different type than the project default`
                : `Project-wide default: ${projectType === 'full' ? 'Full' : 'Semi'} Modular, no per-item overrides`}
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Semi Modular Boxed Units</div>
            <div className="text-2xl font-black text-amber-900 mt-1">{totalSemiBoxed}</div>
            <div className="text-[11px] text-amber-700 mt-0.5">If every unit were Semi Modular</div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Full Modular Boxed Units</div>
            <div className="text-2xl font-black text-emerald-900 mt-1">{totalFullBoxed}</div>
            <div className="text-[11px] text-emerald-700 mt-0.5">If every unit were Full Modular</div>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
          <span>
            Each boxed unit is fabricated as <strong>one continuous carcass</strong> (one pair of gables, one top/bottom deck, one back
            panel) spanning its full width — matching exactly what the Cutting List tab cuts, so shutters are sized off that same full
            width and close flush with no overlap or gap. Semi Modular skips the box for civil-built shutter/frame units (depth left
            blank). Full Modular needs a <strong>real Depth entered</strong> to fabricate a box — a Full Modular row left blank builds
            nothing at all (flagged below) rather than assuming a standard factory depth for you. If a unit is wider than your factory's
            practical single-box handling/transport limit, that's a fabrication decision your team makes on-site — splitting it here
            would need separate gables and re-sized shutters per box, which this schedule does not (yet) generate.
          </span>
        </div>

        {depthMissingRows.length > 0 && (
          <div className="mt-3 flex items-start gap-2 text-[11px] text-red-800 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-500" />
            <span>
              <strong>{depthMissingRows.length} unit(s) need a Depth entered</strong> — {depthMissingRows.map((r) => r.itemName).join(', ')}.
              {' '}These are set to Full Modular but Depth is blank, so <strong>no box is being fabricated for them</strong> until you type
              a real depth in the Excel Format Editor or the Item Inspector.
            </span>
          </div>
        )}
      </div>

      {/* Per-Room Tables */}
      {rooms.map((room) => {
        const roomRows = filtered.filter((r) => r.room === room);
        const roomSemiTotal = roomRows.reduce((s, r) => s + r.semi.boxCount, 0);
        const roomFullTotal = roomRows.reduce((s, r) => s + r.full.boxCount, 0);
        const roomActualTotal = roomRows.reduce((s, r) => s + r.actual.boxCount, 0);

        return (
          <div key={room} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-50 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Box className="w-4 h-4 text-cyan-600" />
                {room}
                <span className="text-[11px] font-mono font-semibold text-slate-500">({roomRows.length} units)</span>
              </h3>
              <div className="flex items-center gap-2 text-[11px] font-bold">
                <span className="px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-800">Current: {roomActualTotal} boxed</span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
                <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">Semi: {roomSemiTotal} boxed</span>
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">Full: {roomFullTotal} boxed</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50/60 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <th className="text-left px-4 py-2.5 font-bold">Item</th>
                    <th className="text-left px-4 py-2.5 font-bold">Wall</th>
                    <th className="text-left px-4 py-2.5 font-bold bg-cyan-50/60">Current (Actual)</th>
                    <th className="text-left px-4 py-2.5 font-bold bg-amber-50/60">Semi Modular</th>
                    <th className="text-left px-4 py-2.5 font-bold bg-emerald-50/60">Full Modular</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {roomRows.map((row) => (
                    <tr key={row.itemId} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-800">{row.itemName}</div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wide">{row.category.replace(/_/g, ' ')}</div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 uppercase">{row.wall}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-start gap-1.5">
                          {row.actual.hasBox ? (
                            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-cyan-600 shrink-0" />
                          ) : row.actual.depthMissing ? (
                            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-red-500 shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" />
                          )}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                  row.isOverridden ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {row.effectiveType === 'full' ? 'Full' : 'Semi'}
                                {row.isOverridden ? ' (override)' : ''}
                              </span>
                            </div>
                            {row.actual.hasBox ? (
                              <>
                                <div className="font-mono font-semibold text-slate-800 mt-0.5">{fmtDim(row.actual)}</div>
                                <div className="text-[10px] text-slate-400">{fmtDimFt(row.actual)}</div>
                              </>
                            ) : row.actual.depthMissing ? (
                              <span className="text-[11px] italic font-semibold text-red-700">Depth required — no box built</span>
                            ) : (
                              <span className="text-[11px] italic text-slate-400">No box — civil-built shutter/frame</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {row.semi.hasBox ? (
                          <div className="flex items-start gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-amber-600 shrink-0" />
                            <div>
                              <div className="font-mono font-semibold text-slate-800">{fmtDim(row.semi)}</div>
                              <div className="text-[10px] text-slate-400">{fmtDimFt(row.semi)}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[11px] italic">No box — civil-built shutter/frame</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {row.full.hasBox ? (
                          <div className="flex items-start gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-600 shrink-0" />
                            <div>
                              <div className="font-mono font-semibold text-slate-800">{fmtDim(row.full)}</div>
                              <div className="text-[10px] text-slate-400">{fmtDimFt(row.full)}</div>
                            </div>
                          </div>
                        ) : row.full.depthMissing ? (
                          <div className="flex items-center gap-1.5 text-red-600">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[11px] italic font-semibold">Depth required — no box built</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[11px] italic">No box — flat Expo/Dummy panel</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-400">
          No items in this room yet. Upload an Excel quotation or switch the Active Room filter.
        </div>
      )}
    </div>
  );
};
