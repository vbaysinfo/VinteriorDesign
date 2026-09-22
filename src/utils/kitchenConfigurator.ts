import { ModularItem, WallType } from '../types';
import { ftToMm, recalculateItemMetrics } from './calculator';

export type KitchenLayoutShape = 'straight' | 'l_shape' | 'u_shape' | 'parallel' | 'island';

export interface KitchenWallRunTemplate {
  key: string;
  label: string;
  wall: WallType;
}

// Each shape's fixed set of wall runs - which walls of the room the run
// sits against, used both to seed a sensible default length and to place
// the generated items correctly in the existing CAD 2D/3D wall system.
// "Island" has no real room wall to sit against (this app's WallType is
// only front/left/right/back); it's placed on 'front' as a working
// approximation, same as any other item that isn't against a real wall.
export const KITCHEN_SHAPE_RUNS: Record<KitchenLayoutShape, KitchenWallRunTemplate[]> = {
  straight: [{ key: 'main', label: 'Main Wall', wall: 'front' }],
  l_shape: [
    { key: 'a', label: 'Wall A', wall: 'front' },
    { key: 'b', label: 'Wall B (Corner)', wall: 'left' },
  ],
  u_shape: [
    { key: 'a', label: 'Left Wall', wall: 'left' },
    { key: 'b', label: 'Back Wall', wall: 'front' },
    { key: 'c', label: 'Right Wall', wall: 'right' },
  ],
  parallel: [
    { key: 'a', label: 'Wall A', wall: 'front' },
    { key: 'b', label: 'Wall B (Opposite)', wall: 'back' },
  ],
  island: [{ key: 'main', label: 'Island', wall: 'front' }],
};

export interface KitchenConfiguratorOptions {
  roomName: string;
  shape: KitchenLayoutShape;
  runLengthsFt: Record<string, number>; // keyed by KitchenWallRunTemplate.key
  includeOverhead: boolean;
  includeLoft: boolean;
  drawersPerRun: number; // 0 = no drawer bank in the base run
  coreMaterial: ModularItem['coreMaterial'];
  finishType: ModularItem['finishType'];
  laminateColorCode?: string;
}

export const DEFAULT_KITCHEN_OPTIONS: Omit<KitchenConfiguratorOptions, 'shape' | 'runLengthsFt'> = {
  roomName: 'Kitchen',
  includeOverhead: true,
  includeLoft: false,
  drawersPerRun: 0,
  coreMaterial: 'BWR Commercial Ply',
  finishType: 'Laminate',
  laminateColorCode: '',
};

const BASE_HEIGHT_FT = 2.8; // ~850mm counter height
const BASE_DEPTH_FT = 2; // ~610mm
const OVERHEAD_HEIGHT_FT = 2.5; // ~760mm
const OVERHEAD_DEPTH_FT = 1.1; // ~335mm
const LOFT_HEIGHT_FT = 1.5; // ~460mm
const LOFT_DEPTH_FT = 1.1;
const MODULE_TARGET_WIDTH_FT = 2; // ~600mm - used only to estimate a sensible shutter count

function estimateShutterCount(widthFt: number): number {
  return Math.max(1, Math.round(widthFt / MODULE_TARGET_WIDTH_FT));
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `kitchen-${Date.now()}-${counter}`;
}

function buildItem(
  base: Partial<ModularItem> & Pick<ModularItem, 'sNo' | 'room' | 'wall' | 'category' | 'description' | 'widthFt' | 'heightFt' | 'depthFt'>,
  options: KitchenConfiguratorOptions
): ModularItem {
  const item: ModularItem = {
    id: nextId(),
    shutterCount: estimateShutterCount(base.widthFt),
    drawerCount: 0,
    shelfCount: 2,
    finishType: options.finishType,
    coreMaterial: options.coreMaterial,
    laminateColorCode: options.laminateColorCode?.trim() || undefined,
    quantity: 1,
    widthMm: ftToMm(base.widthFt),
    heightMm: ftToMm(base.heightFt),
    depthMm: ftToMm(base.depthFt),
    calcBasis: 'Volume (Cu.ft)',
    areaSqFt: 0,
    volumeCuFt: 0,
    ...base,
  };
  return recalculateItemMetrics(item);
}

// Generates one Base cabinet (and optionally Overhead/Loft) ModularItem
// per wall run in the chosen shape, spanning that run's own length as a
// single item - matching how every other multi-shutter item in this app
// already works (shutter count/width is derived automatically, not one
// discrete item per module). Everything downstream (cut list, 3D view,
// hardware, pricing) picks these up for free once they're real items.
export function generateKitchenLayout(options: KitchenConfiguratorOptions, existingItems: ModularItem[]): ModularItem[] {
  const runs = KITCHEN_SHAPE_RUNS[options.shape];
  let sNo = existingItems.length > 0 ? Math.max(...existingItems.map((i) => i.sNo)) + 1 : 1;
  const generated: ModularItem[] = [];

  for (const run of runs) {
    const lengthFt = Math.max(1, options.runLengthsFt[run.key] ?? 6);

    const baseItem = buildItem(
      {
        sNo: sNo++,
        room: options.roomName,
        wall: run.wall,
        category: 'kitchen_base',
        description: `Kitchen Base - ${run.label}`,
        widthFt: lengthFt,
        heightFt: BASE_HEIGHT_FT,
        depthFt: BASE_DEPTH_FT,
        drawerCount: options.drawersPerRun,
      },
      options
    );
    generated.push(baseItem);

    if (options.includeOverhead) {
      generated.push(
        buildItem(
          {
            sNo: sNo++,
            room: options.roomName,
            wall: run.wall,
            category: 'kitchen_overhead',
            description: `Kitchen Overhead - ${run.label}`,
            widthFt: lengthFt,
            heightFt: OVERHEAD_HEIGHT_FT,
            depthFt: OVERHEAD_DEPTH_FT,
          },
          options
        )
      );

      if (options.includeLoft) {
        generated.push(
          buildItem(
            {
              sNo: sNo++,
              room: options.roomName,
              wall: run.wall,
              category: 'kitchen_loft',
              description: `Kitchen Loft - ${run.label}`,
              widthFt: lengthFt,
              heightFt: LOFT_HEIGHT_FT,
              depthFt: LOFT_DEPTH_FT,
            },
            options
          )
        );
      }
    }
  }

  return generated;
}
