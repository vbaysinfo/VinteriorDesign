// Converts the app's own rendered CAD SVG into an AutoCAD-compatible DXF
// file (ASCII DXF, R12-compatible ENTITIES only - the simplest dialect
// every version of AutoCAD and every DXF-reading tool can open). Rather
// than re-deriving wall/cabinet/dimension geometry a second time from the
// project data, this walks the SVG DOM that's already on screen, so the
// DXF always matches exactly what's drawn - one geometry source, two
// export formats.
//
// Coverage: <line>, <rect>, <circle>, <text>, <polygon>/<polyline>, and
// <path> (sampled via getPointAtLength into a line-segment approximation,
// which handles arcs/curves generically without parsing path syntax).
// <foreignObject> (HTML embedded in the SVG, used for a couple of styled
// badges) has no DXF equivalent and is skipped.

type DxfEntity =
  | { type: 'LINE'; x1: number; y1: number; x2: number; y2: number; layer: string }
  | { type: 'CIRCLE'; cx: number; cy: number; r: number; layer: string }
  | { type: 'TEXT'; x: number; y: number; height: number; rotation: number; content: string; layer: string };

const LAYER_WALLS_CABINETS = '0-WALLS-CABINETS';
const LAYER_DIMENSIONS = '0-DIMENSIONS';
const LAYER_TEXT = '0-TEXT';

function layerForGeometry(el: Element): string {
  return el.getAttribute('stroke-dasharray') ? LAYER_DIMENSIONS : LAYER_WALLS_CABINETS;
}

function parseTranslate(el: Element): { tx: number; ty: number } {
  const t = el.getAttribute('transform') || '';
  const m = t.match(/translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)\s*\)/);
  return m ? { tx: parseFloat(m[1]), ty: parseFloat(m[2]) } : { tx: 0, ty: 0 };
}

function parseRotate(el: Element): number {
  const t = el.getAttribute('transform') || '';
  const m = t.match(/rotate\(\s*(-?[\d.]+)/);
  return m ? parseFloat(m[1]) : 0;
}

function num(el: Element, attr: string, fallback = 0): number {
  const v = el.getAttribute(attr);
  return v ? parseFloat(v) : fallback;
}

function walk(el: Element, tx: number, ty: number, entities: DxfEntity[]): void {
  const tag = el.tagName.toLowerCase();

  if (tag === 'g') {
    const d = parseTranslate(el);
    Array.from(el.children).forEach((child) => walk(child, tx + d.tx, ty + d.ty, entities));
    return;
  }

  if (tag === 'line') {
    entities.push({
      type: 'LINE',
      x1: num(el, 'x1') + tx,
      y1: num(el, 'y1') + ty,
      x2: num(el, 'x2') + tx,
      y2: num(el, 'y2') + ty,
      layer: layerForGeometry(el),
    });
  } else if (tag === 'rect') {
    const x = num(el, 'x') + tx;
    const y = num(el, 'y') + ty;
    const w = num(el, 'width');
    const h = num(el, 'height');
    const layer = layerForGeometry(el);
    entities.push({ type: 'LINE', x1: x, y1: y, x2: x + w, y2: y, layer });
    entities.push({ type: 'LINE', x1: x + w, y1: y, x2: x + w, y2: y + h, layer });
    entities.push({ type: 'LINE', x1: x + w, y1: y + h, x2: x, y2: y + h, layer });
    entities.push({ type: 'LINE', x1: x, y1: y + h, x2: x, y2: y, layer });
  } else if (tag === 'circle') {
    entities.push({
      type: 'CIRCLE',
      cx: num(el, 'cx') + tx,
      cy: num(el, 'cy') + ty,
      r: num(el, 'r'),
      layer: layerForGeometry(el),
    });
  } else if (tag === 'text') {
    const content = (el.textContent || '').trim();
    if (content) {
      entities.push({
        type: 'TEXT',
        x: num(el, 'x') + tx,
        y: num(el, 'y') + ty,
        height: Math.max(1, num(el, 'font-size', 12)),
        rotation: parseRotate(el),
        content,
        layer: LAYER_TEXT,
      });
    }
    return; // never descend into a <text>'s own child nodes
  } else if (tag === 'polygon' || tag === 'polyline') {
    const pts = (el.getAttribute('points') || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => {
        const [px, py] = p.split(',').map(Number);
        return { x: px + tx, y: py + ty };
      });
    const layer = layerForGeometry(el);
    for (let i = 0; i < pts.length - 1; i++) {
      entities.push({ type: 'LINE', x1: pts[i].x, y1: pts[i].y, x2: pts[i + 1].x, y2: pts[i + 1].y, layer });
    }
    if (tag === 'polygon' && pts.length > 2) {
      const a = pts[pts.length - 1];
      const b = pts[0];
      entities.push({ type: 'LINE', x1: a.x, y1: a.y, x2: b.x, y2: b.y, layer });
    }
  } else if (tag === 'path') {
    const pathEl = el as SVGPathElement;
    const layer = layerForGeometry(el);
    try {
      const len = pathEl.getTotalLength();
      const steps = Math.max(2, Math.min(64, Math.round(len / 5)));
      let prev: { x: number; y: number } | null = null;
      for (let i = 0; i <= steps; i++) {
        const pt = pathEl.getPointAtLength((len * i) / steps);
        const cur = { x: pt.x + tx, y: pt.y + ty };
        if (prev) entities.push({ type: 'LINE', x1: prev.x, y1: prev.y, x2: cur.x, y2: cur.y, layer });
        prev = cur;
      }
    } catch {
      // getTotalLength unsupported or the path is empty - skip rather than
      // fail the whole export over one decorative element.
    }
  }

  Array.from(el.children).forEach((child) => walk(child, tx, ty, entities));
}

// DXF's Y axis points up; this app's SVG (like all SVG) has Y pointing
// down. Flip every Y coordinate (and negate rotation, since mirroring an
// axis reverses the sense of rotation) once, here, rather than trying to
// track it through the recursive walk above.
function flipY(e: DxfEntity): DxfEntity {
  switch (e.type) {
    case 'LINE':
      return { ...e, y1: -e.y1, y2: -e.y2 };
    case 'CIRCLE':
      return { ...e, cy: -e.cy };
    case 'TEXT':
      return { ...e, y: -e.y, rotation: -e.rotation };
  }
}

function buildDxfString(entities: DxfEntity[]): string {
  const lines: string[] = [];
  const add = (code: number, value: string | number) => {
    lines.push(String(code), String(value));
  };

  add(0, 'SECTION');
  add(2, 'ENTITIES');

  for (const e of entities) {
    if (e.type === 'LINE') {
      add(0, 'LINE');
      add(8, e.layer);
      add(10, e.x1.toFixed(3));
      add(20, e.y1.toFixed(3));
      add(30, '0');
      add(11, e.x2.toFixed(3));
      add(21, e.y2.toFixed(3));
      add(31, '0');
    } else if (e.type === 'CIRCLE') {
      add(0, 'CIRCLE');
      add(8, e.layer);
      add(10, e.cx.toFixed(3));
      add(20, e.cy.toFixed(3));
      add(30, '0');
      add(40, Math.max(0.001, e.r).toFixed(3));
    } else if (e.type === 'TEXT') {
      add(0, 'TEXT');
      add(8, e.layer);
      add(10, e.x.toFixed(3));
      add(20, e.y.toFixed(3));
      add(30, '0');
      add(40, e.height.toFixed(3));
      add(1, e.content.replace(/[\r\n]+/g, ' '));
      if (e.rotation) add(50, e.rotation.toFixed(2));
    }
  }

  add(0, 'ENDSEC');
  add(0, 'EOF');

  return lines.join('\n');
}

// Walks `svgElement`, converts its geometry to DXF entities (millimeter
// units, matching this app's own SVG coordinate space), and triggers a
// browser download of the resulting .dxf file.
export function exportSvgAsDxf(svgElement: SVGSVGElement, filename: string): void {
  const rawEntities: DxfEntity[] = [];
  Array.from(svgElement.children).forEach((child) => walk(child, 0, 0, rawEntities));
  const entities = rawEntities.map(flipY);
  const dxfText = buildDxfString(entities);

  const blob = new Blob([dxfText], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
