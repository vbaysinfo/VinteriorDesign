import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ModularItem, MaterialBreakdown, CostBreakdown, FactoryRates, ProjectInfo } from '../types';

export function generateBOMProposalPDF(
  project: ProjectInfo,
  items: ModularItem[],
  materials: MaterialBreakdown,
  costs: CostBreakdown,
  rates: FactoryRates
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const primaryColor: [number, number, number] = [30, 41, 59]; // Slate-800
  const accentColor: [number, number, number] = [14, 116, 144]; // Cyan-700
  const currency = project.currency;

  // Header Banner
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('MODULAR FACTORY ESTIMATION & BOM PROPOSAL', 14, 15);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Project Mode: ${project.projectType === 'semi' ? 'SEMI-MODULAR (Civil Masonry Based)' : 'FULL-MODULAR (Factory Prefabricated)'}  |  Generated on: ${project.date}`, 14, 23);

  // Project & Client Metadata Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, 38, 182, 30, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('PROJECT DETAILS', 20, 45);
  doc.text('CLIENT DETAILS', 110, 45);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Project: ${project.projectName}`, 20, 52);
  doc.text(`Site: ${project.siteAddress || 'On-site'}`, 20, 58);
  doc.text(`Type: ${project.projectType.toUpperCase()} MODULAR`, 20, 64);

  doc.text(`Client: ${project.clientName}`, 110, 52);
  doc.text(`Email: ${project.clientEmail || 'N/A'}`, 110, 58);
  doc.text(`Phone: ${project.clientPhone || 'N/A'}`, 110, 64);

  // Summary Financial Metrics
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('1. EXECUTIVE COST ESTIMATE', 14, 76);

  const costData = [
    ['Carcass Panels & Core Plywood', `${currency} ${costs.carcassBoardCost.toLocaleString()}`, 'Factory CNC Machining & Pressing', `${currency} ${costs.factoryLaborCost.toLocaleString()}`],
    ['Shutters & Finish Panels', `${currency} ${costs.shutterBoardCost.toLocaleString()}`, 'On-site Carpenter Installation', `${currency} ${costs.installationCost.toLocaleString()}`],
    ['Laminates (Inner Liner + Outer)', `${currency} ${(costs.innerLaminateCost + costs.outerLaminateCost).toLocaleString()}`, 'Packing & Logistics', `${currency} ${costs.packingTransportCost.toLocaleString()}`],
    ['PVC Edge Banding Tape', `${currency} ${costs.edgeBandCost.toLocaleString()}`, 'Subtotal (Excl. Tax)', `${currency} ${costs.subtotal.toLocaleString()}`],
    ['Hardware & Fittings', `${currency} ${costs.hardwareCost.toLocaleString()}`, `GST / Tax (${rates.taxPercent}%)`, `${currency} ${costs.taxAmount.toLocaleString()}`],
  ];

  autoTable(doc, {
    startY: 80,
    head: [['Material & Direct Costs', 'Amount', 'Services & Overheads', 'Amount']],
    body: costData,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    columnStyles: {
      1: { halign: 'right', fontStyle: 'bold' },
      3: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  });

  // Grand Total Highlight Banner
  // @ts-ignore
  const lastY = (doc as any).lastAutoTable.finalY + 4;
  doc.setFillColor(240, 253, 250); // Mint
  doc.setDrawColor(13, 148, 136);
  doc.rect(14, lastY, 182, 12, 'FD');
  doc.setTextColor(13, 148, 136);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL ESTIMATED PROJECT BUDGET: ${currency} ${costs.grandTotal.toLocaleString()}`, 20, lastY + 8);

  // Material Usage Quantification
  const nextY = lastY + 18;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('2. MATERIAL QUANTIFICATION SPECIFICATIONS', 14, nextY);

  const materialData = [
    ['Total Raw Wood Boards (8x4)', `${materials.totalSheets} Sheets`, '32 Sq.ft / Board', 'Combined 18mm, 9mm, and 6mm Core Boards'],
    ['Total Cut Factory Panels', `${materials.totalPieces} Pieces`, 'Precision Sized', 'Finished Gables, Decks, Shutters, Shelves & Drawers'],
    ['18mm BWP/BWR Plywood (8x4)', `${materials.ply18mmSheets} Sheets`, `${materials.ply18mmAreaSqFt} Sq.ft`, 'Carcase, External Shutters & Visible Gables'],
    ['9mm Core Ply (8x4)', `${materials.ply9mmSheets} Sheets`, `${materials.ply9mmAreaSqFt} Sq.ft`, 'Drawer Bottoms & Partition Ribs'],
    ['6mm Backing Ply (8x4)', `${materials.ply6mmSheets} Sheets`, `${materials.ply6mmAreaSqFt} Sq.ft`, 'Groove Mount Rear Wall Moisture Enclosures'],
    ['0.8mm Inner Liner Laminate', `${materials.innerLaminateSheets} Sheets`, '32 Sq.ft/Sheet', 'Internal Carcass Moisture Proof Off-White Liner'],
    ['1.0mm Premium Outer Laminate/Acrylic', `${materials.outerLaminateSheets} Sheets`, '32 Sq.ft/Sheet', 'External Aesthetic Finish Facias & Shutters'],
    ['PVC Edge Binding (Banding)', `${materials.edgeBandMeters} Running Meters`, `2mm: ${materials.edgeBand2mmMeters}m, 0.8mm: ${materials.edgeBand08mmMeters}m`, `~${Math.ceil(materials.edgeBandMeters / 50)} Rolls (50m each) with Hot-Melt Adhesive`],
    ['Soft-Close Concealed Hinges', `${materials.totalHingesPieces} Pcs (${materials.softCloseHingesPairs} Pairs)`, '3D Clip-on', 'Hettich / Hafele Soft-Close Hydraulic Buffer'],
    ['Tandem Box Channels', `${materials.tandemBoxChannels} Sets`, 'Heavy Duty 35-50kg', 'Soft-Close Concealed Undermount Drawer System'],
    ['Telescopic Drawer Slides', `${materials.drawerChannels} Pairs`, '45mm Full Extension', 'Soft-Close Ball-Bearing Runners'],
    ['Handles / Profile Pulls', `${materials.handles} Pcs`, 'Brushed Alloy', 'Concealed J-Pull / Edge Profile Handles'],
    ['Adjustable Shelf Studs', `${materials.shelfSupports} Pcs`, '5mm Nickel Plated', 'Anti-Vibration Silicone Ring Shelving Pins'],
  ];

  autoTable(doc, {
    startY: nextY + 4,
    head: [['Material / Component', 'Quantity Required', 'Unit Coverage', 'Technical Specification']],
    body: materialData,
    theme: 'striped',
    headStyles: { fillColor: accentColor, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    margin: { left: 14, right: 14 },
  });

  // Page 2: Detailed Bill of Quantities (BOQ) & Room Schedule
  doc.addPage();

  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('3. DETAILED ROOM SCHEDULE & ITEM BREAKDOWN (BOQ)', 14, 11);

  const boqData = items.map((item) => [
    item.sNo,
    item.room,
    item.wall.toUpperCase(),
    item.description,
    `${item.widthFt} × ${item.heightFt} ${item.depthFt > 0 ? `× ${item.depthFt}` : ''}`,
    `${item.widthMm} × ${item.heightMm} ${item.depthMm > 0 ? `× ${item.depthMm}` : '-'}`,
    item.calcBasis === 'Area (Sq.ft)' ? `${item.areaSqFt} Sq.ft` : `${item.volumeCuFt} Cu.ft`,
    item.finishType,
    item.coreMaterial,
  ]);

  autoTable(doc, {
    startY: 22,
    head: [['#', 'Room', 'Wall', 'Item Description', 'Size (ft)', 'Size (mm)', 'Qty/Basis', 'Finish', 'Core Material']],
    body: boqData,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { fontStyle: 'bold', cellWidth: 20 },
      2: { halign: 'center', cellWidth: 14 },
      3: { cellWidth: 42 },
      4: { halign: 'center', cellWidth: 20 },
      5: { halign: 'center', cellWidth: 24 },
      6: { halign: 'right', cellWidth: 20 },
    },
    margin: { left: 14, right: 14 },
  });

  // Footer / Terms on final page
  // @ts-ignore
  const boqFinalY = (doc as any).lastAutoTable.finalY + 8;
  if (boqFinalY < 250) {
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('TERMS & CONDITIONS:', 14, boqFinalY);
    doc.text('1. Estimation is subject to final physical site verification of wall plumbs and water level.', 14, boqFinalY + 4);
    doc.text('2. Production lead time: 14-21 working days post approval of 2D CAD layouts and material samples.', 14, boqFinalY + 8);
    doc.text('3. Semi-modular projects assume civil masonry frame/granite slabs are pre-completed by civil contractor.', 14, boqFinalY + 12);
    doc.text('Authorized Signatory: __________________________        Client Acceptance: __________________________', 14, boqFinalY + 22);
  }

  // Trigger download
  doc.save(`${project.projectName.replace(/\s+/g, '_')}_BOM_Proposal.pdf`);
}
