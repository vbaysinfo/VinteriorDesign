import React, { useMemo, useState } from 'react';
import { ModularItem } from '../types';
import {
  KitchenLayoutShape,
  KitchenConfiguratorOptions,
  KITCHEN_SHAPE_RUNS,
  DEFAULT_KITCHEN_OPTIONS,
  generateKitchenLayout,
} from '../utils/kitchenConfigurator';
import { ChefHat, Layers, CheckCircle2, ArrowRight } from 'lucide-react';

interface KitchenConfiguratorProps {
  items: ModularItem[];
  onAddItems: (newItems: ModularItem[]) => void;
  onGoToLayout: () => void;
}

const SHAPE_LABELS: Record<KitchenLayoutShape, string> = {
  straight: 'Straight (1 wall)',
  l_shape: 'L-Shape (2 walls)',
  u_shape: 'U-Shape (3 walls)',
  parallel: 'Parallel / Galley (2 facing walls)',
  island: 'Island (standalone)',
};

const DEFAULT_RUN_LENGTHS: Record<KitchenLayoutShape, Record<string, number>> = {
  straight: { main: 10 },
  l_shape: { a: 8, b: 6 },
  u_shape: { a: 6, b: 8, c: 6 },
  parallel: { a: 8, b: 8 },
  island: { main: 6 },
};

export const KitchenConfigurator: React.FC<KitchenConfiguratorProps> = ({ items, onAddItems, onGoToLayout }) => {
  const [shape, setShape] = useState<KitchenLayoutShape>('l_shape');
  const [runLengthsFt, setRunLengthsFt] = useState<Record<string, number>>(DEFAULT_RUN_LENGTHS.l_shape);
  const [roomName, setRoomName] = useState(DEFAULT_KITCHEN_OPTIONS.roomName);
  const [includeOverhead, setIncludeOverhead] = useState(DEFAULT_KITCHEN_OPTIONS.includeOverhead);
  const [includeLoft, setIncludeLoft] = useState(DEFAULT_KITCHEN_OPTIONS.includeLoft);
  const [drawersPerRun, setDrawersPerRun] = useState(DEFAULT_KITCHEN_OPTIONS.drawersPerRun);
  const [coreMaterial, setCoreMaterial] = useState<ModularItem['coreMaterial']>(DEFAULT_KITCHEN_OPTIONS.coreMaterial);
  const [finishType, setFinishType] = useState<ModularItem['finishType']>(DEFAULT_KITCHEN_OPTIONS.finishType);
  const [laminateColorCode, setLaminateColorCode] = useState('');
  const [justGenerated, setJustGenerated] = useState<number | null>(null);

  const runs = KITCHEN_SHAPE_RUNS[shape];

  const handleShapeChange = (next: KitchenLayoutShape) => {
    setShape(next);
    setRunLengthsFt(DEFAULT_RUN_LENGTHS[next]);
    setJustGenerated(null);
  };

  const options: KitchenConfiguratorOptions = {
    roomName: roomName.trim() || 'Kitchen',
    shape,
    runLengthsFt,
    includeOverhead,
    includeLoft: includeOverhead && includeLoft,
    drawersPerRun,
    coreMaterial,
    finishType,
    laminateColorCode,
  };

  const preview = useMemo(() => generateKitchenLayout(options, items), [
    shape,
    runLengthsFt,
    roomName,
    includeOverhead,
    includeLoft,
    drawersPerRun,
    coreMaterial,
    finishType,
    laminateColorCode,
  ]);

  const totalRunLengthFt = runs.reduce((s, r) => s + (runLengthsFt[r.key] ?? 0), 0);
  const totalAreaSqFt = preview.reduce((s, i) => s + i.areaSqFt, 0);

  const handleGenerate = () => {
    onAddItems(preview);
    setJustGenerated(preview.length);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-orange-600" />
          Modular Kitchen Configurator
        </h2>
        <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
          Pick a kitchen layout shape and wall lengths - the base, overhead, and loft cabinets are generated as real
          project items and added alongside anything already in the project, so the CAD/3D layout, cutting list,
          hardware, and pricing all pick them up automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Configuration */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Layout Shape</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(SHAPE_LABELS) as KitchenLayoutShape[]).map((s) => (
                <button
                  key={s}
                  onClick={() => handleShapeChange(s)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border transition text-left ${
                    shape === s
                      ? 'bg-orange-600 border-orange-700 text-white'
                      : 'bg-white border-slate-300 text-slate-700 hover:border-orange-400'
                  }`}
                >
                  {SHAPE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
              Wall Run Lengths (ft)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {runs.map((run) => (
                <div key={run.key}>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    {run.label} <span className="text-slate-400">({run.wall})</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={0.5}
                    value={runLengthsFt[run.key] ?? 0}
                    onChange={(e) =>
                      setRunLengthsFt((prev) => ({ ...prev, [run.key]: Math.max(1, Number(e.target.value) || 1) }))
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-800"
                  />
                </div>
              ))}
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
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                Drawers per Base Run
              </label>
              <input
                type="number"
                min={0}
                max={6}
                value={drawersPerRun}
                onChange={(e) => setDrawersPerRun(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-800"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeOverhead}
                onChange={(e) => setIncludeOverhead(e.target.checked)}
                className="w-4 h-4 accent-orange-600"
              />
              Include Overhead Cabinets
            </label>
            <label
              className={`flex items-center gap-2 text-sm cursor-pointer ${
                includeOverhead ? 'text-slate-700' : 'text-slate-400'
              }`}
            >
              <input
                type="checkbox"
                checked={includeLoft}
                disabled={!includeOverhead}
                onChange={(e) => setIncludeLoft(e.target.checked)}
                className="w-4 h-4 accent-orange-600"
              />
              Include Loft (above Overhead)
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
            <Layers className="w-4 h-4 text-orange-600" />
            <h3 className="text-sm font-bold text-slate-900">Preview</h3>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Wall runs</span>
              <span className="font-mono font-bold text-slate-900">{runs.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total run length</span>
              <span className="font-mono font-bold text-slate-900">{totalRunLengthFt} ft</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Items to generate</span>
              <span className="font-mono font-bold text-slate-900">{preview.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total area</span>
              <span className="font-mono font-bold text-slate-900">{totalAreaSqFt.toFixed(1)} sq.ft</span>
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1">
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
            className="w-full px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition"
          >
            <ChefHat className="w-4 h-4" />
            Generate Kitchen Layout
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
