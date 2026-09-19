export type ProjectType = 'semi' | 'full';

export type WallType = 'front' | 'left' | 'right' | 'back';

// The closed set of cut-part types a modular item can generate. Shared
// between ModularItem's per-part material override map and CutListPart's
// own partName field so the two can never drift apart.
export type CutListPartName =
  | 'Left Gable'
  | 'Right Gable'
  | 'Top Deck'
  | 'Bottom Deck'
  | 'Back Panel'
  | 'Internal Shelf'
  | 'Shutter'
  | 'Drawer Front'
  | 'Drawer Side'
  | 'Drawer Bottom'
  | 'Pelmet/Skirting'
  | 'Expo/Dummy Panel';

export type UnitCategory = 
  | 'wardrobe_shutter'
  | 'loft'
  | 'sitting_box'
  | 'expo'
  | 'dummy'
  | 'dressing_unit'
  | 'profile_door'
  | 'shelves'
  | 'tv_panel'
  | 'partition'
  | 'kitchen_base'
  | 'kitchen_overhead'
  | 'kitchen_loft'
  | 'tandem_box'
  | 'single_wardrobe'
  | 'other';

export interface ModularItem {
  id: string;
  sNo: number;
  room: string;
  description: string;
  wall: WallType;
  category: UnitCategory;
  widthFt: number;
  heightFt: number;
  depthFt: number; // 0 or blank for frame/shutter in semi-modular
  widthMm: number;
  heightMm: number;
  depthMm: number;
  calcBasis: 'Area (Sq.ft)' | 'Volume (Cu.ft)';
  areaSqFt: number;
  volumeCuFt: number;
  projectType?: ProjectType; // Optional per-item override; blank/undefined inherits the project-wide Semi/Full Modular toggle
  shutterCount: number;
  drawerCount: number;
  shelfCount: number;
  finishType: 'Laminate' | 'Acrylic' | 'PU Paint' | 'Profile Glass' | 'Veneer';
  coreMaterial: 'BWP Marine Ply' | 'BWR Commercial Ply' | 'HDHMR' | 'Prelam MDF';
  notes?: string;
  quantity?: number; // how many identical copies of this item to fabricate (default 1); scales every cut part's qty and area
  laminateColorCode?: string; // free-text laminate color/code, e.g. "Ivory - IV102"
  materialCode?: string; // free-text override for the exported "Material" label; falls back to `${coreMaterial} (${finishType})` when blank
  edgeBindingNote?: string; // free-text summary of edge banding treatment for this item (display/export only - the real per-panel edge banding used for hardware/cost is computed automatically per part)
  shutterWidthOverrides?: number[]; // per-shutter widths in mm, left-to-right; length must equal the item's shutter count or it's ignored and widths fall back to an even auto-split of widthMm
  // Fabric and shutter color are two different material rules: a box's
  // carcass surfaces (Gables/Decks/Back Panel - Width x Height x Depth)
  // take Fabric, laminated on ONE side by default (the factory standard);
  // the customer can select fabric on BOTH sides, which doubles the
  // fabric quantity for those surfaces. Never applies to the shutter,
  // which is Color/Finish on Width x Height only, calculated separately.
  fabricBothSides?: boolean;
  // Manual per-part material override, set by clicking a specific panel
  // in the 3D isometric view and picking Fabric or Color/Laminate there.
  // Keyed by part TYPE (partName), not by the individual generated part's
  // id, so picking a material for e.g. "Shutter" applies to every door of
  // this item, not just the one clicked. Takes precedence over the
  // automatic BOX/SHUTTER material rule in generateCutListForItem.
  materialOverrides?: Partial<Record<CutListPartName, 'Fabric' | 'Color/Laminate'>>;
}

export interface CutListPart {
  id: string;
  itemId: string;
  room: string;
  itemName: string;
  wall: WallType;
  partName: CutListPartName;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  qty: number;
  material: string;
  // Whether this panel's FRONT (customer-facing) side carries the
  // customer's selected decorative color (a visible face - shutter,
  // drawer front, skirting kickplate, an open expo/shelves unit's own
  // shelves) or the generic "Fabric" liner used by every hidden/
  // structural part regardless of room or color. Drives both the sheet
  // nester's compatibility grouping and the on-piece labeling.
  materialCategory: 'Fabric' | 'Color/Laminate';
  // What the panel's BACK (hidden/rear) side is laminated with. Fabric
  // and shutter color are two different material rules: a fully-hidden
  // carcass/internal BOX part (Gable, Deck, Back Panel, Drawer Side/
  // Bottom, a closed wardrobe's shelf, a structural batten) is Fabric on
  // one face by factory-standard default (front === back here), or both
  // faces if its item selected fabricBothSides below. A customer-facing
  // SHUTTER-type part (Shutter, Drawer Front, visible Skirting, Expo/
  // Dummy panel, an open shelf unit's own shelf) is Color/Laminate on
  // both front and back - no fabric on a shutter at all - counted once,
  // not per face, and never affected by fabricBothSides, which only ever
  // applies to the box.
  backMaterialCategory: 'Fabric' | 'Color/Laminate';
  // Copied from the originating item, and only meaningful when both
  // materialCategory and backMaterialCategory above are 'Fabric' (a box
  // surface): whether the customer selected fabric on both faces of this
  // surface, doubling its fabric quantity, instead of the factory-
  // standard single face.
  fabricBothSides?: boolean;
  sheetNumber?: string;
  edgeL1: boolean;
  edgeL2: boolean;
  edgeW1: boolean;
  edgeW2: boolean;
  edgeThicknessMm: number; // 0.8mm or 2.0mm
  areaSqMt: number;
  grainDirection?: 'length' | 'width' | 'any';
  canRotate?: boolean;
  notes?: string;
}

export interface UsableOffcut {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  areaSqMt: number;
  isUsable: boolean;
  recommendedUse: string; // e.g. "Skirting Runner", "Internal Shelf", "Drawer Side", "Dust/Scrap"
}

export interface SheetLayout {
  sheetId: string;
  sheetIndex: number;
  thicknessMm: number;
  materialName: string;
  sheetWidthMm: number; // 2440
  sheetHeightMm: number; // 1220
  usedAreaSqMt: number;
  offcutAreaSqMt: number;
  scrapAreaSqMt: number;
  utilizationPercent: number;
  recoveryPercent: number;
  parts: Array<{
    partId: string;
    partName: string;
    itemName: string;
    room: string;
    materialCategory: 'Fabric' | 'Color/Laminate';
    x: number;
    y: number;
    w: number;
    h: number;
    rotated: boolean;
    color: string;
    grain: 'length' | 'width' | 'any';
  }>;
  offcuts: UsableOffcut[];
  primaryRipCuts?: number[];
}

// Per-item factory carcass box breakdown, computed independently under
// a Semi Modular assumption and a Full Modular assumption so both can be
// compared side by side for the same uploaded item list.
export interface RoomBoxRow {
  itemId: string;
  room: string;
  wall: WallType;
  itemName: string;
  category: UnitCategory;
  hasBox: boolean; // false = civil-built shutter/frame only, no factory carcass box
  boxCount: number; // number of physical carcass boxes this item is split into
  boxWidthMm: number; // width of each individual box (item width split evenly across boxCount)
  heightMm: number;
  depthMm: number;
  boxWidthFt: number;
  heightFt: number;
  depthFt: number;
  volumeCuFtPerBox: number;
}

export interface MaterialBreakdown {
  totalSheets: number;
  totalPieces: number;
  ply18mmSheets: number;
  ply18mmAreaSqFt: number;
  ply9mmSheets: number;
  ply9mmAreaSqFt: number;
  ply6mmSheets: number; // back panels
  ply6mmAreaSqFt: number;
  // innerLaminateSheets/outerLaminateSheets are the totals used for
  // costing (PricingReport) - computed from the box/shutter breakdown
  // below, not a guessed ratio of the board sheet count.
  innerLaminateSheets: number; // = boxFabricSheets (Fabric is never used on a shutter-type panel)
  outerLaminateSheets: number; // = boxColorLaminateSheets + shutterColorSheets
  // Fabric and shutter color are two different material rules (see
  // CutListPart.backMaterialCategory / fabricBothSides), both costed
  // against the same standard 8ft x 4ft / 32 sq.ft factory sheet.
  // BOX: Width x Height x Depth. Fabric-laminated - single face by
  // factory-standard default, doubled per item wherever the customer
  // selected fabric on both faces. A box surface finished in the
  // customer's Color/Laminate instead is tracked too, for whichever
  // category ever generates one (none currently do).
  boxFabricAreaSqFt: number; // total box-panel fabric area actually needed (already includes doubling where selected)
  boxFabricSheets: number;
  boxFabricPieces: number;
  boxFabricBothSidesAreaSqFt: number; // how much of the above came from a both-sides selection (informational)
  boxColorLaminateAreaSqFt: number;
  boxColorLaminateSheets: number;
  boxColorLaminatePieces: number;
  // SHUTTER: Width x Height only. Color/Finish only - no fabric on a
  // shutter at all - calculated completely separately from the box, and
  // never affected by a box's fabricBothSides selection.
  shutterColorAreaSqFt: number;
  shutterColorSheets: number;
  shutterColorPieces: number;
  edgeBandMeters: number;
  edgeBand2mmMeters: number;
  edgeBand08mmMeters: number;
  softCloseHingesPairs: number;
  totalHingesPieces: number;
  tandemBoxChannels: number;
  drawerChannels: number;
  handles: number;
  shelfSupports: number;
  fastenersMinifixCount: number;
  // Zero-waste material usage metrics
  grossBoardAreaSqFt: number;
  netPartsAreaSqFt: number;
  overallUtilizationPercent: number;
  usableOffcutAreaSqFt: number;
  totalScrapWasteSqFt: number;
  wastePercent: number;
  skirtingLinearMeters: number;
  skirtingPiecesCount: number;
  skirtingFromOffcutsMeters: number;
  skirtingPlinthHeightMm: number;
}

export interface RoomPerimeterInfo {
  room: string;
  wallWidthsMm: {
    front: number;
    back: number;
    left: number;
    right: number;
  };
  roomWidthMm: number;
  roomDepthMm: number;
  grossPerimeterMm: number;
  grossPerimeterMeters: number;
  doorDeductionMm: number;
  doorDeductionMeters: number;
  netPerimeterMm: number;
  netPerimeterMeters: number;
  cabinetFrontPlinthMeters: number;
  cabinetReturnPlinthMeters: number;
  totalCabinetPlinthMeters: number;
  wallSkirtingMeters: number;
  totalSkirtingLinearMeters: number;
  suggestedPanelsCount: number;
}

export interface RoomSkirtingOptions {
  skirtingHeightMm?: number; // default 100mm
  thicknessMm?: number; // default 18mm
  material?: string;
  doorDeductionMm?: number; // default 900mm
  standardBoardLengthMm?: number; // default 2440mm
  mode?: 'full_room_perimeter' | 'supplemental_perimeter' | 'cabinet_perimeter';
  rooms?: string[];
}

export interface CostBreakdown {
  carcassBoardCost: number;
  shutterBoardCost: number;
  backPanelCost: number;
  innerLaminateCost: number;
  outerLaminateCost: number;
  edgeBandCost: number;
  hardwareCost: number;
  factoryLaborCost: number;
  packingTransportCost: number;
  installationCost: number;
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  semiSavingsVsFull?: number;
}

export interface FactoryRates {
  plywood18mmPerSqFt: number; // e.g. ₹95 / sqft (approx $1.20)
  plywood9mmPerSqFt: number;  // e.g. ₹55 / sqft
  plywood6mmPerSqFt: number;  // e.g. ₹42 / sqft
  innerLaminatePerSheet: number; // e.g. ₹1100 / sheet (8x4 = 32 sqft)
  outerLaminatePerSheet: number; // e.g. ₹2400 / sheet
  acrylicPerSheet: number;       // e.g. ₹4800 / sheet
  edgeBandPerMeter: number;      // e.g. ₹18 / m (PVC 2mm) or ₹10 (0.8mm)
  hingesPairRate: number;        // e.g. ₹380 / pair (Soft close)
  tandemChannelRate: number;     // e.g. ₹2200 / channel set
  drawerChannelRate: number;     // e.g. ₹650 / pair (Telescopic soft close)
  handleRate: number;            // e.g. ₹280 / pc
  factoryLaborPerSqFt: number;   // e.g. ₹65 / sqft (CNC cutting, edging, pressing)
  installationPerSqFt: number;   // e.g. ₹45 / sqft
  packingTransportLumpSum: number; // e.g. ₹4500
  taxPercent: number;            // e.g. 18% GST
  profitMarginPercent: number;   // e.g. 15%
}

export interface ProjectInfo {
  projectName: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  siteAddress: string;
  projectType: ProjectType;
  date: string;
  currency: string; // '₹' or '$'
}
