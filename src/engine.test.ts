import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stripPlan,
  hemProposal,
  railroadPlan,
  packGroup,
  calculateAccessories,
  defaultInvoiceConfig,
  calculateInvoiceTotals,
  balanceUnitPrice,
  generateSpreadUnitPrices,
  analyzeBiddingSpread,
  buildInvoiceLineItems,
  WindowState,
  LayerState,
  defaultShopRates,
  fullness,
} from './engine.ts';

test('stripPlan: stacks strips vertically and calculates count and extra meters', () => {
  // base = 6m, roll = 2.8m, strip = 0.85m, n = 2 panels
  // stripsPerPiece = floor(2.8 / 0.85) = 3 strips, but n=2, so stripsPerPiece = 2
  // count = ceil(2/2) = 1 piece
  // extra = 1 * (6 / 2) = 3m
  const plan = stripPlan(6.0, 2.8, 0.85, 2);
  assert.equal(plan.ok, true);
  assert.equal(plan.stripsPerPiece, 2);
  assert.equal(plan.count, 1);
  assert.equal(plan.extra, 3.0);
  assert.equal(plan.batches.length, 1);
  assert.equal(plan.batches[0].used, 2);
});

test('stripPlan: correctly determines when strips exceed roll height', () => {
  const plan = stripPlan(6.0, 2.8, 2.9, 2);
  assert.equal(plan.ok, false);
});

test('hemProposal: successfully reduces hems down to fit 1-piece stacking', () => {
  // Window: 3.6m width, 3.48m height, 3 panels, 2.8m roll
  // Base = 3.6 * 2.5 = 9.0m, panelWidth = 3.0m
  // gap = 3.48 - 2.8 = 0.68m
  // current folds: top 11cm, bottom 12cm, join 4cm (sum = 27cm = 0.27m)
  // current strip = 0.68 + 0.27 = 0.95m
  // 3 * 0.95 = 2.85m > 2.8m (needs 2 pieces)
  // target = 2.8 / 3 - 0.68 = 0.9333 - 0.68 = 0.2533m
  // min: minTop 10, minBottom 10, minJoin 3 -> min sum = 23cm = 0.23m
  const w: WindowState = {
    id: 'w1',
    label: 'Living room',
    width: 3.6,
    height: 3.48,
    quantity: 1,
    preset: 'custom',
    panelMode: 'manual',
    manualPanels: 3,
    accessoryMode: 'auto',
    manualBelts: 0,
    manualHooks: 0,
    manualClip: 0,
    includeHandyman: false,
    ratesConfirmed: true,
    outer: {
      enabled: true,
      name: 'Curtain',
      price: 1800,
      style: 'pinch',
      fullness: 2.5,
      roll: 2.8,
      method: 'auto',
      top: 11,
      bottom: 12,
      join: 4,
      minTop: 10,
      minBottom: 10,
      minJoin: 3,
      sewingOverride: '',
      pvcOverride: '',
      pvc: 'rail',
      railApproved: false,
      fitApproved: false,
      fabricGroup: 'OUTER-SHARED',
      autoHem: true,
      railActual: '',
      railSide: 0,
      railSeam: 0,
      railJoin: false,
    },
    inner: {
      enabled: false,
      name: '',
      price: '',
      style: 'roflet',
      fullness: 2.5,
      roll: 2.8,
      method: 'auto',
      top: 10,
      bottom: 10,
      join: 5,
      minTop: 7,
      minBottom: 7,
      minJoin: 3,
      sewingOverride: '',
      pvcOverride: '',
      pvc: 'rail',
      railApproved: false,
      fitApproved: false,
      fabricGroup: '',
      autoHem: true,
      railActual: '',
      railSide: 0,
      railSeam: 0,
      railJoin: false,
    },
  };

  const prop = hemProposal(w, w.outer);
  assert.equal(prop.ok, true);
  if (prop.ok && prop.before && prop.after) {
    assert.equal(prop.before.count, 2);
    assert.equal(prop.after.count, 1);
    assert(prop.before.extra > prop.after.extra);
    assert.equal(prop.after.extra, 3.0); // 1 piece of panelWidth 3.0m
  }
});

test('packGroup: packs multiple strips using 2D guillotine algorithm and allows offcut reuse', () => {
  const demands = [
    {
      owner: 'w1',
      key: 'outer' as const,
      copy: 1,
      panel: 1,
      width: 2.5,
      height: 1.2,
      token: 'w1-p1',
      label: 'Window 1 · Panel 1',
    },
    {
      owner: 'w2',
      key: 'outer' as const,
      copy: 1,
      panel: 1,
      width: 2.0,
      height: 1.0,
      token: 'w2-p1',
      label: 'Window 2 · Panel 1',
    },
  ];

  // Roll height is 2.8m.
  // First piece opened for w1: width 2.5m, roll 2.8m. Cut takes y 0..1.2m.
  // Free bottom shelf is 2.5m wide x 1.6m high.
  // Demand for w2 is 2.0m wide x 1.0m high, which fits inside 2.5m x 1.6m!
  const res = packGroup(demands, 2.8);
  assert.equal(res.pieces.length, 1);
  assert.equal(res.pieces[0].cuts.length, 2);
  assert.equal(res.pieces[0].cuts[0].isOwner, true);
  assert.equal(res.pieces[0].cuts[1].isOwner, false); // Reused for free!
  assert.equal(res.extra, 2.5);
  assert.equal(res.billedPerOwnerKey['w1:outer'], 2.5);
  assert.equal(res.billedPerOwnerKey['w2:outer'], undefined);
});

test('railroadPlan: calculates cut plan and formulas correctly', () => {
  const w: WindowState = {
    id: 'w1',
    label: 'Living room',
    width: 1.8,
    height: 3.4,
    quantity: 1,
    preset: 'custom',
    panelMode: 'auto',
    manualPanels: 1,
    accessoryMode: 'auto',
    manualBelts: 0,
    manualHooks: 0,
    manualClip: 0,
    includeHandyman: false,
    ratesConfirmed: true,
    outer: {
      enabled: true,
      name: 'Curtain',
      price: 1800,
      style: 'pinch',
      fullness: 2.5,
      roll: 2.8,
      method: 'railroad',
      top: 10,
      bottom: 10,
      join: 5,
      minTop: 7,
      minBottom: 7,
      minJoin: 3,
      sewingOverride: '',
      pvcOverride: '',
      pvc: 'rail',
      railApproved: true,
      fitApproved: true,
      fabricGroup: '',
      autoHem: true,
      railActual: 5.125,
      railSide: 0,
      railSeam: 0,
      railJoin: false,
    },
    inner: {
      enabled: false,
      name: '',
      price: '',
      style: 'roflet',
      fullness: 2.5,
      roll: 2.8,
      method: 'auto',
      top: 10,
      bottom: 10,
      join: 5,
      minTop: 7,
      minBottom: 7,
      minJoin: 3,
      sewingOverride: '',
      pvcOverride: '',
      pvc: 'rail',
      railApproved: false,
      fitApproved: false,
      fabricGroup: '',
      autoHem: true,
      railActual: '',
      railSide: 0,
      railSeam: 0,
      railJoin: false,
    },
  };

  const plan = railroadPlan(w, w.outer);
  // width 1.8m < 2m -> 1 panel
  // flat = 1.8 * 2.5 = 4.5m
  // panelWidth = 4.5m > usable (2.8m - 0 = 2.8m)
  assert.equal(plan.seamlessFits, false);
  assert.equal(plan.suggested, 2); // ceil(4.5 / 2.8) = 2 panels
  assert.equal(plan.formula, (1.8 + 0.25) * 2.5); // 5.125
});

test('inner KETEL half-window rule: splits into 2 strips of base/2 width', () => {
  // Window: 2.0m width, height 3.2m, inner roll 2.8m, fullness 2.5
  // base = 2.0 * 2.5 = 5.0m
  // gap = 3.2 - 2.8 = 0.4m
  // folds = top 10 + bottom 10 + join 5 = 25cm = 0.25m
  // strip = 0.4 + 0.25 = 0.65m
  // Inner KETEL strips count = 2 strips (half-window rule)
  // Each strip width = 5.0 / 2 = 2.5m
  // stripsPerPiece = floor(2.8 / 0.65) = 4 strips >= 2, so stripsPerPiece = 2
  // count = 1 piece
  // extra = 1 piece * 2.5m = 2.5m
  const plan = stripPlan(5.0, 2.8, 0.65, 2);
  assert.equal(plan.ok, true);
  assert.equal(plan.count, 1);
  assert.equal(plan.extra, 2.5); // Exactly half-window width!
  assert.equal(plan.stripsPerPiece, 2);
});

test('packGroup cross-window reuse: Window 2 uses Window 1 leftover and bills 0m extra', () => {
  // Window 1: needs 2 inner strips of 3.0m wide x 0.35m tall
  // Window 2: needs 2 inner strips of 3.0m wide x 0.35m tall
  // Roll height is 3.20m.
  // 4 strips * 0.35m = 1.40m <= 3.20m roll, so all 4 fit in Piece #1 (3.0m wide)!
  const demands = [
    { owner: 'w1', key: 'inner' as const, copy: 1, panel: 1, width: 3.0, height: 0.35, token: 'w1_p1', label: 'W1 - Strip 1' },
    { owner: 'w1', key: 'inner' as const, copy: 1, panel: 2, width: 3.0, height: 0.35, token: 'w1_p2', label: 'W1 - Strip 2' },
    { owner: 'w2', key: 'inner' as const, copy: 1, panel: 1, width: 3.0, height: 0.35, token: 'w2_p1', label: 'W2 - Strip 1' },
    { owner: 'w2', key: 'inner' as const, copy: 1, panel: 2, width: 3.0, height: 0.35, token: 'w2_p2', label: 'W2 - Strip 2' },
  ];

  const res = packGroup(demands, 3.20);
  assert.equal(res.pieces.length, 1);
  assert.equal(res.pieces[0].cuts.length, 4);
  assert.equal(res.extra, 3.0);

  // Pieces opened for w1 vs w2:
  const billedW1 = res.pieces.filter(p => p.owner === 'w1' && p.key === 'inner').reduce((s, p) => s + p.width, 0);
  const billedW2 = res.pieces.filter(p => p.owner === 'w2' && p.key === 'inner').reduce((s, p) => s + p.width, 0);

  assert.equal(billedW1, 3.0);
  assert.equal(billedW2, 0.0); // Window 2 bills 0m extra!

  // Window 2's strips are free cuts from Window 1's piece:
  const w2Cuts = res.pieces[0].cuts.filter(c => c.owner === 'w2');
  assert.equal(w2Cuts.length, 2);
  assert.equal(w2Cuts[0].isOwner, false);
  assert.equal(w2Cuts[1].isOwner, false);
});

test('calculateAccessories: auto mode for 2 panels multiplies 1 set belts and 1 set hooks', () => {
  const w: any = {
    width: 2.4,
    height: 2.6,
    panelMode: 'auto',
    accessoryMode: 'auto',
    manualBelts: 0,
    manualHooks: 0,
    manualClip: 0,
    includeHandyman: true,
  };
  const res = calculateAccessories(w, defaultShopRates);
  assert.equal(res.beltsQty, 1);
  assert.equal(res.hooksQty, 1);
  assert.equal(res.clipQty, 0);
  assert.equal(res.handymanQty, 1);
  assert.equal(res.belts, 1000);
  assert.equal(res.hooks, 1000);
  assert.equal(res.clip, 0);
  assert.equal(res.handyman, 400);
  assert.equal(res.total, 2400);
});

test('calculateAccessories: manual mode multiplies user entered belt, hook, and clip quantities by shop rates', () => {
  const w: any = {
    width: 2.4,
    height: 2.6,
    panelMode: 'auto',
    accessoryMode: 'manual',
    manualBelts: 2,
    manualHooks: 3,
    manualClip: 1,
    includeHandyman: true,
  };
  const res = calculateAccessories(w, defaultShopRates);
  assert.equal(res.beltsQty, 2);
  assert.equal(res.hooksQty, 3);
  assert.equal(res.clipQty, 1);
  // shop.belts = 1000 -> 2 * 1000 = 2000
  assert.equal(res.belts, 2000);
  // shop.hooks = 1000 -> 3 * 1000 = 3000
  assert.equal(res.hooks, 3000);
  // shop.clip = 750 -> 1 * 750 = 750
  assert.equal(res.clip, 750);
  assert.equal(res.handyman, 400);
  assert.equal(res.total, 2000 + 3000 + 750 + 400);
});

test('defaultInvoiceConfig: initializes with MEHRET ADANE IMPORT defaults and 15% tax rate', () => {
  const cfg = defaultInvoiceConfig();
  assert.equal(cfg.companyName, 'MEHRET ADANE IMPORT');
  assert.equal(cfg.docTitle, 'PROFORMA INVOICE');
  assert.equal(cfg.taxRate, 15);
  assert.equal(cfg.pricingMode, 'ex_vat');
  assert(cfg.email.includes('@'));
  assert(cfg.phone.includes('+251'));
});

test('calculateInvoiceTotals: standard ex-VAT calculation (Government / Corporate)', () => {
  const items = [{ qty: 1, unitPrice: 7500 }];
  const res = calculateInvoiceTotals(items, 15, 'ex_vat');
  assert.equal(res.subtotal, 7500);
  assert.equal(res.tax, 1125);
  assert.equal(res.grandTotal, 8625);
});

test('calculateInvoiceTotals: balanced reverse VAT calculation (Individual / Retail)', () => {
  const items = [{ qty: 1, unitPrice: 7500 }];
  const res = calculateInvoiceTotals(items, 15, 'vat_inclusive');
  // Target Grand Total = 7500. Subtotal = 7500 / 1.15 = 6521.739130434783
  assert.equal(res.grandTotal, 7500);
  assert.equal(Number(res.subtotal.toFixed(2)), 6521.74);
  assert.equal(Number(res.tax.toFixed(2)), 978.26);
  assert.equal(res.subtotal + res.tax, 7500);
});

test('generateSpreadUnitPrices: applies realistic markup with natural rounding for procurement', () => {
  const basePrices = [1800, 1100, 350, 650];
  // +8% markup: 1800 -> 1944 (rounds to 1945), 1100 -> 1188 (rounds to 1190), 350 -> 378 (rounds to 380), 650 -> 702 (rounds to 700)
  const spread8 = generateSpreadUnitPrices(basePrices, 8, 5);
  assert.equal(spread8[0], 1945);
  assert.equal(spread8[1], 1190);
  assert.equal(spread8[2], 380);
  assert.equal(spread8[3], 700);

  // +16% markup: 1800 -> 2088 (rounds to 2090), 1100 -> 1276 (rounds to 1275)
  const spread16 = generateSpreadUnitPrices(basePrices, 16, 5);
  assert.equal(spread16[0], 2090);
  assert.equal(spread16[1], 1275);
});

test('analyzeBiddingSpread: validates optimal winning spread vs too close vs competitor winning', () => {
  // Case 1: Optimal spread where winner (Supplier 1) is lowest by 8.5% and 15%
  const optimalCase = [
    { name: 'Mehret Adane Import', total: 29468.75, isWinner: true },
    { name: 'Alpha Curtain & Decor', total: 31970.00, isWinner: false },
    { name: 'Royal Drapery Trading', total: 33890.00, isWinner: false },
  ];
  const res1 = analyzeBiddingSpread(optimalCase);
  assert.equal(res1.winnerIsLowest, true);
  assert.equal(res1.status, 'optimal');
  assert(res1.advice.includes('Optimal bidding strategy'));

  // Case 2: Too close (< 2% spread looks coordinated)
  const tooCloseCase = [
    { name: 'Mehret Adane Import', total: 29468.75, isWinner: true },
    { name: 'Alpha Curtain & Decor', total: 29800.00, isWinner: false },
    { name: 'Royal Drapery Trading', total: 30000.00, isWinner: false },
  ];
  const res2 = analyzeBiddingSpread(tooCloseCase);
  assert.equal(res2.status, 'too_close');
  assert(res2.advice.includes('coordinated bidding'));

  // Case 3: Winner is NOT lowest
  const losingCase = [
    { name: 'Mehret Adane Import', total: 32000.00, isWinner: true },
    { name: 'Alpha Curtain & Decor', total: 29000.00, isWinner: false },
    { name: 'Royal Drapery Trading', total: 34000.00, isWinner: false },
  ];
  const res3 = analyzeBiddingSpread(losingCase);
  assert.equal(res3.winnerIsLowest, false);
  assert.equal(res3.status, 'winner_not_lowest');
  assert(res3.advice.includes('NOT the lowest bid'));
});

test('buildInvoiceLineItems: combines dual PVC tracks and matches exact 54,500 ETB project total', () => {
  // Simulating 2 windows (width 2.5m, height 2.8m, qty 2 total)
  // Window 1: outer 1800, inner 1100, sewing 350, rail 650
  const win: WindowState = {
    id: 'w1',
    label: 'Living Room',
    width: 2.5,
    height: 2.8,
    quantity: 2,
    preset: 'normal',
    panelMode: 'auto',
    manualPanels: 2,
    accessoryMode: 'auto',
    manualBelts: 1,
    manualHooks: 1,
    manualClip: 0,
    includeHandyman: true,
    ratesConfirmed: true,
    outer: {
      enabled: true,
      name: 'Outer Curtain Fabric',
      price: 1800,
      style: 'pinch',
      fullness: 2.5,
      roll: 2.8,
      method: 'auto',
      top: 10,
      bottom: 10,
      join: 3,
      minTop: 7,
      minBottom: 7,
      minJoin: 3,
      sewingOverride: '',
      pvcOverride: '',
      pvc: 'rail',
      railApproved: true,
      fitApproved: true,
      fabricGroup: '',
      autoHem: true,
      railActual: '',
      railSide: 0,
      railSeam: 0,
      railJoin: false,
    },
    inner: {
      enabled: true,
      name: 'Inner Sheer Fabric',
      price: 1100,
      style: 'pinch',
      fullness: 2.5,
      roll: 2.8,
      method: 'auto',
      top: 10,
      bottom: 10,
      join: 3,
      minTop: 7,
      minBottom: 7,
      minJoin: 3,
      sewingOverride: '',
      pvcOverride: '',
      pvc: 'rail',
      railApproved: true,
      fitApproved: true,
      fabricGroup: '',
      autoHem: true,
      railActual: '',
      railSide: 0,
      railSeam: 0,
      railJoin: false,
    },
  };

  const windowTotals = {
    w1: {
      qty: 2,
      subtotal: 27250,
      extended: 54500,
      outer: { base: 6, extra: 0, total: 6, pvcMetres: 2.5, pvcRate: 650, sewingRate: 350, sewing: 2100, pvc: 1625, fabricCost: 10800 },
      inner: { base: 6, extra: 0, total: 6, pvcMetres: 2.5, pvcRate: 650, sewingRate: 350, sewing: 2100, pvc: 1625, fabricCost: 6600 },
      sewing: 4200,
      pvc: 3250, // 1625 outer + 1625 inner
      belts: 1000,
      beltsQty: 1,
      hooks: 1000,
      hooksQty: 1,
      clip: 0,
      clipQty: 0,
      handyman: 400,
      handymanQty: 1,
    },
  };

  const res = buildInvoiceLineItems([win], windowTotals, defaultShopRates, { pricingMode: 'ex_vat', taxRate: 15 });
  
  // PVC item must have 10m total (2.5m outer + 2.5m inner = 5m/win * 2 wins = 10m)
  const pvcItem = res.items.find((it) => it.category === 'pvc');
  assert(pvcItem, 'PVC line item should exist');
  assert.equal(pvcItem.qty, 10);
  assert.equal(pvcItem.unitPrice, 650);
  assert.equal(pvcItem.total, 6500);

  // Subtotal must match exactly 54,500.00 ETB!
  assert.equal(res.subtotal, 54500.00);
  // Ex-VAT tax = 54,500 * 0.15 = 8,175.00
  assert.equal(res.tax, 8175.00);
  assert.equal(res.grandTotal, 62675.00);
});

test('buildInvoiceLineItems: creates separate rows for different fabrics and custom prices', () => {
  const win1: WindowState = {
    id: 'w1',
    label: 'Living Room',
    width: 2.0,
    height: 2.8,
    quantity: 1,
    preset: 'normal',
    panelMode: 'auto',
    manualPanels: 2,
    accessoryMode: 'auto',
    manualBelts: 0,
    manualHooks: 0,
    manualClip: 0,
    includeHandyman: false,
    ratesConfirmed: true,
    outer: {
      enabled: true,
      name: 'Blue Velvet',
      price: 2400,
      style: 'pinch',
      fullness: 2.5,
      roll: 2.8,
      method: 'auto',
      top: 10,
      bottom: 10,
      join: 3,
      minTop: 7,
      minBottom: 7,
      minJoin: 3,
      sewingOverride: '',
      pvcOverride: '',
      pvc: 'rail',
      railApproved: true,
      fitApproved: true,
      fabricGroup: 'Velvet',
      autoHem: true,
      railActual: '',
      railSide: 0,
      railSeam: 0,
      railJoin: false,
    },
    inner: { enabled: false } as any,
  };

  const win2: WindowState = {
    id: 'w2',
    label: 'Bedroom',
    width: 2.0,
    height: 2.8,
    quantity: 1,
    preset: 'normal',
    panelMode: 'auto',
    manualPanels: 2,
    accessoryMode: 'auto',
    manualBelts: 0,
    manualHooks: 0,
    manualClip: 0,
    includeHandyman: false,
    ratesConfirmed: true,
    outer: {
      enabled: true,
      name: 'Grey Linen',
      price: 1800,
      style: 'pinch',
      fullness: 2.5,
      roll: 2.8,
      method: 'auto',
      top: 10,
      bottom: 10,
      join: 3,
      minTop: 7,
      minBottom: 7,
      minJoin: 3,
      sewingOverride: '',
      pvcOverride: '',
      pvc: 'rail',
      railApproved: true,
      fitApproved: true,
      fabricGroup: 'Linen',
      autoHem: true,
      railActual: '',
      railSide: 0,
      railSeam: 0,
      railJoin: false,
    },
    inner: { enabled: false } as any,
  };

  const windowTotals = {
    w1: {
      qty: 1,
      outer: { base: 5, extra: 0, total: 5, pvcMetres: 2.0, pvcRate: 650, sewingRate: 350, sewing: 1750, pvc: 1300, fabricCost: 12000 },
      sewing: 1750,
      pvc: 1300,
    },
    w2: {
      qty: 1,
      outer: { base: 5, extra: 0, total: 5, pvcMetres: 2.0, pvcRate: 650, sewingRate: 350, sewing: 1750, pvc: 1300, fabricCost: 9000 },
      sewing: 1750,
      pvc: 1300,
    },
  };

  const res = buildInvoiceLineItems([win1, win2], windowTotals, defaultShopRates, { pricingMode: 'ex_vat' });
  const fabricItems = res.items.filter((it) => it.category === 'fabric_outer');
  
  // Must have 2 separate rows for the 2 distinct fabrics!
  assert.equal(fabricItems.length, 2);
  const velvet = fabricItems.find((it) => it.rawPrice === 2400);
  const linen = fabricItems.find((it) => it.rawPrice === 1800);
  assert(velvet, 'Velvet row exists');
  assert(linen, 'Linen row exists');
  assert(velvet.desc.includes('Velvet'));
  assert(linen.desc.includes('Linen'));
});

test('fullness: allows roflet to use 3.0x and 2.5x fullness without being locked to 2.5x', () => {
  const rofletDefault: LayerState = {
    ...defaultShopRates,
    enabled: true,
    name: 'Inner Sheer',
    price: '',
    style: 'roflet',
    fullness: 2.5,
    roll: 2.8,
    method: 'auto',
    top: 10,
    bottom: 10,
    join: 5,
    minTop: 7,
    minBottom: 7,
    minJoin: 3,
    sewingOverride: '',
    pvcOverride: '',
    pvc: 'rail',
    railApproved: false,
    fitApproved: false,
    fabricGroup: 'INNER-SHARED',
    autoHem: true,
    railActual: '',
    railSide: 0,
    railSeam: 0,
    railJoin: false,
  };

  assert.equal(fullness(rofletDefault), 2.5);

  const roflet3x: LayerState = {
    ...rofletDefault,
    fullness: 3.0,
  };
  assert.equal(fullness(roflet3x), 3.0, 'Roflet with fullness 3.0 returns 3.0');

  const stampLayer: LayerState = {
    ...rofletDefault,
    style: 'stamp',
    fullness: 3.0,
  };
  assert.equal(fullness(stampLayer), 2.5, 'Stamp remains locked to 2.5');
});



