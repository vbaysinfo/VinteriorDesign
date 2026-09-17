import React, { useMemo } from 'react';
import { ModularItem, CutListPart, ProjectType } from '../types';
import { calculateMaterialUsage } from '../utils/calculator';
import { BarChart3, Square, Layers, Palette, Shirt, Ruler, Info, Percent, Package, PieChart } from 'lucide-react';
import { HorizontalBarChart, MaterialCompositionBar, StackedHorizontalBarChart } from './AnalyticsCharts';

// Colors picked from a CVD-validated categorical set (worst adjacent pair
// ΔE 9.9 deutan / 9.6 tritan, normal-vision ΔE 24.0 - see dataviz skill) so
// the three composition segments stay distinguishable even for colorblind
// viewers; the legend still carries the text label so nothing rides on hue
// alone (aqua's 2.74:1 surface contrast needs that relief anyway).
const CHART_COLOR_USED = '#2a78d6';
const CHART_COLOR_OFFCUT = '#1baf7a';
const CHART_COLOR_WASTE = '#d03b3b';
const CHART_COLOR_SQFT = '#2a78d6';
const CHART_COLOR_SHEETS = '#4a3aa7';
const CHART_COLOR_LAMINATE = '#eb6834';

interface AnalyticsReportProps {
  items: ModularItem[];
  cutList: CutListPart[];
  projectType: ProjectType;
}

const isWardrobe = (item: ModularItem) => item.category === 'wardrobe_shutter' || item.category === 'single_wardrobe';

interface LaminateGroup {
  key: string;
  finishType: string;
  colorCode: string | null;
  count: number;
  areaSqFt: number;
}

// Groups items by finish type + laminate color code so "Ivory Laminate -
// IV102" and "Ivory Laminate - IV110" show up as distinct rows, while items
// that never had a color code specified are still counted, just labeled as
// unspecified rather than silently dropped.
function buildLaminateGroups(items: ModularItem[]): LaminateGroup[] {
  const map = new Map<string, LaminateGroup>();
  items.forEach((item) => {
    const colorCode = item.laminateColorCode?.trim() || null;
    const key = `${item.finishType}::${colorCode || ''}`;
    const areaSqFt = Number((item.widthFt * item.heightFt * (item.quantity || 1)).toFixed(2));
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.areaSqFt = Number((existing.areaSqFt + areaSqFt).toFixed(2));
    } else {
      map.set(key, { key, finishType: item.finishType, colorCode, count: 1, areaSqFt });
    }
  });
  return Array.from(map.values()).sort((a, b) => b.areaSqFt - a.areaSqFt);
}

interface RoomStats {
  room: string;
  itemCount: number;
  totalAreaSqFt: number;
  wardrobeCount: number;
  wardrobeAreaSqFt: number;
  laminateGroups: LaminateGroup[];
  materials: ReturnType<typeof calculateMaterialUsage>;
}

function buildRoomStats(room: string, roomItems: ModularItem[], roomCutList: CutListPart[]): RoomStats {
  const wardrobeItems = roomItems.filter(isWardrobe);
  return {
    room,
    itemCount: roomItems.length,
    totalAreaSqFt: Number(roomItems.reduce((s, i) => s + i.widthFt * i.heightFt * (i.quantity || 1), 0).toFixed(1)),
    wardrobeCount: wardrobeItems.length,
    wardrobeAreaSqFt: Number(wardrobeItems.reduce((s, i) => s + i.widthFt * i.heightFt * (i.quantity || 1), 0).toFixed(1)),
    laminateGroups: buildLaminateGroups(roomItems),
    materials: calculateMaterialUsage(roomCutList),
  };
}

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string; sub?: string; tone: string }> = ({
  icon,
  label,
  value,
  sub,
  tone,
}) => (
  <div className={`rounded-xl p-4 ${tone}`}>
    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider opacity-80">
      {icon}
      {label}
    </div>
    <div className="text-2xl font-black mt-1">{value}</div>
    {sub && <div className="text-[11px] mt-0.5 opacity-80">{sub}</div>}
  </div>
);

export const AnalyticsReport: React.FC<AnalyticsReportProps> = ({ items, cutList, projectType }) => {
  const rooms = useMemo(() => Array.from(new Set(items.map((i) => i.room))), [items]);

  const allStats = useMemo(() => buildRoomStats('ALL', items, cutList), [items, cutList]);

  const roomStats = useMemo(
    () =>
      rooms.map((room) =>
        buildRoomStats(
          room,
          items.filter((i) => i.room === room),
          cutList.filter((p) => p.room === room)
        )
      ),
    [rooms, items, cutList]
  );

  const edgeTotalMeters = Number((allStats.materials.edgeBand2mmMeters + allStats.materials.edgeBand08mmMeters).toFixed(1));

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-400">
        No project data yet. Upload an Excel quotation sheet to see the analytics report.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-cyan-600" />
              Project Analytics Report
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              All Rooms summary followed by a per-room breakdown — {projectType === 'semi' ? 'Semi Modular (Civil-built)' : 'Full Modular (Factory prefab)'} mode.
            </p>
          </div>
          <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            {items.length} units across {rooms.length} room(s)
          </span>
        </div>

        {/* All Rooms Overview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5">
          <StatCard
            icon={<Square className="w-3.5 h-3.5" />}
            label="Total Sq.ft"
            value={`${allStats.totalAreaSqFt.toLocaleString()}`}
            sub="Sum of all elevation areas"
            tone="bg-slate-900 text-white"
          />
          <StatCard
            icon={<Layers className="w-3.5 h-3.5" />}
            label="Total Sheets"
            value={`${allStats.materials.totalSheets}`}
            sub={`${allStats.materials.totalPieces} cut pieces`}
            tone="bg-cyan-50 border border-cyan-200 text-cyan-900"
          />
          <StatCard
            icon={<Shirt className="w-3.5 h-3.5" />}
            label="Wardrobes"
            value={`${allStats.wardrobeCount}`}
            sub={`${allStats.wardrobeAreaSqFt.toLocaleString()} sq.ft`}
            tone="bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-900"
          />
          <StatCard
            icon={<Palette className="w-3.5 h-3.5" />}
            label="Laminate Colors"
            value={`${allStats.laminateGroups.length}`}
            sub="Distinct finish/color combos"
            tone="bg-amber-50 border border-amber-200 text-amber-900"
          />
          <StatCard
            icon={<Ruler className="w-3.5 h-3.5" />}
            label="Edge Binding"
            value={`${edgeTotalMeters.toLocaleString()} m`}
            sub={`${allStats.materials.edgeBand2mmMeters.toFixed(1)}m @2mm • ${allStats.materials.edgeBand08mmMeters.toFixed(1)}m @0.8mm`}
            tone="bg-emerald-50 border border-emerald-200 text-emerald-900"
          />
          <StatCard
            icon={<Percent className="w-3.5 h-3.5" />}
            label="Material Yield"
            value={`${allStats.materials.overallUtilizationPercent}%`}
            sub={`${allStats.materials.wastePercent}% scrap waste`}
            tone="bg-indigo-50 border border-indigo-200 text-indigo-900"
          />
        </div>

        {/* Material Usage & Waste chart - part-to-whole composition of the
            total board area bought, so it's visible at a glance how much of
            what you pay for actually becomes cabinet vs. usable offcut vs.
            true scrap. */}
        <div className="border border-slate-200 rounded-xl p-4 mt-4">
          <h4 className="text-xs font-bold text-slate-900 mb-1 flex items-center gap-1.5">
            <PieChart className="w-3.5 h-3.5 text-cyan-600" /> Material Usage & Waste (All Rooms)
          </h4>
          <p className="text-[10px] text-slate-400 mb-3">
            Of the {allStats.materials.grossBoardAreaSqFt.toLocaleString()} sq.ft of board bought (
            {allStats.materials.totalSheets} sheets)
          </p>
          <MaterialCompositionBar
            segments={[
              { label: 'Net Panels Used', value: allStats.materials.netPartsAreaSqFt, color: CHART_COLOR_USED },
              { label: 'Usable Offcut', value: allStats.materials.usableOffcutAreaSqFt, color: CHART_COLOR_OFFCUT },
              { label: 'Scrap Waste', value: allStats.materials.totalScrapWasteSqFt, color: CHART_COLOR_WASTE },
            ]}
          />
        </div>

        {/* Material Used vs Waste by Room - both halves of the story on one
            shared scale: how much sheet material a room actually needs
            (blue) stacked against how much of that room's own sheets end up
            as scrap (red). Nested independently per room (like the sheet
            counts elsewhere in this report), so a room's waste here runs a
            bit higher than its true share of the combined project total
            above - nesting every room together shares offcuts across rooms
            that nesting room-by-room can't. */}
        <div className="border border-slate-200 rounded-xl p-4 mt-4">
          <h4 className="text-xs font-bold text-slate-900 mb-1 flex items-center gap-1.5">
            <Ruler className="w-3.5 h-3.5 text-rose-600" /> Material Used vs Waste by Room
          </h4>
          <p className="text-[10px] text-slate-400 mb-3">Net panel area used vs. scrap, if each room's sheets were nested on their own</p>
          <StackedHorizontalBarChart
            data={[...roomStats]
              .sort((a, b) => b.materials.grossBoardAreaSqFt - a.materials.grossBoardAreaSqFt)
              .map((rs) => ({
                label: rs.room,
                values: [rs.materials.netPartsAreaSqFt, rs.materials.totalScrapWasteSqFt],
              }))}
            seriesLabels={['Used', 'Waste']}
            seriesColors={[CHART_COLOR_USED, CHART_COLOR_WASTE]}
            unit=" sq.ft"
          />
        </div>

        {/* Total Sq.ft by Room - which rooms actually carry the most work */}
        <div className="border border-slate-200 rounded-xl p-4 mt-4">
          <h4 className="text-xs font-bold text-slate-900 mb-3 flex items-center gap-1.5">
            <Square className="w-3.5 h-3.5 text-cyan-600" /> Total Sq.ft by Room
          </h4>
          <HorizontalBarChart
            data={[...roomStats].sort((a, b) => b.totalAreaSqFt - a.totalAreaSqFt).map((rs) => ({ label: rs.room, value: rs.totalAreaSqFt }))}
            color={CHART_COLOR_SQFT}
            unit=" sq.ft"
          />
        </div>

        {/* Sheet composition + hardware detail for more understanding */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="border border-slate-200 rounded-xl p-4">
            <h4 className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-600" /> Sheet Requirement by Thickness
            </h4>
            <div className="mb-3">
              <HorizontalBarChart
                data={[
                  { label: '18mm', value: allStats.materials.ply18mmSheets },
                  { label: '9mm', value: allStats.materials.ply9mmSheets },
                  { label: '6mm', value: allStats.materials.ply6mmSheets },
                ]}
                color={CHART_COLOR_SHEETS}
                unit=" sheets"
              />
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">18mm (carcass/shutter)</span>
                <span className="font-mono font-bold text-slate-800">
                  {allStats.materials.ply18mmSheets} sheets • {allStats.materials.ply18mmAreaSqFt.toLocaleString()} sq.ft
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">9mm</span>
                <span className="font-mono font-bold text-slate-800">
                  {allStats.materials.ply9mmSheets} sheets • {allStats.materials.ply9mmAreaSqFt.toLocaleString()} sq.ft
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">6mm (back panel)</span>
                <span className="font-mono font-bold text-slate-800">
                  {allStats.materials.ply6mmSheets} sheets • {allStats.materials.ply6mmAreaSqFt.toLocaleString()} sq.ft
                </span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-slate-100">
                <span className="text-slate-500">Inner / Outer Laminate Sheets</span>
                <span className="font-mono font-bold text-slate-800">
                  {allStats.materials.innerLaminateSheets} / {allStats.materials.outerLaminateSheets}
                </span>
              </div>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl p-4">
            <h4 className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-amber-600" /> Hardware Requirement
            </h4>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Soft-Close Hinge Pairs</span>
                <span className="font-mono font-bold text-slate-800">{Math.ceil(allStats.materials.softCloseHingesPairs)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Handles</span>
                <span className="font-mono font-bold text-slate-800">{allStats.materials.handles}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Drawer Channels</span>
                <span className="font-mono font-bold text-slate-800">{allStats.materials.drawerChannels}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-slate-100">
                <span className="text-slate-500">Tandem Box Channels</span>
                <span className="font-mono font-bold text-slate-800">{allStats.materials.tandemBoxChannels}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Laminate / Color breakdown */}
        <div className="border border-slate-200 rounded-xl p-4 mt-4">
          <h4 className="text-xs font-bold text-slate-900 mb-3 flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-amber-600" /> Color Laminates & Finish Breakdown (All Rooms)
          </h4>
          <div className="mb-4">
            <HorizontalBarChart
              data={allStats.laminateGroups.map((g) => ({
                label: g.colorCode ? `${g.finishType} - ${g.colorCode}` : `${g.finishType} (Unspecified)`,
                value: g.areaSqFt,
              }))}
              color={CHART_COLOR_LAMINATE}
              unit=" sq.ft"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-slate-400 uppercase tracking-wide text-[10px] border-b border-slate-200">
                  <th className="text-left py-1.5 pr-3">Finish Type</th>
                  <th className="text-left py-1.5 pr-3">Color / Laminate Code</th>
                  <th className="text-right py-1.5 pr-3">Units</th>
                  <th className="text-right py-1.5">Area (sq.ft)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allStats.laminateGroups.map((g) => (
                  <tr key={g.key}>
                    <td className="py-1.5 pr-3 font-semibold text-slate-800">{g.finishType}</td>
                    <td className="py-1.5 pr-3">
                      {g.colorCode ? (
                        <span className="font-mono font-bold text-slate-800">{g.colorCode}</span>
                      ) : (
                        <span className="italic text-slate-400">Unspecified</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono">{g.count}</td>
                    <td className="py-1.5 text-right font-mono font-bold">{g.areaSqFt.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
          <span>
            <strong>Total Sq.ft</strong> sums every item's Width × Height in feet (its elevation/opening area), independent of Semi/Full
            mode. <strong>Total Sheets</strong> and <strong>Edge Binding</strong> come from the same real cut list the Cutting List tab
            nests, so they match exactly. Per-room sheet counts below are computed by nesting each room's parts on their own, so they'll
            usually sum to slightly more than the All Rooms total above — nesting the whole project together shares offcuts across rooms
            that nesting room-by-room can't.
          </span>
        </div>
      </div>

      {/* Per-Room Detail Cards */}
      {roomStats.map((rs) => (
        <div key={rs.room} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-50 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Square className="w-4 h-4 text-cyan-600" />
              {rs.room}
              <span className="text-[11px] font-mono font-semibold text-slate-500">({rs.itemCount} units)</span>
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{rs.totalAreaSqFt.toLocaleString()} sq.ft</span>
              <span className="px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-800">{rs.materials.totalSheets} sheets</span>
              <span className="px-2.5 py-1 rounded-full bg-fuchsia-100 text-fuchsia-800">{rs.wardrobeCount} wardrobe(s)</span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                {(rs.materials.edgeBand2mmMeters + rs.materials.edgeBand08mmMeters).toFixed(1)}m edge band
              </span>
            </div>
          </div>

          <div className="p-4 overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-slate-400 uppercase tracking-wide text-[10px] border-b border-slate-200">
                  <th className="text-left py-1.5 pr-3">Finish Type</th>
                  <th className="text-left py-1.5 pr-3">Color / Laminate Code</th>
                  <th className="text-right py-1.5 pr-3">Units</th>
                  <th className="text-right py-1.5">Area (sq.ft)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rs.laminateGroups.map((g) => (
                  <tr key={g.key}>
                    <td className="py-1.5 pr-3 font-semibold text-slate-800">{g.finishType}</td>
                    <td className="py-1.5 pr-3">
                      {g.colorCode ? (
                        <span className="font-mono font-bold text-slate-800">{g.colorCode}</span>
                      ) : (
                        <span className="italic text-slate-400">Unspecified</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono">{g.count}</td>
                    <td className="py-1.5 text-right font-mono font-bold">{g.areaSqFt.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};
