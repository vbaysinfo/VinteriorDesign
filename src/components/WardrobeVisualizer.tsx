import React, { useRef, useState } from 'react';
import { ModularItem, DoorType, ShutterStyle, TextureStyle, HandleStyle } from '../types';
import { WardrobeTemplateKey, WARDROBE_TEMPLATES } from '../utils/wardrobeConfigurator';
import {
  WardrobeDesign,
  LAMINATE_COLORS,
  SHUTTER_STYLE_OPTIONS,
  TEXTURE_OPTIONS,
  HANDLE_STYLE_OPTIONS,
  defaultWardrobeDesign,
  wardrobeDesignToItem,
  loadSavedDesigns,
  saveDesign,
  deleteSavedDesign,
  downloadSvgAsPng,
  svgToPngDataUrl,
  generateWardrobeQuotationPDF,
  QuotationContact,
  readImageAsDataUrl,
} from '../utils/wardrobeVisualizer';
import { WardrobePreviewSvg } from './WardrobePreviewSvg';
import {
  Wand2,
  Save,
  Download,
  FileText,
  Trash2,
  FolderOpen,
  ArrowRight,
  CheckCircle2,
  X,
  DoorOpen,
  Upload,
  ImageOff,
  Minus,
  Circle,
  GripVertical,
  Ban,
} from 'lucide-react';

const TEXTURE_SWATCH_STYLE: Record<TextureStyle, React.CSSProperties> = {
  matte: { background: '#cbd5e1' },
  gloss: { background: 'linear-gradient(135deg, #cbd5e1 35%, #ffffff 50%, #cbd5e1 65%)' },
  wood_grain: {
    background:
      'repeating-linear-gradient(0deg, #c9a66b 0px, #c9a66b 3px, #b08b52 3px, #b08b52 6px)',
  },
  suede: {
    background: '#a8a29e',
    backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.25) 1px, transparent 1px)',
    backgroundSize: '5px 5px',
  },
};

const HANDLE_ICONS: Record<HandleStyle, React.ComponentType<{ className?: string }>> = {
  bar: Minus,
  knob: Circle,
  profile: GripVertical,
  none: Ban,
};

interface WardrobeVisualizerProps {
  items: ModularItem[];
  onAddItems: (newItems: ModularItem[]) => void;
  onGoToLayout: () => void;
}

export const WardrobeVisualizer: React.FC<WardrobeVisualizerProps> = ({ items, onAddItems, onGoToLayout }) => {
  const [design, setDesign] = useState<WardrobeDesign>(() => defaultWardrobeDesign('two_door'));
  const [savedDesigns, setSavedDesigns] = useState(() => loadSavedDesigns());
  const [showSaved, setShowSaved] = useState(false);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [contact, setContact] = useState<QuotationContact>({ name: '', phone: '', email: '', notes: '' });
  const [justAdded, setJustAdded] = useState<number | null>(null);
  const [busy, setBusy] = useState<'download' | 'quote' | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showInterior, setShowInterior] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 2500);
  };

  const pickTemplate = (key: WardrobeTemplateKey) => {
    setDesign(defaultWardrobeDesign(key));
    setJustAdded(null);
  };

  const update = <K extends keyof WardrobeDesign>(key: K, value: WardrobeDesign[K]) => {
    setDesign((prev) => ({ ...prev, [key]: value }));
    setJustAdded(null);
  };

  const pickPrimaryColor = (name: string, hex: string) => {
    setDesign((prev) => ({ ...prev, laminateColorName: name, primaryColor: hex }));
  };
  const pickSecondaryColor = (name: string, hex: string) => {
    setDesign((prev) => ({ ...prev, secondaryColorName: name, secondaryColor: hex }));
  };

  const handleUploadTexture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError(null);
    try {
      const dataUrl = await readImageAsDataUrl(file);
      setDesign((prev) => ({ ...prev, customTextureUrl: dataUrl, customTextureName: file.name }));
      flash('Custom laminate applied to the preview.');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not use that image.');
    }
  };

  const clearCustomTexture = () => {
    setDesign((prev) => ({ ...prev, customTextureUrl: undefined, customTextureName: undefined }));
  };

  const handleAddToProject = () => {
    const sNo = items.length > 0 ? Math.max(...items.map((i) => i.sNo)) + 1 : 1;
    const item = wardrobeDesignToItem(design, sNo, 'Bedroom', 'front');
    onAddItems([item]);
    setJustAdded(1);
    flash('Added to your project.');
  };

  const handleSaveDesign = () => {
    const name = window.prompt('Name this design', WARDROBE_TEMPLATES[design.templateKey].label);
    if (name === null) return;
    setSavedDesigns(saveDesign(name, design));
    flash('Design saved.');
  };

  const handleLoadDesign = (d: WardrobeDesign) => {
    setDesign(d);
    setShowSaved(false);
    flash('Design loaded.');
  };

  const handleDeleteDesign = (id: string) => {
    setSavedDesigns(deleteSavedDesign(id));
  };

  const handleDownloadImage = async () => {
    if (!svgRef.current) return;
    setBusy('download');
    try {
      await downloadSvgAsPng(svgRef.current, `wardrobe-design-${design.templateKey}.png`);
      flash('Image downloaded.');
    } catch {
      flash('Could not download the image in this browser.');
    } finally {
      setBusy(null);
    }
  };

  const handleRequestQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('quote');
    try {
      let previewDataUrl: string | undefined;
      try {
        if (svgRef.current) previewDataUrl = await svgToPngDataUrl(svgRef.current);
      } catch {
        previewDataUrl = undefined;
      }
      generateWardrobeQuotationPDF(design, contact, previewDataUrl);
      setShowQuoteForm(false);
      flash('Quotation request PDF downloaded.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-fuchsia-600" />
          Wardrobe Visualizer
        </h2>
        <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
          Customize a wardrobe's model, shutter style, laminate colors, texture, handles, and dimensions and see it
          update instantly below. Save designs to come back to, download the image to share, or request a
          quotation - all without needing to touch the full project spreadsheet.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Controls */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Wardrobe Model</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Object.keys(WARDROBE_TEMPLATES) as WardrobeTemplateKey[]).map((key) => {
                const t = WARDROBE_TEMPLATES[key];
                const active = design.templateKey === key;
                return (
                  <button
                    key={key}
                    onClick={() => pickTemplate(key)}
                    className={`px-3 py-2 rounded-lg text-left border transition ${
                      active ? 'bg-fuchsia-600 border-fuchsia-700 text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-fuchsia-400'
                    }`}
                  >
                    <div className="text-xs font-bold">{t.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Shutter Style</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SHUTTER_STYLE_OPTIONS.map((opt) => {
                const active = design.shutterStyle === opt.key;
                return (
                  <button
                    key={opt.key}
                    title={opt.description}
                    onClick={() => update('shutterStyle', opt.key as ShutterStyle)}
                    className={`px-2.5 py-2 rounded-lg text-center border transition ${
                      active ? 'bg-fuchsia-600 border-fuchsia-700 text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-fuchsia-400'
                    }`}
                  >
                    <div className="text-[11px] font-bold leading-tight">{opt.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
                Laminate Color {design.shutterStyle === 'two_color' ? '(Primary)' : ''}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {LAMINATE_COLORS.map((c) => (
                  <button
                    key={c.name}
                    title={c.name}
                    onClick={() => pickPrimaryColor(c.name, c.hex)}
                    className={`w-6 h-6 rounded-full border-2 transition ${
                      design.laminateColorName === c.name ? 'border-fuchsia-600 scale-110' : 'border-slate-200'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">{design.laminateColorName}</div>
            </div>

            {design.shutterStyle === 'two_color' && (
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Accent Color</label>
                <div className="flex flex-wrap gap-1.5">
                  {LAMINATE_COLORS.map((c) => (
                    <button
                      key={c.name}
                      title={c.name}
                      onClick={() => pickSecondaryColor(c.name, c.hex)}
                      className={`w-6 h-6 rounded-full border-2 transition ${
                        design.secondaryColorName === c.name ? 'border-fuchsia-600 scale-110' : 'border-slate-200'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">{design.secondaryColorName}</div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Texture</label>
              <div className="grid grid-cols-2 gap-1.5">
                {TEXTURE_OPTIONS.map((t) => {
                  const active = design.textureStyle === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => update('textureStyle', t.key as TextureStyle)}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition ${
                        active ? 'border-fuchsia-600 ring-1 ring-fuchsia-400 bg-fuchsia-50' : 'border-slate-300 hover:border-fuchsia-400'
                      }`}
                    >
                      <span className="w-5 h-5 rounded border border-slate-300 shrink-0" style={TEXTURE_SWATCH_STYLE[t.key]} />
                      <span className="text-[11px] font-semibold text-slate-700 truncate">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Handle</label>
              <div className="grid grid-cols-2 gap-1.5">
                {HANDLE_STYLE_OPTIONS.map((h) => {
                  const active = design.handleStyle === h.key;
                  const Icon = HANDLE_ICONS[h.key as HandleStyle];
                  return (
                    <button
                      key={h.key}
                      onClick={() => update('handleStyle', h.key as HandleStyle)}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition ${
                        active ? 'border-fuchsia-600 ring-1 ring-fuchsia-400 bg-fuchsia-50' : 'border-slate-300 hover:border-fuchsia-400'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      <span className="text-[11px] font-semibold text-slate-700 truncate">{h.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
                Upload Your Own Laminate / Texture
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:border-fuchsia-400 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" /> Choose Image
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUploadTexture} className="hidden" />
                {design.customTextureUrl && (
                  <>
                    <img src={design.customTextureUrl} alt="Uploaded laminate" className="w-8 h-8 rounded border border-slate-300 object-cover" />
                    <span className="text-[11px] text-slate-500 truncate max-w-[140px]">{design.customTextureName}</span>
                    <button onClick={clearCustomTexture} title="Remove" className="text-slate-400 hover:text-red-600">
                      <ImageOff className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Upload a photo of a laminate sheet or texture - it's applied to the preview instantly so you can check how it looks.
              </p>
              {uploadError && <p className="text-[10px] text-red-600 mt-1">{uploadError}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Width (ft)</label>
              <input
                type="number"
                min={1}
                step={0.5}
                value={design.widthFt}
                onChange={(e) => update('widthFt', Math.max(1, Number(e.target.value) || 1))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Height (ft)</label>
              <input
                type="number"
                min={1}
                step={0.5}
                value={design.heightFt}
                onChange={(e) => update('heightFt', Math.max(1, Number(e.target.value) || 1))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Depth (ft)</label>
              <input
                type="number"
                min={0.5}
                step={0.1}
                value={design.depthFt}
                onChange={(e) => update('depthFt', Math.max(0.5, Number(e.target.value) || 0.5))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Shutters</label>
              <input
                type="number"
                min={1}
                max={6}
                value={design.shutterCount}
                onChange={(e) => update('shutterCount', Math.max(1, Number(e.target.value) || 1))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Door Type</label>
            <select
              value={design.doorType}
              onChange={(e) => update('doorType', e.target.value as DoorType)}
              className="w-full sm:w-56 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm font-bold text-slate-800"
            >
              <option value="hinged">Hinged (Open/Close)</option>
              <option value="sliding">Sliding</option>
              <option value="lift_top">Lift Top (Flap)</option>
            </select>
          </div>
        </div>

        {/* Live preview + actions */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">Live Preview</h3>
              <button
                onClick={() => setShowInterior((v) => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
                  showInterior ? 'bg-fuchsia-600 border-fuchsia-700 text-white' : 'bg-white border-slate-300 text-slate-600 hover:border-fuchsia-400'
                }`}
                title="Automatically shows the closet interior (shelves, hanging rod, drawers) with the doors pushed open"
              >
                <DoorOpen className="w-3.5 h-3.5" /> {showInterior ? 'Doors Open' : 'Doors Closed'}
              </button>
            </div>
            <div className="flex items-center justify-center bg-slate-50 rounded-lg border border-slate-200 p-4 overflow-x-auto">
              <WardrobePreviewSvg ref={svgRef} design={design} widthPx={300} showInterior={showInterior} />
            </div>
            <div className="mt-3 text-[11px] text-slate-500 flex justify-between">
              <span>{WARDROBE_TEMPLATES[design.templateKey].label}</span>
              <span className="font-mono">
                {design.widthFt}ft x {design.heightFt}ft x {design.depthFt}ft
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-2.5">
            <button
              onClick={handleSaveDesign}
              className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition"
            >
              <Save className="w-4 h-4" /> Save Design
            </button>
            <button
              onClick={() => setShowSaved(true)}
              className="w-full px-4 py-2 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition"
            >
              <FolderOpen className="w-4 h-4" /> Saved Designs ({savedDesigns.length})
            </button>
            <button
              onClick={handleDownloadImage}
              disabled={busy === 'download'}
              className="w-full px-4 py-2 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> {busy === 'download' ? 'Downloading...' : 'Download Image'}
            </button>
            <button
              onClick={() => setShowQuoteForm(true)}
              className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition"
            >
              <FileText className="w-4 h-4" /> Request Quotation
            </button>
            <button
              onClick={handleAddToProject}
              className="w-full px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition"
            >
              <Wand2 className="w-4 h-4" /> Add to Project
            </button>

            {justAdded !== null && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 space-y-2">
                <div className="flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  Added to your project.
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

      {toast && (
        <div className="fixed bottom-5 right-5 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      {/* Saved Designs modal */}
      {showSaved && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4" onClick={() => setShowSaved(false)}>
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">Saved Designs</h3>
              <button onClick={() => setShowSaved(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            {savedDesigns.length === 0 ? (
              <p className="text-xs text-slate-500">No designs saved yet. Use "Save Design" to keep this one.</p>
            ) : (
              <div className="space-y-2">
                {savedDesigns.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 border border-slate-200 rounded-lg p-2.5">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">{d.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {WARDROBE_TEMPLATES[d.design.templateKey].label} · {new Date(d.savedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleLoadDesign(d.design)}
                        className="px-2.5 py-1 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded text-[11px] font-semibold"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleDeleteDesign(d.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Request Quotation modal */}
      {showQuoteForm && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4" onClick={() => setShowQuoteForm(false)}>
          <form
            onSubmit={handleRequestQuotation}
            className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-slate-900">Request a Quotation</h3>
              <button type="button" onClick={() => setShowQuoteForm(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              We'll generate a PDF with your design specification and contact details for our team to follow up with
              pricing.
            </p>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Name</label>
              <input
                required
                type="text"
                value={contact.name}
                onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Phone</label>
              <input
                required
                type="tel"
                value={contact.phone}
                onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Email</label>
              <input
                type="email"
                value={contact.email}
                onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Notes</label>
              <textarea
                value={contact.notes}
                onChange={(e) => setContact((c) => ({ ...c, notes: e.target.value }))}
                rows={2}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-800"
              />
            </div>
            <button
              type="submit"
              disabled={busy === 'quote'}
              className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <FileText className="w-4 h-4" /> {busy === 'quote' ? 'Generating PDF...' : 'Download Quotation PDF'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
