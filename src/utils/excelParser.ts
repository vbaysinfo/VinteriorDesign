import * as XLSX from 'xlsx';
import { ModularItem, WallType, UnitCategory } from '../types';
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
          const widthFtKey = getKey(['width (ft)', 'width_ft', 'widthft', 'w (ft)', 'width']);
          const heightFtKey = getKey(['height (ft)', 'height_ft', 'heightft', 'h (ft)', 'height'], [widthFtKey]);
          const depthFtKey = getKey(['depth (ft)', 'depth_ft', 'depthft', 'd (ft)', 'depth'], [widthFtKey, heightFtKey]);
          const wallKey = getKey(['wall', 'side', 'elevation']);
          const sNoKey = getKey(['s.no', 'sno', 'sl', 'no', '#']);

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
            projectType: 'semi',
            shutterCount: wFt > 6 ? 4 : wFt > 3 ? 2 : 1,
            drawerCount: category === 'tandem_box' ? 3 : category === 'sitting_box' ? 2 : 0,
            shelfCount: category === 'expo' || category === 'shelves' ? 4 : 2,
            finishType: desc.toLowerCase().includes('glass') || desc.toLowerCase().includes('profile') ? 'Profile Glass' : 'Laminate',
            coreMaterial: currentRoom.toLowerCase().includes('kitchen') ? 'BWP Marine Ply' : 'BWR Commercial Ply',
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

// Export items to Excel workbook (.xlsx)
export function exportToExcel(items: ModularItem[], fileName = 'Modular_Factory_Estimation.xlsx') {
  const exportData = items.map((item) => ({
    'S.No': item.sNo,
    'Room': item.room,
    'Wall': item.wall.toUpperCase(),
    'Item / Furniture Description': item.description,
    'Width (ft)': item.widthFt,
    'Height (ft)': item.heightFt,
    'Depth (ft) [blank = Frame/Shutter]': item.depthFt > 0 ? item.depthFt : '',
    'Width (mm) auto': item.widthMm,
    'Height (mm) auto': item.heightMm,
    'Depth (mm) auto': item.depthMm > 0 ? item.depthMm : '',
    'Calc. Basis (auto)': item.calcBasis,
    'Area (Sq.ft) / Volume (Cu.ft) (auto)': item.calcBasis === 'Area (Sq.ft)' ? item.areaSqFt : item.volumeCuFt,
    'Core Material': item.coreMaterial,
    'Finish': item.finishType,
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Estimation Sheet');

  // Generate buffer and trigger download
  XLSX.writeFile(workbook, fileName);
}
