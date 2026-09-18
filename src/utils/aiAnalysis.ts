// Deterministic, rules-based "AI Analysis" engine. Every number and finding
// here is computed straight from the project's own data (the uploaded Excel
// rows, the generated cut list, and the same sheet-nesting algorithm the
// Cutting List tab uses) - there is no external AI model call. It reuses
// calculator.ts as the single source of truth so its numbers always agree
// with the rest of the app instead of drifting into a second formula.
import { ModularItem, CutListPart, MaterialBreakdown, ProjectType, WallType, UnitCategory } from '../types';
import {
  calculateMaterialUsage,
  generateSheetNestingLayouts,
  getShutterLayout,
  hasShutterDoors,
  getEffectiveDepthMm,
} from './calculator';

export type FindingSeverity = 'critical' | 'warning' | 'info';

export interface Finding {
  id: string;
  severity: FindingSeverity;
  category: string;
  room: string;
  itemName?: string;
  message: string;
}

export interface RoomUnderstanding {
  room: string;
  itemCount: number;
  totalAreaSqFt: number;
  categoryCounts: { category: UnitCategory; count: number }[];
  materialCounts: { material: string; count: number }[];
  finishCounts: { finish: string; count: number }[];
  widthRangeMm: [number, number];
  heightRangeMm: [number, number];
  totalShutters: number;
  totalDrawers: number;
  totalShelves: number;
}

export interface WallSummary {
  room: string;
  wall: WallType;
  itemCount: number;
  totalWidthMm: number;
  heightRangeMm: [number, number];
}

export interface CadGeometryNote {
  room: string;
  severity: FindingSeverity;
  message: string;
}

export interface LowYieldSheet {
  sheetId: string;
  room: string;
  thicknessMm: number;
  utilizationPercent: number;
}

export interface CuttingOptimizationResult {
  combinedSheets: number;
  perRoomSheets: number;
  sheetsSaved: number;
  areaSavedSqFt: number;
  // A simple shelf-nesting algorithm (see generateSheetNestingLayouts)
  // naturally leaves plenty of individual sheets under 60% on any real
  // project - that's the algorithm's normal behavior on odd-sized parts,
  // not each one a distinct fixable defect. lowYieldCount is the honest
  // total; lowYieldSheets is only the worst few, for a concrete example.
  lowYieldCount: number;
  lowYieldSheets: LowYieldSheet[];
}

export interface MaterialOptimizationResult {
  materials: MaterialBreakdown;
  suggestions: string[];
}

export interface PanelSummary {
  partName: string;
  pieceCount: number;
  totalAreaSqFt: number;
  minDimMm: number;
  maxDimMm: number;
}

export interface ProductionAnalysisResult {
  panelSummary: PanelSummary[];
  totalPieces: number;
  totalLabelsNeeded: number;
  edgeBand2mmMeters: number;
  edgeBand08mmMeters: number;
  hingePairs: number;
  handles: number;
  drawerChannels: number;
  tandemBoxChannels: number;
  minifixSets: number;
  shelfSupports: number;
}

export interface QualityCheckResult {
  rule: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface AIAnalysisResult {
  itemCount: number;
  roomUnderstanding: RoomUnderstanding[];
  wallSummaries: WallSummary[];
  cadNotes: CadGeometryNote[];
  findings: Finding[];
  cuttingOptimization: CuttingOptimizationResult;
  materialOptimization: MaterialOptimizationResult;
  production: ProductionAnalysisResult;
  qualityChecks: QualityCheckResult[];
  overallScore: number;
}

const range = (values: number[]): [number, number] =>
  values.length === 0 ? [0, 0] : [Math.min(...values), Math.max(...values)];

const countBy = <T extends string>(values: T[]): { key: T; count: number }[] => {
  const map = new Map<T, number>();
  values.forEach((v) => map.set(v, (map.get(v) || 0) + 1));
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
};

// 1. Excel -> Room Understanding: what the uploaded sheet actually contains,
// grouped by room - dimensions, categories, materials, hardware quantities.
function buildRoomUnderstanding(items: ModularItem[]): RoomUnderstanding[] {
  const rooms = Array.from(new Set(items.map((i) => i.room)));
  return rooms.map((room) => {
    const roomItems = items.filter((i) => i.room === room);
    return {
      room,
      itemCount: roomItems.length,
      totalAreaSqFt: Number(roomItems.reduce((s, i) => s + i.widthFt * i.heightFt * (i.quantity || 1), 0).toFixed(1)),
      categoryCounts: countBy(roomItems.map((i) => i.category)).map((c) => ({ category: c.key, count: c.count })),
      materialCounts: countBy(roomItems.map((i) => i.coreMaterial)).map((c) => ({ material: c.key, count: c.count })),
      finishCounts: countBy(roomItems.map((i) => i.finishType)).map((c) => ({ finish: c.key, count: c.count })),
      widthRangeMm: range(roomItems.map((i) => i.widthMm)),
      heightRangeMm: range(roomItems.map((i) => i.heightMm)),
      totalShutters: roomItems.reduce((s, i) => s + (hasShutterDoors(i) ? getShutterLayout(i).count : 0), 0),
      totalDrawers: roomItems.reduce((s, i) => s + (i.drawerCount || 0), 0),
      totalShelves: roomItems.reduce((s, i) => s + Math.max(0, i.shelfCount ?? 0), 0),
    };
  });
}

// 2. 2D CAD Analysis: the same per-room-per-wall grouping the interactive
// CAD elevation draws, plus a soft heuristic flag when opposite walls of the
// same room carry very different total cabinet widths - worth a human
// glance (a real alcove/door, or a missing/duplicated Excel row) since this
// app has no real room-boundary geometry to check a hard wall length against.
function buildWallSummaries(items: ModularItem[]): WallSummary[] {
  const rooms = Array.from(new Set(items.map((i) => i.room)));
  const walls: WallType[] = ['front', 'left', 'right', 'back'];
  const summaries: WallSummary[] = [];
  rooms.forEach((room) => {
    walls.forEach((wall) => {
      const wallItems = items.filter((i) => i.room === room && i.wall === wall);
      if (wallItems.length === 0) return;
      summaries.push({
        room,
        wall,
        itemCount: wallItems.length,
        totalWidthMm: wallItems.reduce((s, i) => s + i.widthMm * (i.quantity || 1), 0),
        heightRangeMm: range(wallItems.map((i) => i.heightMm)),
      });
    });
  });
  return summaries;
}

function buildCadNotes(items: ModularItem[], wallSummaries: WallSummary[]): CadGeometryNote[] {
  const notes: CadGeometryNote[] = [];
  const rooms = Array.from(new Set(items.map((i) => i.room)));
  const find = (room: string, wall: WallType) => wallSummaries.find((w) => w.room === room && w.wall === wall);

  rooms.forEach((room) => {
    const pairs: [WallType, WallType][] = [
      ['front', 'back'],
      ['left', 'right'],
    ];
    pairs.forEach(([a, b]) => {
      const wa = find(room, a);
      const wb = find(room, b);
      if (!wa || !wb) return;
      const diff = Math.abs(wa.totalWidthMm - wb.totalWidthMm);
      if (diff > 300) {
        notes.push({
          room,
          severity: 'info',
          message: `${a} wall cabinets total ${wa.totalWidthMm}mm vs ${b} wall ${wb.totalWidthMm}mm (Δ${diff}mm) - confirm this is a real door/window/alcove and not a missing or duplicated Excel row.`,
        });
      }
    });
  });

  return notes;
}

// 3. Error Detection: missing dimensions, impossible sizes, insufficient
// clearance, duplicate items, and Excel/CAD inconsistencies.
function detectErrors(items: ModularItem[], projectType: ProjectType): Finding[] {
  const findings: Finding[] = [];
  let seq = 0;
  const push = (f: Omit<Finding, 'id'>) => findings.push({ ...f, id: `f${seq++}` });

  items.forEach((item) => {
    const label = `#${item.sNo} ${item.description}`;

    // Missing dimensions
    if (!item.widthMm || item.widthMm <= 0) {
      push({ severity: 'critical', category: 'Missing Dimension', room: item.room, itemName: label, message: `${label} has no width set - the cutting list can't produce real panel sizes for this row.` });
    }
    if (!item.heightMm || item.heightMm <= 0) {
      push({ severity: 'critical', category: 'Missing Dimension', room: item.room, itemName: label, message: `${label} has no height set - the cutting list can't produce real panel sizes for this row.` });
    }

    // Implausible cabinet sizes (factory sanity bounds)
    if (item.widthMm > 0 && (item.widthMm < 150 || item.widthMm > 4000)) {
      push({ severity: 'warning', category: 'Implausible Size', room: item.room, itemName: label, message: `${label} width is ${item.widthMm}mm - outside the realistic 150-4000mm range for one cabinet run; check against the Excel sheet.` });
    }
    if (item.heightMm > 0 && (item.heightMm < 150 || item.heightMm > 3200)) {
      push({ severity: 'warning', category: 'Implausible Size', room: item.room, itemName: label, message: `${label} height is ${item.heightMm}mm - outside the realistic 150-3200mm range.` });
    }
    if (item.depthMm > 0 && (item.depthMm < 200 || item.depthMm > 900)) {
      push({ severity: 'warning', category: 'Implausible Size', room: item.room, itemName: label, message: `${label} depth is ${item.depthMm}mm - unusual for a ${item.category.replace(/_/g, ' ')}; typical factory depths run 300-650mm.` });
    }

    // Insufficient door clearance - very wide needs heavier hardware, very
    // narrow can't open comfortably. Thresholds are set above the app's own
    // default auto-split widths (600-800mm is normal factory practice for a
    // single wardrobe/loft shutter) so this flags genuinely oversized or
    // undersized doors rather than the app's everyday default sizing.
    // Checked once per distinct width (not once per shutter) since an
    // even auto-split gives every shutter on an item the same width.
    if (hasShutterDoors(item) && item.widthMm > 0) {
      const { widths } = getShutterLayout(item);
      const distinctWidths = Array.from(new Set(widths));
      distinctWidths.forEach((w) => {
        const shareCount = widths.filter((x) => x === w).length;
        const shutterWord = shareCount > 1 ? `${shareCount} shutters` : '1 shutter';
        if (w > 900) {
          push({ severity: 'warning', category: 'Door Clearance', room: item.room, itemName: label, message: `${label} has ${shutterWord} at ${w}mm wide - doors over 900mm need heavier hinges and more swing clearance; consider splitting into more shutters.` });
        } else if (w < 200) {
          push({ severity: 'warning', category: 'Door Clearance', room: item.room, itemName: label, message: `${label} has ${shutterWord} only ${w}mm wide - too narrow to open comfortably; reduce the shutter count or widen the item.` });
        }
      });
    }

    // Inconsistent Excel/CAD data
    const shouldBeVolume = item.depthFt > 0;
    if (shouldBeVolume && item.calcBasis !== 'Volume (Cu.ft)') {
      push({ severity: 'info', category: 'Inconsistent Data', room: item.room, itemName: label, message: `${label} has a depth set but its calc basis is "${item.calcBasis}" instead of Volume (Cu.ft).` });
    }
    if (!shouldBeVolume && item.calcBasis === 'Volume (Cu.ft)') {
      push({ severity: 'info', category: 'Inconsistent Data', room: item.room, itemName: label, message: `${label} has no depth set but its calc basis is still "Volume (Cu.ft)".` });
    }
    if (item.shutterWidthOverrides && item.shutterWidthOverrides.length > 0) {
      const { count } = getShutterLayout(item);
      if (item.shutterWidthOverrides.length !== count) {
        push({ severity: 'info', category: 'Inconsistent Data', room: item.room, itemName: label, message: `${label} has ${item.shutterWidthOverrides.length} saved per-shutter width override(s) but currently needs ${count} shutter(s) - the overrides are being ignored until they match.` });
      }
    }
    if (item.depthMm === 0 && projectType === 'full' && getEffectiveDepthMm(item, 'full') > 0) {
      push({ severity: 'info', category: 'Inconsistent Data', room: item.room, itemName: label, message: `${label} has no depth entered - Full Modular is defaulting it to ${getEffectiveDepthMm(item, 'full')}mm for this category; enter a real depth if that's not correct.` });
    }
  });

  // Duplicate items: identical room+wall+name+dimensions
  const dupMap = new Map<string, ModularItem[]>();
  items.forEach((i) => {
    const key = `${i.room}|${i.wall}|${i.description.trim().toLowerCase()}|${i.widthMm}|${i.heightMm}|${i.depthMm}`;
    dupMap.set(key, [...(dupMap.get(key) || []), i]);
  });
  dupMap.forEach((group) => {
    if (group.length > 1) {
      const sNos = group.map((i) => `#${i.sNo}`).join(', ');
      push({ severity: 'warning', category: 'Duplicate Item', room: group[0].room, itemName: group[0].description, message: `${sNos} in ${group[0].room} are identical (same name, wall, width, height, depth) - confirm these are really separate units and not a duplicated Excel row.` });
    }
  });

  // Duplicate serial numbers - a genuine Excel data integrity problem
  const sNoMap = new Map<number, ModularItem[]>();
  items.forEach((i) => sNoMap.set(i.sNo, [...(sNoMap.get(i.sNo) || []), i]));
  sNoMap.forEach((group, sNo) => {
    if (group.length > 1) {
      push({ severity: 'critical', category: 'Duplicate Serial Number', room: group.map((i) => i.room).join(', '), message: `S.No ${sNo} is used by ${group.length} different rows (${group.map((i) => i.description).join(', ')}) - every row should have a unique S.No.` });
    }
  });

  return findings;
}

// 4. Cutting Optimization: compare nesting every room independently
// (what each room would use on its own) against nesting the whole project
// together (what the real Cutting List tab does) using the exact same
// sheet-nesting algorithm, plus flag any sheet that came out with low yield.
function analyzeCuttingOptimization(items: ModularItem[], cutList: CutListPart[]): CuttingOptimizationResult {
  const { layouts: combinedLayouts } = generateSheetNestingLayouts(cutList);
  const combinedSheets = combinedLayouts.length;

  const rooms = Array.from(new Set(items.map((i) => i.room)));
  let perRoomSheets = 0;
  rooms.forEach((room) => {
    const roomCutList = cutList.filter((p) => p.room === room);
    if (roomCutList.length === 0) return;
    perRoomSheets += generateSheetNestingLayouts(roomCutList).layouts.length;
  });

  const sheetsSaved = Math.max(0, perRoomSheets - combinedSheets);
  const belowTarget = combinedLayouts
    .filter((l) => l.utilizationPercent < 60)
    .sort((a, b) => a.utilizationPercent - b.utilizationPercent);
  const lowYieldSheets: LowYieldSheet[] = belowTarget.slice(0, 10).map((l) => ({
    sheetId: l.sheetId,
    room: l.parts[0]?.room || '-',
    thicknessMm: l.thicknessMm,
    utilizationPercent: l.utilizationPercent,
  }));

  return {
    combinedSheets,
    perRoomSheets,
    sheetsSaved,
    areaSavedSqFt: Number((sheetsSaved * 32.07).toFixed(1)),
    lowYieldCount: belowTarget.length,
    lowYieldSheets,
  };
}

// 5. Material Optimization: the real board/sheet requirement (already
// computed by calculateMaterialUsage) plus plain-language opportunities to
// cut waste further.
function analyzeMaterialOptimization(materials: MaterialBreakdown, cutting: CuttingOptimizationResult): MaterialOptimizationResult {
  const suggestions: string[] = [];
  if (materials.wastePercent > 12) {
    suggestions.push(`Scrap waste is ${materials.wastePercent}% of board bought - above the ~10% factory target. Review large shutter/gable width groupings for panels that could share a common width to nest tighter.`);
  }
  if (cutting.sheetsSaved > 0) {
    suggestions.push(`Nesting every room together (as the Cutting List tab already does) instead of room-by-room saves ${cutting.sheetsSaved} sheet(s) - about ${cutting.areaSavedSqFt} sq.ft of board.`);
  }
  if (materials.usableOffcutAreaSqFt > 0) {
    suggestions.push(`${materials.usableOffcutAreaSqFt} sq.ft of usable offcut is available from the current nesting; ${materials.skirtingFromOffcutsMeters}m of the ${materials.skirtingLinearMeters}m skirting run is already planned to come from these offcuts instead of new board.`);
  }
  if (cutting.combinedSheets > 0 && cutting.lowYieldCount / cutting.combinedSheets > 0.3) {
    suggestions.push(`${cutting.lowYieldCount} of ${cutting.combinedSheets} sheets (${Math.round((cutting.lowYieldCount / cutting.combinedSheets) * 100)}%) came out below 60% utilization - typical for a simple strip-nesting pass on many odd-sized shelves/battens; see the worst examples under Cutting Optimization below.`);
  }
  if (suggestions.length === 0) {
    suggestions.push('No further material savings found - current nesting and waste are within the factory target range.');
  }
  return { materials, suggestions };
}

// 6. Production Analysis: panel-by-panel manufacturing summary - sizes,
// edge banding, hardware/drilling counts, and how many physical labels the
// factory floor needs to print.
function analyzeProduction(cutList: CutListPart[], materials: MaterialBreakdown): ProductionAnalysisResult {
  const byPart = new Map<string, CutListPart[]>();
  cutList.forEach((p) => byPart.set(p.partName, [...(byPart.get(p.partName) || []), p]));

  const panelSummary: PanelSummary[] = Array.from(byPart.entries()).map(([partName, parts]) => {
    const pieceCount = parts.reduce((s, p) => s + p.qty, 0);
    const totalAreaSqFt = Number((parts.reduce((s, p) => s + p.areaSqMt, 0) * 10.7639).toFixed(1));
    const dims = parts.flatMap((p) => [p.lengthMm, p.widthMm]);
    const [minDimMm, maxDimMm] = range(dims);
    return { partName, pieceCount, totalAreaSqFt, minDimMm, maxDimMm };
  }).sort((a, b) => b.pieceCount - a.pieceCount);

  return {
    panelSummary,
    totalPieces: materials.totalPieces,
    totalLabelsNeeded: materials.totalPieces,
    edgeBand2mmMeters: materials.edgeBand2mmMeters,
    edgeBand08mmMeters: materials.edgeBand08mmMeters,
    hingePairs: materials.softCloseHingesPairs,
    handles: materials.handles,
    drawerChannels: materials.drawerChannels,
    tandemBoxChannels: materials.tandemBoxChannels,
    minifixSets: materials.fastenersMinifixCount,
    shelfSupports: materials.shelfSupports,
  };
}

const FLOOR_CATEGORIES: UnitCategory[] = ['wardrobe_shutter', 'single_wardrobe', 'kitchen_base', 'sitting_box', 'dressing_unit', 'tandem_box'];

// 7. Quality Check: predefined factory rules run against the real cut list,
// each with a deterministic pass/warn/fail - not a subjective AI opinion.
function runQualityChecks(items: ModularItem[], cutList: CutListPart[]): QualityCheckResult[] {
  const checks: QualityCheckResult[] = [];

  const shutters = cutList.filter((p) => p.partName === 'Shutter');
  const unbanded = shutters.filter((p) => !(p.edgeL1 && p.edgeL2 && p.edgeW1 && p.edgeW2));
  checks.push({
    rule: 'Every shutter is edge-banded on all 4 sides',
    status: shutters.length === 0 ? 'pass' : unbanded.length === 0 ? 'pass' : 'fail',
    detail: shutters.length === 0
      ? 'No shutter panels in this project.'
      : unbanded.length === 0
      ? `${shutters.length} shutter panel(s) checked - all 4 edges banded.`
      : `${unbanded.length} of ${shutters.length} shutter panel(s) are missing edge banding on at least one side.`,
  });

  const gableItemIds = new Set(cutList.filter((p) => p.partName === 'Left Gable').map((p) => p.itemId));
  const backItemIds = new Set(cutList.filter((p) => p.partName === 'Back Panel').map((p) => p.itemId));
  const missingBack = Array.from(gableItemIds).filter((id) => !backItemIds.has(id));
  checks.push({
    rule: 'Every carcass box has a back panel',
    status: gableItemIds.size === 0 ? 'pass' : missingBack.length === 0 ? 'pass' : 'fail',
    detail: gableItemIds.size === 0
      ? 'No carcass boxes in this project.'
      : missingBack.length === 0
      ? `${gableItemIds.size} carcass box(es) checked - all have a back panel.`
      : `${missingBack.length} of ${gableItemIds.size} carcass box(es) are missing a back panel.`,
  });

  const floorItems = items.filter((i) => FLOOR_CATEGORIES.includes(i.category));
  const skirtingItemIds = new Set(cutList.filter((p) => p.partName === 'Pelmet/Skirting').map((p) => p.itemId));
  const missingSkirting = floorItems.filter((i) => !skirtingItemIds.has(i.id));
  checks.push({
    rule: 'Every floor-standing unit has a skirting plinth',
    status: floorItems.length === 0 ? 'pass' : missingSkirting.length === 0 ? 'pass' : 'warn',
    detail: floorItems.length === 0
      ? 'No floor-standing units in this project.'
      : missingSkirting.length === 0
      ? `${floorItems.length} floor-standing unit(s) checked - all have a skirting plinth.`
      : `${missingSkirting.length} of ${floorItems.length} floor-standing unit(s) have no skirting plinth: ${missingSkirting.slice(0, 5).map((i) => `#${i.sNo}`).join(', ')}${missingSkirting.length > 5 ? '…' : ''}.`,
  });

  const missingColor = items.filter((i) => !i.laminateColorCode || !i.laminateColorCode.trim());
  checks.push({
    rule: 'Laminate / finish color code specified',
    status: items.length === 0 || missingColor.length === 0 ? 'pass' : missingColor.length < items.length * 0.3 ? 'warn' : 'fail',
    detail: items.length === 0
      ? 'No items in this project.'
      : missingColor.length === 0
      ? `All ${items.length} item(s) have a laminate/finish color code.`
      : `${missingColor.length} of ${items.length} item(s) have no laminate color code set - confirm the finish before production.`,
  });

  const wideShelfItems = items.filter((i) => (i.shelfCount ?? 0) > 0 && Math.max(100, i.widthMm - 36) > 900);
  checks.push({
    rule: 'Shelf span within safe unsupported limit (≤900mm)',
    status: wideShelfItems.length === 0 ? 'pass' : 'warn',
    detail: wideShelfItems.length === 0
      ? 'All shelves are within the 900mm safe unsupported span.'
      : `${wideShelfItems.length} item(s) have shelves wider than 900mm - add a center support batten to prevent sagging: ${wideShelfItems.slice(0, 5).map((i) => `#${i.sNo}`).join(', ')}${wideShelfItems.length > 5 ? '…' : ''}.`,
  });

  return checks;
}

function computeOverallScore(findings: Finding[], qualityChecks: QualityCheckResult[]): number {
  let score = 100;
  findings.forEach((f) => {
    score -= f.severity === 'critical' ? 8 : f.severity === 'warning' ? 3 : 1;
  });
  qualityChecks.forEach((q) => {
    score -= q.status === 'fail' ? 6 : q.status === 'warn' ? 2 : 0;
  });
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function runAIAnalysis(items: ModularItem[], cutList: CutListPart[], projectType: ProjectType): AIAnalysisResult {
  const roomUnderstanding = buildRoomUnderstanding(items);
  const wallSummaries = buildWallSummaries(items);
  const cadNotes = buildCadNotes(items, wallSummaries);
  const findings = detectErrors(items, projectType);
  const cuttingOptimization = analyzeCuttingOptimization(items, cutList);
  const materials = calculateMaterialUsage(cutList);
  const materialOptimization = analyzeMaterialOptimization(materials, cuttingOptimization);
  const production = analyzeProduction(cutList, materials);
  const qualityChecks = runQualityChecks(items, cutList);
  const overallScore = computeOverallScore(findings, qualityChecks);

  return {
    itemCount: items.length,
    roomUnderstanding,
    wallSummaries,
    cadNotes,
    findings,
    cuttingOptimization,
    materialOptimization,
    production,
    qualityChecks,
    overallScore,
  };
}
