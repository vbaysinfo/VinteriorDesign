export type ProjectType = 'semi' | 'full';

export type WallType = 'front' | 'left' | 'right' | 'back';

export type UnitCategory = 
  | 'wardrobe_shutter'
  | 'loft'
  | 'sitting_box'
  | 'expo'
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
}

export interface CutListPart {
  id: string;
  itemId: string;
  room: string;
  itemName: string;
  wall: WallType;
  partName: 'Left Gable' | 'Right Gable' | 'Top Deck' | 'Bottom Deck' | 'Back Panel' | 'Internal Shelf' | 'Shutter' | 'Drawer Front' | 'Drawer Side' | 'Drawer Bottom' | 'Pelmet/Skirting';
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  qty: number;
  material: string;
  // Whether this panel carries the customer's selected decorative color
  // (a visible face - shutter, drawer front, skirting kickplate, an open
  // expo/shelves unit's own shelves) or the generic "Fabric" liner used by
  // every hidden/structural part regardless of room or color. Drives both
  // the sheet nester's compatibility grouping and the on-piece labeling.
  materialCategory: 'Fabric' | 'Color/Laminate';
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
  innerLaminateSheets: number;
  outerLaminateSheets: number;
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
