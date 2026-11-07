export const EPS = 1e-9;

export interface ShopRates {
  sewing: number;
  stampSewing: number;
  rail: number;
  tunnel: number;
  belts: number;
  hooks: number;
  clip: number;
  handyman: number;
  minTop: number;
  minBottom: number;
  minJoin: number;
}

export const defaultShopRates: ShopRates = {
  sewing: 350,
  stampSewing: 450,
  rail: 650,
  tunnel: 800,
  belts: 1000,
  hooks: 1000,
  clip: 750,
  handyman: 400,
  minTop: 7,
  minBottom: 7,
  minJoin: 3,
};

export interface InvoiceConfig {
  companyName: string;
  address: string;
  email: string;
  phone: string;
  logoUrl: string;
  docTitle: string;
  taxRate: number;
  pricingMode: 'ex_vat' | 'vat_inclusive';
  language: 'en' | 'am';
  noteVat: string;
  notePayment: string;
  footerContact: string;
}

export function defaultInvoiceConfig(): InvoiceConfig {
  return {
    companyName: 'MEHRET ADANE IMPORT',
    address: 'PIYASSA SHOPING CENTER CHURCHILL AVENUE\nFloor: 2 NO 204',
    email: 'Mulu07md@gmail.com',
    phone: '+251940707077 / +251901079907',
    logoUrl: '/public/assets/aistudio/image_5b483dd2.png',
    docTitle: 'PROFORMA INVOICE',
    taxRate: 15,
    pricingMode: 'ex_vat',
    language: 'en',
    noteVat: 'NB: Price Includes 15% VAT',
    notePayment: 'Half payment is required to start the order',
    footerContact: 'If you have any queries concerning the price quoted, please do not hesitate to contact on +251940707077 or +251913555906 Email: Mulu07md@gmail.com Address : Piyassa Shoping Center No 204 Churchill Avenue Addis Ababa, Ethiopia',
  };
}

export function balanceUnitPrice(targetInclusivePrice: number, taxRate: number = 15): number {
  const rateFraction = (Number(taxRate) || 0) / 100;
  if (rateFraction <= -1) return targetInclusivePrice;
  const exVat = targetInclusivePrice / (1 + rateFraction);
  return Number(exVat.toFixed(2));
}

export function calculateInvoiceTotals(
  items: Array<{ qty: number; unitPrice: number }>,
  taxRate: number,
  pricingMode: 'ex_vat' | 'vat_inclusive'
) {
  const rateFraction = (Number(taxRate) || 0) / 100;
  if (pricingMode === 'vat_inclusive') {
    // Reverse VAT / Balanced Calculation from Target Final Total
    let grandTotal = 0;
    for (const item of items) {
      grandTotal += (item.qty || 0) * (item.unitPrice || 0);
    }
    const subtotal = rateFraction > -1 ? grandTotal / (1 + rateFraction) : grandTotal;
    const tax = grandTotal - subtotal;
    return {
      subtotal,
      tax,
      grandTotal,
    };
  } else {
    // Standard Ex-VAT Calculation
    let subtotal = 0;
    for (const item of items) {
      subtotal += (item.qty || 0) * (item.unitPrice || 0);
    }
    const tax = subtotal * rateFraction;
    const grandTotal = subtotal + tax;
    return {
      subtotal,
      tax,
      grandTotal,
    };
  }
}

export interface InvoiceLineItem {
  id: string;
  desc: string;
  descAm: string;
  uom: string;
  uomAm: string;
  qty: number;
  qtyStr: string;
  rawPrice: number;
  unitPrice: number;
  total: number;
  category: 'fabric_outer' | 'fabric_outer_ketel' | 'fabric_inner' | 'fabric_inner_ketel' | 'sewing' | 'pvc' | 'belts' | 'hooks' | 'clips' | 'handyman';
}

export function buildInvoiceLineItems(
  windows: WindowState[],
  windowTotals: Record<string, any>,
  shop: ShopRates,
  options?: {
    language?: 'en' | 'am';
    pricingMode?: 'ex_vat' | 'vat_inclusive';
    taxRate?: number;
  }
) {
  const language = options?.language || 'en';
  const pricingMode = options?.pricingMode || 'ex_vat';
  const taxRateVal = options?.taxRate !== undefined ? options.taxRate : 15;
  const isAmharic = language === 'am';
  const isVatInclusive = pricingMode === 'vat_inclusive';
  const vatDivider = 1 + (taxRateVal / 100);

  function getAdjustedUnitPrice(rawPrice: number): number {
    const p = Number(rawPrice) || 0;
    if (isVatInclusive && vatDivider > 0) {
      return Number((p / vatDivider).toFixed(2));
    }
    return p;
  }

  // 1. Group Outer Fabrics by distinct price and group/name
  interface FabricBucket {
    key: string;
    label: string;
    price: number;
    baseMeters: number;
    ketelMeters: number;
  }
  const outerBuckets = new Map<string, FabricBucket>();
  const innerBuckets = new Map<string, FabricBucket>();

  let totalSewingM = 0;
  let totalSewingCost = 0;
  let totalPVCM = 0;
  let totalPVCCost = 0;
  let totalBelts = 0;
  let totalHooks = 0;
  let totalClips = 0;
  let totalHandymanWins = 0;

  windows.forEach((w) => {
    const r = windowTotals[w.id];
    if (!r) return;
    const q = r.qty || w.quantity || 1;

    // Outer Layer
    if (w.outer && w.outer.enabled && r.outer) {
      const oPrice = Number(w.outer.price) || 0;
      const oLabel = (w.outer.fabricGroup || w.outer.name || '').trim();
      const bKey = `outer_${oLabel.toLowerCase()}___${oPrice}`;
      if (!outerBuckets.has(bKey)) {
        outerBuckets.set(bKey, {
          key: bKey,
          label: oLabel,
          price: oPrice,
          baseMeters: 0,
          ketelMeters: 0,
        });
      }
      const b = outerBuckets.get(bKey)!;
      b.baseMeters += (r.outer.base || 0) * q;
      if (r.outer.extra > 0) {
        b.ketelMeters += (r.outer.extra || 0) * q;
      }
    }

    // Inner Layer
    if (w.inner && w.inner.enabled && r.inner) {
      const iPrice = Number(w.inner.price) || 0;
      const iLabel = (w.inner.fabricGroup || w.inner.name || '').trim();
      const bKey = `inner_${iLabel.toLowerCase()}___${iPrice}`;
      if (!innerBuckets.has(bKey)) {
        innerBuckets.set(bKey, {
          key: bKey,
          label: iLabel,
          price: iPrice,
          baseMeters: 0,
          ketelMeters: 0,
        });
      }
      const b = innerBuckets.get(bKey)!;
      b.baseMeters += (r.inner.base || 0) * q;
      if (r.inner.extra > 0) {
        b.ketelMeters += (r.inner.extra || 0) * q;
      }
    }

    // Tailoring & Sewing Workmanship
    const sewM = ((r.outer ? r.outer.total : 0) + (r.inner ? r.inner.total : 0)) * q;
    if (sewM > 0) {
      totalSewingM += sewM;
      totalSewingCost += (r.sewing || 0) * q;
    }

    // PVC Rails & Tunnels (Combines both outer and inner tracks!)
    const pM = ((r.outer ? r.outer.pvcMetres : 0) + (r.inner ? r.inner.pvcMetres : 0)) * q;
    if (pM > 0) {
      totalPVCM += pM;
      totalPVCCost += (r.pvc || 0) * q;
    }

    totalBelts += (r.beltsQty || 0) * q;
    totalHooks += (r.hooksQty || 0) * q;
    totalClips += (r.clipQty || 0) * q;
    totalHandymanWins += (r.handymanQty || 0) * q;
  });

  const items: InvoiceLineItem[] = [];
  const multipleOuter = outerBuckets.size > 1;
  const multipleInner = innerBuckets.size > 1;

  // Add Outer Fabrics
  let outerIdx = 1;
  outerBuckets.forEach((b) => {
    const rawPrice = b.price;
    const unitPrice = getAdjustedUnitPrice(rawPrice);
    const tag = b.label ? b.label : multipleOuter ? `Type ${outerIdx}` : '';
    const descEn = multipleOuter
      ? `Outer Fabric (${tag}) (WERAJ)`
      : 'Outer Curtain Fabric (WERAJ)';
    const descAm = multipleOuter
      ? `ወፍራም ወራጅ (${tag})`
      : 'ወፍራም ወራጅ';

    if (b.baseMeters > 0) {
      const qVal = Number(b.baseMeters.toFixed(2));
      const lineTot = Number((qVal * unitPrice).toFixed(2));
      items.push({
        id: `outer_base_${b.key}`,
        desc: isAmharic ? descAm : descEn,
        descAm,
        uom: 'M',
        uomAm: 'M',
        qty: qVal,
        qtyStr: qVal.toFixed(2),
        rawPrice,
        unitPrice,
        total: lineTot,
        category: 'fabric_outer',
      });
    }

    if (b.ketelMeters > 0) {
      const ketelEn = multipleOuter
        ? `Outer KETEL Extensions (${tag})`
        : 'Outer KETEL Extensions';
      const ketelAm = multipleOuter
        ? `ቅጥል ወፍራም (${tag})`
        : 'ቅጥል ወፍራም';
      const qVal = Number(b.ketelMeters.toFixed(2));
      const lineTot = Number((qVal * unitPrice).toFixed(2));
      items.push({
        id: `outer_ketel_${b.key}`,
        desc: isAmharic ? ketelAm : ketelEn,
        descAm: ketelAm,
        uom: 'M',
        uomAm: 'M',
        qty: qVal,
        qtyStr: qVal.toFixed(2),
        rawPrice,
        unitPrice,
        total: lineTot,
        category: 'fabric_outer_ketel',
      });
    }
    outerIdx++;
  });

  // Add Inner Fabrics
  let innerIdx = 1;
  innerBuckets.forEach((b) => {
    const rawPrice = b.price;
    const unitPrice = getAdjustedUnitPrice(rawPrice);
    const tag = b.label ? b.label : multipleInner ? `Type ${innerIdx}` : '';
    const descEn = multipleInner
      ? `Inner Sheer Fabric (${tag}) (WERAJ)`
      : 'Inner Sheer Fabric (WERAJ)';
    const descAm = multipleInner
      ? `ስስ ወራጅ (${tag})`
      : 'ስስ ወራጅ';

    if (b.baseMeters > 0) {
      const qVal = Number(b.baseMeters.toFixed(2));
      const lineTot = Number((qVal * unitPrice).toFixed(2));
      items.push({
        id: `inner_base_${b.key}`,
        desc: isAmharic ? descAm : descEn,
        descAm,
        uom: 'M',
        uomAm: 'M',
        qty: qVal,
        qtyStr: qVal.toFixed(2),
        rawPrice,
        unitPrice,
        total: lineTot,
        category: 'fabric_inner',
      });
    }

    if (b.ketelMeters > 0) {
      const ketelEn = multipleInner
        ? `Inner KETEL Extensions (${tag}) (Half-Window Rule)`
        : 'Inner KETEL Extensions (Half-Window Rule)';
      const ketelAm = multipleInner
        ? `ስስ ቅጥል (${tag})`
        : 'ስስ ቅጥል';
      const qVal = Number(b.ketelMeters.toFixed(2));
      const lineTot = Number((qVal * unitPrice).toFixed(2));
      items.push({
        id: `inner_ketel_${b.key}`,
        desc: isAmharic ? ketelAm : ketelEn,
        descAm: ketelAm,
        uom: 'M',
        uomAm: 'M',
        qty: qVal,
        qtyStr: qVal.toFixed(2),
        rawPrice,
        unitPrice,
        total: lineTot,
        category: 'fabric_inner_ketel',
      });
    }
    innerIdx++;
  });

  // Tailoring & Sewing Workmanship
  if (totalSewingM > 0) {
    const rawPrice = totalSewingM > 0 ? Number((totalSewingCost / totalSewingM).toFixed(2)) : shop.sewing;
    const unitPrice = getAdjustedUnitPrice(rawPrice);
    const qVal = Number(totalSewingM.toFixed(2));
    const lineTot = Number((qVal * unitPrice).toFixed(2));
    items.push({
      id: 'sewing',
      desc: isAmharic ? 'ስፌት' : 'Tailoring & Sewing Workmanship',
      descAm: 'ስፌት',
      uom: 'M',
      uomAm: 'M',
      qty: qVal,
      qtyStr: qVal.toFixed(2),
      rawPrice,
      unitPrice,
      total: lineTot,
      category: 'sewing',
    });
  }

  // PVC Rails & Tunnels (Combines both Outer and Inner tracks!)
  if (totalPVCM > 0) {
    const rawPrice = totalPVCM > 0 ? Number((totalPVCCost / totalPVCM).toFixed(2)) : shop.rail;
    const unitPrice = getAdjustedUnitPrice(rawPrice);
    const qVal = Number(totalPVCM.toFixed(2));
    const lineTot = Number((qVal * unitPrice).toFixed(2));
    items.push({
      id: 'pvc',
      desc: isAmharic ? 'የመጋርጃ መስቀያ ብረት' : 'PVC Rails & Tunnels',
      descAm: 'የመጋርጃ መስቀያ ብረት',
      uom: 'M',
      uomAm: 'M',
      qty: qVal,
      qtyStr: qVal.toFixed(2),
      rawPrice,
      unitPrice,
      total: lineTot,
      category: 'pvc',
    });
  }

  // Tieback Belts
  if (totalBelts > 0) {
    const rawPrice = shop.belts;
    const unitPrice = getAdjustedUnitPrice(rawPrice);
    const qVal = Number(totalBelts.toFixed(2));
    const lineTot = Number((qVal * unitPrice).toFixed(2));
    items.push({
      id: 'belts',
      desc: isAmharic ? 'የመጋርጃ መያዣ ቤልት' : 'Tieback Belts',
      descAm: 'የመጋርጃ መያዣ ቤልት',
      uom: isAmharic ? 'ስብስብ' : 'Set',
      uomAm: 'ስብስብ',
      qty: qVal,
      qtyStr: qVal.toFixed(2),
      rawPrice,
      unitPrice,
      total: lineTot,
      category: 'belts',
    });
  }

  // Curtain Hooks
  if (totalHooks > 0) {
    const rawPrice = shop.hooks;
    const unitPrice = getAdjustedUnitPrice(rawPrice);
    const qVal = Number(totalHooks.toFixed(2));
    const lineTot = Number((qVal * unitPrice).toFixed(2));
    items.push({
      id: 'hooks',
      desc: isAmharic ? 'የመጋርጃ መያዣ ሁክ' : 'Curtain Hooks',
      descAm: 'የመጋርጃ መያዣ ሁክ',
      uom: isAmharic ? 'ስብስብ' : 'Set',
      uomAm: 'ስብስብ',
      qty: qVal,
      qtyStr: qVal.toFixed(2),
      rawPrice,
      unitPrice,
      total: lineTot,
      category: 'hooks',
    });
  }

  // Middle Clips
  if (totalClips > 0) {
    const rawPrice = shop.clip;
    const unitPrice = getAdjustedUnitPrice(rawPrice);
    const qVal = Number(totalClips.toFixed(2));
    const lineTot = Number((qVal * unitPrice).toFixed(2));
    items.push({
      id: 'clips',
      desc: isAmharic ? 'የመጋርጃ መያዣ ክሊፕ' : 'Middle Clips',
      descAm: 'የመጋርጃ መያዣ ክሊፕ',
      uom: isAmharic ? 'ቁጥር' : 'Pc',
      uomAm: 'ቁጥር',
      qty: qVal,
      qtyStr: qVal.toFixed(2),
      rawPrice,
      unitPrice,
      total: lineTot,
      category: 'clips',
    });
  }

  // Handyman Installation
  if (totalHandymanWins > 0) {
    const rawPrice = shop.handyman;
    const unitPrice = getAdjustedUnitPrice(rawPrice);
    const qVal = Number(totalHandymanWins.toFixed(2));
    const lineTot = Number((qVal * unitPrice).toFixed(2));
    items.push({
      id: 'handyman',
      desc: isAmharic ? 'ገጣሚ' : 'Handyman Installation Services',
      descAm: 'ገጣሚ',
      uom: isAmharic ? 'መስኮት' : 'Win',
      uomAm: 'መስኮት',
      qty: qVal,
      qtyStr: qVal.toFixed(2),
      rawPrice,
      unitPrice,
      total: lineTot,
      category: 'handyman',
    });
  }

  let subtotal = 0;
  let rawTotal = 0;
  items.forEach((it) => {
    subtotal += it.total;
    rawTotal += it.qty * it.rawPrice;
  });

  const rateFraction = (Number(taxRateVal) || 0) / 100;
  let tax = 0;
  let grandTotal = 0;

  if (isVatInclusive) {
    tax = Number((subtotal * rateFraction).toFixed(2));
    grandTotal = Number((subtotal + tax).toFixed(2));
  } else {
    tax = Number((subtotal * rateFraction).toFixed(2));
    grandTotal = Number((subtotal + tax).toFixed(2));
  }

  return {
    items,
    subtotal: Number(subtotal.toFixed(2)),
    tax,
    grandTotal,
    rawTotal: Number(rawTotal.toFixed(2)),
  };
}

export interface PCalcSupplierData {
  name: string;
  isWinner: boolean;
  markupPct: number;
}

export function generateSpreadUnitPrices(
  basePrices: number[],
  markupPct: number,
  roundToStep: number = 5
): number[] {
  return basePrices.map((p) => {
    if (p <= 0) return 0;
    const marked = p * (1 + markupPct / 100);
    if (roundToStep > 0 && marked >= 50) {
      // Natural procurement rounding (e.g. nearest 5 or 10 ETB)
      return Math.round(marked / roundToStep) * roundToStep;
    }
    return Number(marked.toFixed(2));
  });
}

export function analyzeBiddingSpread(
  suppliers: Array<{ name: string; total: number; isWinner: boolean }>
) {
  if (!suppliers || suppliers.length === 0) {
    return {
      lowestIndex: -1,
      lowestTotal: 0,
      winnerIndex: -1,
      winnerIsLowest: false,
      advice: 'No supplier proformas available to analyze.',
      status: 'neutral' as const,
      deltas: [],
    };
  }

  let lowestIndex = 0;
  let lowestTotal = suppliers[0].total;
  let winnerIndex = 0;

  suppliers.forEach((s, idx) => {
    if (s.isWinner) winnerIndex = idx;
    if (s.total < lowestTotal) {
      lowestTotal = s.total;
      lowestIndex = idx;
    }
  });

  const winner = suppliers[winnerIndex];
  const winnerIsLowest = winnerIndex === lowestIndex;

  const deltas = suppliers.map((s, idx) => {
    const diff = s.total - lowestTotal;
    const pct = lowestTotal > 0 ? (diff / lowestTotal) * 100 : 0;
    return {
      index: idx,
      name: s.name,
      total: s.total,
      diff,
      pct: Number(pct.toFixed(1)),
      isWinner: idx === winnerIndex,
      isLowest: idx === lowestIndex,
    };
  });

  const nonLowestDeltas = deltas.filter((d) => !d.isLowest && d.total > 0);
  const minSpreadPct = nonLowestDeltas.length > 0 ? Math.min(...nonLowestDeltas.map((d) => d.pct)) : 0;
  const maxSpreadPct = nonLowestDeltas.length > 0 ? Math.max(...nonLowestDeltas.map((d) => d.pct)) : 0;

  let status: 'optimal' | 'too_close' | 'too_wide' | 'winner_not_lowest' = 'optimal';
  let advice = '';

  if (!winnerIsLowest) {
    status = 'winner_not_lowest';
    const lowestName = suppliers[lowestIndex].name || `Supplier ${lowestIndex + 1}`;
    advice = `Target winner "${winner.name}" is NOT the lowest bid (${winner.total.toLocaleString()} vs ${lowestName} at ${lowestTotal.toLocaleString()}). Adjust unit prices or change winner so your target proforma takes the lowest bid.`;
  } else if (nonLowestDeltas.length > 0 && minSpreadPct < 2.0) {
    status = 'too_close';
    advice = `Competitor bids are extremely close to the winning bid (only +${minSpreadPct}%). Procurement evaluation committees may flag this as coordinated bidding. We recommend spreading anchor bids by at least +5% to +10%.`;
  } else if (nonLowestDeltas.length > 0 && maxSpreadPct > 35.0) {
    status = 'too_wide';
    advice = `Highest competitor bid is +${maxSpreadPct}% above the winning bid. A gap wider than 30% risks having the high quote rejected by committee auditors as non-responsive. We recommend capping spreads around +15% to +25%.`;
  } else {
    status = 'optimal';
    const spreadSummary = nonLowestDeltas.map((d) => `+${d.pct}% (${d.diff.toLocaleString()} ETB)`).join(' and ');
    advice = `Optimal bidding strategy: "${winner.name}" is the lowest qualifying bid at ${winner.total.toLocaleString()} ETB. Competitors are spaced at ${spreadSummary}. This realistic spread passes institutional procurement evaluation without suspicion.`;
  }

  return {
    lowestIndex,
    lowestTotal,
    winnerIndex,
    winnerIsLowest,
    status,
    advice,
    deltas,
  };
}

export interface LayerState {
  enabled: boolean;
  name: string;
  price: string | number;
  style: 'pinch' | 'roflet' | 'stamp';
  fullness: number;
  roll: number;
  method: 'auto' | 'railroad';
  top: number;
  bottom: number;
  join: number;
  minTop: number;
  minBottom: number;
  minJoin: number;
  sewingOverride: string | number;
  pvcOverride: string | number;
  pvc: 'rail' | 'tunnel';
  railApproved: boolean;
  fitApproved: boolean;
  fabricGroup: string;
  autoHem: boolean;
  railActual: string | number;
  railSide: number;
  railSeam: number;
  railJoin: boolean;
  key?: 'outer' | 'inner';
}

export interface WindowState {
  id: string;
  label: string;
  width: string | number;
  height: string | number;
  quantity: number;
  preset: 'normal' | 'stamp' | 'custom';
  panelMode: 'auto' | 'manual';
  manualPanels: number;
  accessoryMode: 'auto' | 'manual';
  manualBelts: string | number;
  manualHooks: string | number;
  manualClip: string | number;
  includeHandyman: boolean;
  ratesConfirmed: boolean;
  outer: LayerState;
  inner: LayerState;
}

export function panelCount(w: WindowState): number {
  if (w.panelMode === 'manual') {
    const p = Math.round(Number(w.manualPanels));
    return Math.max(1, Math.min(20, isNaN(p) ? 2 : p));
  }
  const width = Number(w.width);
  if (isNaN(width) || width <= 0) return 2;
  return width < 2 ? 1 : 2;
}

export function fullness(l: LayerState): number {
  if (l.style === 'stamp') return 2.5;
  return l.fullness === 3.0 ? 3.0 : 2.5;
}

export function calculateAccessories(w: WindowState, shop: ShopRates) {
  const width = Number(w.width) || 0;
  const n = panelCount(w);
  let beltsQty = 0;
  let hooksQty = 0;
  let clipQty = 0;

  if (w.accessoryMode === 'manual' || n > 3) {
    beltsQty = Math.max(0, Number(w.manualBelts) || 0);
    hooksQty = Math.max(0, Number(w.manualHooks) || 0);
    clipQty = Math.max(0, Number(w.manualClip) || 0);
  } else {
    if (width > 0) {
      if (n === 1) {
        beltsQty = 0;
        hooksQty = 0;
        clipQty = 1;
      } else if (n === 2) {
        beltsQty = 1;
        hooksQty = 1;
        clipQty = 0;
      } else if (n === 3) {
        beltsQty = 1;
        hooksQty = 1;
        clipQty = 1;
      }
    } else {
      beltsQty = 0;
      hooksQty = 0;
      clipQty = 0;
    }
  }

  const belts = beltsQty * (shop.belts || 0);
  const hooks = hooksQty * (shop.hooks || 0);
  const clip = clipQty * (shop.clip || 0);
  const handymanQty = (w.includeHandyman && (width > 0 || w.accessoryMode === 'manual')) ? 1 : 0;
  const handyman = handymanQty * (shop.handyman || 0);

  return {
    beltsQty,
    hooksQty,
    clipQty,
    handymanQty,
    belts,
    hooks,
    clip,
    handyman,
    total: belts + hooks + clip + handyman,
  };
}

export function stripPlan(base: number, roll: number, strip: number, n: number) {
  if (!(strip > 0) || strip > roll + EPS) {
    return { ok: false, stripsPerPiece: 0, count: 0, extra: 0, batches: [] };
  }
  const panelWidth = base / n;
  const stripsPerPiece = Math.max(1, Math.min(n, Math.floor((roll + EPS) / strip)));
  const count = Math.ceil(n / stripsPerPiece);
  const batches = [];
  let remainingPanels = n;
  for (let i = 0; i < count; i++) {
    const used = Math.min(remainingPanels, stripsPerPiece);
    remainingPanels -= used;
    batches.push({
      pieceIndex: i + 1,
      used,
      stripHeight: strip,
      leftoverHeight: Math.max(0, roll - used * strip),
    });
  }
  const extra = count * panelWidth;
  return { ok: true, stripsPerPiece, count, extra, batches };
}

export function railroadPlan(w: WindowState, l: LayerState) {
  const width = Number(w.width) || 0;
  const height = Number(w.height) || 0;
  const f = fullness(l);
  const roll = Number(l.roll) || 2.8;
  const n = panelCount(w);
  const flat = width * f;
  const panelWidth = n > 0 ? flat / n : 0;
  const side = (Number(l.railSide) || 0) / 100;
  const seam = (Number(l.railSeam) || 0) / 100;
  const top = (Number(l.top) || 0) / 100;
  const bottom = (Number(l.bottom) || 0) / 100;
  const cutHeight = height + top + bottom;
  const usable = roll - 2 * side;
  const suggested = usable > 0 ? Math.ceil((flat - EPS) / usable) : null;
  const neededRoll = panelWidth + 2 * side;

  let piecesPerPanel = 1;
  let joins = 0;
  let seamlessFits = true;
  let blockingWarning: string | null = null;

  if (panelWidth <= usable + EPS) {
    piecesPerPanel = 1;
    joins = 0;
    seamlessFits = true;
  } else {
    seamlessFits = false;
    if (l.railJoin) {
      const incremental = roll - seam;
      if (incremental <= 0) {
        blockingWarning = 'Incremental roll width after seam allowance is non-positive.';
        piecesPerPanel = 1;
      } else {
        piecesPerPanel = 1 + Math.ceil((panelWidth - usable - EPS) / incremental);
        joins = n * Math.max(0, piecesPerPanel - 1);
      }
    } else {
      blockingWarning = `Seamless rotated panel of ${panelWidth.toFixed(2)}m does not fit usable roll height of ${usable.toFixed(2)}m. Choose more panels (${suggested || 3}), allow vertical joins, pick a taller roll, or switch to KETEL.`;
    }
  }

  const pieces = n * piecesPerPanel;
  const required = pieces * cutHeight;
  const formula = (width + 0.25) * f;

  return {
    flat,
    panelWidth,
    side,
    seam,
    cutHeight,
    usable,
    suggested,
    neededRoll,
    piecesPerPanel,
    pieces,
    joins,
    seamlessFits,
    required,
    formula,
    blockingWarning,
  };
}

export function hemProposal(w: WindowState, l: LayerState, isOuter: boolean = true) {
  const width = Number(w.width) || 0;
  const height = Number(w.height) || 0;
  const roll = Number(l.roll) || 2.8;
  const n = isOuter ? panelCount(w) : 2; // Inner KETEL always uses 2 strips (half-window rule)
  const f = fullness(l);
  const base = width * f;

  if (height <= roll + EPS) {
    return { ok: false, reason: 'Height already fits inside roll height' };
  }

  const gap = height - roll;
  const minB = Number(l.minBottom) / 100;
  const minT = Number(l.minTop) / 100;
  const minJ = Number(l.minJoin) / 100;
  const minSum = minB + minT + minJ;

  const currB = Number(l.bottom) / 100;
  const currT = Number(l.top) / 100;
  const currJ = Number(l.join) / 100;
  const currSum = currB + currT + currJ;
  const currStrip = gap + currSum;

  const currStripsPerPiece = Math.max(1, Math.min(n, Math.floor((roll + EPS) / currStrip)));
  const beforePlan = stripPlan(base, roll, currStrip, n);

  const maxK = Math.min(20, Math.floor((roll + EPS) / 0.15));
  let bestCandidate: any = null;

  // Search candidate k values that can improve stacking
  const candidatesK: number[] = [];
  if (n > currStripsPerPiece && !candidatesK.includes(n)) candidatesK.push(n);
  for (let k = currStripsPerPiece + 1; k <= Math.max(n * 4, currStripsPerPiece + 2); k++) {
    if (k <= maxK && !candidatesK.includes(k)) candidatesK.push(k);
  }
  candidatesK.sort((a, b) => b - a);

  for (const k of candidatesK) {
    const target = roll / k - gap;
    if (target < minSum - EPS) continue;
    if (target >= currSum - EPS) continue;

    let needCut = currSum - target;
    const cutB = Math.min(needCut, Math.max(0, currB - minB));
    needCut -= cutB;
    const cutT = Math.min(needCut, Math.max(0, currT - minT));
    needCut -= cutT;
    const cutJ = Math.min(needCut, Math.max(0, currJ - minJ));
    needCut -= cutJ;

    if (needCut > EPS) continue;

    const newB = currB - cutB;
    const newT = currT - cutT;
    const newJ = currJ - cutJ;
    const newStrip = gap + newB + newT + newJ;
    const afterPlan = stripPlan(base, roll, newStrip, n);

    const piecesSaved = beforePlan.count - afterPlan.count;
    const fitsMoreStrips = k > currStripsPerPiece;

    if (piecesSaved > 0 || fitsMoreStrips) {
      bestCandidate = {
        ok: true,
        gap,
        target,
        targetK: k,
        currStripsPerPiece,
        reductionCm: Number(((currSum - (newB + newT + newJ)) * 100).toFixed(1)),
        overflowCm: Number(((k * currStrip - roll) * 100).toFixed(1)),
        before: {
          strip: currStrip,
          bottomCm: Math.round(currB * 100),
          topCm: Math.round(currT * 100),
          joinCm: Math.round(currJ * 100),
          extra: beforePlan.extra,
          count: beforePlan.count,
        },
        after: {
          strip: newStrip,
          bottomCm: Math.round(newB * 100),
          topCm: Math.round(newT * 100),
          joinCm: Math.round(newJ * 100),
          extra: afterPlan.extra,
          count: afterPlan.count,
        },
        taken: {
          bottomCm: Number((cutB * 100).toFixed(1)),
          topCm: Number((cutT * 100).toFixed(1)),
          joinCm: Number((cutJ * 100).toFixed(1)),
        },
      };
      if (piecesSaved > 0) break;
    }
  }

  return bestCandidate || { ok: false, reason: 'No viable fold reduction found' };
}

export interface Demand {
  owner: string;
  key: 'outer' | 'inner';
  copy: number;
  panel: number;
  width: number;
  height: number;
  token: string;
  label: string;
}

export function packGroup(demands: Demand[], roll: number) {
  // Sort demands: b.width - a.width || b.height - a.height || a.token.localeCompare(b.token)
  const sorted = [...demands].sort(
    (a, b) => b.width - a.width || b.height - a.height || a.token.localeCompare(b.token)
  );

  interface Piece {
    id: number;
    width: number;
    roll: number;
    owner: string;
    key: 'outer' | 'inner';
    copy: number;
    cuts: Array<{
      owner: string;
      key: 'outer' | 'inner';
      copy: number;
      panel: number;
      label: string;
      token: string;
      x: number;
      y: number;
      width: number;
      height: number;
      isOwner: boolean;
    }>;
    free: Array<{ x: number; y: number; w: number; h: number }>;
  }

  const pieces: Piece[] = [];

  for (const d of sorted) {
    let bestPieceIdx = -1;
    let bestRectIdx = -1;
    let bestWaste = Infinity;

    for (let pIdx = 0; pIdx < pieces.length; pIdx++) {
      const piece = pieces[pIdx];
      for (let rIdx = 0; rIdx < piece.free.length; rIdx++) {
        const r = piece.free[rIdx];
        if (d.width <= r.w + EPS && d.height <= r.h + EPS) {
          const waste = r.w * r.h - d.width * d.height;
          if (waste < bestWaste) {
            bestWaste = waste;
            bestPieceIdx = pIdx;
            bestRectIdx = rIdx;
          }
        }
      }
    }

    if (bestPieceIdx >= 0) {
      const piece = pieces[bestPieceIdx];
      const r = piece.free.splice(bestRectIdx, 1)[0];
      const isOwner = piece.owner === d.owner && piece.key === d.key;
      piece.cuts.push({
        owner: d.owner,
        key: d.key,
        copy: d.copy,
        panel: d.panel,
        label: d.label,
        token: d.token,
        x: r.x,
        y: r.y,
        width: d.width,
        height: d.height,
        isOwner,
      });

      // Split using full-width horizontal shelf first:
      // Right remainder: { x: r.x + d.width, y: r.y, w: r.w - d.width, h: d.height }
      if (r.w - d.width > EPS) {
        piece.free.push({
          x: r.x + d.width,
          y: r.y,
          w: r.w - d.width,
          h: d.height,
        });
      }
      // Bottom full-width remainder: { x: r.x, y: r.y + d.height, w: r.w, h: r.h - d.height }
      if (r.h - d.height > EPS) {
        piece.free.push({
          x: r.x,
          y: r.y + d.height,
          w: r.w,
          h: r.h - d.height,
        });
      }
    } else {
      const pieceId = pieces.length + 1;
      const newPiece: Piece = {
        id: pieceId,
        width: d.width,
        roll,
        owner: d.owner,
        key: d.key,
        copy: d.copy,
        cuts: [
          {
            owner: d.owner,
            key: d.key,
            copy: d.copy,
            panel: d.panel,
            label: d.label,
            token: d.token,
            x: 0,
            y: 0,
            width: d.width,
            height: d.height,
            isOwner: true,
          },
        ],
        free: [],
      };
      if (newPiece.width - d.width > EPS) {
        newPiece.free.push({
          x: d.width,
          y: 0,
          w: newPiece.width - d.width,
          h: d.height,
        });
      }
      if (roll - d.height > EPS) {
        newPiece.free.push({
          x: 0,
          y: d.height,
          w: newPiece.width,
          h: roll - d.height,
        });
      }
      pieces.push(newPiece);
    }
  }

  let totalExtra = 0;
  const billedPerOwnerKey: Record<string, number> = {};

  for (const piece of pieces) {
    totalExtra += piece.width;
    const ok = `${piece.owner}:${piece.key}`;
    billedPerOwnerKey[ok] = (billedPerOwnerKey[ok] || 0) + piece.width;
  }

  return { pieces, extra: totalExtra, billedPerOwnerKey };
}
