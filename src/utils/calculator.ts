import {
  ModularItem,
  CutListPart,
  MaterialBreakdown,
  CostBreakdown,
  FactoryRates,
  ProjectType,
  SheetLayout,
  RoomPerimeterInfo,
  RoomSkirtingOptions,
  RoomBoxRow,
  WallType,
  HardwareRules,
  HingeRule,
  HardwareBOMLine,
  AggregatedHardwareLine,
  LeftoverInventoryRow,
  MaterialReuseSummary,
} from '../types';

// Standard sheet dimensions in mm
export const SHEET_LENGTH_MM = 2440;
export const SHEET_WIDTH_MM = 1220;
export const SAW_KERF_MM = 4;

// Factory-configurable hardware quantity rules. These are defaults only -
// the factory admin can edit every value from the Hardware Rules panel;
// nothing here should be read as a permanent, un-overridable assumption.
// The hinge thresholds and shelf-pin count match this app's own prior
// hardcoded behavior exactly, so turning them into editable rules doesn't
// shift any existing estimate until an admin actually changes one.
export const DEFAULT_HARDWARE_RULES: HardwareRules = {
  hingeRules: [
    { maxHeightMm: 1500, hinges: 2 },
    { maxHeightMm: 2100, hinges: 3 },
    { maxHeightMm: Infinity, hinges: 4 },
  ],
  handlesPerShutter: 1,
  handlesPerDrawer: 1,
  shelfPinsPerShelf: 4,
  boxJoiningSystem: 'minifix_dowel',
  minifixSetsPerBox: 8, // 2 sets per corner x 4 corners (Top/Bottom x Left/Right)
  dowelsPerBox: 8, // 1 dowel per minifix set
  confirmatScrewsPerBox: 12,
  bracketsPerBox: 8,
  bracketScrewsPerBracket: 2,
  backPanelFixing: 'staples',
  backPanelFixingSpacingMm: 150,
  skirtingClipSpacingMm: 400,
};

// Resolves how many hinges a shutter of a given height needs, from the
// factory's own configured rule table - never a single hardcoded number
// for every shutter. Rules are checked in ascending maxHeightMm order; the
// first one the shutter's height fits under wins. A rule table with no
// entry tall enough to cover a given shutter falls back to the tallest
// configured rule rather than silently returning nothing.
export function getHingeCountForHeight(heightMm: number, hingeRules: HingeRule[]): number {
  const sorted = [...hingeRules].sort((a, b) => a.maxHeightMm - b.maxHeightMm);
  for (const rule of sorted) {
    if (heightMm <= rule.maxHeightMm) return rule.hinges;
  }
  return sorted[sorted.length - 1]?.hinges ?? 2;
}

// Resolve the working carcass depth for an item under a given project mode.
// Semi Modular items left blank (depthMm 0) are civil-built shutter/frame
// units with no factory box. Full Modular always fabricates a full carcass,
// so blank depths fall back to factory-standard defaults per category.
export function getEffectiveDepthMm(item: ModularItem, effectiveProjectType: ProjectType): number {
  // Expo/Dummy pieces are flat 2D panels per the factory's own rule - no
  // depth at all, under either Semi or Full Modular, regardless of the
  // fallback depths every other category gets when Full Modular assumes a
  // real factory box.
  if (item.category === 'expo' || item.category === 'dummy') return 0;
  // The two construction methods are never mixed: Semi Modular is Frame +
  // Shutter with no factory-built box at all, so it never has an
  // "effective" fabrication depth - regardless of any depth value that
  // happens to be present on the row. Only Full Modular ever fabricates a
  // real depth (the row's own value, or a category fallback below).
  if (effectiveProjectType !== 'full') return 0;
  let d = item.depthMm;
  if (d === 0) {
    if (item.category === 'wardrobe_shutter' || item.category === 'single_wardrobe') d = 560;
    else if (item.category === 'kitchen_base' || item.category === 'tandem_box') d = 560;
    else if (item.category === 'kitchen_overhead' || item.category === 'loft' || item.category === 'kitchen_loft') d = 330;
    else if (item.category === 'sitting_box') d = 488;
    else d = 350;
  }
  return d;
}

// Free-text material override for the exported/display material label.
// Falls back to the structured coreMaterial dropdown when left blank.
export function getCoreMaterialLabel(item: ModularItem): string {
  return item.materialCode?.trim() ? item.materialCode.trim() : item.coreMaterial;
}

// The finish type alone ("Laminate") doesn't say which color - two items
// both finished in "Laminate" can be completely different physical boards
// (Ivory vs. Walnut). Folding the color code in here makes this the real
// purchasable-board identity, used both for display and as the sheet
// nesting compatibility key below, so different colors never get nested
// onto the same physical sheet.
export function getFinishLabel(item: ModularItem): string {
  return item.laminateColorCode?.trim() ? `${item.finishType} - ${item.laminateColorCode.trim()}` : item.finishType;
}

// Single source of truth for how many shutters an item gets and how wide
// each one is - used by the real cut list below, the interactive 2D CAD
// elevation, and the printable layout, so all three always agree with each
// other instead of drifting into separate near-duplicate formulas.
//
// `widths` is per-shutter, left to right. By default every shutter gets an
// even auto-split of the item's total width, but `item.shutterWidthOverrides`
// (set from the 2D CAD layout's shutter editor) lets each shutter be sized
// independently - e.g. two unequal wardrobe doors instead of a plain 50/50
// split. `shutterWidthMm` is kept as the first shutter's width for older
// call sites that only care about the even-split case.
export function getShutterLayout(item: ModularItem): { count: number; widths: number[]; shutterWidthMm: number; gapMm: number } {
  const w = item.widthMm;
  const count = Math.max(1, item.shutterCount ?? (w > 1800 ? 4 : w > 1000 ? 3 : w > 500 ? 2 : 1));
  const gapMm = count > 1 ? 3 : 0;
  // Floored, not rounded: see the note in generateCutListForItem - rounding
  // up even by 0.5mm compounds across every shutter sharing this one width.
  const evenWidthMm = Math.floor((w - (count - 1) * gapMm) / count);
  const overrides = item.shutterWidthOverrides;
  const widths =
    overrides && overrides.length === count && overrides.every((x) => x > 0)
      ? overrides
      : Array.from({ length: count }, () => evenWidthMm);
  return { count, widths, shutterWidthMm: widths[0], gapMm };
}

// Resizes one shutter and spreads the difference evenly across the rest, so
// they always sum to exactly the cabinet's fixed opening width - editing one
// in isolation would otherwise overflow past the carcass (or leave a gap)
// since the opening itself doesn't move. Shared by the 2D CAD layout's
// per-shutter editor and the Item Inspector Drawer's shutter list, so
// editing from either place produces identical results.
export function redistributeShutterWidths(item: ModularItem, editIndex: number, newWidthMm: number): number[] {
  const { count, widths, gapMm } = getShutterLayout(item);
  if (count < 2) return widths;
  const MIN_SHUTTER_MM = 50;
  const availableWidthMm = item.widthMm - (count - 1) * gapMm;
  const others = count - 1;
  const edited = Math.min(Math.max(newWidthMm, MIN_SHUTTER_MM), availableWidthMm - others * MIN_SHUTTER_MM);
  const remaining = availableWidthMm - edited;
  const evenOther = Math.floor(remaining / others);
  const lastOtherExtra = remaining - evenOther * others;
  let otherSeen = 0;
  return Array.from({ length: count }, (_, i) => {
    if (i === editIndex) return edited;
    otherSeen++;
    return otherSeen === others ? evenOther + lastOtherExtra : evenOther;
  });
}

// Whether an item has doors drawn/cut at all - excludes drawer-only units
// and flat panel/partition categories that never get hinged shutters, and
// any item explicitly set to 0 shutters (an open expo/display unit with no
// doors at all, not just "use the default door count").
export function hasShutterDoors(item: ModularItem): boolean {
  return (
    item.shutterCount !== 0 &&
    item.category !== 'tv_panel' &&
    item.category !== 'partition' &&
    item.category !== 'tandem_box'
  );
}

// Color palette for nesting diagram
const PART_COLORS: Record<string, string> = {
  'Shutter': '#3b82f6', // blue
  'Left Gable': '#10b981', // emerald
  'Right Gable': '#059669', // darker emerald
  'Top Deck': '#f59e0b', // amber
  'Bottom Deck': '#d97706', // dark amber
  'Back Panel': '#8b5cf6', // purple
  'Internal Shelf': '#06b6d4', // cyan
  'Drawer Front': '#ec4899', // pink
  'Drawer Side': '#f43f5e', // rose
  'Drawer Bottom': '#6366f1', // indigo
  'Pelmet/Skirting': '#14b8a6', // teal (skirting plinth & pelmet)
  'Expo/Dummy Panel': '#eab308', // yellow (flat exposed/filler panel)
};

// Converts ft to mm with standard factory rounding
export function ftToMm(ft: number): number {
  return Math.round(ft * 304.8);
}

// Converts mm to ft rounded to 2 decimals
export function mmToFt(mm: number): number {
  return Number((mm / 304.8).toFixed(2));
}

// Recalculate area and volume for an item
export function recalculateItemMetrics(item: ModularItem): ModularItem {
  const widthMm = ftToMm(item.widthFt);
  const heightMm = ftToMm(item.heightFt);
  const depthMm = item.depthFt > 0 ? ftToMm(item.depthFt) : 0;

  const areaSqFt = Number((item.widthFt * item.heightFt).toFixed(2));
  const volumeCuFt = item.depthFt > 0 ? Number((item.widthFt * item.heightFt * item.depthFt).toFixed(2)) : 0;
  const calcBasis = item.depthFt > 0 ? 'Volume (Cu.ft)' : 'Area (Sq.ft)';

  return {
    ...item,
    widthMm,
    heightMm,
    depthMm,
    areaSqFt,
    volumeCuFt,
    calcBasis,
  };
}

// A user can manually pin a specific part TYPE (e.g. "Shutter" or "Left
// Gable") to Fabric or Color/Laminate, and separately pin its own
// both-sides selection, by clicking it in the 3D isometric view or in the
// Item Inspector's cut list - see ModularItem.materialOverrides and
// fabricBothSidesOverrides. Both take precedence over the item-wide
// automatic BOX/SHUTTER material rule and fabricBothSides checkbox, and
// apply uniformly to every generated part of that type on this item (e.g.
// every door of a multi-door wardrobe's Shutter parts).
function finalizeParts(parts: CutListPart[], item: ModularItem): void {
  const coreLabel = getCoreMaterialLabel(item);
  for (const part of parts) {
    const materialOverride = item.materialOverrides?.[part.partName];
    if (materialOverride) {
      part.materialCategory = materialOverride;
      part.backMaterialCategory = materialOverride;
      // Keep the displayed material label in sync with the override,
      // instead of leaving it showing whichever material the automatic
      // rule would have picked.
      part.material =
        materialOverride === 'Fabric' ? `${coreLabel} (Fabric)` : `${coreLabel} (${getFinishLabel(item)})`;
    }
    // Both-sides only ever means anything on a Fabric-backed box part - a
    // shutter-type part (Color/Laminate) never has a fabric face to double.
    if (part.backMaterialCategory === 'Fabric') {
      const bothSidesOverride = item.fabricBothSidesOverrides?.[part.partName];
      part.fabricBothSides = bothSidesOverride !== undefined ? bothSidesOverride : item.fabricBothSides ?? false;
    } else {
      part.fabricBothSides = undefined;
    }
  }
}

// Generate real-time cut list parts for an item
export function generateCutListForItem(item: ModularItem, globalProjectType: ProjectType): CutListPart[] {
  const parts: CutListPart[] = [];
  const pType = item.projectType || globalProjectType;

  const w = item.widthMm;
  const h = item.heightMm;

  // EXPO ("exposed/visible") and DUMMY ("dummy/filler/cover") pieces are
  // both flat 2D panels per the factory's own rule: Length x Width only,
  // no Depth/Thickness used in the calculation at all. They skip every
  // section below (shutters, drawers, carcass box, internal shelves,
  // skirting) entirely - there's no box to build - and just cut one flat
  // panel in the item's own selected color, since the panel itself IS the
  // visible/exposed face.
  if (item.category === 'expo' || item.category === 'dummy') {
    parts.push({
      id: `${item.id}-panel`,
      itemId: item.id,
      room: item.room,
      itemName: item.description,
      wall: item.wall,
      partName: 'Expo/Dummy Panel',
      lengthMm: h,
      widthMm: w,
      thicknessMm: 18,
      qty: 1,
      material: `${getCoreMaterialLabel(item)} (${getFinishLabel(item)})`,
      materialCategory: 'Color/Laminate',
      // No fabric on a shutter-type panel, per the factory's own rule -
      // this is one Color/Laminate piece, not a mixed two-face panel.
      backMaterialCategory: 'Color/Laminate',
      edgeL1: true,
      edgeL2: true,
      edgeW1: true,
      edgeW2: true,
      edgeThicknessMm: 2.0,
      grainDirection: 'any',
      canRotate: true,
      notes: 'Expo/Dummy panel - flat 2D piece, Length x Width only (no depth used)',
      areaSqMt: Number(((h * w) / 1_000_000).toFixed(3)),
    });
    finalizeParts(parts, item);
    const copies = Math.max(1, Math.round(item.quantity || 1));
    return copies > 1
      ? parts.map((p) => ({ ...p, qty: p.qty * copies, areaSqMt: Number((p.areaSqMt * copies).toFixed(3)) }))
      : parts;
  }

  // If semi-modular and depth is 0, it's civil shutter frame
  // If full-modular and depth was 0, default to factory standard depth (e.g. 560mm for wardrobe, 320mm for loft/overhead)
  const d = getEffectiveDepthMm(item, pType);

  const isFullModular = pType === 'full';

  // 1. Shutter / Doors / Front Paneling
  if (hasShutterDoors(item)) {
    const { widths: shutterWidths } = getShutterLayout(item);
    // The two construction methods are never mixed: a Semi Modular item is
    // always Frame + Shutter, full height, regardless of any depth value
    // that might happen to be present on the row - only Full Modular's
    // real carcass box gives the shutter a 20mm inset to clear the gables.
    const shutterHeight = isFullModular ? h - 20 : h;

    // Shutters usually share one even width, but a per-shutter override
    // (see getShutterLayout) can make them unequal - group by width so each
    // distinct size becomes its own cut part instead of one part claiming a
    // single width for every panel.
    const widthGroups = new Map<number, number>();
    shutterWidths.forEach((wid) => widthGroups.set(wid, (widthGroups.get(wid) || 0) + 1));
    const isSplit = widthGroups.size > 1;

    let groupIdx = 0;
    for (const [shutterWidth, qty] of widthGroups) {
      groupIdx++;
      parts.push({
        id: isSplit ? `${item.id}-shutter-${groupIdx}` : `${item.id}-shutter`,
        itemId: item.id,
        room: item.room,
        itemName: item.description,
        wall: item.wall,
        partName: 'Shutter',
        lengthMm: shutterHeight,
        widthMm: shutterWidth,
        thicknessMm: 18,
        qty,
        material: `${getCoreMaterialLabel(item)} (${getFinishLabel(item)})`,
        materialCategory: 'Color/Laminate',
        // No fabric on shutters - Color/Laminate only, per the factory's
        // own material rule.
        backMaterialCategory: 'Color/Laminate',
        edgeL1: true,
        edgeL2: true,
        edgeW1: true,
        edgeW2: true,
        edgeThicknessMm: 2.0,
        areaSqMt: Number(((shutterHeight * shutterWidth * qty) / 1_000_000).toFixed(3)),
      });
    }
  }

  // 2. Drawers (if tandem box or drawer count > 0)
  if (item.drawerCount > 0) {
    const dCount = item.drawerCount;
    // Same reasoning as the shutter width above: floor so dCount identical
    // drawer fronts sharing one height can never combine to exceed h.
    const faciaHeight = Math.floor((h - (dCount * 5)) / dCount);
    const faciaWidth = w - 10;
    
    // Drawer Facia
    parts.push({
      id: `${item.id}-drawer-facia`,
      itemId: item.id,
      room: item.room,
      itemName: item.description,
      wall: item.wall,
      partName: 'Drawer Front',
      lengthMm: faciaWidth,
      widthMm: faciaHeight,
      thicknessMm: 18,
      qty: dCount,
      material: `${getCoreMaterialLabel(item)} (${getFinishLabel(item)})`,
      materialCategory: 'Color/Laminate',
      // No fabric on a shutter-type panel (Drawer Front is a visible face
      // just like a Shutter) - Color/Laminate only.
      backMaterialCategory: 'Color/Laminate',
      edgeL1: true,
      edgeL2: true,
      edgeW1: true,
      edgeW2: true,
      edgeThicknessMm: 2.0,
      areaSqMt: Number(((faciaWidth * faciaHeight * dCount) / 1_000_000).toFixed(3)),
    });

    // Drawer internal box (sides & bottom) is a factory-built carcass
    // component - it only exists for Full Modular. A Semi Modular item is
    // Frame + Shutter only: the drawer front above still gets cut (it's
    // the visible face, same as a shutter), but the sliding box behind it
    // is civil/site work, not part of this construction method's own
    // production calculation.
    if (isFullModular) {
      const drawerDepth = d > 0 ? d - 50 : 450;
      // Left & Right Drawer sides
      parts.push({
        id: `${item.id}-drawer-sides`,
        itemId: item.id,
        room: item.room,
        itemName: item.description,
        wall: item.wall,
        partName: 'Drawer Side',
        lengthMm: drawerDepth,
        widthMm: Math.max(120, faciaHeight - 50),
        thicknessMm: 18,
        qty: dCount * 2,
        material: '18mm Prelam / BWP',
        materialCategory: 'Fabric',
        backMaterialCategory: 'Fabric',
        fabricBothSides: item.fabricBothSides ?? false,
        edgeL1: true,
        edgeL2: false,
        edgeW1: true,
        edgeW2: false,
        edgeThicknessMm: 0.8,
        areaSqMt: Number(((drawerDepth * Math.max(120, faciaHeight - 50) * dCount * 2) / 1_000_000).toFixed(3)),
      });

      // Drawer Bottom (9mm Ply)
      parts.push({
        id: `${item.id}-drawer-bottom`,
        itemId: item.id,
        room: item.room,
        itemName: item.description,
        wall: item.wall,
        partName: 'Drawer Bottom',
        lengthMm: faciaWidth - 40,
        widthMm: drawerDepth,
        thicknessMm: 9,
        qty: dCount,
        material: '9mm Plywood',
        materialCategory: 'Fabric',
        backMaterialCategory: 'Fabric',
        fabricBothSides: item.fabricBothSides ?? false,
        edgeL1: false,
        edgeL2: false,
        edgeW1: false,
        edgeW2: false,
        edgeThicknessMm: 0,
        areaSqMt: Number((((faciaWidth - 40) * drawerDepth * dCount) / 1_000_000).toFixed(3)),
      });
    }
  }

  // 3. Carcass Panels: Left Gable, Right Gable, Top Deck, Bottom Deck, Back Panel
  // Full Modular only - a Semi Modular item is Frame + Shutter, never a
  // factory-built box, regardless of whether a depth value happens to be
  // present on the row.
  if (isFullModular) {
    const carcassDepth = d > 0 ? d : 560;
    
    // Left & Right Gables
    parts.push({
      id: `${item.id}-left-gable`,
      itemId: item.id,
      room: item.room,
      itemName: item.description,
      wall: item.wall,
      partName: 'Left Gable',
      lengthMm: h,
      widthMm: carcassDepth,
      thicknessMm: 18,
      qty: 1,
      // Hidden carcass part - per the factory's fabric/laminate rule, only
      // the customer-visible faces (shutters, drawer fronts, skirtings, an
      // open expo/shelf unit's own shelves) carry the selected color;
      // everything else inside the box is a standard "Fabric" liner shared
      // across every room and color, which is also what lets these nest
      // freely together for maximum sheet reuse below.
      material: `${getCoreMaterialLabel(item)} (Fabric)`,
      materialCategory: 'Fabric',
      backMaterialCategory: 'Fabric',
      fabricBothSides: item.fabricBothSides ?? false,
      edgeL1: true,
      edgeL2: false,
      edgeW1: true,
      edgeW2: false,
      edgeThicknessMm: 0.8,
      areaSqMt: Number(((h * carcassDepth) / 1_000_000).toFixed(3)),
    });

    parts.push({
      id: `${item.id}-right-gable`,
      itemId: item.id,
      room: item.room,
      itemName: item.description,
      wall: item.wall,
      partName: 'Right Gable',
      lengthMm: h,
      widthMm: carcassDepth,
      thicknessMm: 18,
      qty: 1,
      material: `${getCoreMaterialLabel(item)} (Fabric)`,
      materialCategory: 'Fabric',
      backMaterialCategory: 'Fabric',
      fabricBothSides: item.fabricBothSides ?? false,
      edgeL1: true,
      edgeL2: false,
      edgeW1: true,
      edgeW2: false,
      edgeThicknessMm: 0.8,
      areaSqMt: Number(((h * carcassDepth) / 1_000_000).toFixed(3)),
    });

    // Top & Bottom Decks
    const deckWidth = Math.max(100, w - 36); // inner width between two 18mm gables
    parts.push({
      id: `${item.id}-top-deck`,
      itemId: item.id,
      room: item.room,
      itemName: item.description,
      wall: item.wall,
      partName: 'Top Deck',
      lengthMm: deckWidth,
      widthMm: carcassDepth,
      thicknessMm: 18,
      qty: 1,
      material: `${getCoreMaterialLabel(item)} (Fabric)`,
      materialCategory: 'Fabric',
      backMaterialCategory: 'Fabric',
      fabricBothSides: item.fabricBothSides ?? false,
      edgeL1: true,
      edgeL2: false,
      edgeW1: false,
      edgeW2: false,
      edgeThicknessMm: 0.8,
      areaSqMt: Number(((deckWidth * carcassDepth) / 1_000_000).toFixed(3)),
    });

    parts.push({
      id: `${item.id}-bottom-deck`,
      itemId: item.id,
      room: item.room,
      itemName: item.description,
      wall: item.wall,
      partName: 'Bottom Deck',
      lengthMm: deckWidth,
      widthMm: carcassDepth,
      thicknessMm: 18,
      qty: 1,
      material: `${getCoreMaterialLabel(item)} (Fabric)`,
      materialCategory: 'Fabric',
      backMaterialCategory: 'Fabric',
      fabricBothSides: item.fabricBothSides ?? false,
      edgeL1: true,
      edgeL2: false,
      edgeW1: false,
      edgeW2: false,
      edgeThicknessMm: 0.8,
      areaSqMt: Number(((deckWidth * carcassDepth) / 1_000_000).toFixed(3)),
    });

    // Back Panel (6mm Ply)
    parts.push({
      id: `${item.id}-back-panel`,
      itemId: item.id,
      room: item.room,
      itemName: item.description,
      wall: item.wall,
      partName: 'Back Panel',
      lengthMm: h - 16,
      widthMm: w - 16,
      thicknessMm: 6,
      qty: 1,
      material: '6mm Backing Ply',
      materialCategory: 'Fabric',
      backMaterialCategory: 'Fabric',
      fabricBothSides: item.fabricBothSides ?? false,
      edgeL1: false,
      edgeL2: false,
      edgeW1: false,
      edgeW2: false,
      edgeThicknessMm: 0,
      areaSqMt: Number((((h - 16) * (w - 16)) / 1_000_000).toFixed(3)),
    });
  }

  // 4. Internal Shelves - `?? ` (not `||`) so an explicit 0 (shelves
  // removed) is respected instead of silently falling back to the default
  // count, which used to keep drawing a phantom Internal Shelf part even
  // after the user zeroed the shelf count out. This fallback only matters
  // if shelfCount is ever missing entirely (every real construction site -
  // Excel upload, sample dataset, new-row default - already sets it): a
  // Shelves unit defaults to 0, not a guessed count, since nothing
  // upstream actually specified a shelf count for it. (Expo/Dummy never
  // reach here at all - they returned as a flat panel above.)
  // Also never mixed: a closed unit's shelves are a hidden internal
  // carcass component (Full Modular only, same as the drawer box above),
  // but an open "shelves" display unit's shelves ARE the whole visible
  // product - not something hidden inside a box - so they're cut
  // regardless of construction method, the same way an Expo/Dummy panel
  // is.
  const shelfCount = item.shelfCount ?? (item.category === 'shelves' ? 0 : 2);
  if (shelfCount > 0 && (isFullModular || item.category === 'shelves')) {
    const shelfWidth = Math.max(100, w - 36);
    const shelfDepth = d > 0 ? d - 30 : 350;
    parts.push({
      id: `${item.id}-shelves`,
      itemId: item.id,
      room: item.room,
      itemName: item.description,
      wall: item.wall,
      partName: 'Internal Shelf',
      lengthMm: shelfWidth,
      widthMm: shelfDepth,
      thicknessMm: 18,
      qty: shelfCount,
      // A closed wardrobe's shelves sit hidden behind its doors (generic
      // Fabric liner), but an open "shelves" display unit has no door at
      // all - its shelves ARE the visible face, so they carry the
      // customer's actual color like a shutter would.
      material: `${getCoreMaterialLabel(item)} (${item.category === 'shelves' ? getFinishLabel(item) : 'Fabric'})`,
      materialCategory: item.category === 'shelves' ? 'Color/Laminate' : 'Fabric',
      // An open shelves unit's shelf is a shutter-type panel - Color/
      // Laminate only, no fabric tracked at all, same as a Shutter. A
      // closed wardrobe's hidden shelf is a box surface, so it's Fabric
      // on one face by default or both if the item selected it.
      backMaterialCategory: item.category === 'shelves' ? 'Color/Laminate' : 'Fabric',
      fabricBothSides: item.category === 'shelves' ? undefined : item.fabricBothSides ?? false,
      edgeL1: true,
      edgeL2: false,
      edgeW1: false,
      edgeW2: false,
      edgeThicknessMm: 0.8,
      grainDirection: 'any',
      canRotate: true,
      notes: 'Internal adjustable / fixed shelf (rotatable for optimal nesting)',
      areaSqMt: Number(((shelfWidth * shelfDepth * shelfCount) / 1_000_000).toFixed(3)),
    });
  }

  // 5. Floor Skirting Plinth & Structural Under-Carcass Battens
  // Essential for all floor-standing units to elevate off floor, block moisture, and conceal levelers
  const isFloorUnit =
    item.category === 'wardrobe_shutter' ||
    item.category === 'single_wardrobe' ||
    item.category === 'kitchen_base' ||
    item.category === 'sitting_box' ||
    item.category === 'dressing_unit' ||
    item.category === 'tandem_box';

  if (isFloorUnit) {
    // 5A. Front Elevation Skirting Runner (Plinth) - 100mm height
    parts.push({
      id: `${item.id}-skirting-front`,
      itemId: item.id,
      room: item.room,
      itemName: item.description,
      wall: item.wall,
      partName: 'Pelmet/Skirting',
      lengthMm: w,
      widthMm: 100,
      thicknessMm: 18,
      qty: 1,
      // Visible kickplate along the floor - carries the customer's actual
      // color/laminate, same as a shutter, per the skirting rule. Shutter-
      // type panel, so no fabric tracked at all - Color/Laminate only.
      material: `${getCoreMaterialLabel(item)} (${getFinishLabel(item)})`,
      materialCategory: 'Color/Laminate',
      backMaterialCategory: 'Color/Laminate',
      edgeL1: true, // Top edge banded with 0.8mm PVC to seal against water spills
      edgeL2: false,
      edgeW1: true, // Side end edge banded
      edgeW2: true, // Side end edge banded
      edgeThicknessMm: 0.8,
      grainDirection: 'any',
      canRotate: true, // Narrow 100mm runner nests into offcut rip margins
      notes: '100mm Front Plinth Runner (protects carcass from floor water)',
      areaSqMt: Number(((w * 100) / 1_000_000).toFixed(3)),
    });

    // 5B. Cross Battens / Sub-Carcass Leveler Supports (Returns) - these
    // level and support a factory-built carcass box, so like the rest of
    // the box's internal components they only exist for Full Modular;
    // there's no carcass under Semi Modular for them to support.
    if (isFullModular) {
      const battenLength = Math.max(250, (d > 0 ? d : 560) - 50);
      const battenQty = w > 1500 ? 3 : 2; // Left return, right return, + center stiffener if wide
      parts.push({
        id: `${item.id}-skirting-battens`,
        itemId: item.id,
        room: item.room,
        itemName: item.description,
        wall: item.wall,
        partName: 'Pelmet/Skirting',
        lengthMm: battenLength,
        widthMm: 100,
        thicknessMm: 18,
        qty: battenQty,
        // Hidden structural batten under the carcass - generic Fabric liner.
        material: `${getCoreMaterialLabel(item)} (Fabric)`,
        materialCategory: 'Fabric',
        backMaterialCategory: 'Fabric',
        fabricBothSides: item.fabricBothSides ?? false,
        edgeL1: false,
        edgeL2: false,
        edgeW1: false,
        edgeW2: false,
        edgeThicknessMm: 0,
        grainDirection: 'any',
        canRotate: true, // Harvested directly from board offcuts
        notes: '100mm Sub-carcass leveler batten & structural floor riser',
        areaSqMt: Number(((battenLength * 100 * battenQty) / 1_000_000).toFixed(3)),
      });
    }
  }

  // 6. Loft units never get skirting/pelmet of any kind - a Loft is
  // Carcass + Shutter (or Expo/Dummy panel, handled above) only. This used
  // to add a 75mm "Ceiling Infill Pelmet" here, but per the factory's own
  // rule a module identified as LOFT must never produce a skirting piece,
  // skirting dimensions, skirting edge-banding, or a skirting BOM entry -
  // no exceptions - so nothing is generated for it at all.

  // 7. Special Wall Paneling / Partition
  if (item.category === 'tv_panel' || item.category === 'partition') {
    parts.push({
      id: `${item.id}-panel-sheet`,
      itemId: item.id,
      room: item.room,
      itemName: item.description,
      wall: item.wall,
      partName: 'Shutter',
      lengthMm: h,
      widthMm: w,
      thicknessMm: 18,
      qty: 1,
      material: `${getCoreMaterialLabel(item)} (${getFinishLabel(item)})`,
      materialCategory: 'Color/Laminate',
      // Shutter-type panel - no fabric tracked at all.
      backMaterialCategory: 'Color/Laminate',
      edgeL1: true,
      edgeL2: true,
      edgeW1: true,
      edgeW2: true,
      edgeThicknessMm: 2.0,
      grainDirection: 'length',
      canRotate: false,
      notes: 'Decorative Wall Feature Paneling',
      areaSqMt: Number(((h * w) / 1_000_000).toFixed(3)),
    });
  }

  finalizeParts(parts, item);

  // Scale every part by how many identical copies of this item are needed.
  const copies = Math.max(1, Math.round(item.quantity || 1));
  if (copies > 1) {
    return parts.map((p) => ({
      ...p,
      qty: p.qty * copies,
      areaSqMt: Number((p.areaSqMt * copies).toFixed(3)),
    }));
  }

  return parts;
}

// Generate all cut list parts for all items
export function generateAllCutLists(items: ModularItem[], globalProjectType: ProjectType): CutListPart[] {
  return items.flatMap((item) => generateCutListForItem(item, globalProjectType));
}

// Room-wise factory carcass box breakdown for every item, evaluated under a
// single forced project mode ('semi' or 'full') regardless of any per-item
// override, so a Semi Modular run and a Full Modular run can be compared
// side by side for the exact same uploaded item list.
export function generateRoomBoxSummary(items: ModularItem[], forcedProjectType: ProjectType): RoomBoxRow[] {
  return items.map((item) => {
    const depthMm = getEffectiveDepthMm(item, forcedProjectType);
    const hasBox = depthMm > 0;
    // Matches generateCutListForItem exactly: every item is ONE continuous
    // carcass (one pair of gables, one deck, one back panel) regardless of
    // width, with shutters sized off that same full width. Reporting more
    // than 1 box here without also splitting the actual gables/deck/back
    // panel and re-sizing shutters per box would silently overstate what
    // gets cut - shutters would then be the wrong size for a real seam and
    // could gap or overlap where boxes meet.
    const boxCount = hasBox ? 1 : 0;
    const boxWidthMm = item.widthMm;
    const heightMm = item.heightMm;

    return {
      itemId: item.id,
      room: item.room,
      wall: item.wall,
      itemName: item.description,
      category: item.category,
      hasBox,
      boxCount,
      boxWidthMm,
      heightMm,
      depthMm,
      boxWidthFt: mmToFt(boxWidthMm),
      heightFt: mmToFt(heightMm),
      depthFt: mmToFt(depthMm),
      volumeCuFtPerBox: Number((mmToFt(boxWidthMm) * mmToFt(heightMm) * mmToFt(depthMm)).toFixed(2)),
    };
  });
}

// Calculate material usage breakdown from items and cut list. `rules`
// defaults to the factory's standard hardware rules so every existing call
// site keeps working unchanged; pass the live, admin-edited rules once a
// caller has them so its hinge/shelf-pin counts stay in sync with the
// detailed Hardware BOM below.
export function calculateMaterialUsage(cutList: CutListPart[], rules: HardwareRules = DEFAULT_HARDWARE_RULES): MaterialBreakdown {
  // An empty cut list (Clear Project, or before anything's been uploaded)
  // must report zero everything. Every count below is built on
  // Math.max(1, ...) floors (never show "0 sheets" for a real, tiny job) -
  // without this guard those floors instead invent a phantom 1 sheet, 1
  // laminate sheet, 32 minifix fasteners, and a nonzero "68% yield" out of
  // thin air for a project that has nothing in it at all.
  if (cutList.length === 0) {
    return {
      totalSheets: 0,
      totalPieces: 0,
      ply18mmSheets: 0,
      ply18mmAreaSqFt: 0,
      ply9mmSheets: 0,
      ply9mmAreaSqFt: 0,
      ply6mmSheets: 0,
      ply6mmAreaSqFt: 0,
      innerLaminateSheets: 0,
      outerLaminateSheets: 0,
      boxFabricAreaSqFt: 0,
      boxFabricSheets: 0,
      boxFabricPieces: 0,
      boxFabricBothSidesAreaSqFt: 0,
      boxColorLaminateAreaSqFt: 0,
      boxColorLaminateSheets: 0,
      boxColorLaminatePieces: 0,
      shutterColorAreaSqFt: 0,
      shutterColorSheets: 0,
      shutterColorPieces: 0,
      edgeBandMeters: 0,
      edgeBand2mmMeters: 0,
      edgeBand08mmMeters: 0,
      softCloseHingesPairs: 0,
      totalHingesPieces: 0,
      tandemBoxChannels: 0,
      drawerChannels: 0,
      handles: 0,
      shelfSupports: 0,
      fastenersMinifixCount: 0,
      grossBoardAreaSqFt: 0,
      netPartsAreaSqFt: 0,
      overallUtilizationPercent: 0,
      usableOffcutAreaSqFt: 0,
      totalScrapWasteSqFt: 0,
      wastePercent: 0,
      skirtingLinearMeters: 0,
      skirtingPiecesCount: 0,
      skirtingFromOffcutsMeters: 0,
      skirtingPlinthHeightMm: 100,
    };
  }

  let ply18mmAreaSqMt = 0;
  let ply9mmAreaSqMt = 0;
  let ply6mmAreaSqMt = 0;
  let edgeBand2mmMeters = 0;
  let edgeBand08mmMeters = 0;
  let softCloseHingesPairs = 0;
  let tandemBoxChannels = 0;
  let drawerChannels = 0;
  let handles = 0;
  let shelfSupports = 0;
  let totalPieces = 0;
  let skirtingLinearMeters = 0;
  let skirtingPiecesCount = 0;
  // Which items actually built a real carcass - a Left Gable only exists
  // on an item with a full box, so its presence is the signal. Used below
  // to price box-assembly fasteners per real box instead of guessing from
  // sheet count.
  const boxItemIds = new Set<string>();
  // Fabric and shutter color are two different material rules, each
  // calculated separately, both against the same standard 8x4ft/32 sq.ft
  // sheet (see effectiveAreaPerSheetSqMt below).
  // BOX (Gable/Deck/Back Panel/Drawer box/hidden shelf/batten - both
  // faces Fabric): Width x Height x Depth derived, Fabric-laminated on
  // one face by factory-standard default, doubled per item wherever
  // fabricBothSides was selected. A box surface Color/Laminate branch is
  // tracked too for whenever one applies (none of the categories
  // currently generate one, but the rule reserves the bucket).
  // SHUTTER (Shutter, Drawer Front, visible Skirting, Expo/Dummy panel,
  // an open shelf - Width x Height only): Color/Finish only, no fabric
  // at all - counted once per panel, not per face.
  let boxFabricAreaSqMt = 0; // box-panel area actually needed (already includes doubling where selected)
  let boxFabricBothSidesAreaSqMt = 0; // the subset of the above from a both-sides selection (informational)
  let boxFabricPieces = 0;
  let boxColorLaminateAreaSqMt = 0; // reserved: a box surface finished in the customer's color, if any category ever generates one
  let boxColorLaminatePieces = 0;
  let shutterColorAreaSqMt = 0;
  let shutterColorPieces = 0;

  for (const part of cutList) {
    totalPieces += part.qty;
    const partAreaSqMt = part.areaSqMt;
    if (part.thicknessMm === 18) {
      ply18mmAreaSqMt += partAreaSqMt;
    } else if (part.thicknessMm === 9) {
      ply9mmAreaSqMt += partAreaSqMt;
    } else if (part.thicknessMm === 6) {
      ply6mmAreaSqMt += partAreaSqMt;
    }

    if (part.backMaterialCategory === 'Fabric') {
      // A box surface (front and back both Fabric) - single face by
      // default, doubled if selected.
      boxFabricAreaSqMt += partAreaSqMt;
      boxFabricPieces += part.qty;
      if (part.fabricBothSides) {
        boxFabricAreaSqMt += partAreaSqMt;
        boxFabricBothSidesAreaSqMt += partAreaSqMt;
      }
    } else if (part.materialCategory === 'Fabric') {
      // Reserved: a box surface whose front is Fabric but back is Color/
      // Laminate. Not generated by any current category, but handled for
      // completeness.
      boxColorLaminateAreaSqMt += partAreaSqMt;
      boxColorLaminatePieces += part.qty;
    } else {
      // A shutter-type panel - Color/Laminate only, counted once (not
      // per face), since no fabric is ever tracked for it.
      shutterColorAreaSqMt += partAreaSqMt;
      shutterColorPieces += part.qty;
    }

    if (part.partName === 'Pelmet/Skirting') {
      skirtingLinearMeters += (part.lengthMm / 1000) * part.qty;
      skirtingPiecesCount += part.qty;
    }

    // Edge banding length by thickness
    const lMeters = (part.lengthMm / 1000) * part.qty;
    const wMeters = (part.widthMm / 1000) * part.qty;
    let partEdgeMeters = 0;
    if (part.edgeL1) partEdgeMeters += lMeters;
    if (part.edgeL2) partEdgeMeters += lMeters;
    if (part.edgeW1) partEdgeMeters += wMeters;
    if (part.edgeW2) partEdgeMeters += wMeters;

    if (part.edgeThicknessMm === 2.0) {
      edgeBand2mmMeters += partEdgeMeters;
    } else if (part.edgeThicknessMm === 0.8) {
      edgeBand08mmMeters += partEdgeMeters;
    }

    // Hardware deduction
    if (part.partName === 'Shutter') {
      const hingesNeeded = getHingeCountForHeight(part.lengthMm, rules.hingeRules);
      softCloseHingesPairs += (hingesNeeded / 2) * part.qty;
      handles += part.qty;
    } else if (part.partName === 'Drawer Front') {
      handles += part.qty;
      if (part.itemName.toLowerCase().includes('tandom') || part.itemName.toLowerCase().includes('tandem')) {
        tandemBoxChannels += part.qty;
      } else {
        drawerChannels += part.qty;
      }
    } else if (part.partName === 'Internal Shelf') {
      shelfSupports += part.qty * rules.shelfPinsPerShelf;
    } else if (part.partName === 'Left Gable') {
      boxItemIds.add(part.itemId);
    }
  }

  // 1 standard board = 8ft x 4ft = 2440mm x 1220mm = 2.977 sq.mt = 32.07 sq.ft
  // Standard CNC / panel saw yield: ~88% due to saw kerf (3.2mm) and trimmer margins
  const sheetAreaSqMt = 2.977;
  const yieldFactor = 0.88;
  const effectiveAreaPerSheetSqMt = sheetAreaSqMt * yieldFactor;

  const ply18mmSheets = Math.max(1, Math.ceil(ply18mmAreaSqMt / effectiveAreaPerSheetSqMt));
  const ply9mmSheets = Math.ceil(ply9mmAreaSqMt / effectiveAreaPerSheetSqMt);
  const ply6mmSheets = Math.ceil(ply6mmAreaSqMt / effectiveAreaPerSheetSqMt);

  // Sq.ft conversion: 1 sq.mt = 10.7639 sq.ft
  const ply18mmAreaSqFt = Number((ply18mmAreaSqMt * 10.7639).toFixed(1));
  const ply9mmAreaSqFt = Number((ply9mmAreaSqMt * 10.7639).toFixed(1));
  const ply6mmAreaSqFt = Number((ply6mmAreaSqMt * 10.7639).toFixed(1));

  const totalSheets = ply18mmSheets + ply9mmSheets + ply6mmSheets;
  const grossBoardAreaSqFt = Number((totalSheets * 32.07).toFixed(1));
  const netPartsAreaSqFt = Number((ply18mmAreaSqFt + ply9mmAreaSqFt + ply6mmAreaSqFt).toFixed(1));

  const overallUtilizationPercent = Math.min(94, Math.max(68, Math.round((netPartsAreaSqFt / grossBoardAreaSqFt) * 100)));
  const usableOffcutAreaSqFt = Number((grossBoardAreaSqFt * 0.08).toFixed(1));
  const totalScrapWasteSqFt = Number(Math.max(0, grossBoardAreaSqFt - netPartsAreaSqFt - usableOffcutAreaSqFt).toFixed(1));
  const wastePercent = Math.max(3, Math.round((totalScrapWasteSqFt / grossBoardAreaSqFt) * 100));

  // In 2440x1220 boards with 560mm gables (560+560 = 1120 + 4mm kerf = 1124mm, leaving 96-100mm offcut strip),
  // 75% to 85% of 100mm skirting runners are harvested directly from sheet offcut strips without buying extra sheets!
  const skirtingFromOffcutsMeters = Number((skirtingLinearMeters * 0.82).toFixed(1));

  // Fabric and Color/Laminate both use the same standard factory sheet -
  // 8ft x 4ft, 32 sq.ft - per the factory's own material sheet rule. This
  // is the raw sheet area, not the board nesting's kerf/trim-adjusted
  // effectiveAreaPerSheetSqMt above: a laminate/fabric sheet is pasted on
  // as one continuous layer, not cut into many small parts, so a plain
  // ceiling-division against the full 32 sq.ft is the right sheet count.
  // boxFabricAreaSqMt already includes doubling per item where
  // fabricBothSides was selected (see the accumulation loop above).
  const boxFabricSheets = Math.max(1, Math.ceil(boxFabricAreaSqMt / sheetAreaSqMt));
  const boxColorLaminateSheets = Math.ceil(boxColorLaminateAreaSqMt / sheetAreaSqMt);
  const shutterColorSheets = Math.ceil(shutterColorAreaSqMt / sheetAreaSqMt);
  const innerLaminateSheets = Math.max(1, boxFabricSheets);
  const outerLaminateSheets = Math.max(1, boxColorLaminateSheets + shutterColorSheets);

  const roundedEdgeBand2mm = Math.round(edgeBand2mmMeters);
  const roundedEdgeBand08mm = Math.round(edgeBand08mmMeters);
  const totalEdgeBand = roundedEdgeBand2mm + roundedEdgeBand08mm;
  const totalHingesPairs = Math.ceil(softCloseHingesPairs);
  // Box assembly fasteners, priced per real box (one per item that
  // actually built a carcass) and by whichever joining system the factory
  // uses - not a guess derived from sheet count.
  const boxCount = boxItemIds.size;
  const fastenersMinifixCount =
    rules.boxJoiningSystem === 'confirmat'
      ? boxCount * rules.confirmatScrewsPerBox
      : rules.boxJoiningSystem === 'screw_bracket'
        ? boxCount * rules.bracketsPerBox
        : boxCount * rules.minifixSetsPerBox;

  return {
    totalSheets,
    totalPieces,
    ply18mmSheets,
    ply18mmAreaSqFt,
    ply9mmSheets,
    ply9mmAreaSqFt,
    ply6mmSheets,
    ply6mmAreaSqFt,
    innerLaminateSheets,
    outerLaminateSheets,
    boxFabricAreaSqFt: Number((boxFabricAreaSqMt * 10.7639).toFixed(1)),
    boxFabricSheets,
    boxFabricPieces,
    boxFabricBothSidesAreaSqFt: Number((boxFabricBothSidesAreaSqMt * 10.7639).toFixed(1)),
    boxColorLaminateAreaSqFt: Number((boxColorLaminateAreaSqMt * 10.7639).toFixed(1)),
    boxColorLaminateSheets,
    boxColorLaminatePieces,
    shutterColorAreaSqFt: Number((shutterColorAreaSqMt * 10.7639).toFixed(1)),
    shutterColorSheets,
    shutterColorPieces,
    edgeBandMeters: totalEdgeBand,
    edgeBand2mmMeters: roundedEdgeBand2mm,
    edgeBand08mmMeters: roundedEdgeBand08mm,
    softCloseHingesPairs: totalHingesPairs,
    totalHingesPieces: totalHingesPairs * 2,
    tandemBoxChannels,
    drawerChannels,
    handles,
    shelfSupports,
    fastenersMinifixCount,
    grossBoardAreaSqFt,
    netPartsAreaSqFt,
    overallUtilizationPercent,
    usableOffcutAreaSqFt,
    totalScrapWasteSqFt,
    wastePercent,
    skirtingLinearMeters: Number(skirtingLinearMeters.toFixed(1)),
    skirtingPiecesCount,
    skirtingFromOffcutsMeters,
    skirtingPlinthHeightMm: 100,
  };
}

// Detailed, per-component hardware BOM - one line per hardware requirement
// per actual cut part (or once per box for assembly hardware), driven
// entirely by the factory's configured HardwareRules. This is the
// authoritative source for the Hardware BOM export; calculateMaterialUsage
// above only keeps its own rough aggregate totals (for the Pricing Report)
// in sync with the same rules, not this level of per-component detail.
export function calculateHardwareBOM(cutList: CutListPart[], rules: HardwareRules, projectId: string): HardwareBOMLine[] {
  const lines: HardwareBOMLine[] = [];

  const byItem = new Map<string, CutListPart[]>();
  for (const part of cutList) {
    if (!byItem.has(part.itemId)) byItem.set(part.itemId, []);
    byItem.get(part.itemId)!.push(part);
  }

  for (const [itemId, parts] of byItem) {
    const moduleName = parts[0]?.itemName ?? '';
    const room = parts[0]?.room ?? '';
    const push = (line: Omit<HardwareBOMLine, 'projectId' | 'moduleId' | 'moduleName' | 'room' | 'source'>) => {
      lines.push({ projectId, moduleId: itemId, moduleName, room, source: 'Factory Rule', ...line });
    };

    for (const part of parts) {
      if (part.partName === 'Shutter') {
        const hinges = getHingeCountForHeight(part.lengthMm, rules.hingeRules);
        push({
          componentId: part.id,
          componentType: 'Shutter',
          hardwareCode: 'HNG-SC',
          hardwareName: 'Soft-Close Hinge',
          unit: 'Nos',
          quantity: hinges * part.qty,
          calculationRule: `${hinges} hinge(s) per shutter up to ${part.lengthMm}mm height`,
        });
        if (rules.handlesPerShutter > 0) {
          push({
            componentId: part.id,
            componentType: 'Shutter',
            hardwareCode: 'HDL-01',
            hardwareName: 'Handle',
            unit: 'Nos',
            quantity: rules.handlesPerShutter * part.qty,
            calculationRule: `${rules.handlesPerShutter} handle(s) per shutter`,
          });
        }
      } else if (part.partName === 'Drawer Front') {
        const isTandem = moduleName.toLowerCase().includes('tandom') || moduleName.toLowerCase().includes('tandem');
        push({
          componentId: part.id,
          componentType: 'Drawer',
          hardwareCode: isTandem ? 'CHN-TDM' : 'CHN-SC',
          hardwareName: isTandem ? 'Tandem Box Channel Set' : 'Soft-Close Drawer Channel',
          unit: 'Pair',
          quantity: part.qty,
          calculationRule: '1 pair per drawer',
        });
        if (rules.handlesPerDrawer > 0) {
          push({
            componentId: part.id,
            componentType: 'Drawer',
            hardwareCode: 'HDL-01',
            hardwareName: 'Handle',
            unit: 'Nos',
            quantity: rules.handlesPerDrawer * part.qty,
            calculationRule: `${rules.handlesPerDrawer} handle(s) per drawer`,
          });
        }
      } else if (part.partName === 'Internal Shelf') {
        push({
          componentId: part.id,
          componentType: 'Shelf',
          hardwareCode: 'SHF-PIN',
          hardwareName: 'Shelf Support Pin',
          unit: 'Nos',
          quantity: rules.shelfPinsPerShelf * part.qty,
          calculationRule: `${rules.shelfPinsPerShelf} pin(s) per shelf`,
        });
      } else if (part.partName === 'Back Panel') {
        const perimeterMm = 2 * (part.lengthMm + part.widthMm);
        const fixingsPerPanel = Math.max(4, Math.ceil(perimeterMm / rules.backPanelFixingSpacingMm));
        push({
          componentId: part.id,
          componentType: 'Back Panel',
          hardwareCode: rules.backPanelFixing === 'staples' ? 'BKP-STP' : 'BKP-SCR',
          hardwareName: rules.backPanelFixing === 'staples' ? 'Back Panel Staple' : 'Back Panel Screw',
          unit: 'Nos',
          quantity: fixingsPerPanel * part.qty,
          calculationRule: `1 per ${rules.backPanelFixingSpacingMm}mm of back panel perimeter`,
        });
      } else if (part.partName === 'Pelmet/Skirting' && part.backMaterialCategory === 'Color/Laminate') {
        // Only the customer-facing skirting run (the visible kickplate) is
        // clipped on - the hidden structural batten behind it is fixed
        // directly into the carcass. Skirting parts only exist here at all
        // when the customer actually selected skirting (see generateCutListForItem -
        // a Loft, for one, never generates any), so nothing further to gate.
        const runLengthMm = part.lengthMm * part.qty;
        const clips = Math.max(1, Math.ceil(runLengthMm / rules.skirtingClipSpacingMm));
        push({
          componentId: part.id,
          componentType: 'Skirting',
          hardwareCode: 'SKT-CLP',
          hardwareName: 'Skirting Clip',
          unit: 'Nos',
          quantity: clips,
          calculationRule: `1 per ${rules.skirtingClipSpacingMm}mm of skirting run`,
        });
      }
    }

    // Box assembly hardware applies once per box (per item that actually
    // built a real carcass), not once per panel - a Left Gable only exists
    // on an item that generated a full box, so its presence is the signal.
    const hasBox = parts.some((p) => p.partName === 'Left Gable');
    if (hasBox) {
      if (rules.boxJoiningSystem === 'minifix_dowel') {
        push({
          componentId: `${itemId}-box`,
          componentType: 'Box Assembly',
          hardwareCode: 'MFX-SET',
          hardwareName: 'Minifix Fitting Set',
          unit: 'Set',
          quantity: rules.minifixSetsPerBox,
          calculationRule: `${rules.minifixSetsPerBox} set(s) per box (factory rule)`,
        });
        push({
          componentId: `${itemId}-box`,
          componentType: 'Box Assembly',
          hardwareCode: 'DWL-08',
          hardwareName: 'Wooden Dowel',
          unit: 'Nos',
          quantity: rules.dowelsPerBox,
          calculationRule: `${rules.dowelsPerBox} dowel(s) per box (factory rule)`,
        });
      } else if (rules.boxJoiningSystem === 'confirmat') {
        push({
          componentId: `${itemId}-box`,
          componentType: 'Box Assembly',
          hardwareCode: 'CNF-SCR',
          hardwareName: 'Confirmat Screw',
          unit: 'Nos',
          quantity: rules.confirmatScrewsPerBox,
          calculationRule: `${rules.confirmatScrewsPerBox} screw(s) per box (factory rule)`,
        });
      } else if (rules.boxJoiningSystem === 'screw_bracket') {
        push({
          componentId: `${itemId}-box`,
          componentType: 'Box Assembly',
          hardwareCode: 'BRK-L',
          hardwareName: 'L-Bracket',
          unit: 'Nos',
          quantity: rules.bracketsPerBox,
          calculationRule: `${rules.bracketsPerBox} bracket(s) per box (factory rule)`,
        });
        push({
          componentId: `${itemId}-box`,
          componentType: 'Box Assembly',
          hardwareCode: 'BRK-SCR',
          hardwareName: 'Bracket Screw',
          unit: 'Nos',
          quantity: rules.bracketsPerBox * rules.bracketScrewsPerBracket,
          calculationRule: `${rules.bracketScrewsPerBracket} screw(s) per bracket`,
        });
      }
    }
  }

  return lines;
}

// Aggregates identical hardware (same code + unit) across every component
// into one purchase line, per the factory rule that a Purchase BOM must
// never show the same hardware as separate line items.
export function aggregateHardwareBOM(lines: HardwareBOMLine[]): AggregatedHardwareLine[] {
  const map = new Map<string, AggregatedHardwareLine>();
  for (const line of lines) {
    const key = `${line.hardwareCode}__${line.unit}`;
    const existing = map.get(key);
    if (existing) {
      existing.totalQuantity += line.quantity;
    } else {
      map.set(key, {
        hardwareCode: line.hardwareCode,
        hardwareName: line.hardwareName,
        unit: line.unit,
        totalQuantity: line.quantity,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.hardwareName.localeCompare(b.hardwareName));
}

// 2D Guillotine / Strip Nesting Algorithm for 2440 x 1220 mm Standard Boards
// Optimized to minimize waste, respect wood grain, and harvest usable offcuts for skirting & shelves
export function generateSheetNestingLayouts(cutList: CutListPart[]): {
  layouts: SheetLayout[];
  updatedCutList: CutListPart[];
} {
  const layouts: SheetLayout[] = [];
  const updatedCutList: CutListPart[] = [...cutList];

  // Physical sheets are single-material: a board pre-laminated in one
  // color can't also yield a different color's shutter, and a factory
  // can't buy a sheet that's simultaneously two different core plies. So
  // the real nesting compatibility key is thickness AND material (which
  // now folds in the laminate color - see getFinishLabel), not thickness
  // alone - grouping by thickness only would have let a Walnut shutter and
  // an Ivory shutter get cut from the same "sheet". Groups are discovered
  // from whatever materials the project actually uses, not a fixed list.
  const THICKNESS_PREFIX: Record<number, string> = { 18: '18', 9: '09', 6: '06' };
  const materialsByThickness = new Map<number, string[]>();
  updatedCutList.forEach((p) => {
    const seen = materialsByThickness.get(p.thicknessMm) || [];
    if (!seen.includes(p.material)) seen.push(p.material);
    materialsByThickness.set(p.thicknessMm, seen);
  });

  const groups: { thickness: number; material: string; name: string; prefix: string }[] = [];
  materialsByThickness.forEach((materials, thickness) => {
    const thicknessPrefix = THICKNESS_PREFIX[thickness] || String(thickness);
    materials.forEach((material, idx) => {
      // Only append a letter suffix once a thickness actually has more than
      // one material - the common single-material case keeps the plain
      // "18"/"09"/"06" sheet IDs instead of always saying "18A".
      const prefix = materials.length > 1 ? `${thicknessPrefix}${String.fromCharCode(65 + idx)}` : thicknessPrefix;
      groups.push({ thickness, material, name: material, prefix });
    });
  });

  for (const group of groups) {
    const groupParts = updatedCutList.filter((p) => p.thicknessMm === group.thickness && p.material === group.material);
    if (groupParts.length === 0) continue;

    interface NestingUnit {
      partIndex: number;
      partId: string;
      partName: string;
      itemName: string;
      room: string;
      materialCategory: 'Fabric' | 'Color/Laminate';
      dim1: number; // length
      dim2: number; // width
      color: string;
      canRotate: boolean;
      grain: 'length' | 'width' | 'any';
    }

    const units: NestingUnit[] = [];
    groupParts.forEach((part) => {
      const globalIdx = updatedCutList.indexOf(part);
      const isGrainLocked = part.grainDirection === 'length' || part.partName === 'Shutter';
      const rotatable = part.canRotate !== undefined ? part.canRotate : !isGrainLocked;

      for (let q = 0; q < part.qty; q++) {
        units.push({
          partIndex: globalIdx,
          partId: `${part.id}-${q}`,
          partName: part.partName,
          itemName: part.itemName,
          room: part.room,
          materialCategory: part.materialCategory,
          dim1: part.lengthMm,
          dim2: part.widthMm,
          color: PART_COLORS[part.partName] || '#64748b',
          canRotate: rotatable,
          grain: part.grainDirection || (isGrainLocked ? 'length' : 'any'),
        });
      }
    });

    // Priority sorting: one room's own pieces first (largest area first
    // within it), then the next room's - not one global size-only sort
    // across every room sharing this material. The bin packer below always
    // searches every sheet already open, so once a room's pieces are
    // placed the next room's still gets to reuse whatever space is left on
    // those same sheets; it just never gets first pick of a fresh sheet
    // ahead of the room that's already using it. That's what keeps a
    // sheet's rooms to "this room, then whichever compatible room needed
    // the leftover" instead of an arbitrary size-driven shuffle.
    const roomOrder = new Map<string, number>();
    groupParts.forEach((p) => {
      if (!roomOrder.has(p.room)) roomOrder.set(p.room, roomOrder.size);
    });
    units.sort((a, b) => {
      const roomDiff = (roomOrder.get(a.room) ?? 0) - (roomOrder.get(b.room) ?? 0);
      if (roomDiff !== 0) return roomDiff;
      const areaA = a.dim1 * a.dim2;
      const areaB = b.dim1 * b.dim2;
      return areaB - areaA || b.dim1 - a.dim1;
    });

    // Free-rectangle guillotine bin packing: every piece is placed into the
    // best-fitting (least-leftover-area) empty rectangle across ALL sheets
    // opened so far for this thickness - not just the current one - before a
    // new sheet is opened at all. That's what makes an already-nested
    // sheet's unused corner get filled with a later, smaller piece instead
    // of sitting empty while a fresh sheet is started for it.
    interface FreeRect {
      x: number;
      y: number;
      w: number;
      h: number;
      // True only for a sheet's original, untouched full-size rectangle -
      // false for anything produced by splitting after a piece was placed.
      // Landing on a non-virgin rect means this piece is reusing material a
      // previous piece freed up, not cutting into new board.
      isVirgin: boolean;
    }
    interface WorkingSheet {
      sheetIndex: number;
      freeRects: FreeRect[];
      parts: SheetLayout['parts'];
      usedArea: number; // sq.m
      ripCutYs: Set<number>;
    }

    const MIN_REUSABLE_MM = 60; // below this on either side it's kerf dust, not a reusable offcut
    const sheets: WorkingSheet[] = [];
    const sheetPartAssignments = new Map<number, string>();
    const sheetIdFor = (sheetIndex: number) => `Sheet ${group.prefix}-${String(sheetIndex).padStart(2, '0')}`;

    // Splits the rectangle a piece was just placed into around that piece,
    // into up to two new free rectangles - the standard guillotine choice
    // between "full-width bottom + right sliver" and "full-height right +
    // bottom sliver", picked so the larger of the two leftovers is as big as
    // possible (maximizes the chance a later piece can reuse it in one go).
    const splitFreeRect = (rect: FreeRect, usedW: number, usedH: number): FreeRect[] => {
      const rightW = rect.w - usedW - SAW_KERF_MM;
      const bottomH = rect.h - usedH - SAW_KERF_MM;
      const optA: FreeRect[] = [
        { x: rect.x, y: rect.y + usedH + SAW_KERF_MM, w: rect.w, h: bottomH, isVirgin: false },
        { x: rect.x + usedW + SAW_KERF_MM, y: rect.y, w: rightW, h: usedH, isVirgin: false },
      ];
      const optB: FreeRect[] = [
        { x: rect.x + usedW + SAW_KERF_MM, y: rect.y, w: rightW, h: rect.h, isVirgin: false },
        { x: rect.x, y: rect.y + usedH + SAW_KERF_MM, w: usedW, h: bottomH, isVirgin: false },
      ];
      const largest = (opts: FreeRect[]) => Math.max(...opts.map((r) => Math.max(0, r.w) * Math.max(0, r.h)));
      const chosen = largest(optA) >= largest(optB) ? optA : optB;
      return chosen.filter((r) => r.w >= MIN_REUSABLE_MM && r.h >= MIN_REUSABLE_MM);
    };

    interface Placement {
      sheet: WorkingSheet;
      rectIdx: number;
      w: number;
      h: number;
      rotated: boolean;
    }

    // Best-area-fit: search every free rectangle on every open sheet and
    // take whichever leaves the smallest leftover area, trying the rotated
    // orientation too when the piece is allowed to rotate.
    const findBestPlacement = (dim1: number, dim2: number, canRotate: boolean): Placement | null => {
      let best: Placement | null = null;
      let bestLeftover = Infinity;
      for (const sheet of sheets) {
        sheet.freeRects.forEach((rect, rectIdx) => {
          const options: { w: number; h: number; rotated: boolean }[] = [{ w: dim1, h: dim2, rotated: false }];
          if (canRotate) options.push({ w: dim2, h: dim1, rotated: true });
          options.forEach((opt) => {
            if (opt.w <= rect.w && opt.h <= rect.h) {
              const leftover = rect.w * rect.h - opt.w * opt.h;
              if (leftover < bestLeftover) {
                bestLeftover = leftover;
                best = { sheet, rectIdx, w: opt.w, h: opt.h, rotated: opt.rotated };
              }
            }
          });
        });
      }
      return best;
    };

    const openNewSheet = (): WorkingSheet => {
      const sheet: WorkingSheet = {
        sheetIndex: sheets.length + 1,
        freeRects: [{ x: 0, y: 0, w: SHEET_LENGTH_MM, h: SHEET_WIDTH_MM, isVirgin: true }],
        parts: [],
        usedArea: 0,
        ripCutYs: new Set(),
      };
      sheets.push(sheet);
      return sheet;
    };

    for (const unit of units) {
      // Clamp/rotate a piece bigger than the sheet even alone, same
      // fallback the previous packer used, so it still gets a placement.
      let dim1 = unit.dim1;
      let dim2 = unit.dim2;
      if (dim1 > SHEET_LENGTH_MM) {
        if (unit.canRotate && dim2 <= SHEET_LENGTH_MM && dim1 <= SHEET_WIDTH_MM) {
          [dim1, dim2] = [dim2, dim1];
        } else {
          dim1 = Math.min(dim1, SHEET_LENGTH_MM);
        }
      }
      dim2 = Math.min(dim2, SHEET_WIDTH_MM);

      let placement = findBestPlacement(dim1, dim2, unit.canRotate);
      if (!placement) {
        openNewSheet();
        placement = findBestPlacement(dim1, dim2, unit.canRotate);
        if (!placement) continue; // unreachable: a fresh sheet always fits a clamped piece
      }

      const { sheet, rectIdx, w, h, rotated } = placement;
      const rect = sheet.freeRects[rectIdx];
      const reusedOffcut = !rect.isVirgin;
      sheet.freeRects.splice(rectIdx, 1);
      splitFreeRect(rect, w, h).forEach((r) => {
        sheet.freeRects.push(r);
        if (r.x === 0 && r.w === SHEET_LENGTH_MM) sheet.ripCutYs.add(r.y);
      });

      sheet.parts.push({
        partId: unit.partId,
        partName: unit.partName,
        itemName: unit.itemName,
        room: unit.room,
        materialCategory: unit.materialCategory,
        x: rect.x,
        y: rect.y,
        w,
        h,
        rotated,
        color: unit.color,
        grain: unit.grain,
        reusedOffcut,
      });
      sheet.usedArea += (w * h) / 1_000_000;

      if (!sheetPartAssignments.has(unit.partIndex)) {
        sheetPartAssignments.set(unit.partIndex, sheetIdFor(sheet.sheetIndex));
      }
    }

    // Turn each working sheet into a SheetLayout. Whatever free rectangles
    // are still left once every piece in this project's own cut list has
    // had a chance to reuse them are the real, final offcut inventory -
    // large enough ones are flagged usable (skirting/shelf stock) so they
    // show up for reuse rather than being written off as scrap.
    const totalSheetArea = (SHEET_LENGTH_MM * SHEET_WIDTH_MM) / 1_000_000;
    sheets.forEach((sheet) => {
      const sheetId = sheetIdFor(sheet.sheetIndex);
      const offcuts: SheetLayout['offcuts'] = sheet.freeRects
        .filter((r) => r.w * r.h > 0)
        .map((r, i) => {
          const areaSqMt = Number(((r.w * r.h) / 1_000_000).toFixed(3));
          const isUsable = (r.w >= 500 && r.h >= 90) || (r.h >= 500 && r.w >= 90);
          const shortSide = Math.min(r.w, r.h);
          return {
            id: `${sheetId}-offcut-${i}`,
            x: r.x,
            y: r.y,
            w: r.w,
            h: r.h,
            areaSqMt,
            isUsable,
            recommendedUse: isUsable
              ? shortSide <= 120
                ? '100mm Skirting Runner / Plinth Support'
                : 'Internal Shelf / Drawer Side'
              : 'Saw Kerf & Trimmer Scrap',
            sheetId,
            materialName: group.name,
            thicknessMm: group.thickness,
          };
        });

      const usableOffcutArea = offcuts.filter((o) => o.isUsable).reduce((sum, o) => sum + o.areaSqMt, 0);
      const scrapArea = Math.max(0, totalSheetArea - sheet.usedArea - usableOffcutArea);
      const utilizationPercent = Math.round((sheet.usedArea / totalSheetArea) * 100);
      const recoveryPercent = Math.round(((sheet.usedArea + usableOffcutArea) / totalSheetArea) * 100);

      layouts.push({
        sheetId,
        sheetIndex: sheet.sheetIndex,
        thicknessMm: group.thickness,
        materialName: group.name,
        sheetWidthMm: SHEET_LENGTH_MM,
        sheetHeightMm: SHEET_WIDTH_MM,
        usedAreaSqMt: Number(sheet.usedArea.toFixed(2)),
        offcutAreaSqMt: Number(usableOffcutArea.toFixed(2)),
        scrapAreaSqMt: Number(scrapArea.toFixed(2)),
        utilizationPercent,
        recoveryPercent,
        parts: sheet.parts,
        offcuts,
        primaryRipCuts: Array.from(sheet.ripCutYs).sort((a, b) => a - b),
      });
    });

    sheetPartAssignments.forEach((sId, pIdx) => {
      if (updatedCutList[pIdx]) {
        updatedCutList[pIdx].sheetNumber = sId;
      }
    });
  }

  return { layouts, updatedCutList };
}

// Material reuse summary - the leftover inventory that's still available
// once nesting is done (every usable offcut already had a chance to be
// claimed by a later piece in generateSheetNestingLayouts above, so
// whatever remains here genuinely wasn't reusable within this project),
// plus how many pieces actually got cut from reused leftover space versus
// virgin board. This is the "no usable material waste" rule made visible -
// the nesting algorithm already prioritizes reuse over a new sheet on its
// own; this just reports what it did.
export function summarizeMaterialReuse(layouts: SheetLayout[]): MaterialReuseSummary {
  const leftoverInventory: LeftoverInventoryRow[] = [];
  let reusedPiecesCount = 0;
  let freshPiecesCount = 0;
  let totalUsableLeftoverAreaSqMt = 0;
  let totalScrapAreaSqMt = 0;

  for (const sheet of layouts) {
    for (const part of sheet.parts) {
      if (part.reusedOffcut) reusedPiecesCount++;
      else freshPiecesCount++;
    }
    totalScrapAreaSqMt += sheet.scrapAreaSqMt;
    for (const offcut of sheet.offcuts) {
      if (!offcut.isUsable) continue;
      totalUsableLeftoverAreaSqMt += offcut.areaSqMt;
      leftoverInventory.push({
        id: offcut.id,
        sheetId: offcut.sheetId,
        materialName: offcut.materialName,
        thicknessMm: offcut.thicknessMm,
        lengthMm: Math.max(offcut.w, offcut.h),
        widthMm: Math.min(offcut.w, offcut.h),
        areaSqFt: Number((offcut.areaSqMt * 10.7639).toFixed(2)),
        recommendedUse: offcut.recommendedUse,
      });
    }
  }

  const totalUsableLeftoverAreaSqFt = Number((totalUsableLeftoverAreaSqMt * 10.7639).toFixed(1));
  const totalScrapAreaSqFt = Number((totalScrapAreaSqMt * 10.7639).toFixed(1));
  const totalSheetAreaSqFt = layouts.length * ((SHEET_LENGTH_MM * SHEET_WIDTH_MM) / 1_000_000) * 10.7639;
  const scrapPercent = totalSheetAreaSqFt > 0 ? Number(((totalScrapAreaSqFt / totalSheetAreaSqFt) * 100).toFixed(1)) : 0;

  leftoverInventory.sort((a, b) => b.areaSqFt - a.areaSqFt);

  return {
    leftoverInventory,
    reusedPiecesCount,
    freshPiecesCount,
    totalUsableLeftoverAreaSqFt,
    totalScrapAreaSqFt,
    scrapPercent,
  };
}

// Calculate comprehensive cost breakdown
export function calculateProjectCost(
  material: MaterialBreakdown,
  items: ModularItem[],
  rates: FactoryRates
): CostBreakdown {
  // An empty project (Clear Project, or before any upload) must cost zero.
  // packingTransportCost below is a flat lump sum applied unconditionally -
  // without this guard it (plus the material side's own phantom-1-sheet
  // floors) would show a nonzero "Total Project Budget" for a project with
  // nothing in it.
  if (items.length === 0) {
    return {
      carcassBoardCost: 0,
      shutterBoardCost: 0,
      backPanelCost: 0,
      innerLaminateCost: 0,
      outerLaminateCost: 0,
      edgeBandCost: 0,
      hardwareCost: 0,
      factoryLaborCost: 0,
      packingTransportCost: 0,
      installationCost: 0,
      subtotal: 0,
      taxAmount: 0,
      grandTotal: 0,
    };
  }

  const totalAreaSqFt = items.reduce((sum, item) => sum + item.areaSqFt * Math.max(1, Math.round(item.quantity || 1)), 0);

  const carcassBoardCost = Math.round(material.ply18mmAreaSqFt * rates.plywood18mmPerSqFt);
  const shutterBoardCost = Math.round((material.ply18mmAreaSqFt * 0.35) * rates.plywood18mmPerSqFt);
  const backPanelCost = Math.round(material.ply6mmAreaSqFt * rates.plywood6mmPerSqFt);

  const innerLaminateCost = Math.round(material.innerLaminateSheets * rates.innerLaminatePerSheet);
  const outerLaminateCost = Math.round(material.outerLaminateSheets * rates.outerLaminatePerSheet);
  const edgeBandCost = Math.round(material.edgeBandMeters * rates.edgeBandPerMeter);

  const hardwareCost = Math.round(
    (material.softCloseHingesPairs * rates.hingesPairRate) +
    (material.tandemBoxChannels * rates.tandemChannelRate) +
    (material.drawerChannels * rates.drawerChannelRate) +
    (material.handles * rates.handleRate) +
    (material.shelfSupports * 15) +
    (material.fastenersMinifixCount * 12)
  );

  const factoryLaborCost = Math.round(totalAreaSqFt * rates.factoryLaborPerSqFt);
  const installationCost = Math.round(totalAreaSqFt * rates.installationPerSqFt);
  const packingTransportCost = rates.packingTransportLumpSum;

  const rawSubtotal = carcassBoardCost + shutterBoardCost + backPanelCost +
    innerLaminateCost + outerLaminateCost + edgeBandCost +
    hardwareCost + factoryLaborCost + installationCost + packingTransportCost;

  const marginAmount = Math.round(rawSubtotal * (rates.profitMarginPercent / 100));
  const subtotalWithMargin = rawSubtotal + marginAmount;

  const taxAmount = Math.round(subtotalWithMargin * (rates.taxPercent / 100));
  const grandTotal = subtotalWithMargin + taxAmount;

  return {
    carcassBoardCost,
    shutterBoardCost,
    backPanelCost,
    innerLaminateCost,
    outerLaminateCost,
    edgeBandCost,
    hardwareCost,
    factoryLaborCost,
    packingTransportCost,
    installationCost,
    subtotal: subtotalWithMargin,
    taxAmount,
    grandTotal,
  };
}
