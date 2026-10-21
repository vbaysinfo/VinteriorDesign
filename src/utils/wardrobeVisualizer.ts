import jsPDF from 'jspdf';
import { ModularItem, ShutterStyle, TextureStyle, HandleStyle, DoorType } from '../types';
import { ftToMm, recalculateItemMetrics } from './calculator';
import { WardrobeTemplateKey, WARDROBE_TEMPLATES } from './wardrobeConfigurator';

// A curated palette of common Indian modular-furniture laminate colors -
// free-text laminateColorCode already exists on ModularItem for exactly
// this, this is just a visual picker over it plus the hex the live preview
// actually paints with.
export interface LaminateColorSwatch {
  name: string;
  hex: string;
}

export const LAMINATE_COLORS: LaminateColorSwatch[] = [
  { name: 'Ivory', hex: '#f1ebdd' },
  { name: 'Pure White', hex: '#fbfbfa' },
  { name: 'Wenge', hex: '#3b2a24' },
  { name: 'Walnut', hex: '#5c3a21' },
  { name: 'Natural Oak', hex: '#c9a66b' },
  { name: 'Ash Grey', hex: '#9ca3af' },
  { name: 'Charcoal Black', hex: '#23262b' },
  { name: 'Classic Blue', hex: '#2c5282' },
  { name: 'Maroon', hex: '#6b1f2a' },
  { name: 'Teak', hex: '#8a5a32' },
  { name: 'Champagne Gold', hex: '#d4b483' },
  { name: 'Mint Green', hex: '#8fb9a8' },
];

export const SHUTTER_STYLE_OPTIONS: { key: ShutterStyle; label: string; description: string }[] = [
  { key: 'plain', label: 'Plain Shutter', description: 'A flat rectangular panel - the clean, contemporary default.' },
  { key: 'fluted', label: 'Fluted Shutter', description: 'Repeating vertical grooves routed across the full panel.' },
  { key: 'framed', label: 'Framed Shutter', description: 'A raised outer frame around a recessed center panel.' },
  { key: 'shaker', label: 'Shaker-Style Shutter', description: 'A flatter, single-margin recessed panel - the classic shaker look.' },
  { key: 'arch', label: 'Arch-Style Traditional', description: 'An elliptical arch routed across the top edge.' },
  { key: 'glass_profile', label: 'Glass-Profile Shutter', description: 'A tinted glass pane in a slim aluminum profile frame.' },
  { key: 'mirror', label: 'Mirror Shutter', description: 'A full mirror front with a soft reflective highlight.' },
  { key: 'two_color', label: 'Two-Color Combination', description: 'A split front combining a primary and an accent color.' },
];

export const TEXTURE_OPTIONS: { key: TextureStyle; label: string }[] = [
  { key: 'matte', label: 'Matte' },
  { key: 'gloss', label: 'High Gloss' },
  { key: 'wood_grain', label: 'Wood Grain' },
  { key: 'suede', label: 'Suede / Fabric Look' },
];

export const HANDLE_STYLE_OPTIONS: { key: HandleStyle; label: string }[] = [
  { key: 'bar', label: 'Bar Handle' },
  { key: 'knob', label: 'Knob Handle' },
  { key: 'profile', label: 'Profile (Handleless)' },
  { key: 'none', label: 'None' },
];

export interface WardrobeDesign {
  templateKey: WardrobeTemplateKey;
  widthFt: number;
  heightFt: number;
  depthFt: number;
  shutterCount: number;
  doorType: DoorType;
  shutterStyle: ShutterStyle;
  textureStyle: TextureStyle;
  handleStyle: HandleStyle;
  primaryColor: string; // hex
  secondaryColor: string; // hex, used only when shutterStyle === 'two_color'
  laminateColorName: string;
  secondaryColorName: string;
  // A customer-uploaded laminate/texture photo (data URL) - when set, the
  // live preview paints the shutter surface with this image instead of the
  // picked swatch color, so "upload your own laminate and see how it
  // looks" works without a backend: the image never leaves the browser.
  customTextureUrl?: string;
  customTextureName?: string;
}

export function defaultWardrobeDesign(templateKey: WardrobeTemplateKey = 'two_door'): WardrobeDesign {
  const t = WARDROBE_TEMPLATES[templateKey];
  return {
    templateKey,
    widthFt: t.widthFt,
    heightFt: t.heightFt,
    depthFt: t.depthFt,
    shutterCount: t.shutterCount,
    doorType: t.doorType,
    shutterStyle: 'plain',
    textureStyle: 'matte',
    handleStyle: 'bar',
    primaryColor: LAMINATE_COLORS[0].hex,
    secondaryColor: LAMINATE_COLORS[2].hex,
    laminateColorName: LAMINATE_COLORS[0].name,
    secondaryColorName: LAMINATE_COLORS[2].name,
  };
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `visualizer-${Date.now()}-${counter}`;
}

// Turns a Visualizer design into a real project ModularItem - same
// construction as wardrobeConfigurator's own buildWardrobeItem, so a design
// saved or quoted here is a completely normal row afterward (Item
// Inspector, Closet Interior Design editor, Print CAD, cut list, hardware,
// pricing) if the user chooses to add it to their project.
export function wardrobeDesignToItem(design: WardrobeDesign, sNo: number, room: string, wall: ModularItem['wall']): ModularItem {
  const widthMm = ftToMm(design.widthFt);
  const heightMm = ftToMm(design.heightFt);
  const item: ModularItem = {
    id: nextId(),
    sNo,
    room,
    description: `${WARDROBE_TEMPLATES[design.templateKey].label} (Visualizer)`,
    wall,
    category: 'wardrobe_shutter',
    widthFt: design.widthFt,
    heightFt: design.heightFt,
    depthFt: design.depthFt,
    widthMm,
    heightMm,
    depthMm: ftToMm(design.depthFt),
    calcBasis: 'Volume (Cu.ft)',
    areaSqFt: 0,
    volumeCuFt: 0,
    shutterCount: design.shutterCount,
    doorType: design.doorType === 'hinged' ? undefined : design.doorType,
    shutterStyle: design.shutterStyle === 'plain' ? undefined : design.shutterStyle,
    textureStyle: design.textureStyle === 'matte' ? undefined : design.textureStyle,
    handleStyle: design.handleStyle === 'bar' ? undefined : design.handleStyle,
    drawerCount: 0,
    shelfCount: 4,
    finishType: design.shutterStyle === 'mirror' || design.shutterStyle === 'glass_profile' ? 'Profile Glass' : 'Laminate',
    coreMaterial: 'BWR Commercial Ply',
    laminateColorCode: design.laminateColorName,
    secondaryLaminateColorCode: design.shutterStyle === 'two_color' ? design.secondaryColorName : undefined,
    quantity: 1,
  };
  return recalculateItemMetrics(item);
}

// ---- Saved Designs (browser-local, no backend) ----

export interface SavedWardrobeDesign {
  id: string;
  name: string;
  savedAt: string; // ISO timestamp
  design: WardrobeDesign;
}

const SAVED_DESIGNS_KEY = 'wardrobeVisualizer.savedDesigns';

export function loadSavedDesigns(): SavedWardrobeDesign[] {
  try {
    const raw = localStorage.getItem(SAVED_DESIGNS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDesign(name: string, design: WardrobeDesign): SavedWardrobeDesign[] {
  const existing = loadSavedDesigns();
  const entry: SavedWardrobeDesign = {
    id: `saved-${Date.now()}`,
    name: name.trim() || 'Untitled Design',
    savedAt: new Date().toISOString(),
    design,
  };
  const next = [entry, ...existing];
  try {
    localStorage.setItem(SAVED_DESIGNS_KEY, JSON.stringify(next));
  } catch {
    // Private browsing / storage full - the design still shows for this
    // session via the returned array, it just won't persist on reload.
  }
  return next;
}

export function deleteSavedDesign(id: string): SavedWardrobeDesign[] {
  const next = loadSavedDesigns().filter((d) => d.id !== id);
  try {
    localStorage.setItem(SAVED_DESIGNS_KEY, JSON.stringify(next));
  } catch {
    // See saveDesign - best effort only.
  }
  return next;
}

// ---- Upload a custom laminate/texture photo (browser-local, no backend) ----

const MAX_CUSTOM_TEXTURE_BYTES = 4 * 1024 * 1024; // 4MB - generous for a phone photo, still localStorage-safe

export function readImageAsDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('Please choose an image file (JPG, PNG, or WEBP).'));
  }
  if (file.size > MAX_CUSTOM_TEXTURE_BYTES) {
    return Promise.reject(new Error('Image is too large - please use one under 4MB.'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read that image file.'));
    reader.readAsDataURL(file);
  });
}

// ---- Download the live preview as a PNG ----

// Renders an on-screen <svg> element into an offscreen <canvas> - no extra
// dependency needed (no html2canvas, no server round trip): serialize the
// SVG's own markup into a data-URL <img>, then read the canvas back out.
// Shared by the PNG download and by the quotation PDF's embedded preview.
async function renderSvgToCanvas(svg: SVGSVGElement, scale: number): Promise<HTMLCanvasElement> {
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svg);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const widthAttr = svg.getAttribute('width');
  const heightAttr = svg.getAttribute('height');
  const viewBox = svg.getAttribute('viewBox');
  let width = widthAttr ? parseFloat(widthAttr) : 0;
  let height = heightAttr ? parseFloat(heightAttr) : 0;
  if ((!width || !height) && viewBox) {
    const parts = viewBox.split(/\s+/).map(Number);
    if (parts.length === 4) {
      width = width || parts[2];
      height = height || parts[3];
    }
  }
  width = width || 800;
  height = height || 600;

  try {
    const img = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not render the preview image.'));
    });
    img.src = url;
    await loaded;

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported in this browser.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function downloadSvgAsPng(svg: SVGSVGElement, filename: string, scale = 3): Promise<void> {
  const canvas = await renderSvgToCanvas(svg, scale);
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not export the preview as an image.');
  const dlUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = dlUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(dlUrl);
}

// Used only to embed a preview thumbnail into the quotation PDF - best
// effort, swallowed by the caller if the browser can't produce one.
export async function svgToPngDataUrl(svg: SVGSVGElement, scale = 2): Promise<string> {
  const canvas = await renderSvgToCanvas(svg, scale);
  return canvas.toDataURL('image/png');
}

// ---- Request a Quotation (client-side PDF, no backend) ----

export interface QuotationContact {
  name: string;
  phone: string;
  email: string;
  notes: string;
}

const SHUTTER_STYLE_LABEL: Record<ShutterStyle, string> = {
  plain: 'Plain Shutter',
  fluted: 'Fluted Shutter',
  framed: 'Framed Shutter',
  shaker: 'Shaker-Style Shutter',
  arch: 'Arch-Style Traditional',
  glass_profile: 'Glass-Profile Shutter',
  mirror: 'Mirror Shutter',
  two_color: 'Two-Color Combination',
};

const TEXTURE_LABEL: Record<TextureStyle, string> = {
  matte: 'Matte',
  gloss: 'High Gloss',
  wood_grain: 'Wood Grain',
  suede: 'Suede / Fabric Look',
};

const HANDLE_LABEL: Record<HandleStyle, string> = {
  bar: 'Bar Handle',
  knob: 'Knob Handle',
  profile: 'Profile (Handleless)',
  none: 'None',
};

// Builds a shareable quotation-request PDF from a Visualizer design and a
// customer's contact details - same jsPDF visual language as the project's
// real BOM proposal (pdfGenerator.ts): slate header banner, cyan accents.
// This is a request for a quote, not a priced estimate, since a Visualizer
// design has no project-level factory rates attached to cost against yet.
export function generateWardrobeQuotationPDF(design: WardrobeDesign, contact: QuotationContact, previewDataUrl?: string): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const primaryColor: [number, number, number] = [30, 41, 59];
  const accentColor: [number, number, number] = [124, 58, 237]; // Violet-600, matches the Visualizer's own theme

  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('WARDROBE DESIGN - QUOTATION REQUEST', 14, 15);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated on: ${new Date().toLocaleDateString()} | Wardrobe Visualizer`, 14, 23);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, 38, 182, 28, 'FD');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('CUSTOMER DETAILS', 20, 45);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Name: ${contact.name || 'N/A'}`, 20, 52);
  doc.text(`Phone: ${contact.phone || 'N/A'}`, 20, 58);
  doc.text(`Email: ${contact.email || 'N/A'}`, 110, 52);
  doc.text(`Notes: ${contact.notes ? contact.notes.slice(0, 60) : 'None'}`, 110, 58);

  let y = 76;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...accentColor);
  doc.text('WARDROBE SPECIFICATION', 14, y);
  y += 8;

  const specs: [string, string][] = [
    ['Model', WARDROBE_TEMPLATES[design.templateKey].label],
    ['Dimensions (W x H x D)', `${design.widthFt}ft x ${design.heightFt}ft x ${design.depthFt}ft`],
    ['Shutter Count', `${design.shutterCount}`],
    ['Door Type', design.doorType === 'hinged' ? 'Hinged' : design.doorType === 'sliding' ? 'Sliding' : 'Lift Top'],
    ['Shutter Style', SHUTTER_STYLE_LABEL[design.shutterStyle]],
    ['Texture / Finish', TEXTURE_LABEL[design.textureStyle]],
    ['Handle Style', HANDLE_LABEL[design.handleStyle]],
    ['Primary Laminate Color', design.laminateColorName],
  ];
  if (design.shutterStyle === 'two_color') {
    specs.push(['Accent Laminate Color', design.secondaryColorName]);
  }
  if (design.customTextureUrl) {
    specs.push(['Custom Laminate Upload', design.customTextureName || 'Customer-supplied image']);
  }

  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  specs.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, 90, y);
    y += 7;
  });

  if (previewDataUrl) {
    try {
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...accentColor);
      doc.text('DESIGN PREVIEW', 14, y);
      y += 4;
      doc.addImage(previewDataUrl, 'PNG', 14, y, 90, 90, undefined, 'FAST');
      y += 96;
    } catch {
      // Preview image is a nice-to-have - the specification table above
      // already fully describes the design if embedding the image fails.
    }
  }

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('This is a quotation request, not a final priced estimate. Our team will reach out with pricing and lead time.', 14, 285);

  const safeName = (contact.name || 'wardrobe').trim().replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  doc.save(`quotation-request-${safeName || 'wardrobe'}.pdf`);
}
