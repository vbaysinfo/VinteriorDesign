import * as XLSX from 'xlsx';
import { ModularItem, CutListPart, WallType, UnitCategory } from '../types';
import { ftToMm, recalculateItemMetrics } from './calculator';

// Helper to determine category from description
export function categorizeDescription(desc: string): UnitCategory {
  const lower = desc.toLowerCase();
  if (lower.includes('tandem') || lower.includes('tandom')) return 'tandem_box';
  if (lower.includes('loft') && lower.includes('kitchen')) return 'kitchen_loft';
  if (lower.includes('loft')) return 'loft';
  if (lower.includes('overhead')) return 'kitchen_overhead';
  if (lower.includes('base')) return 'kitchen_base';
  if (lower.includes('sitting')) return 'sitting_box';
  if (lower.includes('expo')) return 'expo';
  if (lower.includes('dressing')) return 'dressing_unit';
  if (lower.includes('profile door') || lower.includes('glass')) return 'profile_door';
  if (lower.includes('shelf') || lower.includes('shelves')) return 'shelves';
  if (lower.includes('tv') || lower.includes('panel') || lower.includes('lover')) return 'tv_panel';
  if (lower.includes('partition') || lower.includes('panneling')) return 'partition';
  if (lower.includes('single wardrobe')) return 'single_wardrobe';
  if (lower.includes('wardrobe') || lower.includes('shutter')) return 'wardrobe_shutter';
  return 'other';
}

// Helper to deduce wall from description if not given
export function deduceWall(desc: string, currentWall?: string): WallType {
  if (currentWall) {
    const w = currentWall.toLowerCase();
    if (w.includes('left')) return 'left';
    if (w.includes('right')) return 'right';
    if (w.includes('back') || w.includes('opp') || w.includes('rear')) return 'back';
    if (w.includes('front')) return 'front';
  }
  const lower = desc.toLowerCase();
  if (lower.includes('left')) return 'left';
  if (lower.includes('right')) return 'right';
  if (lower.includes('back') || lower.includes('opp') || lower.includes('rear')) return 'back';
  return 'front';
}

// Parse uploaded Excel or CSV file
export async function parseExcelFile(file: File): Promise<ModularItem[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to array of objects
        const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

        if (!rawRows || rawRows.length === 0) {
          throw new Error('No data found in uploaded Excel sheet.');
        }

        let currentRoom = 'General';
        const parsedItems: ModularItem[] = [];

        rawRows.forEach((row, index) => {
          // Identify keys case-insensitively. Patterns are checked in priority
          // order across ALL keys first (most specific first) rather than all
          // patterns against each key in column order - otherwise a loose
          // pattern like 'h (ft)' (meant to catch "H (ft)") also matches
          // inside "Widt-h (ft)" or "Dept-h (ft)" and steals the wrong column.
          const keys = Object.keys(row);
          const getKey = (patterns: string[], exclude: Array<string | undefined> = []) => {
            for (const p of patterns) {
              const found = keys.find((k) => !exclude.includes(k) && k.toLowerCase().includes(p.toLowerCase()));
              if (found) return found;
            }
            return undefined;
          };

          const roomKey = getKey(['room', 'location', 'area_name']);
          const descKey = getKey(['item', 'furniture', 'description', 'particular']);
          // Single-letter patterns like 'w (ft)'/'h (ft)'/'d (ft)' are a last
          // resort, tried only after the full bare word - a wrapped header
          // cell (e.g. "Height/Length" on one line, "(ft)" on the next,
          // joined by a real newline character, not a space) won't match the
          // exact "height (ft)" pattern, and 'h (ft)' as a substring also
          // matches inside "Dept-h (ft)" or "Widt-h (ft)". Trying the bare
          // word first means a genuine "Height" or "Width" header is found
          // before that generic fallback ever gets a chance to steal an
          // unrelated column.
          const widthFtKey = getKey(['width (ft)', 'width_ft', 'widthft', 'width', 'w (ft)']);
          // "Length" is this factory's word for the vertical/height dimension
          // (Semi Modular = Width x Length; Full Modular = Width x Length x
          // Depth) - accepted alongside the more generic "Height" header.
          const heightFtKey = getKey(
            ['length (ft)', 'length_ft', 'lengthft', 'height (ft)', 'height_ft', 'heightft', 'height', 'length', 'h (ft)'],
            [widthFtKey]
          );
          const depthFtKey = getKey(['depth (ft)', 'depth_ft', 'depthft', 'depth', 'd (ft)'], [widthFtKey, heightFtKey]);
          const wallKey = getKey(['wall', 'side', 'elevation']);
          const sNoKey = getKey(['s.no', 'sno', 'sl', 'no', '#']);
          const quantityKey = getKey(['quantity', 'qty']);
          const materialKey = getKey(['material']);
          const noteKey = getKey(['note', 'remark']);
          const laminateKey = getKey(['laminate color code', 'laminate code', 'colour code', 'color code', 'laminate']);
          const edgeBindingKey = getKey(['edge binding', 'edge band', 'edging']);
          const projectTypeKey = getKey(['project type', 'modular type', 'fabrication type', 'semi/full', 'semi / full']);

          // Room carry-over (in spreadsheets, Room is often merged or blank in subsequent rows)
          if (roomKey && row[roomKey] && String(row[roomKey]).trim() !== '') {
            currentRoom = String(row[roomKey]).trim();
          }

          const desc = descKey && row[descKey] ? String(row[descKey]).trim() : '';
          if (!desc) return; // Skip empty rows

          // Parse dimensions (handling ft or mm if only mm provided)
          let wFt = widthFtKey ? parseFloat(row[widthFtKey]) || 0 : 0;
          let hFt = heightFtKey ? parseFloat(row[heightFtKey]) || 0 : 0;
          let dFt = depthFtKey ? parseFloat(row[depthFtKey]) || 0 : 0;

          // If dimensions are in mm (> 50 typically means mm, not ft)
          if (wFt > 100) wFt = Number((wFt / 304.8).toFixed(2));
          if (hFt > 100) hFt = Number((hFt / 304.8).toFixed(2));
          if (dFt > 100) dFt = Number((dFt / 304.8).toFixed(2));

          const sNo = sNoKey && row[sNoKey] ? parseInt(row[sNoKey], 10) || (index + 1) : (index + 1);
          const wall = deduceWall(desc, wallKey ? String(row[wallKey]) : undefined);
          const category = categorizeDescription(desc);

          const quantity = quantityKey && row[quantityKey] ? Math.max(1, parseInt(row[quantityKey], 10) || 1) : 1;
          const materialCode = materialKey && row[materialKey] ? String(row[materialKey]).trim() : undefined;
          const notes = noteKey && row[noteKey] ? String(row[noteKey]).trim() : undefined;
          const laminateColorCode = laminateKey && row[laminateKey] ? String(row[laminateKey]).trim() : undefined;
          const edgeBindingNote = edgeBindingKey && row[edgeBindingKey] ? String(row[edgeBindingKey]).trim() : undefined;

          // Optional per-row Semi/Full override. Left undefined (not 'semi')
          // when absent or unrecognized, so the item inherits whichever
          // project-wide mode is active instead of being locked to one -
          // this is deliberately NOT a default value, see ModularItem.projectType.
          let projectTypeOverride: 'semi' | 'full' | undefined;
          if (projectTypeKey && row[projectTypeKey]) {
            const raw = String(row[projectTypeKey]).trim().toLowerCase();
            if (raw.includes('full')) projectTypeOverride = 'full';
            else if (raw.includes('semi')) projectTypeOverride = 'semi';
          }

          // Defaults
          const item: ModularItem = {
            id: `item-${Date.now()}-${index}`,
            sNo,
            room: currentRoom,
            description: desc,
            wall,
            category,
            widthFt: wFt,
            heightFt: hFt,
            depthFt: dFt,
            widthMm: ftToMm(wFt),
            heightMm: ftToMm(hFt),
            depthMm: dFt > 0 ? ftToMm(dFt) : 0,
            calcBasis: dFt > 0 ? 'Volume (Cu.ft)' : 'Area (Sq.ft)',
            areaSqFt: Number((wFt * hFt).toFixed(2)),
            volumeCuFt: dFt > 0 ? Number((wFt * hFt * dFt).toFixed(2)) : 0,
            projectType: projectTypeOverride,
            shutterCount: wFt > 6 ? 4 : wFt > 3 ? 2 : 1,
            drawerCount: category === 'tandem_box' ? 3 : category === 'sitting_box' ? 2 : 0,
            // Not read from any Excel column - there isn't one for this.
            // An Expo/Shelves unit defaults to 0 (no assumed shelves)
            // rather than guessing a count the uploaded sheet never
            // specified; set a real value per item in the Item Inspector
            // after upload if it actually needs shelves.
            shelfCount: category === 'expo' || category === 'shelves' ? 0 : 2,
            finishType: desc.toLowerCase().includes('glass') || desc.toLowerCase().includes('profile') ? 'Profile Glass' : 'Laminate',
            coreMaterial: currentRoom.toLowerCase().includes('kitchen') ? 'BWP Marine Ply' : 'BWR Commercial Ply',
            quantity,
            materialCode,
            notes,
            laminateColorCode,
            edgeBindingNote,
          };

          parsedItems.push(recalculateItemMetrics(item));
        });

        resolve(parsedItems);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

// Export items to Excel workbook (.xlsx) - one row per furniture item.
// "Length" is used instead of "Height" to match this factory's own
// vocabulary: Semi Modular items are Width x Length (2D, no carcass box);
// Full Modular items are Width x Length x Depth (3D carcass box).
export function exportToExcel(items: ModularItem[], fileName = 'Modular_Factory_Estimation.xlsx') {
  const exportData = items.map((item) => ({
    'S.No': item.sNo,
    'Room': item.room,
    'Wall': item.wall.toUpperCase(),
    'Item / Furniture Description': item.description,
    'Width (ft)': item.widthFt,
    'Length (ft)': item.heightFt,
    'Depth (ft) [Full Modular only, blank = Frame/Shutter]': item.depthFt > 0 ? item.depthFt : '',
    'Width (mm) auto': item.widthMm,
    'Length (mm) auto': item.heightMm,
    'Depth (mm) auto': item.depthMm > 0 ? item.depthMm : '',
    'Calc. Basis (auto)': item.calcBasis,
    'Area (Sq.ft) / Volume (Cu.ft) (auto)': item.calcBasis === 'Area (Sq.ft)' ? item.areaSqFt : item.volumeCuFt,
    'Quantity': item.quantity || 1,
    'Core Material': item.coreMaterial,
    'Finish': item.finishType,
    'Material': item.materialCode || '',
    'Laminate Color Code': item.laminateColorCode || '',
    'Edge Binding': item.edgeBindingNote || '',
    'Note': item.notes || '',
    'Project Type [blank = inherit Semi/Full Modular toggle]':
      item.projectType === 'full' ? 'Full Modular' : item.projectType === 'semi' ? 'Semi Modular' : '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Estimation Sheet');

  // Generate buffer and trigger download
  XLSX.writeFile(workbook, fileName);
}

// Export the granular cut list (one row per physical panel/board) using the
// exact factory cutting-software header names and spacing supplied by the
// user's own CUT_LEST template - intentionally NOT relabeled, so the file
// can be handed straight to that software. One blank, unlabeled column
// (holding a stray "0") in the original template sits between NOTE and
// MATERIAL; it is skipped here as it carries no real header/data.
export function exportCutListFactoryFormat(cutList: CutListPart[], fileName = 'Cut_List_Factory_Format.xlsx') {
  const exportData = cutList.map((p) => ({
    'NAME': `${p.room} / ${p.itemName} - ${p.partName}`,
    'LENGTH': p.lengthMm,
    'WIDTH': p.widthMm,
    'QUANTITY': p.qty,
    'NOTE': p.notes || (p.sheetNumber ? `Sheet: ${p.sheetNumber}` : ''),
    'MATERIAL': p.material,
    'EDGING LENGTH  1': p.edgeL1 ? `${p.edgeThicknessMm}mm` : '',
    'EDGING LENGTH  2': p.edgeL2 ? `${p.edgeThicknessMm}mm` : '',
    'EDGING WIDTH 1': p.edgeW1 ? `${p.edgeThicknessMm}mm` : '',
    'EDGING WIDTH 2': p.edgeW2 ? `${p.edgeThicknessMm}mm` : '',
    // Net panel sizes above are the finished body size, not yet built up by
    // banding thickness - defaults to "No" so the cutting software applies
    // its own edge-banding allowance. Flip to "Yes" in the sheet if your
    // LENGTH/WIDTH should be read as already including that allowance.
    'INCLUDE EDGING THICKNESS': 'No',
    'TYPE': p.partName,
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

  XLSX.writeFile(workbook, fileName);
}
