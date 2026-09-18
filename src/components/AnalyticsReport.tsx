import React, { useEffect, useMemo, useState } from 'react';
import { ModularItem, CutListPart, ProjectType } from '../types';
import { calculateMaterialUsage } from '../utils/calculator';
import {
  BarChart3,
  Square,
  Layers,
  Palette,
  Shirt,
  Ruler,
  Info,
  Percent,
  Package,
  PieChart,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
} from 'lucide-react';
import { HorizontalBarChart, MaterialCompositionBar, StackedHorizontalBarChart } from './AnalyticsCharts';

// Colors picked from CVD-validated categorical sets (see dataviz skill) so
// series stay distinguishable for colorblind viewers; every chart also
// carries a visible legend/label so nothing rides on hue alone (aqua's
// 2.74:1 surface contrast needs that relief anyway).
// Set A (worst adjacent ΔE 9.9 deutan / 9.6 tritan, normal-vision 24.0):
const CHART_COLOR_USED = '#2a78d6';
const CHART_COLOR_OFFCUT = '#1baf7a';
const CHART_COLOR_WASTE = '#d03b3b';
const CHART_COLOR_LAMINATE = '#eb6834';
// Set B, for the sheet-thickness breakdowns (worst adjacent ΔE 9.2 deutan,
// normal-vision 27.6) - kept visually distinct from Set A so a reader never
// confuses "which chart is this legend for" when scanning the page:
const CHART_COLOR_18MM = '#4a3aa7';
const CHART_COLOR_9MM = '#eb6834';
const CHART_COLOR_6MM = '#1baf7a';

// A small uppercase eyebrow label that opens each major section of the
// report, so the page reads as distinct groups (Overview / Material &
// Waste / Sheets & Hardware / Finishes / Room-by-Room) instead of one long
// undifferentiated stack of cards.
const SectionHeading: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode }> = ({
  icon,
  title,
  subtitle,
  action,
}) => (
  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
    <div className="flex items-center gap-2">
      <span className="text-cyan-600">{icon}</span>
      <h3 className="text-base font-black text-slate-900 uppercase tracking-wide">{title}</h3>
      {subtitle && <span className="text-sm text-slate-400">{subtitle}</span>}
    </div>
    {action}
  </div>
);

interface AnalyticsReportProps {
  items: ModularItem[];
  cutList: CutListPart[];
  projectType: ProjectType;
  selectedRoom: string;
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
  <div className={`rounded-xl p-5 ${tone}`}>
    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider opacity-80">
      {icon}
      {label}
    </div>
    <div className="text-3xl font-black mt-1.5">{value}</div>
    {sub && <div className="text-xs mt-1 opacity-80">{sub}</div>}
  </div>
);

export const AnalyticsReport: React.FC<AnalyticsReportProps> = ({ items, cutList, projectType, selectedRoom }) => {
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

  // The header cards and the "All Rooms" charts previously showed the whole
  // project's numbers no matter what the app's Active Room dropdown was set
  // to - every other tab (Excel Editor, Cutting List, Box Schedule) filters
  // by it, so this looked broken/frozen by comparison. Switching the header
  // dropdown to a specific room now re-scopes the summary cards and the
  // composition/sheet/laminate breakdowns to just that room; the
  // room-comparison bar charts stay showing every room (a comparison against
  // only itself isn't useful) but highlight the selected one.
  const isFiltered = selectedRoom !== 'ALL';
  const displayStats = isFiltered ? roomStats.find((rs) => rs.room === selectedRoom) ?? allStats : allStats;
  const scopeLabel = isFiltered ? selectedRoom : 'All Rooms';

  const edgeTotalMeters = Number(
    (displayStats.materials.edgeBand2mmMeters + displayStats.materials.edgeBand08mmMeters).toFixed(1)
  );

  // Room detail cards default collapsed - with more charts above them now,
  // a project with several rooms would otherwise mean a lot of scrolling
  // just to see the overview. The quick-jump chips below expand a room and
  // scroll it into view in one click.
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set());
  const toggleRoom = (room: string) => {
    setExpandedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(room)) next.delete(room);
      else next.add(room);
      return next;
    });
  };
  const roomAnchor = (room: string) => `analytics-room-${room.replace(/\s+/g, '-')}`;
  const jumpToRoom = (room: string) => {
    setExpandedRooms((prev) => new Set(prev).add(room));
    requestAnimationFrame(() => {
      document.getElementById(roomAnchor(room))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  // Picking a specific room in the header's Active Room dropdown should
  // open that room's own card automatically, matching the rest of the
  // report now scoping itself to that room.
  useEffect(() => {
    if (isFiltered) setExpandedRooms((prev) => new Set(prev).add(selectedRoom));
  }, [isFiltered, selectedRoom]);

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
            <p className="text-sm text-slate-500 mt-1">
              {isFiltered ? (
                <>
                  Showing <strong className="text-slate-700">{selectedRoom}</strong> only - switch Active Room to "All Rooms" above
                  for the full project.
                </>
              ) : (
                <>All Rooms summary followed by a per-room breakdown</>
              )}{' '}
              — {projectType === 'semi' ? 'Semi Modular (Civil-built)' : 'Full Modular (Factory prefab)'} mode.
            </p>
          </div>
          <span className="text-sm font-mono font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            {displayStats.itemCount} units{isFiltered ? ` in ${selectedRoom}` : ` across ${rooms.length} room(s)`}
          </span>
        </div>

        {/* Overview Cards - scoped to the Active Room filter when one is set */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mt-6">
          <StatCard
            icon={<Square className="w-3.5 h-3.5" />}
            label="Total Sq.ft"
            value={`${displayStats.totalAreaSqFt.toLocaleString()}`}
            sub="Cabinet face area, not panel material"
            tone="bg-slate-900 text-white"
          />
          <StatCard
            icon={<Layers className="w-3.5 h-3.5" />}
            label="Total Sheets"
            value={`${displayStats.materials.totalSheets}`}
            sub={`${displayStats.materials.totalPieces} cut pieces`}
            tone="bg-cyan-50 border border-cyan-200 text-cyan-900"
          />
          <StatCard
            icon={<Shirt className="w-3.5 h-3.5" />}
            label="Wardrobes"
            value={`${displayStats.wardrobeCount}`}
            sub={`${displayStats.wardrobeAreaSqFt.toLocaleString()} sq.ft`}
            tone="bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-900"
          />
          <StatCard
            icon={<Palette className="w-3.5 h-3.5" />}
            label="Laminate Colors"
            value={`${displayStats.laminateGroups.length}`}
            sub="Distinct finish/color combos"
            tone="bg-amber-50 border border-amber-200 text-amber-900"
          />
          <StatCard
            icon={<Ruler className="w-3.5 h-3.5" />}
            label="Edge Binding"
            value={`${edgeTotalMeters.toLocaleString()} m`}
            sub={`${displayStats.materials.edgeBand2mmMeters.toFixed(1)}m @2mm • ${displayStats.materials.edgeBand08mmMeters.toFixed(1)}m @0.8mm`}
            tone="bg-emerald-50 border border-emerald-200 text-emerald-900"
          />
          <StatCard
            icon={<Percent className="w-3.5 h-3.5" />}
            label="Material Yield"
            value={`${displayStats.materials.overallUtilizationPercent}%`}
            sub={`${displayStats.materials.wastePercent}% scrap waste`}
            tone="bg-indigo-50 border border-indigo-200 text-indigo-900"
          />
        </div>
      </div>

      {/* Section: Material & Waste */}
      <section>
        <SectionHeading
          icon={<PieChart className="w-4 h-4" />}
          title="Material & Waste"
          subtitle={isFiltered ? `${selectedRoom} + all-room comparison` : 'All rooms + per-room breakdown'}
        />
        <div className="space-y-4">
        {/* Material Usage & Waste chart - part-to-whole composition of the
            total board area bought, so it's visible at a glance how much of
            what you pay for actually becomes cabinet vs. usable offcut vs.
            true scrap. Kept full-width as the section's headline figure. */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <h4 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-1.5">
            <PieChart className="w-4 h-4 text-cyan-600" /> Material Usage & Waste ({scopeLabel})
          </h4>
          <p className="text-xs text-slate-400 mb-3">
            Of the {displayStats.materials.grossBoardAreaSqFt.toLocaleString()} sq.ft of board bought (
            {displayStats.materials.totalSheets} sheets)
          </p>
          <MaterialCompositionBar
            segments={[
              { label: 'Net Panels Used', value: displayStats.materials.netPartsAreaSqFt, color: CHART_COLOR_USED },
              { label: 'Usable Offcut', value: displayStats.materials.usableOffcutAreaSqFt, color: CHART_COLOR_OFFCUT },
              { label: 'Scrap Waste', value: displayStats.materials.totalScrapWasteSqFt, color: CHART_COLOR_WASTE },
            ]}
          />
        </div>

        {/* Material Used vs Waste by Room, and Sheets Needed by Room, side
            by side - both are per-room stacked-bar comparisons over the same
            room list, so they line up row-for-row and read as one paired
            comparison instead of two separately-scrolled full-width charts. */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <h4 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-1.5">
              <Ruler className="w-4 h-4 text-rose-600" /> Material Used vs Waste by Room
            </h4>
            <p className="text-xs text-slate-400 mb-3">
              Panel material (18/9/6mm sheet area) used vs. scrap, nested independently per room - naturally several times
              larger than that room's elevation area above, since one cabinet's box is built from many separate panels
            </p>
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
              highlightLabel={isFiltered ? selectedRoom : undefined}
            />
          </div>

          {/* Sheets Needed by Room - how many raw boards each room's own cut
              list requires, split by thickness so it's clear which rooms are
              driving the 18mm (carcass/shutter) count vs the thinner backs. */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <h4 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-violet-600" /> Sheets Needed by Room
            </h4>
            <p className="text-xs text-slate-400 mb-3">
              Raw 8×4ft boards required per room, by thickness - nested independently per room like the figures alongside
            </p>
            <StackedHorizontalBarChart
              data={[...roomStats]
                .sort((a, b) => b.materials.totalSheets - a.materials.totalSheets)
                .map((rs) => ({
                  label: rs.room,
                  values: [rs.materials.ply18mmSheets, rs.materials.ply9mmSheets, rs.materials.ply6mmSheets],
                }))}
              seriesLabels={['18mm', '9mm', '6mm']}
              seriesColors={[CHART_COLOR_18MM, CHART_COLOR_9MM, CHART_COLOR_6MM]}
              unit=" sheets"
              highlightLabel={isFiltered ? selectedRoom : undefined}
            />
          </div>
        </div>
        </div>
      </section>

      {/* Section: Sheets & Hardware */}
      <section>
        <SectionHeading icon={<Layers className="w-4 h-4" />} title="Sheets & Hardware" />
        {/* Sheet composition + hardware detail side by side */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-cyan-600" /> Sheet Requirement by Thickness ({scopeLabel})
            </h4>
            <div className="mb-4">
              <HorizontalBarChart
                data={[
                  { label: '18mm', value: displayStats.materials.ply18mmSheets },
                  { label: '9mm', value: displayStats.materials.ply9mmSheets },
                  { label: '6mm', value: displayStats.materials.ply6mmSheets },
                ]}
                color={CHART_COLOR_18MM}
                unit=" sheets"
              />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">18mm (carcass/shutter)</span>
                <span className="font-mono font-bold text-slate-800">
                  {displayStats.materials.ply18mmSheets} sheets • {displayStats.materials.ply18mmAreaSqFt.toLocaleString()} sq.ft
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">9mm</span>
                <span className="font-mono font-bold text-slate-800">
                  {displayStats.materials.ply9mmSheets} sheets • {displayStats.materials.ply9mmAreaSqFt.toLocaleString()} sq.ft
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">6mm (back panel)</span>
                <span className="font-mono font-bold text-slate-800">
                  {displayStats.materials.ply6mmSheets} sheets • {displayStats.materials.ply6mmAreaSqFt.toLocaleString()} sq.ft
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-100">
                <span className="text-slate-500">Inner / Outer Laminate Sheets</span>
                <span className="font-mono font-bold text-slate-800">
                  {displayStats.materials.innerLaminateSheets} / {displayStats.materials.outerLaminateSheets}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-amber-600" /> Hardware Requirement ({scopeLabel})
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Soft-Close Hinge Pairs</span>
                <span className="font-mono font-bold text-slate-800">{Math.ceil(displayStats.materials.softCloseHingesPairs)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Handles</span>
                <span className="font-mono font-bold text-slate-800">{displayStats.materials.handles}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Drawer Channels</span>
                <span className="font-mono font-bold text-slate-800">{displayStats.materials.drawerChannels}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-100">
                <span className="text-slate-500">Tandem Box Channels</span>
                <span className="font-mono font-bold text-slate-800">{displayStats.materials.tandemBoxChannels}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section: Finishes */}
      <section>
        <SectionHeading icon={<Palette className="w-4 h-4" />} title="Finishes" />
        {/* Laminate / Color breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
            <Palette className="w-4 h-4 text-amber-600" /> Color Laminates & Finish Breakdown ({scopeLabel})
          </h4>
          <div className="mb-4">
            <HorizontalBarChart
              data={displayStats.laminateGroups.map((g) => ({
                label: g.colorCode ? `${g.finishType} - ${g.colorCode}` : `${g.finishType} (Unspecified)`,
                value: g.areaSqFt,
              }))}
              color={CHART_COLOR_LAMINATE}
              unit=" sq.ft"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 uppercase tracking-wide text-xs border-b border-slate-200">
                  <th className="text-left py-2 pr-3">Finish Type</th>
                  <th className="text-left py-2 pr-3">Color / Laminate Code</th>
                  <th className="text-right py-2 pr-3">Units</th>
                  <th className="text-right py-2">Area (sq.ft)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayStats.laminateGroups.map((g) => (
                  <tr key={g.key}>
                    <td className="py-2 pr-3 font-semibold text-slate-800">{g.finishType}</td>
                    <td className="py-2 pr-3">
                      {g.colorCode ? (
                        <span className="font-mono font-bold text-slate-800">{g.colorCode}</span>
                      ) : (
                        <span className="italic text-slate-400">Unspecified</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono">{g.count}</td>
                    <td className="py-2 text-right font-mono font-bold">{g.areaSqFt.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="flex items-start gap-2 text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-4">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
        <span>
          <strong>Total Sq.ft</strong> at the top sums every item's Width × Length in feet (its elevation/opening area, e.g. a
          wardrobe's 8×7ft face) - it does not, and isn't meant to, match the <strong>panel material</strong> figures in the
          Used/Waste charts above. Building that wardrobe's actual carcass needs a Left Gable, Right Gable, Top Deck, Bottom
          Deck, Back Panel, Shelves, and Shutters - each its own separate 18mm/6mm sheet panel with its own area - so the real
          material area is naturally several times the cabinet's simple face area. <strong>Total Sheets</strong> and{' '}
          <strong>Edge Binding</strong> come from that same real cut list the Cutting List tab nests, so they match it exactly.
          Per-room sheet/waste figures are computed by nesting each room's parts on their own, so they'll usually sum to
          slightly more than the All Rooms totals above them — nesting the whole project together shares offcuts across rooms
          that nesting room-by-room can't.
        </span>
      </div>

      {/* Section: Room-by-Room Detail - collapsed by default so a project
          with several rooms doesn't force scrolling past everything just to
          reach the overview above; the quick-jump chips expand and scroll
          straight to one room. */}
      <section>
        <SectionHeading
          icon={<Square className="w-4 h-4" />}
          title="Room-by-Room Detail"
          action={
            <button
              onClick={() =>
                setExpandedRooms((prev) => (prev.size === rooms.length ? new Set() : new Set(rooms)))
              }
              className="text-sm font-bold text-cyan-700 hover:text-cyan-900 flex items-center gap-1"
            >
              {expandedRooms.size === rooms.length ? (
                <>
                  <ChevronsDownUp className="w-3.5 h-3.5" /> Collapse All
                </>
              ) : (
                <>
                  <ChevronsUpDown className="w-3.5 h-3.5" /> Expand All
                </>
              )}
            </button>
          }
        />

        {/* Quick-jump chips */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {roomStats.map((rs) => (
            <button
              key={rs.room}
              onClick={() => jumpToRoom(rs.room)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:border-cyan-300 hover:text-cyan-700 transition"
            >
              {rs.room}
            </button>
          ))}
        </div>

        <div className="space-y-3">
      {roomStats.map((rs) => {
        const isExpanded = expandedRooms.has(rs.room);
        return (
        <div key={rs.room} id={roomAnchor(rs.room)} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden scroll-mt-4">
          <button
            onClick={() => toggleRoom(rs.room)}
            className="w-full flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-slate-50 hover:bg-slate-100/70 transition text-left"
          >
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              {rs.room}
              <span className="text-sm font-mono font-semibold text-slate-500">({rs.itemCount} units)</span>
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700">{rs.totalAreaSqFt.toLocaleString()} sq.ft</span>
              <span className="px-3 py-1 rounded-full bg-cyan-100 text-cyan-800">{rs.materials.totalSheets} sheets</span>
              <span className="px-3 py-1 rounded-full bg-fuchsia-100 text-fuchsia-800">{rs.wardrobeCount} wardrobe(s)</span>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
                {(rs.materials.edgeBand2mmMeters + rs.materials.edgeBand08mmMeters).toFixed(1)}m edge band
              </span>
            </div>
          </button>

          {isExpanded && (
          <div className="p-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 uppercase tracking-wide text-xs border-b border-slate-200">
                  <th className="text-left py-2 pr-3">Finish Type</th>
                  <th className="text-left py-2 pr-3">Color / Laminate Code</th>
                  <th className="text-right py-2 pr-3">Units</th>
                  <th className="text-right py-2">Area (sq.ft)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rs.laminateGroups.map((g) => (
                  <tr key={g.key}>
                    <td className="py-2 pr-3 font-semibold text-slate-800">{g.finishType}</td>
                    <td className="py-2 pr-3">
                      {g.colorCode ? (
                        <span className="font-mono font-bold text-slate-800">{g.colorCode}</span>
                      ) : (
                        <span className="italic text-slate-400">Unspecified</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono">{g.count}</td>
                    <td className="py-2 text-right font-mono font-bold">{g.areaSqFt.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
        );
      })}
        </div>
      </section>
    </div>
  );
};
