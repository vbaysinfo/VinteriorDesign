import { ModularItem, WallType, DoorType, ShutterStyle, ClosetLayout } from '../types';
import { ftToMm, recalculateItemMetrics, getAutoClosetLayout } from './calculator';

// Nine ready-made starting points for the most common real wardrobe builds -
// each sets sensible Width/Height/Depth, Door Type, and (where relevant) a
// Loft or a drawer-fitted closet interior, so picking one and hitting
// Generate gives a complete, realistic, Full Modular wardrobe in one click
// instead of configuring every field by hand. Every generated item is a
// completely normal ModularItem afterward - same Item Inspector, Closet
// Interior Design editor, Print CAD, cut list, and hardware/pricing as if
// it had been typed in or uploaded from Excel.
export type WardrobeTemplateKey =
  | 'two_door'
  | 'three_door'
  | 'four_door'
  | 'sliding_door'
  | 'hinged_door'
  | 'floor_to_ceiling'
  | 'with_loft'
  | 'with_drawers'
  | 'arch_traditional';

export interface WardrobeTemplateDefinition {
  label: string;
  description: string;
  widthFt: number;
  heightFt: number;
  depthFt: number;
  shutterCount: number;
  doorType: DoorType;
  shutterStyle: ShutterStyle;
  // A second Loft item is generated above this one on the same wall,
  // matching how a real Loft row is already modeled everywhere else in
  // this app (the Wall Elevation and Wardrobe Design Sheets already know
  // how to draw the two as one attached, combined-height unit).
  includeLoft: boolean;
  // The closet interior's auto-generated layout gets its bottom two
  // compartments (in its first non-rod column) converted to real drawer
  // boxes instead of open shelves.
  includeDrawers: boolean;
}

export const WARDROBE_TEMPLATES: Record<WardrobeTemplateKey, WardrobeTemplateDefinition> = {
  two_door: {
    label: 'Two-Door Wardrobe',
    description: 'A compact 4ft-wide, 2-shutter hinged wardrobe - the standard single-bedroom starting point.',
    widthFt: 4,
    heightFt: 7,
    depthFt: 2,
    shutterCount: 2,
    doorType: 'hinged',
    shutterStyle: 'plain',
    includeLoft: false,
    includeDrawers: false,
  },
  three_door: {
    label: 'Three-Door Wardrobe',
    description: 'A 6ft-wide, 3-shutter hinged wardrobe - room for a dedicated hanging-rod bay plus two shelf columns.',
    widthFt: 6,
    heightFt: 7,
    depthFt: 2,
    shutterCount: 3,
    doorType: 'hinged',
    shutterStyle: 'plain',
    includeLoft: false,
    includeDrawers: false,
  },
  four_door: {
    label: 'Four-Door Wardrobe',
    description: 'An 8ft-wide, 4-shutter hinged wardrobe for a full master bedroom wall.',
    widthFt: 8,
    heightFt: 7,
    depthFt: 2,
    shutterCount: 4,
    doorType: 'hinged',
    shutterStyle: 'plain',
    includeLoft: false,
    includeDrawers: false,
  },
  sliding_door: {
    label: 'Sliding-Door Wardrobe',
    description: 'A 6ft-wide, 2-panel sliding wardrobe - no door swing clearance needed, good for a tight room.',
    widthFt: 6,
    heightFt: 7,
    depthFt: 2,
    shutterCount: 2,
    doorType: 'sliding',
    shutterStyle: 'plain',
    includeLoft: false,
    includeDrawers: false,
  },
  hinged_door: {
    label: 'Hinged-Door Wardrobe',
    description: 'A 5ft-wide, 3-shutter hinged wardrobe - the classic swing-open door style at a common mid-size.',
    widthFt: 5,
    heightFt: 7,
    depthFt: 2,
    shutterCount: 3,
    doorType: 'hinged',
    shutterStyle: 'plain',
    includeLoft: false,
    includeDrawers: false,
  },
  floor_to_ceiling: {
    label: 'Floor-to-Ceiling Wardrobe',
    description:
      'A 6ft-wide, 9ft-tall wardrobe built right up to the ceiling - taller than the standard 7ft door height, so it auto-splits into a Floor carcass + an automatic Loft box, same as any other Full Modular wardrobe entered that tall.',
    widthFt: 6,
    heightFt: 9,
    depthFt: 2,
    shutterCount: 3,
    doorType: 'hinged',
    shutterStyle: 'plain',
    includeLoft: false,
    includeDrawers: false,
  },
  with_loft: {
    label: 'Wardrobe with Loft',
    description: 'A 4ft-wide, 7ft wardrobe plus its own separate 2.2ft Loft box above it on the same wall.',
    widthFt: 4,
    heightFt: 7,
    depthFt: 2,
    shutterCount: 2,
    doorType: 'hinged',
    shutterStyle: 'plain',
    includeLoft: true,
    includeDrawers: false,
  },
  with_drawers: {
    label: 'Wardrobe with Drawers',
    description: 'A 4ft-wide, 2-shutter wardrobe whose closet interior has a real drawer bank fitted in its bottom.',
    widthFt: 4,
    heightFt: 7,
    depthFt: 2,
    shutterCount: 2,
    doorType: 'hinged',
    shutterStyle: 'plain',
    includeLoft: false,
    includeDrawers: true,
  },
  arch_traditional: {
    label: 'Traditional Wardrobe (Arch Shutters)',
    description: 'A 4ft-wide, 2-shutter wardrobe with a classic elliptical arch routed across the top of each door.',
    widthFt: 4,
    heightFt: 7,
    depthFt: 2,
    shutterCount: 2,
    doorType: 'hinged',
    shutterStyle: 'arch',
    includeLoft: false,
    includeDrawers: false,
  },
};

const LOFT_HEIGHT_FT = 2.2; // ~670mm, matching this app's own sample Loft rows

export interface WardrobeConfiguratorOptions {
  templateKey: WardrobeTemplateKey;
  roomName: string;
  wall: WallType;
  widthFt: number;
  heightFt: number;
  depthFt: number;
  shutterCount: number;
  doorType: DoorType;
  shutterStyle: ShutterStyle;
  includeLoft: boolean;
  includeDrawers: boolean;
  coreMaterial: ModularItem['coreMaterial'];
  finishType: ModularItem['finishType'];
  laminateColorCode?: string;
}

export function defaultWardrobeOptions(templateKey: WardrobeTemplateKey, roomName: string, wall: WallType): WardrobeConfiguratorOptions {
  const t = WARDROBE_TEMPLATES[templateKey];
  return {
    templateKey,
    roomName,
    wall,
    widthFt: t.widthFt,
    heightFt: t.heightFt,
    depthFt: t.depthFt,
    shutterCount: t.shutterCount,
    doorType: t.doorType,
    shutterStyle: t.shutterStyle,
    includeLoft: t.includeLoft,
    includeDrawers: t.includeDrawers,
    coreMaterial: 'BWR Commercial Ply',
    finishType: 'Laminate',
    laminateColorCode: '',
  };
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `wardrobe-${Date.now()}-${counter}`;
}

// Converts the bottom two compartments (bottom one, if there's only one) of
// the auto-layout's first non-hanging-rod column into real drawer boxes - a
// drawer bank is conventionally fitted at the BOTTOM of a wardrobe column,
// under the shelves, not mixed in at random heights. Every other column
// (including any hanging-rod bay) is left exactly as the auto-layout built
// it.
function fitDrawersIntoLayout(layout: ClosetLayout): ClosetLayout {
  let fitted = false;
  return {
    columns: layout.columns.map((col) => {
      if (fitted || col.rodCompartments.length > 0) return col;
      fitted = true;
      const compartmentCount = col.shelvesMm.length + 1;
      const bottomCompartments = compartmentCount >= 2 ? [compartmentCount - 1, compartmentCount - 2] : [compartmentCount - 1];
      return { ...col, drawerCompartments: bottomCompartments };
    }),
  };
}

function buildWardrobeItem(
  sNo: number,
  options: WardrobeConfiguratorOptions,
  overrides: Partial<ModularItem> = {}
): ModularItem {
  const widthMm = ftToMm(options.widthFt);
  const heightMm = ftToMm(options.heightFt);

  let closetLayout: ClosetLayout | undefined;
  if (options.includeDrawers) {
    closetLayout = fitDrawersIntoLayout(getAutoClosetLayout(widthMm, heightMm));
  }

  const item: ModularItem = {
    id: nextId(),
    sNo,
    room: options.roomName,
    description: WARDROBE_TEMPLATES[options.templateKey].label,
    wall: options.wall,
    category: 'wardrobe_shutter',
    widthFt: options.widthFt,
    heightFt: options.heightFt,
    depthFt: options.depthFt,
    widthMm,
    heightMm,
    depthMm: ftToMm(options.depthFt),
    calcBasis: 'Volume (Cu.ft)',
    areaSqFt: 0,
    volumeCuFt: 0,
    shutterCount: options.shutterCount,
    doorType: options.doorType === 'hinged' ? undefined : options.doorType,
    shutterStyle: options.shutterStyle === 'plain' ? undefined : options.shutterStyle,
    drawerCount: 0,
    shelfCount: 4,
    closetLayout,
    finishType: options.finishType,
    coreMaterial: options.coreMaterial,
    laminateColorCode: options.laminateColorCode?.trim() || undefined,
    quantity: 1,
    ...overrides,
  };
  return recalculateItemMetrics(item);
}

// Generates the one (or two, for "Wardrobe with Loft") ModularItem(s) for
// the chosen template + options. Everything downstream - the cut list
// (including the 7ft auto-split for Floor-to-Ceiling), the Closet Interior
// Design editor, Print CAD, hardware, and pricing - picks these up for free
// the same way it already does for an Excel-uploaded or hand-typed row.
export function generateWardrobeFromTemplate(options: WardrobeConfiguratorOptions, existingItems: ModularItem[]): ModularItem[] {
  let sNo = existingItems.length > 0 ? Math.max(...existingItems.map((i) => i.sNo)) + 1 : 1;
  const generated: ModularItem[] = [];

  generated.push(buildWardrobeItem(sNo++, options));

  if (options.includeLoft) {
    generated.push(
      buildWardrobeItem(sNo++, options, {
        category: 'loft',
        description: `${WARDROBE_TEMPLATES[options.templateKey].label} - Loft`,
        heightFt: LOFT_HEIGHT_FT,
        heightMm: ftToMm(LOFT_HEIGHT_FT),
        shutterCount: options.shutterCount,
        closetLayout: undefined,
      })
    );
  }

  return generated;
}
