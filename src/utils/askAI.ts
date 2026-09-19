import { ModularItem, CutListPart, ProjectType, HardwareRules } from '../types';
import {
  generateAllCutLists,
  calculateMaterialUsage,
  calculateHardwareBOM,
  aggregateHardwareBOM,
  generateSheetNestingLayouts,
} from './calculator';

export interface AskAIAnswerSection {
  title: string;
  rows: string[];
}

export interface AskAIAnswer {
  question: string;
  summary: string;
  sections: AskAIAnswerSection[];
  matched: boolean;
}

// Not a live LLM call - this app has no backend/API key to make one. This
// is a deterministic query engine over the project's own already-computed
// data: it recognizes a fixed set of topics (sheets, hardware, laminate,
// fabric, rooms, categories like shelves/expo/dummy, dimensions, and a
// Semi vs Full Modular comparison) plus an optional room/category scope
// pulled out of the question text, and answers with real numbers - never
// a generated guess.
const EXAMPLE_QUESTIONS = [
  'How many sheets for MBR?',
  'Compare sheets semi vs full modular',
  'How much fabric and laminate area?',
  'How many shelves are there?',
  'Total hardware for the Kitchen',
  'What is the size of the Wardrobe Shutter in MBR?',
  'List all rooms',
];

function scopeLabel(room: string | null, keyword: string | null): string {
  // A keyword like "kitchen" can also literally be a room name - showing
  // both would read as "(Kitchen in Kitchen)". Drop the keyword once it's
  // redundant with the room.
  const dedupedKeyword = keyword && room && keyword.toLowerCase() === room.toLowerCase() ? null : keyword;
  const parts: string[] = [];
  if (dedupedKeyword) parts.push(dedupedKeyword);
  if (room) parts.push(`in ${room}`);
  return parts.length ? ` (${parts.join(' ')})` : '';
}

export function answerProjectQuestion(
  question: string,
  items: ModularItem[],
  cutList: CutListPart[],
  projectType: ProjectType,
  hardwareRules: HardwareRules,
  currentProjectName: string
): AskAIAnswer {
  const q = question.toLowerCase().trim();
  const sections: AskAIAnswerSection[] = [];
  let matched = false;

  if (!q || items.length === 0) {
    return {
      question,
      summary: items.length === 0 ? 'Upload or load a project first.' : 'Ask a question about the project.',
      sections: [{ title: 'Try asking', rows: EXAMPLE_QUESTIONS }],
      matched: false,
    };
  }

  // --- Room scope: does the question name one of the project's own rooms? ---
  const roomNames = Array.from(new Set(items.map((i) => i.room))).filter(Boolean);
  const matchedRoom = roomNames.find((r) => r && q.includes(r.toLowerCase())) || null;

  // --- Category/keyword scope ---
  // "drawer" is deliberately not a category keyword here - it's an
  // item-level count (item.drawerCount), not something that shows up in a
  // category name or description, so it gets its own topic below instead
  // of trying to scope items by a "drawer" substring match that would
  // rarely find anything.
  const KEYWORD_MATCHERS: { keyword: string; label: string }[] = [
    { keyword: 'shelves', label: 'Shelves' },
    { keyword: 'shelf', label: 'Shelves' },
    { keyword: 'expo', label: 'Expo' },
    { keyword: 'dummy', label: 'Dummy' },
    { keyword: 'wardrobe', label: 'Wardrobe' },
    { keyword: 'loft', label: 'Loft' },
    { keyword: 'tandem', label: 'Tandem Box' },
    { keyword: 'tv panel', label: 'TV Panel' },
    { keyword: 'tv unit', label: 'TV Unit' },
    { keyword: 'partition', label: 'Partition' },
    { keyword: 'kitchen', label: 'Kitchen' },
    { keyword: 'dressing', label: 'Dressing Unit' },
    { keyword: 'profile door', label: 'Profile Door' },
    { keyword: 'sitting box', label: 'Sitting Box' },
    { keyword: 'skirting', label: 'Skirting' },
    { keyword: 'back panel', label: 'Back Panel' },
    { keyword: 'shutter', label: 'Shutter' },
  ];
  const keywordMatch = KEYWORD_MATCHERS.find((k) => q.includes(k.keyword));
  const matchedKeyword = keywordMatch?.keyword ?? null;
  const matchedLabel = keywordMatch?.label ?? null;

  let scopedItems = items;
  if (matchedRoom) scopedItems = scopedItems.filter((i) => i.room === matchedRoom);
  if (matchedKeyword) {
    const bare = matchedKeyword.replace(/s$/, '');
    scopedItems = scopedItems.filter(
      (i) => i.category.toLowerCase().includes(bare) || i.description.toLowerCase().includes(matchedKeyword)
    );
  }

  const label = scopeLabel(matchedRoom, matchedLabel);

  // --- Mode scope: Semi / Full / compare both ---
  const wantsSemi = /\bsemi\b/.test(q);
  const wantsFull = /\bfull\b/.test(q);
  const wantsCompare = /(compare|difference|vs\.?|versus)/.test(q) || (wantsSemi && wantsFull);
  const forcedMode: ProjectType | null = wantsCompare ? null : wantsSemi ? 'semi' : wantsFull ? 'full' : null;

  const cutListForMode = (mode: ProjectType, srcItems: ModularItem[]): CutListPart[] => {
    const forced = srcItems.map((i) => ({ ...i, projectType: mode }));
    return generateAllCutLists(forced, mode);
  };
  const scopedCurrentCutList = () =>
    cutList.filter((p) => scopedItems.some((i) => i.id === p.itemId));

  // --- Topic: SHEETS ---
  if (/(sheet|board)/.test(q)) {
    matched = true;
    if (wantsCompare) {
      const semiLayouts = generateSheetNestingLayouts(cutListForMode('semi', scopedItems)).layouts;
      const fullLayouts = generateSheetNestingLayouts(cutListForMode('full', scopedItems)).layouts;
      sections.push({
        title: `Sheets - Semi vs Full Modular${label}`,
        rows: [
          `Semi Modular: ${semiLayouts.length} sheets`,
          `Full Modular: ${fullLayouts.length} sheets`,
          `Difference: ${fullLayouts.length - semiLayouts.length} more sheets under Full Modular`,
        ],
      });
    } else {
      const targetCutList = forcedMode ? cutListForMode(forcedMode, scopedItems) : scopedCurrentCutList();
      const layouts = generateSheetNestingLayouts(targetCutList).layouts;
      const byThickness = new Map<number, number>();
      layouts.forEach((l) => byThickness.set(l.thicknessMm, (byThickness.get(l.thicknessMm) || 0) + 1));
      const modeNote = forcedMode ? ` (${forcedMode === 'semi' ? 'Semi' : 'Full'} Modular)` : '';
      sections.push({
        title: `Sheets${label}${modeNote}`,
        rows: [
          `Total: ${layouts.length} sheets`,
          ...Array.from(byThickness.entries())
            .sort((a, b) => b[0] - a[0])
            .map(([t, c]) => `${t}mm: ${c} sheets`),
        ],
      });
    }
  }

  // --- Topic: HARDWARE ---
  if (/(hardware|hinge|handle|channel|screw|minifix|dowel|bracket|clip|shelf pin)/.test(q)) {
    matched = true;
    if (wantsCompare) {
      const semiBOM = calculateHardwareBOM(cutListForMode('semi', scopedItems), hardwareRules, currentProjectName);
      const fullBOM = calculateHardwareBOM(cutListForMode('full', scopedItems), hardwareRules, currentProjectName);
      const semiTotal = aggregateHardwareBOM(semiBOM).reduce((s, l) => s + l.totalQuantity, 0);
      const fullTotal = aggregateHardwareBOM(fullBOM).reduce((s, l) => s + l.totalQuantity, 0);
      sections.push({
        title: `Hardware - Semi vs Full Modular${label}`,
        rows: [`Semi Modular: ${semiTotal} pieces total`, `Full Modular: ${fullTotal} pieces total`],
      });
    } else {
      const targetCutList = forcedMode ? cutListForMode(forcedMode, scopedItems) : scopedCurrentCutList();
      const bom = calculateHardwareBOM(targetCutList, hardwareRules, currentProjectName);
      const agg = aggregateHardwareBOM(bom);
      const modeNote = forcedMode ? ` (${forcedMode === 'semi' ? 'Semi' : 'Full'} Modular)` : '';
      sections.push({
        title: `Hardware${label}${modeNote}`,
        rows: agg.length ? agg.map((l) => `${l.hardwareName}: ${l.totalQuantity} ${l.unit}`) : ['No hardware in this scope.'],
      });
    }
  }

  // --- Topic: FABRIC / LAMINATE ---
  if (/(fabric|laminate|color|colour)/.test(q)) {
    matched = true;
    const targetCutList = forcedMode ? cutListForMode(forcedMode, scopedItems) : scopedCurrentCutList();
    const m = calculateMaterialUsage(targetCutList, hardwareRules);
    const modeNote = forcedMode ? ` (${forcedMode === 'semi' ? 'Semi' : 'Full'} Modular)` : '';
    sections.push({
      title: `Fabric & Laminate${label}${modeNote}`,
      rows: [
        `Box Fabric: ${m.boxFabricAreaSqFt} sq.ft (${m.boxFabricSheets} sheets, ${m.boxFabricPieces} pieces)`,
        `Shutter Color/Laminate: ${m.shutterColorAreaSqFt} sq.ft (${m.shutterColorSheets} sheets, ${m.shutterColorPieces} pieces)`,
      ],
    });
  }

  // --- Topic: ROOMS ---
  if (/\broom/.test(q) && !matchedRoom) {
    matched = true;
    sections.push({
      title: 'Rooms in this project',
      rows: roomNames.map((r) => `${r}: ${items.filter((i) => i.room === r).length} item(s)`),
    });
  }

  // --- Topic: DRAWERS - a count on the item itself (item.drawerCount), not
  // a "drawer" keyword in the description, so a general item/category
  // keyword match wouldn't find these on its own. ---
  if (/\bdrawer/.test(q)) {
    matched = true;
    const withDrawers = scopedItems.filter((i) => i.drawerCount > 0);
    const totalDrawers = withDrawers.reduce((s, i) => s + i.drawerCount, 0);
    sections.push({
      title: `Drawers${label}`,
      rows:
        withDrawers.length > 0
          ? [
              `Total: ${totalDrawers} drawer(s) across ${withDrawers.length} item(s)`,
              ...withDrawers.map((i) => `${i.description} (${i.room}): ${i.drawerCount} drawer(s)`),
            ]
          : ['No drawers in this scope.'],
    });
  }

  // --- Topic: AREA / VOLUME ---
  if (/(total area|sq\.?\s?ft|square feet|area|volume|cu\.?\s?ft)/.test(q)) {
    matched = true;
    const qtyOf = (i: ModularItem) => Math.max(1, Math.round(i.quantity || 1));
    const totalAreaSqFt = scopedItems.reduce((s, i) => s + i.areaSqFt * qtyOf(i), 0);
    const totalVolumeCuFt = scopedItems.reduce((s, i) => s + i.volumeCuFt * qtyOf(i), 0);
    sections.push({
      title: `Area & Volume${label}`,
      rows: [
        `Total Area: ${totalAreaSqFt.toFixed(1)} sq.ft`,
        `Total Volume: ${totalVolumeCuFt.toFixed(1)} cu.ft`,
        `Across ${scopedItems.length} item(s)`,
      ],
    });
  }

  // --- Topic: DIMENSIONS / SIZE (also the fallback for a category/room match with no other topic) ---
  const wantsDimensions = /(size|dimension|height|width|depth|length)/.test(q);
  if (wantsDimensions || ((matchedRoom || matchedKeyword) && !matched)) {
    matched = true;
    const wantsCount = /how many/.test(q);
    const rows = scopedItems.slice(0, 30).map((i) => {
      const depth = i.depthMm > 0 ? ` × D:${i.depthMm}mm` : ' (Frame/Shutter, no depth)';
      return `${i.description} (${i.room}): W:${i.widthMm}mm × H:${i.heightMm}mm${depth}`;
    });
    if (scopedItems.length > 30) rows.push(`...and ${scopedItems.length - 30} more`);
    if (wantsCount) rows.unshift(`Count: ${scopedItems.length}`);
    sections.push({
      title: `Sizes${label}`,
      rows: rows.length ? rows : ['No matching items found.'],
    });
  }

  if (!matched) {
    return {
      question,
      summary: `I don't recognize a topic in that question yet.`,
      sections: [{ title: 'Try asking', rows: EXAMPLE_QUESTIONS }],
      matched: false,
    };
  }

  return {
    question,
    summary: `${sections.length} result${sections.length > 1 ? 's' : ''} for "${question}"`,
    sections,
    matched: true,
  };
}
