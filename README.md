# VinteriorDesign

Modular interior factory estimation and 2D/3D CAD planner. Upload an Excel quotation sheet and it converts straight into a room-by-room design: elevation and floor-plan layouts, an isometric 3D view, sheet-nesting cutting lists, material takeoffs, and a priced BOM proposal (exportable as PDF).

Runs entirely client-side — no backend or API key required.

## Features

- **Excel/CSV upload → design**: drop in your quotation sheet (`.xlsx`, `.xls`, `.csv`) and it's parsed into structured modular items (room, wall, dimensions, category) and rendered as a CAD layout.
- **2D CAD viewer**: elevation and floor-plan views per wall/room, with zoom, pan, grid, dimensions, and multiple drafting themes.
- **3D isometric viewer**: quick 3D visualization of the same layout.
- **Cutting list & sheet nesting**: auto-generates cut lists per item and nests parts onto standard board sheets with utilization/offcut reporting.
- **Pricing & BOM**: editable factory rate card (board, laminate, edge-band, hardware, labor, tax, margin) driving a full cost breakdown and PDF proposal export.
- **Semi vs. Full Modular** project modes with different cost/material assumptions.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`
3. Build for production:
   `npm run build`

## Project Structure

- `src/utils/excelParser.ts` – Excel/CSV → `ModularItem[]` parsing and categorization
- `src/utils/calculator.ts` – cut list generation, material usage, and cost calculation
- `src/utils/pdfGenerator.ts` – BOM/proposal PDF export
- `src/components/Cad2DViewer.tsx` – 2D elevation/floor-plan CAD canvas
- `src/components/Isometric3DViewer.tsx` – 3D isometric layout view
- `src/components/SpreadsheetEditor.tsx` – in-app editable data grid
- `src/components/CuttingListViewer.tsx` – cutting list & sheet nesting view
- `src/components/PricingReport.tsx` – rates, cost breakdown, and proposal export
