import React from 'react';
import { ModularItem, ProjectType, FactoryRates, DoorType, UnitCategory } from '../types';
import {
  generateCutListForItem,
  mmToFt,
  recalculateItemMetrics,
  getShutterLayout,
  hasShutterDoors,
  redistributeShutterWidths,
  isDepthRequiredButMissing,
  resolveEffectiveProjectType,
  getAutoShutterCount,
  isClosetEligible,
  CATEGORY_LABELS,
} from '../utils/calculator';
import { X, Box, Layers, Scissors, Check, Sliders, DoorOpen } from 'lucide-react';
import { NumberField } from './NumberField';
import { ClosetInteriorEditor } from './ClosetInteriorEditor';

interface ItemInspectorDrawerProps {
  item: ModularItem | null;
  projectType: ProjectType;
  rates: FactoryRates;
  currency: string;
  onClose: () => void;
  onUpdateItem: (updated: ModularItem) => void;
}

export const ItemInspectorDrawer: React.FC<ItemInspectorDrawerProps> = ({
  item,
  projectType,
  rates,
  currency,
  onClose,
  onUpdateItem,
}) => {
  if (!item) return null;

  const cutListParts = generateCutListForItem(item, projectType);
  const effectiveType = resolveEffectiveProjectType(item, projectType);
  const depthMissing = isDepthRequiredButMissing(item, effectiveType);
  // A real closet interior (vertical partitions + per-section shelves)
  // only replaces the plain Shelves count once there's an actual box to
  // put it in - a wardrobe/dressing unit that's Semi Modular, or Full
  // Modular with Depth still blank, has no carcass at all yet.
  const isCloset = isClosetEligible(item) && effectiveType === 'full' && item.depthMm > 0;

  // Editing width/height/depth here always goes through the ft fields
  // (recalculateItemMetrics derives mm from ft), matching the same
  // bidirectional sync rule the Excel Format Editor grid uses, so a value
  // typed here and a value typed there never disagree on how it's stored.
  const handleDimensionChange = (field: 'widthMm' | 'heightMm' | 'depthMm', num: number) => {
    const updated: ModularItem = { ...item };
    if (field === 'widthMm') {
      updated.widthMm = num;
      updated.widthFt = mmToFt(num);
    } else if (field === 'heightMm') {
      updated.heightMm = num;
      updated.heightFt = mmToFt(num);
    } else {
      updated.depthMm = num;
      updated.depthFt = num > 0 ? mmToFt(num) : 0;
    }
    onUpdateItem(recalculateItemMetrics(updated));
  };

  // Switching Door Type immediately recalculates the door/panel count from
  // the item's current width (2 or 3 for Sliding, the 1/2/3/4 hinged ladder
  // otherwise) - see getAutoShutterCount(). The user can still hand-edit the
  // Shutters count afterward same as always; this only fires on an explicit
  // door-type change, not on every width edit, so it never silently
  // overwrites a count someone deliberately customized.
  const handleDoorTypeChange = (doorType: DoorType) => {
    onUpdateItem({
      ...item,
      doorType: doorType === 'hinged' ? undefined : doorType,
      shutterCount: getAutoShutterCount(item.widthMm, doorType),
    });
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white shadow-2xl z-50 border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
        <div>
          <span className="text-[10px] font-mono uppercase bg-cyan-800 text-cyan-200 px-2 py-0.5 rounded">
            Item #{item.sNo} • {item.room}
          </span>
          <h3 className="text-base font-bold text-white mt-1">{item.description}</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-slate-700">
        {/* Wall & Dimensions Card */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between font-semibold text-slate-900 pb-2 border-b border-slate-200">
            <span className="flex items-center gap-1.5">
              <Box className="w-4 h-4 text-cyan-600" />
              Structural Dimensions
            </span>
            <span className="text-[11px] font-mono text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
              Wall: {item.wall.toUpperCase()}
            </span>
          </div>

          {/* Category - auto-detected from the description at upload time
              (sniffed for keywords like "wardrobe"/"dressing"/"loft"), which
              silently falls back to "Other" for a typo'd or unrecognized
              wording - that quietly disables the closet interior editor
              below, hardware rules, and everything else keyed off category,
              with no error shown anywhere. Always fixable by hand here. */}
          <div className="flex items-center justify-between pb-1">
            <span className="text-[11px] font-semibold text-slate-600">Category</span>
            <select
              value={item.category}
              onChange={(e) => onUpdateItem({ ...item, category: e.target.value as UnitCategory })}
              className={`text-[11px] font-bold rounded-lg px-2.5 py-1 border ${
                item.category === 'other'
                  ? 'bg-red-50 border-red-300 text-red-800'
                  : 'bg-white border-slate-300 text-slate-700'
              }`}
            >
              {(Object.keys(CATEGORY_LABELS) as UnitCategory[]).map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>
          {item.category === 'other' && (
            <div className="flex items-start gap-1.5 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-2">
              <span>
                ⚠ Category is "Other" - usually means the description didn't match a known keyword at upload (a typo like
                "Wardrone" instead of "Wardrobe"). Pick the right category above to restore its closet editor, hardware rules,
                and cut list behavior.
              </span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-white rounded-lg border border-slate-200">
              <span className="text-slate-400 text-[10px] block mb-0.5">WIDTH (mm)</span>
              <NumberField
                min={0}
                value={item.widthMm}
                onCommit={(num) => handleDimensionChange('widthMm', num)}
                className="w-full text-center bg-slate-50 border border-slate-200 rounded font-mono font-bold text-sm text-slate-900 py-1 focus:bg-white focus:ring-1 focus:ring-cyan-500"
              />
              <span className="text-slate-500 text-[10px] block mt-0.5">({item.widthFt} ft)</span>
            </div>
            <div className="p-2 bg-white rounded-lg border border-slate-200">
              <span className="text-slate-400 text-[10px] block mb-0.5">LENGTH (mm)</span>
              <NumberField
                min={0}
                value={item.heightMm}
                onCommit={(num) => handleDimensionChange('heightMm', num)}
                className="w-full text-center bg-slate-50 border border-slate-200 rounded font-mono font-bold text-sm text-slate-900 py-1 focus:bg-white focus:ring-1 focus:ring-cyan-500"
              />
              <span className="text-slate-500 text-[10px] block mt-0.5">({item.heightFt} ft)</span>
            </div>
            <div className={`p-2 bg-white rounded-lg border ${depthMissing ? 'border-red-400 ring-1 ring-red-200' : 'border-slate-200'}`}>
              <span className="text-slate-400 text-[10px] block mb-0.5">DEPTH (mm)</span>
              <NumberField
                min={0}
                zeroAsEmpty
                placeholder={depthMissing ? 'Required!' : '0 (Frame)'}
                value={item.depthMm}
                onCommit={(num) => handleDimensionChange('depthMm', num)}
                className={`w-full text-center rounded font-mono font-bold text-sm py-1 placeholder:font-normal focus:bg-white focus:ring-1 ${
                  depthMissing
                    ? 'bg-red-50 text-red-900 placeholder:text-red-400 focus:ring-red-400'
                    : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-cyan-500'
                }`}
              />
              <span className={`text-[10px] block mt-0.5 ${depthMissing ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
                {item.depthFt > 0 ? `(${item.depthFt} ft)` : depthMissing ? 'No box until entered' : 'Civil niche'}
              </span>
            </div>
          </div>

          {depthMissing && (
            <div className="flex items-start gap-1.5 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-2">
              <span>
                ⚠ This item is {effectiveType === 'full' && item.projectType ? 'pinned to' : 'set to'} <strong>Full Modular</strong> but
                Depth is blank — no factory box (gables, decks, back panel) will be fabricated for it until you enter a real depth here.
              </span>
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] pt-1 text-slate-600">
            <span>Calculation Basis: <strong>{item.calcBasis}</strong></span>
            <span>Total: <strong>{item.calcBasis === 'Area (Sq.ft)' ? `${item.areaSqFt} Sq.ft` : `${item.volumeCuFt} Cu.ft`}</strong></span>
          </div>

          {/* Per-item construction type override. With no override
              (Inherit), a real Depth entered above makes this item Full
              Modular automatically, regardless of the project-wide toggle -
              matching the Excel Format Editor's own Depth column
              convention. Picking Semi or Full here instead pins THIS item
              to that mode no matter what Depth says or what the project
              toggle is, so a single project can mix civil-built
              (Frame+Shutter) and factory-built (full box) items side by
              side - e.g. wardrobes built full modular while lofts above
              them stay semi modular. See resolveEffectiveProjectType(). */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            <span className="text-[11px] font-semibold text-slate-600">
              Construction Type
              {!item.projectType && (
                <span className="text-slate-400 font-normal">
                  {' '}
                  (inherits {effectiveType === 'full' ? 'Full' : 'Semi'} Modular
                  {item.depthMm > 0 ? ' - Depth entered' : ` - project default`})
                </span>
              )}
            </span>
            <select
              value={item.projectType ?? ''}
              onChange={(e) =>
                onUpdateItem({
                  ...item,
                  projectType: e.target.value === '' ? undefined : (e.target.value as ProjectType),
                })
              }
              className={`text-[11px] font-bold rounded-lg px-2.5 py-1 border ${
                item.projectType
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-white border-slate-300 text-slate-700'
              }`}
            >
              <option value="">Inherit (project default)</option>
              <option value="semi">Semi Modular</option>
              <option value="full">Full Modular</option>
            </select>
          </div>
        </div>

        {/* Per-Shutter Dimension Editor - the individual dividers in the 2D
            CAD drawing are clickable too, but hitting the exact pixel for
            one door in a zoomed/panned SVG is fiddly, so every door is also
            listed here as a plain editable row. Width is genuinely
            per-door (see redistributeShutterWidths); Length and Depth are
            physically one shared carcass property across a single row of
            hinged doors, so they mirror the same Structural Dimensions
            fields above - editing either from any door row updates every
            row at once, same as editing the card above would. */}
        {hasShutterDoors(item) &&
          (() => {
            const { count, widths } = getShutterLayout(item);
            const hasOverride = !!item.shutterWidthOverrides;
            return (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between font-semibold text-slate-900 pb-2 border-b border-slate-200">
                  <span className="flex items-center gap-1.5">
                    <DoorOpen className="w-4 h-4 text-cyan-600" />
                    Shutter Dimensions ({count} door{count > 1 ? 's' : ''})
                  </span>
                  {hasOverride && (
                    <button
                      onClick={() => {
                        const { shutterWidthOverrides, ...rest } = item;
                        onUpdateItem(rest);
                      }}
                      className="text-[11px] text-cyan-700 underline hover:text-cyan-900"
                    >
                      Reset widths to auto split
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-slate-400 uppercase text-[10px] tracking-wide">
                        <th className="text-left pb-1 font-bold">Door</th>
                        <th className="text-center pb-1 font-bold">Width (mm)</th>
                        <th className="text-center pb-1 font-bold">Length (mm)</th>
                        <th className="text-center pb-1 font-bold">Depth (mm)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {widths.map((w, i) => (
                        <tr key={i}>
                          <td className="py-1 pr-2 font-semibold text-slate-600 whitespace-nowrap">Door {i + 1}</td>
                          <td className="py-1 px-1">
                            <NumberField
                              min={50}
                              value={w}
                              disabled={count < 2}
                              onCommit={(num) =>
                                onUpdateItem({ ...item, shutterWidthOverrides: redistributeShutterWidths(item, i, num) })
                              }
                              className="w-full text-center bg-white border border-slate-200 rounded font-mono font-bold py-1 focus:ring-1 focus:ring-cyan-500 disabled:opacity-60"
                            />
                          </td>
                          <td className="py-1 px-1">
                            <NumberField
                              min={0}
                              value={item.heightMm}
                              onCommit={(num) => handleDimensionChange('heightMm', num)}
                              className="w-full text-center bg-white border border-slate-200 rounded font-mono font-bold py-1 focus:ring-1 focus:ring-cyan-500"
                            />
                          </td>
                          <td className="py-1 pl-1">
                            <NumberField
                              min={0}
                              zeroAsEmpty
                              placeholder={depthMissing ? 'Required!' : '0 (Frame)'}
                              value={item.depthMm}
                              onCommit={(num) => handleDimensionChange('depthMm', num)}
                              className={`w-full text-center rounded font-mono font-bold py-1 placeholder:font-normal focus:ring-1 ${
                                depthMissing
                                  ? 'bg-red-50 border border-red-400 text-red-900 placeholder:text-red-400 focus:ring-red-400'
                                  : 'bg-white border border-slate-200 placeholder:text-slate-400 focus:ring-cyan-500'
                              }`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-slate-400">
                  Width is per-door - widening one door narrows the others so they always add up to the item's total
                  width. Length and Depth are one shared carcass dimension across the whole row of doors, same as the
                  Structural Dimensions card above - editing it here changes it there too.
                </p>
              </div>
            );
          })()}

        {/* Specifications & Hardware Config */}
        <div className="space-y-3">
          <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-emerald-600" />
            Component Hardware & Materials
          </h4>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Core Board</label>
              <select
                value={item.coreMaterial}
                onChange={(e) => onUpdateItem({ ...item, coreMaterial: e.target.value as any })}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
              >
                <option value="BWP Marine Ply">BWP Marine Ply (IS:710)</option>
                <option value="BWR Commercial Ply">BWR Commercial Ply (IS:303)</option>
                <option value="HDHMR">HDHMR (Moisture Resistant)</option>
                <option value="Prelam MDF">Prelam MDF</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Finish Type</label>
              <select
                value={item.finishType}
                onChange={(e) => onUpdateItem({ ...item, finishType: e.target.value as any })}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
              >
                <option value="Laminate">1.0mm Matte/Gloss Laminate</option>
                <option value="Acrylic">High Gloss Acrylic</option>
                <option value="Profile Glass">Profile Glass / Aluminum Frame</option>
                <option value="PU Paint">PU Matte / Gloss Paint</option>
                <option value="Veneer">Natural Wood Veneer</option>
              </select>
            </div>
          </div>

          {hasShutterDoors(item) && (
            <div>
              <label className="block text-slate-600 font-medium mb-1">Door Type</label>
              <select
                value={item.doorType === 'sliding' ? 'sliding' : 'hinged'}
                onChange={(e) => handleDoorTypeChange(e.target.value as DoorType)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-bold"
              >
                <option value="hinged">Hinged (Open/Close)</option>
                <option value="sliding">Sliding</option>
              </select>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {item.doorType === 'sliding'
                  ? 'Panel count auto-set from width (2 up to ~7ft, 3 beyond) - no hinge, track + rollers instead'
                  : 'Panel count auto-set from width (1 to 4 doors) - swings open on hinges'}
              </span>
            </div>
          )}

          <div className={`grid gap-2 ${isCloset ? 'grid-cols-2' : 'grid-cols-3'}`}>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Shutters</label>
              <NumberField
                min={0}
                value={item.shutterCount}
                onCommit={(num) => onUpdateItem({ ...item, shutterCount: num })}
                className="w-full px-2 py-1 border border-slate-300 rounded-lg text-center font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Drawers</label>
              <NumberField
                min={0}
                value={item.drawerCount}
                onCommit={(num) => onUpdateItem({ ...item, drawerCount: num })}
                className="w-full px-2 py-1 border border-slate-300 rounded-lg text-center font-bold"
              />
            </div>
            {/* A closet's shelf count/positions are set entirely by the
                Closet Interior Design editor below once it has a real box -
                this plain field would otherwise sit there doing nothing. */}
            {!isCloset && (
              <div>
                <label className="block text-slate-600 font-medium mb-1">Shelves</label>
                <NumberField
                  min={0}
                  value={item.shelfCount}
                  onCommit={(num) => onUpdateItem({ ...item, shelfCount: num })}
                  className="w-full px-2 py-1 border border-slate-300 rounded-lg text-center font-bold"
                />
              </div>
            )}
          </div>

          {/* Drawer Type - Standard soft-close vs Tandem Box (the deeper
              pot/pan channel system common in kitchen base units). The
              drawer count above already auto-divides this item's own
              Width/Height/Depth into that many equal tiers (same as a
              shutter's width ladder), so switching style here is purely a
              hardware choice, not a resize - the quick "2 Tandem"/"3
              Tandem" buttons just set both the count and the style in one
              click, matching the common kitchen base pattern. */}
          {item.drawerCount > 0 && (
            <div>
              <label className="block text-slate-600 font-medium mb-1">Drawer Type</label>
              <div className="flex items-center gap-2">
                <select
                  value={item.drawerType === 'tandem' ? 'tandem' : 'standard'}
                  onChange={(e) => onUpdateItem({ ...item, drawerType: e.target.value === 'tandem' ? 'tandem' : undefined })}
                  className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-bold"
                >
                  <option value="standard">Standard (Soft-Close)</option>
                  <option value="tandem">Tandem Box (Pot/Pan Channel)</option>
                </select>
                <button
                  onClick={() => onUpdateItem({ ...item, drawerType: 'tandem', drawerCount: 2 })}
                  className="px-2 py-1.5 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-800 transition"
                >
                  2 Tandem
                </button>
                <button
                  onClick={() => onUpdateItem({ ...item, drawerType: 'tandem', drawerCount: 3 })}
                  className="px-2 py-1.5 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-800 transition"
                >
                  3 Tandem
                </button>
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {item.drawerType === 'tandem'
                  ? `${item.drawerCount} tandem box channel(s) - each tier sized from this item's own Width/Height/Depth above`
                  : `${item.drawerCount} standard soft-close drawer(s)`}
              </span>
            </div>
          )}

          {isCloset && <ClosetInteriorEditor item={item} onUpdateItem={onUpdateItem} />}

          {/* Fabric and shutter color are two different material rules -
              this only ever affects the box (Gables/Decks/Back Panel and
              other hidden carcass surfaces), never the shutter, which is
              always Color/Finish on its own front face regardless. */}
          <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={!!item.fabricBothSides}
              onChange={(e) => onUpdateItem({ ...item, fabricBothSides: e.target.checked })}
              className="w-4 h-4 accent-cyan-600"
            />
            <span className="text-slate-700 font-medium">Fabric both sides of the box</span>
            <span className="text-[10px] text-slate-400 ml-auto">
              {item.fabricBothSides ? 'Doubles box fabric quantity' : 'Single side (factory default)'}
            </span>
          </label>
        </div>

        {/* Real-time Generated Cut List for this cabinet */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <Scissors className="w-4 h-4 text-amber-600" />
              Generated Factory Cut List ({cutListParts.length} parts)
            </h4>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {cutListParts.map((part) => {
              const override = item.materialOverrides?.[part.partName];
              const setOverride = (material: 'Fabric' | 'Color/Laminate') =>
                onUpdateItem({
                  ...item,
                  materialOverrides: { ...item.materialOverrides, [part.partName]: material },
                });
              const bothSidesOverride = item.fabricBothSidesOverrides?.[part.partName];
              const setBothSides = (value: boolean) =>
                onUpdateItem({
                  ...item,
                  fabricBothSidesOverrides: { ...item.fabricBothSidesOverrides, [part.partName]: value },
                });
              return (
                <div key={part.id} className="p-2.5 hover:bg-slate-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-900 block">{part.partName}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {part.lengthMm} × {part.widthMm} × {part.thicknessMm}mm • {part.material}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-mono font-bold text-slate-800">
                        Qty: {part.qty}
                      </span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">
                        {part.areaSqMt} m²
                      </span>
                    </div>
                  </div>
                  {/* Per-piece material picker - same choice as clicking this
                      part in the 3D isometric view, but always reachable
                      here regardless of camera angle/occlusion. */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <button
                      onClick={() => setOverride('Fabric')}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition ${
                        part.backMaterialCategory === 'Fabric'
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : 'bg-white border-slate-200 text-slate-500 hover:border-emerald-400'
                      }`}
                    >
                      Fabric
                    </button>
                    <button
                      onClick={() => setOverride('Color/Laminate')}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition ${
                        part.backMaterialCategory === 'Color/Laminate'
                          ? 'bg-fuchsia-600 border-fuchsia-500 text-white'
                          : 'bg-white border-slate-200 text-slate-500 hover:border-fuchsia-400'
                      }`}
                    >
                      Laminate
                    </button>
                    {/* Both sides only means anything on a Fabric-backed
                        piece - a Color/Laminate shutter-type piece has no
                        fabric face to double at all. */}
                    {part.backMaterialCategory === 'Fabric' && (
                      <label className="flex items-center gap-1 text-[10px] text-slate-600 font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!part.fabricBothSides}
                          onChange={(e) => setBothSides(e.target.checked)}
                          className="w-3 h-3 accent-cyan-600"
                        />
                        Both sides
                        {bothSidesOverride !== undefined && (
                          <button
                            onClick={() => {
                              const rest = { ...item.fabricBothSidesOverrides };
                              delete rest[part.partName];
                              onUpdateItem({ ...item, fabricBothSidesOverrides: rest });
                            }}
                            className="text-slate-400 hover:text-slate-700 underline"
                          >
                            (reset)
                          </button>
                        )}
                      </label>
                    )}
                    {override && (
                      <button
                        onClick={() => {
                          const rest = { ...item.materialOverrides };
                          delete rest[part.partName];
                          onUpdateItem({ ...item, materialOverrides: rest });
                        }}
                        className="text-[10px] text-slate-400 hover:text-slate-700 underline ml-auto"
                      >
                        Reset to auto
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition"
        >
          Done
        </button>
      </div>
    </div>
  );
};
