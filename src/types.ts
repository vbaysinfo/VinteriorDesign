export type ProjectType = 'semi' | 'full';

// How an item's doors open. 'hinged' (the default/undefined) swings open on
// hinges, one door per shutter slot; 'sliding' rides on a track and never
// swings - its own panel count is auto-calculated from width (2 panels up
// to a standard track width, 3 beyond it), separately from the hinged
// width ladder. See getAutoShutterCount() in calculator.ts.
export type DoorType = 'hinged' | 'sliding';

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
  | 'Vertical Partition'
  | 'Shutter'
  | 'Drawer Front'
  | 'Drawer Side'
  | 'Drawer Bottom'
  | 'Pelmet/Skirting'
  | 'Expo/Dummy Panel';

// A wardrobe/dressing unit's interior closet organization - full-height
// vertical columns (like the two reference photo styles the factory
// actually builds: a hanging-rod bay next to an independent shelf/drawer
// stack), each with its OWN horizontal shelf pattern instead of one shared
// set of shelf heights across the whole carcass. This is what lets one
// column be a plain hanging rod while the column next to it has its own
// shelves, some of which are converted to drawers - a real asymmetric
// closet, not just a uniform grid.
export type ClosetColumnType = 'shelves' | 'hanging_rod';

export interface ClosetColumn {
  id: string;
  widthMm: number; // this column's own width - every column's widthMm sums to the carcass's inner width
  type: ClosetColumnType;
  // Horizontal shelf positions within THIS column only, in mm from the
  // column's own inner-top edge. For 'shelves', splits the column into
  // compartments top-to-bottom. For 'hanging_rod', at most one entry - an
  // overhead storage shelf above the rod (the common reference-photo
  // pattern); the rod itself always sits a fixed distance below that.
  shelvesMm: number[];
  // Which compartments (0-indexed top-to-bottom, bounded by shelvesMm plus
  // the column's own top/bottom edges) are fabricated as a real drawer box
  // (front + sides + bottom) instead of an open shelf - the Item
  // Inspector's Closet Interior Design editor exposes this as a "Make
  // Drawer" / "Make Shelf" button on each compartment. Only meaningful for
  // 'shelves' columns.
  drawerCompartments: number[];
}

// See getAutoClosetLayout() / getEffectiveClosetLayout() in calculator.ts -
// undefined on the item means "not customized yet, auto-generate from
// width/height"; an explicit value always wins over the auto-layout, even
// one the user has stripped down to a single plain column.
export interface ClosetLayout {
  columns: ClosetColumn[];
}

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
  doorType?: DoorType; // blank/undefined = hinged (open/close); 'sliding' = track-mounted, never drawn with a hinge swing
  drawerCount: number;
  shelfCount: number;
  // Wardrobe/dressing-unit interior closet design (vertical partitions +
  // horizontal shelves) - only meaningful for a closet-eligible category
  // (wardrobe_shutter, single_wardrobe, dressing_unit) built Full Modular
  // with a real Depth (a real box). Undefined = not customized, auto-
  // generate from width/height; superseded by shelfCount above for every
  // other category/construction mode, which keeps using the plain flat
  // shelf count. See isClosetEligible() / getEffectiveClosetLayout().
  closetLayout?: ClosetLayout;
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
  // Per-piece override of fabricBothSides above - e.g. only the Back Panel
  // needs both faces fabric-laminated while the Gables stay single-sided.
  // Only meaningful for a part currently backed by Fabric (a box surface,
  // or one manually pinned to Fabric via materialOverrides); a missing
  // entry falls back to the item-wide fabricBothSides checkbox.
  fabricBothSidesOverrides?: Partial<Record<CutListPartName, boolean>>;
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
  // Copied from the originating item, only ever set on a 'Shutter' part -
  // lets hardware calculation charge a sliding track/rollers instead of
  // hinges for that panel, without having to look the item back up.
  doorType?: DoorType;
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
  // Which sheet this offcut sits on, and that sheet's own material/color and
  // thickness - so an offcut can be listed on its own (a leftover inventory
  // row) without needing its parent SheetLayout for context.
  sheetId: string;
  materialName: string;
  thicknessMm: number;
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
    // True when this piece was cut from a rectangle freed up by an earlier
    // piece on this sheet (leftover material reused), false when it's the
    // first piece placed on this sheet (starting from virgin board).
    reusedOffcut: boolean;
  }>;
  offcuts: UsableOffcut[];
  primaryRipCuts?: number[];
}

// One still-available (unconsumed) usable offcut, flattened out of every
// sheet's own offcuts list - the material reuse system's actual leftover
// inventory register: Length x Width, Material, and where it lives.
export interface LeftoverInventoryRow {
  id: string;
  sheetId: string;
  materialName: string;
  thicknessMm: number;
  lengthMm: number;
  widthMm: number;
  areaSqFt: number;
  recommendedUse: string;
}

export interface MaterialReuseSummary {
  leftoverInventory: LeftoverInventoryRow[];
  reusedPiecesCount: number;
  freshPiecesCount: number;
  totalUsableLeftoverAreaSqFt: number;
  totalScrapAreaSqFt: number;
  scrapPercent: number;
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
  depthMissing: boolean; // true = this row IS meant to be boxed (Full Modular) but Depth is blank, so no box was built
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

// A single "up to this shutter height, this many hinges" step. Rules are
// read in ascending maxHeightMm order; the first one a shutter's own
// height fits under wins. The last rule should carry a very large
// maxHeightMm so every taller shutter still resolves to a hinge count
// instead of falling through unhandled.
export interface HingeRule {
  maxHeightMm: number;
  hinges: number;
}

export type BoxJoiningSystem = 'confirmat' | 'minifix_dowel' | 'screw_bracket';
export type BackPanelFixing = 'staples' | 'screws';

// Factory-configurable hardware quantity rules - separate from FactoryRates
// (which prices hardware, not counts it). Admin-editable via the Hardware
// Rules panel; calculateHardwareBOM and calculateMaterialUsage both read
// from the same rules object so the detailed BOM and the aggregate
// hardware totals never disagree with each other.
export interface HardwareRules {
  hingeRules: HingeRule[];
  handlesPerShutter: number;
  handlesPerDrawer: number;
  shelfPinsPerShelf: number;
  boxJoiningSystem: BoxJoiningSystem;
  minifixSetsPerBox: number;
  dowelsPerBox: number;
  confirmatScrewsPerBox: number;
  bracketsPerBox: number;
  bracketScrewsPerBracket: number;
  backPanelFixing: BackPanelFixing;
  backPanelFixingSpacingMm: number;
  skirtingClipSpacingMm: number;
}

// Where a value in the hardware engine came from - a permanent factory
// default, a one-off project override, or something the AI derived from a
// factory rule. Never invent a hardware line without one of these.
export type HardwareSource = 'Factory Rule' | 'Project Rule' | 'AI Calculation';

// One calculated hardware requirement for one component. Several of these
// aggregate (by hardwareCode + unit) into the Purchase BOM.
export interface HardwareBOMLine {
  projectId: string;
  moduleId: string;
  moduleName: string;
  room: string;
  componentId: string;
  componentType: string;
  hardwareCode: string;
  hardwareName: string;
  brand?: string;
  model?: string;
  specification?: string;
  unit: string;
  quantity: number;
  calculationRule: string;
  source: HardwareSource;
  remarks?: string;
}

export interface AggregatedHardwareLine {
  hardwareCode: string;
  hardwareName: string;
  unit: string;
  totalQuantity: number;
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
  // Quick flat per-sq.ft quotation rates - a separate, simpler estimate
  // from the detailed BOM costing above (board/hardware/labor rates).
  // Applied per item using its own elevation face area (widthFt x
  // heightFt, same as areaSqFt - unaffected by depth), bucketed by each
  // item's real effective construction type: Full Modular = a real Depth
  // is entered (item.projectType override or the project-wide default),
  // Semi Modular = Depth left blank. 0 = not yet configured by the user.
  quickSemiRatePerSqFt: number;
  quickFullRatePerSqFt: number;
}

// Result of the quick per-sq.ft estimate - every item bucketed by its own
// real effective construction type and priced at that bucket's flat rate.
export interface QuickAreaEstimate {
  semiAreaSqFt: number;
  semiItemCount: number;
  semiCost: number;
  fullAreaSqFt: number;
  fullItemCount: number;
  fullCost: number;
  totalAreaSqFt: number;
  totalCost: number;
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
