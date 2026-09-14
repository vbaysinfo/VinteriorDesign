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
} from '../types';

// Standard sheet dimensions in mm
export const SHEET_LENGTH_MM = 2440;
export const SHEET_WIDTH_MM = 1220;
export const SAW_KERF_MM = 4;

// Resolve the working carcass depth for an item under a given project mode.
// Semi Modular items left blank (depthMm 0) are civil-built shutter/frame
// units with no factory box. Full Modular always fabricates a full carcass,
// so blank depths fall back to factory-standard defaults per category.
export function getEffectiveDepthMm(item: ModularItem, effectiveProjectType: ProjectType): number {
  let d = item.depthMm;
  if (d === 0) {
    if (effectiveProjectType === 'full') {
      if (item.category === 'wardrobe_shutter' || item.category === 'single_wardrobe') d = 560;
      else if (item.category === 'kitchen_base' || item.category === 'tandem_box') d = 560;
      else if (item.category === 'kitchen_overhead' || item.category === 'loft' || item.category === 'kitchen_loft') d = 330;
      else if (item.category === 'sitting_box') d = 488;
      else d = 350;
    } else {
      d = 0;
    }
  }
  return d;
}

// Free-text material override for the exported/display material label.
// Falls back to the structured coreMaterial dropdown when left blank.
export function getCoreMaterialLabel(item: ModularItem): string {
  return item.materialCode?.trim() ? item.materialCode.trim() : item.coreMaterial;
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

// Generate real-time cut list parts for an item
export function generateCutListForItem(item: ModularItem, globalProjectType: ProjectType): CutListPart[] {
  const parts: CutListPart[] = [];
  const pType = item.projectType || globalProjectType;

  const w = item.widthMm;
  const h = item.heightMm;
  // If semi-modular and depth is 0, it's civil shutter frame
  // If full-modular and depth was 0, default to factory standard depth (e.g. 560mm for wardrobe, 320mm for loft/overhead)
  const d = getEffectiveDepthMm(item, pType);

  const isBoxUnit = d > 0;
  const isFullModular = pType === 'full';

  // 1. Shutter / Doors / Front Paneling
  if (item.category !== 'tv_panel' && item.category !== 'partition' && item.category !== 'tandem_box') {
    const sCount = Math.max(1, item.shutterCount || (w > 1800 ? 4 : w > 1000 ? 3 : w > 500 ? 2 : 1));
    const shutterWidth = Math.round((w - (sCount - 1) * 3) / sCount);
    const shutterHeight = isBoxUnit ? h - 20 : h; // 20mm clearance or full height
    
    parts.push({
      id: `${item.id}-shutter`,
      itemId: item.id,
      room: item.room,
      itemName: item.description,
      wall: item.wall,
      partName: 'Shutter',
      lengthMm: shutterHeight,
      widthMm: shutterWidth,
      thicknessMm: 18,
      qty: sCount,
      material: `${getCoreMaterialLabel(item)} (${item.finishType})`,
      edgeL1: true,
      edgeL2: true,
      edgeW1: true,
      edgeW2: true,
      edgeThicknessMm: 2.0,
      areaSqMt: Number(((shutterHeight * shutterWidth * sCount) / 1_000_000).toFixed(3)),
    });
  }

  // 2. Drawers (if tandem box or drawer count > 0)
  if (item.drawerCount > 0) {
    const dCount = item.drawerCount;
    const faciaHeight = Math.round((h - (dCount * 5)) / dCount);
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
      material: `${getCoreMaterialLabel(item)} (${item.finishType})`,
      edgeL1: true,
      edgeL2: true,
      edgeW1: true,
      edgeW2: true,
      edgeThicknessMm: 2.0,
      areaSqMt: Number(((faciaWidth * faciaHeight * dCount) / 1_000_000).toFixed(3)),
    });

    // Drawer internal box sides & bottom (if depth > 0)
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
      edgeL1: false,
      edgeL2: false,
      edgeW1: false,
      edgeW2: false,
      edgeThicknessMm: 0,
      areaSqMt: Number((((faciaWidth - 40) * drawerDepth * dCount) / 1_000_000).toFixed(3)),
    });
  }

  // 3. Carcass Panels: Left Gable, Right Gable, Top Deck, Bottom Deck, Back Panel
  // Generated in Full Modular ALWAYS, and in Semi Modular only when isBoxUnit is true (depth > 0)
  if (isFullModular || isBoxUnit) {
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
      material: `${getCoreMaterialLabel(item)} (Laminate)`,
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
      material: `${getCoreMaterialLabel(item)} (Laminate)`,
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
      material: `${getCoreMaterialLabel(item)} (Laminate)`,
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
      material: `${getCoreMaterialLabel(item)} (Laminate)`,
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
      edgeL1: false,
      edgeL2: false,
      edgeW1: false,
      edgeW2: false,
      edgeThicknessMm: 0,
      areaSqMt: Number((((h - 16) * (w - 16)) / 1_000_000).toFixed(3)),
    });
  }

  // 4. Internal Shelves
  const shelfCount = item.shelfCount || (item.category === 'shelves' || item.category === 'expo' ? 4 : 2);
  if (shelfCount > 0) {
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
      material: `${getCoreMaterialLabel(item)} (Laminate)`,
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
      material: '18mm BWP Marine Ply (Moisture-Resistant Skirting Plinth)',
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

    // 5B. Cross Battens / Sub-Carcass Leveler Supports (Returns)
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
      material: '18mm BWP Marine Ply (Under-Carcass Load Transfer Battens)',
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

  // 6. Ceiling Pelmet / Infill Strip (for Lofts and overhead units to seal ceiling gap)
  const isLoftUnit = item.category === 'loft' || item.category === 'kitchen_loft';
  if (isLoftUnit) {
    parts.push({
      id: `${item.id}-pelmet-top`,
      itemId: item.id,
      room: item.room,
      itemName: item.description,
      wall: item.wall,
      partName: 'Pelmet/Skirting',
      lengthMm: w,
      widthMm: 75,
      thicknessMm: 18,
      qty: 1,
      material: `${getCoreMaterialLabel(item)} (${item.finishType})`,
      edgeL1: true,
      edgeL2: false,
      edgeW1: false,
      edgeW2: false,
      edgeThicknessMm: 0.8,
      grainDirection: 'any',
      canRotate: true,
      notes: '75mm Ceiling Infill Pelmet for slab leveling',
      areaSqMt: Number(((w * 75) / 1_000_000).toFixed(3)),
    });
  }

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
      material: `${getCoreMaterialLabel(item)} (${item.finishType})`,
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

// Calculate material usage breakdown from items and cut list
export function calculateMaterialUsage(cutList: CutListPart[]): MaterialBreakdown {
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
      const hingesNeeded = part.lengthMm > 2100 ? 4 : part.lengthMm > 1500 ? 3 : 2;
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
      shelfSupports += part.qty * 4;
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

  const outerLaminateSheets = Math.ceil(ply18mmSheets * 0.45);
  const innerLaminateSheets = Math.ceil(ply18mmSheets * 0.95);

  const roundedEdgeBand2mm = Math.round(edgeBand2mmMeters);
  const roundedEdgeBand08mm = Math.round(edgeBand08mmMeters);
  const totalEdgeBand = roundedEdgeBand2mm + roundedEdgeBand08mm;
  const totalHingesPairs = Math.ceil(softCloseHingesPairs);

  return {
    totalSheets,
    totalPieces,
    ply18mmSheets,
    ply18mmAreaSqFt,
    ply9mmSheets,
    ply9mmAreaSqFt,
    ply6mmSheets,
    ply6mmAreaSqFt,
    innerLaminateSheets: Math.max(1, innerLaminateSheets),
    outerLaminateSheets: Math.max(1, outerLaminateSheets),
    edgeBandMeters: totalEdgeBand,
    edgeBand2mmMeters: roundedEdgeBand2mm,
    edgeBand08mmMeters: roundedEdgeBand08mm,
    softCloseHingesPairs: totalHingesPairs,
    totalHingesPieces: totalHingesPairs * 2,
    tandemBoxChannels,
    drawerChannels,
    handles,
    shelfSupports,
    fastenersMinifixCount: (ply18mmSheets * 32),
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

// 2D Guillotine / Strip Nesting Algorithm for 2440 x 1220 mm Standard Boards
// Optimized to minimize waste, respect wood grain, and harvest usable offcuts for skirting & shelves
export function generateSheetNestingLayouts(cutList: CutListPart[]): {
  layouts: SheetLayout[];
  updatedCutList: CutListPart[];
} {
  const layouts: SheetLayout[] = [];
  const updatedCutList: CutListPart[] = [...cutList];

  // Group parts by thickness: 18mm, 9mm, 6mm
  const thicknessGroups = [
    { thickness: 18, name: '18mm Core Board (Plywood/HDHMR)', prefix: '18' },
    { thickness: 9, name: '9mm Drawer Bottom Board', prefix: '09' },
    { thickness: 6, name: '6mm Backing Ply Panel', prefix: '06' },
  ];

  for (const group of thicknessGroups) {
    const groupParts = updatedCutList.filter((p) => p.thicknessMm === group.thickness);
    if (groupParts.length === 0) continue;

    interface NestingUnit {
      partIndex: number;
      partId: string;
      partName: string;
      itemName: string;
      room: string;
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
          dim1: part.lengthMm,
          dim2: part.widthMm,
          color: PART_COLORS[part.partName] || '#64748b',
          canRotate: rotatable,
          grain: part.grainDirection || (isGrainLocked ? 'length' : 'any'),
        });
      }
    });

    // Priority sorting: Large panels first (decreasing area & primary length), narrow skirtings/cleats fill strips later
    units.sort((a, b) => {
      const areaA = a.dim1 * a.dim2;
      const areaB = b.dim1 * b.dim2;
      return areaB - areaA || b.dim1 - a.dim1;
    });

    let sheetNumber = 1;
    let currentSheetParts: SheetLayout['parts'] = [];
    let currentSheetOffcuts: SheetLayout['offcuts'] = [];
    let primaryRipCuts: number[] = [];
    let currentX = 0; // Along SHEET_LENGTH_MM (2440)
    let currentY = 0; // Along SHEET_WIDTH_MM (1220)
    let currentShelfHeight = 0; // Height of current strip along 1220
    let usedArea = 0;
    const sheetPartAssignments = new Map<number, string>();

    const finalizeSheet = () => {
      if (currentSheetParts.length === 0) return;
      const sheetId = `Sheet ${group.prefix}-${String(sheetNumber).padStart(2, '0')}`;
      const totalSheetArea = (SHEET_LENGTH_MM * SHEET_WIDTH_MM) / 1_000_000;

      // Identify remaining offcut rectangles on this sheet
      // 1. Right end of last active shelf
      if (currentX + 150 < SHEET_LENGTH_MM && currentShelfHeight > 80) {
        const offW = SHEET_LENGTH_MM - currentX;
        const offH = currentShelfHeight;
        const offArea = Number(((offW * offH) / 1_000_000).toFixed(3));
        const isUsable = offW >= 500 && offH >= 90;
        currentSheetOffcuts.push({
          id: `${sheetId}-offcut-strip`,
          x: currentX,
          y: currentY,
          w: offW,
          h: offH,
          areaSqMt: offArea,
          isUsable,
          recommendedUse: isUsable
            ? offH <= 120
              ? '100mm Skirting Runner / Plinth Support'
              : 'Internal Shelf / Drawer Side'
            : 'Saw Kerf & Trimmer Scrap',
        });
      }

      // 2. Bottom remaining un-cut slab across sheet width (1220mm)
      const bottomRemainingY = currentY + currentShelfHeight + SAW_KERF_MM;
      if (bottomRemainingY + 80 < SHEET_WIDTH_MM) {
        const offW = SHEET_LENGTH_MM;
        const offH = SHEET_WIDTH_MM - bottomRemainingY;
        const offArea = Number(((offW * offH) / 1_000_000).toFixed(3));
        const isUsable = offH >= 90;
        currentSheetOffcuts.push({
          id: `${sheetId}-offcut-bottom`,
          x: 0,
          y: bottomRemainingY,
          w: offW,
          h: offH,
          areaSqMt: offArea,
          isUsable,
          recommendedUse: isUsable
            ? offH <= 120
              ? '100mm Skirting Plinth Runners (Full 2.4m Length)'
              : 'Standard Shelves / Infill Cleats'
            : 'Saw Dust & Trimmer Scrap',
        });
        primaryRipCuts.push(bottomRemainingY);
      }

      const usableOffcutArea = currentSheetOffcuts
        .filter((o) => o.isUsable)
        .reduce((sum, o) => sum + o.areaSqMt, 0);

      const scrapArea = Math.max(0, totalSheetArea - usedArea - usableOffcutArea);
      const utilPercent = Math.min(98, Math.max(35, Math.round((usedArea / totalSheetArea) * 100)));
      const recPercent = Math.min(99, Math.round(((usedArea + usableOffcutArea) / totalSheetArea) * 100));

      layouts.push({
        sheetId,
        sheetIndex: sheetNumber,
        thicknessMm: group.thickness,
        materialName: group.name,
        sheetWidthMm: SHEET_LENGTH_MM,
        sheetHeightMm: SHEET_WIDTH_MM,
        usedAreaSqMt: Number(usedArea.toFixed(2)),
        offcutAreaSqMt: Number(usableOffcutArea.toFixed(2)),
        scrapAreaSqMt: Number(scrapArea.toFixed(2)),
        utilizationPercent: utilPercent,
        recoveryPercent: recPercent,
        parts: currentSheetParts,
        offcuts: currentSheetOffcuts,
        primaryRipCuts: [...new Set(primaryRipCuts)].sort((a, b) => a - b),
      });

      sheetNumber++;
      currentSheetParts = [];
      currentSheetOffcuts = [];
      primaryRipCuts = [];
      currentX = 0;
      currentY = 0;
      currentShelfHeight = 0;
      usedArea = 0;
    };

    for (const unit of units) {
      // Determine best orientation (length along X, width along Y vs rotated)
      let partW = unit.dim1; // along sheet length (2440)
      let partH = unit.dim2; // along sheet width (1220)
      let isRotated = false;

      // If unit can rotate, check if rotated orientation fits better or uses less strip height
      if (unit.canRotate) {
        // Try fitting within remaining current shelf
        const fitsNormal = currentX + unit.dim1 + SAW_KERF_MM <= SHEET_LENGTH_MM && unit.dim2 <= (currentShelfHeight || SHEET_WIDTH_MM);
        const fitsRotated = currentX + unit.dim2 + SAW_KERF_MM <= SHEET_LENGTH_MM && unit.dim1 <= (currentShelfHeight || SHEET_WIDTH_MM);

        if (!fitsNormal && fitsRotated) {
          partW = unit.dim2;
          partH = unit.dim1;
          isRotated = true;
        } else if (currentShelfHeight === 0) {
          // Starting a new shelf: pick orientation that consumes less vertical height along 1220
          const minH = Math.min(unit.dim1, unit.dim2);
          const maxW = Math.max(unit.dim1, unit.dim2);
          if (maxW <= SHEET_LENGTH_MM && minH <= SHEET_WIDTH_MM) {
            partW = maxW;
            partH = minH;
            isRotated = partW !== unit.dim1;
          }
        }
      }

      // If part exceeds sheet length even alone, clamp or rotate
      if (partW > SHEET_LENGTH_MM) {
        if (unit.canRotate && partH <= SHEET_LENGTH_MM && partW <= SHEET_WIDTH_MM) {
          const temp = partW;
          partW = partH;
          partH = temp;
          isRotated = !isRotated;
        } else {
          partW = Math.min(partW, SHEET_LENGTH_MM);
        }
      }

      // Check if part fits on current horizontal shelf
      if (currentX + partW + SAW_KERF_MM > SHEET_LENGTH_MM) {
        // Move to next shelf vertically
        if (currentShelfHeight > 0) {
          primaryRipCuts.push(currentY + currentShelfHeight);
        }
        currentX = 0;
        currentY += currentShelfHeight + SAW_KERF_MM;
        currentShelfHeight = 0;
      }

      // Check if part fits vertically within the 1220mm sheet width
      if (currentY + partH + SAW_KERF_MM > SHEET_WIDTH_MM) {
        // Sheet full -> open new sheet
        finalizeSheet();
      }

      // Place part on current sheet
      const currentSheetId = `Sheet ${group.prefix}-${String(sheetNumber).padStart(2, '0')}`;
      currentSheetParts.push({
        partId: unit.partId,
        partName: unit.partName,
        itemName: unit.itemName,
        room: unit.room,
        x: currentX,
        y: currentY,
        w: partW,
        h: partH,
        rotated: isRotated,
        color: unit.color,
        grain: unit.grain,
      });

      usedArea += (partW * partH) / 1_000_000;
      currentX += partW + SAW_KERF_MM;
      currentShelfHeight = Math.max(currentShelfHeight, partH);

      // Record sheet assignment for master cutList part
      if (!sheetPartAssignments.has(unit.partIndex)) {
        sheetPartAssignments.set(unit.partIndex, currentSheetId);
      }
    }

    // Finalize last sheet of this thickness
    finalizeSheet();

    // Assign sheetNumber to original parts
    sheetPartAssignments.forEach((sId, pIdx) => {
      if (updatedCutList[pIdx]) {
        updatedCutList[pIdx].sheetNumber = sId;
      }
    });
  }

  return { layouts, updatedCutList };
}

// Calculate comprehensive cost breakdown
export function calculateProjectCost(
  material: MaterialBreakdown,
  items: ModularItem[],
  rates: FactoryRates
): CostBreakdown {
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
