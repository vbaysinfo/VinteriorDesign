import React, { useMemo, useState } from 'react';
import { ModularItem, WallType, DoorType, ShutterStyle } from '../types';
import {
  WardrobeTemplateKey,
  WARDROBE_TEMPLATES,
  WardrobeConfiguratorOptions,
  defaultWardrobeOptions,
  generateWardrobeFromTemplate,
} from '../utils/wardrobeConfigurator';
import { DoorOpen, Layers, CheckCircle2, ArrowRight } from 'lucide-react';

interface WardrobeConfiguratorProps {
  items: ModularItem[];
  onAddItems: (newItems: ModularItem[]) => void;
  onGoToLayout: () => void;
}

const WALL_LABELS: Record<WallType, string> = {
  front: 'Front Wall',
  left: 'Left Wall',
  right: 'Right Wall',
  back: 'Back Wall',
};

export const WardrobeConfigurator: React.FC<WardrobeConfiguratorProps> = ({ items, onAddItems, onGoToLayout }) => {
  const [roomName, setRoomName] = useState('Bedroom');
  const [wall, setWall] = useState<WallType>('front');
  const [templateKey, setTemplateKey] = useState<WardrobeTemplateKey>('two_door');
  const [options, setOptions] = useState<WardrobeConfiguratorOptions>(() => defaultWardrobeOptions('two_door', 'Bedroom', 'front'));
  const [coreMaterial, setCoreMaterial] = useState<ModularItem['coreMaterial']>('BWR Commercial Ply');
  const [finishType, setFinishType] = useState<ModularItem['finishType']>('Laminate');
  const [laminateColorCode, setLaminateColorCode] = useState('');
  const [justGenerated, setJustGenerated] = useState<number | null>(null);

  const handlePickTemplate = (key: WardrobeTemplateKey) => {
    setTemplateKey(key);
    setOptions(defaultWardrobeOptions(key, roomName, wall));
    setJustGenerated(null);
  };

  const fullOptions: WardrobeConfiguratorOptions = {
    ...options,
    roomName: roomName.trim() || 'Bedroom',
    wall,
    coreMaterial,
    finishType,
    laminateColorCode,
  };

  const preview = useMemo(() => generateWardrobeFromTemplate(fullOptions, items), [
    templateKey,
    options,
    roomName,
    wall,
    coreMaterial,
    finishType,
    laminateColorCode,
  ]);

  const totalAreaSqFt = preview.reduce((s, i) => s + i.areaSqFt, 0);

  const handleGenerate = () => {
    onAddItems(preview);
    setJustGenerated(preview.length);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <DoorOpen className="w-5 h-5 text-violet-600" />
          Wardrobe Models
        </h2>
        <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
          Pick a ready-made wardrobe template, adjust its size if you need to, and generate it as a real Full Modular
          project item - the CAD/3D layout, Closet Interior Design editor, cut list, hardware, and pricing all pick
          it up automatically, exactly the same as an Excel-uploaded or hand-typed row.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Configuration */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Wardrobe Template</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Object.keys(WARDROBE_TEMPLATES) as WardrobeTemplateKey[]).map((key) => {
                const t = WARDROBE_TEMPLATES[key];
                const active = templateKey === key;
                return (
                  <button
                    key={key}
                    onClick={() => handlePickTemplate(key)}
                    className={`px-3 py-2.5 rounded-lg text-left border transition ${
                      active
                        ? 'bg-violet-600 border-violet-700 text-white'
                        : 'bg-white border-slate-300 text-slate-700 hover:border-violet-400'
                    }`}
                  >
                    <div className="text-xs font-bold">{t.label}</div>
                    <div className={`text-[10px] mt-0.5 ${active ? 'text-violet-100' : 'text-slate-400'}`}>
                      {t.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Room Name</label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Wall</label>
              <select
                value={wall}
                onChange={(e) => setWall(e.target.value as WallType)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm text-slate-800"
              >
                {(Object.keys(WALL_LABELS) as WallType[]).map((w) => (
                  <option key={w} value={w}>
                    {WALL_LABELS[w]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Width (ft)</label>
              <input
                type="number"
                min={1}
                step={0.5}
                value={options.widthFt}
                onChange={(e) => setOptions((prev) => ({ ...prev, widthFt: Math.max(1, Number(e.target.value) || 1) }))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Height (ft)</label>
              <input
                type="number"
                min={1}
                step={0.5}
                value={options.heightFt}
                onChange={(e) => setOptions((prev) => ({ ...prev, heightFt: Math.max(1, Number(e.target.value) || 1) }))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-800"
              />
              {options.heightFt > 7 && (
                <span className="text-[10px] text-amber-600 mt-0.5 block">
                  &gt;7ft auto-splits into Floor + Loft
                </span>
              )}
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Depth (ft)</label>
              <input
                type="number"
                min={0.5}
                step={0.1}
                value={options.depthFt}
                onChange={(e) => setOptions((prev) => ({ ...prev, depthFt: Math.max(0.5, Number(e.target.value) || 0.5) }))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Shutters</label>
              <input
                type="number"
                min={1}
                max={6}
                value={options.shutterCount}
                onChange={(e) => setOptions((prev) => ({ ...prev, shutterCount: Math.max(1, Number(e.target.value) || 1) }))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Door Type</label>
              <select
                value={options.doorType}
                onChange={(e) => setOptions((prev) => ({ ...prev, doorType: e.target.value as DoorType }))}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm font-bold text-slate-800"
              >
                <option value="hinged">Hinged (Open/Close)</option>
                <option value="sliding">Sliding</option>
                <option value="lift_top">Lift Top (Flap)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={options.includeLoft}
                onChange={(e) => setOptions((prev) => ({ ...prev, includeLoft: e.target.checked }))}
                className="w-4 h-4 accent-violet-600"
              />
              Add a separate Loft above it
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={options.includeDrawers}
                onChange={(e) => setOptions((prev) => ({ ...prev, includeDrawers: e.target.checked }))}
                className="w-4 h-4 accent-violet-600"
              />
              Fit a drawer bank in the closet interior
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={options.shutterStyle === 'arch'}
                onChange={(e) => setOptions((prev) => ({ ...prev, shutterStyle: (e.target.checked ? 'arch' : 'plain') as ShutterStyle }))}
                className="w-4 h-4 accent-violet-600"
              />
              Arch-style shutter top
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Core Board</label>
              <select
                value={coreMaterial}
                onChange={(e) => setCoreMaterial(e.target.value as ModularItem['coreMaterial'])}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
              >
                <option value="BWP Marine Ply">BWP Marine Ply (IS:710)</option>
                <option value="BWR Commercial Ply">BWR Commercial Ply (IS:303)</option>
                <option value="HDHMR">HDHMR (Moisture Resistant)</option>
                <option value="Prelam MDF">Prelam MDF</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Finish Type</label>
              <select
                value={finishType}
                onChange={(e) => setFinishType(e.target.value as ModularItem['finishType'])}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
              >
                <option value="Laminate">1.0mm Matte/Gloss Laminate</option>
                <option value="Acrylic">High Gloss Acrylic</option>
                <option value="Profile Glass">Profile Glass / Aluminum Frame</option>
                <option value="PU Paint">PU Matte / Gloss Paint</option>
                <option value="Veneer">Natural Wood Veneer</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Laminate Color Code</label>
              <input
                type="text"
                placeholder="e.g. Ivory - IV102"
                value={laminateColorCode}
                onChange={(e) => setLaminateColorCode(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* Preview & Generate */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-violet-600" />
            <h3 className="text-sm font-bold text-slate-900">Preview</h3>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Items to generate</span>
              <span className="font-mono font-bold text-slate-900">{preview.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total area</span>
              <span className="font-mono font-bold text-slate-900">{totalAreaSqFt.toFixed(1)} sq.ft</span>
            </div>
          </div>
          <div className="space-y-1">
            {preview.map((i) => (
              <div key={i.id} className="text-[11px] text-slate-600 flex justify-between border-b border-slate-50 py-1">
                <span>{i.description}</span>
                <span className="font-mono text-slate-400">
                  {i.widthMm}×{i.heightMm}mm
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={handleGenerate}
            className="w-full px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition"
          >
            <DoorOpen className="w-4 h-4" />
            Generate Wardrobe
          </button>

          {justGenerated !== null && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 space-y-2">
              <div className="flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                Added {justGenerated} item(s) to the project.
              </div>
              <button
                onClick={onGoToLayout}
                className="flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-semibold underline underline-offset-2"
              >
                View in CAD 2D / 3D Layout <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
