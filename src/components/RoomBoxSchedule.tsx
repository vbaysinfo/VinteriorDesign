import React, { useMemo } from 'react';
import { ModularItem, RoomBoxRow } from '../types';
import { generateRoomBoxSummary } from '../utils/calculator';
import { Box, Boxes, Info, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';

interface RoomBoxScheduleProps {
  items: ModularItem[];
  selectedRoom: string;
}

interface MergedRow {
  itemId: string;
  room: string;
  wall: string;
  itemName: string;
  category: string;
  semi: RoomBoxRow;
  full: RoomBoxRow;
}

const fmtDim = (row: RoomBoxRow) =>
  `${row.boxWidthMm} × ${row.heightMm} × ${row.depthMm} mm`;

const fmtDimFt = (row: RoomBoxRow) =>
  `${row.boxWidthFt}' × ${row.heightFt}' × ${row.depthFt}'`;

export const RoomBoxSchedule: React.FC<RoomBoxScheduleProps> = ({ items, selectedRoom }) => {
  const semiRows = useMemo(() => generateRoomBoxSummary(items, 'semi'), [items]);
  const fullRows = useMemo(() => generateRoomBoxSummary(items, 'full'), [items]);

  const merged: MergedRow[] = useMemo(() => {
    return items.map((item, idx) => ({
      itemId: item.id,
      room: item.room,
      wall: item.wall,
      itemName: item.description,
      category: item.category,
      semi: semiRows[idx],
      full: fullRows[idx],
    }));
  }, [items, semiRows, fullRows]);

  const filtered = selectedRoom === 'ALL' ? merged : merged.filter((r) => r.room === selectedRoom);

  const rooms = Array.from(new Set(filtered.map((r) => r.room)));

  const totalSemiBoxed = filtered.reduce((s, r) => s + r.semi.boxCount, 0);
  const totalFullBoxed = filtered.reduce((s, r) => s + r.full.boxCount, 0);
  const totalItems = filtered.length;

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
              Which units get a factory carcass box, and its Width × Length × Depth — compared for Semi Modular vs Full Modular.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
          <div className="bg-slate-900 rounded-xl p-4">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Items</div>
            <div className="text-2xl font-black text-white mt-1">{totalItems}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{selectedRoom === 'ALL' ? `Across ${rooms.length} room(s)` : selectedRoom}</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Semi Modular Boxed Units</div>
            <div className="text-2xl font-black text-amber-900 mt-1">{totalSemiBoxed}</div>
            <div className="text-[11px] text-amber-700 mt-0.5">Civil-built shutter/frame units carry no factory box</div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Full Modular Boxed Units</div>
            <div className="text-2xl font-black text-emerald-900 mt-1">{totalFullBoxed}</div>
            <div className="text-[11px] text-emerald-700 mt-0.5">
              {totalFullBoxed > totalSemiBoxed
                ? `+${totalFullBoxed - totalSemiBoxed} more units boxed than Semi Modular`
                : 'Every unit fully prefabricated'}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
          <span>
            Each boxed unit is fabricated as <strong>one continuous carcass</strong> (one pair of gables, one top/bottom deck, one back
            panel) spanning its full width — matching exactly what the Cutting List tab cuts, so shutters are sized off that same full
            width and close flush with no overlap or gap. Semi Modular skips the box for civil-built shutter/frame units (depth left
            blank); Full Modular fabricates a box for every unit, defaulting depth by category when left blank. If a unit is wider than
            your factory's practical single-box handling/transport limit, that's a fabrication decision your team makes on-site — splitting
            it here would need separate gables and re-sized shutters per box, which this schedule does not (yet) generate.
          </span>
        </div>
      </div>

      {/* Per-Room Tables */}
      {rooms.map((room) => {
        const roomRows = filtered.filter((r) => r.room === room);
        const roomSemiTotal = roomRows.reduce((s, r) => s + r.semi.boxCount, 0);
        const roomFullTotal = roomRows.reduce((s, r) => s + r.full.boxCount, 0);

        return (
          <div key={room} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-50 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Box className="w-4 h-4 text-cyan-600" />
                {room}
                <span className="text-[11px] font-mono font-semibold text-slate-500">({roomRows.length} units)</span>
              </h3>
              <div className="flex items-center gap-2 text-[11px] font-bold">
                <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">Semi: {roomSemiTotal} boxed</span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">Full: {roomFullTotal} boxed</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50/60 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <th className="text-left px-4 py-2.5 font-bold">Item</th>
                    <th className="text-left px-4 py-2.5 font-bold">Wall</th>
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
                        <div className="flex items-start gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-600 shrink-0" />
                          <div>
                            <div className="font-mono font-semibold text-slate-800">{fmtDim(row.full)}</div>
                            <div className="text-[10px] text-slate-400">{fmtDimFt(row.full)}</div>
                          </div>
                        </div>
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
