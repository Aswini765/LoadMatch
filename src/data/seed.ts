// Demo data for LoadMatch. All company, party and vehicle names are fictional.
// Times are relative to the moment the demo was (re)set, so the story always reads as "today".

export const COMPANY = {
  name: 'Kaveri Wood Products',
  city: 'Mysuru',
  state: 'Karnataka',
  gstin: '29AAAAA0000A1Z5',
};

// Units of the same company. Each is a godown in Tally. Moves between them are internal (no customer,
// no sale). By default they share the company's GSTIN; the owner can set a different GSTIN per unit in
// Settings, which changes only the paperwork (a branch transfer invoice instead of stock journals).
export const UNITS: Record<string, { id: string; name: string; godown: string }> = {
  MYS: { id: 'MYS', name: 'Mysuru unit (plywood)', godown: 'Mysuru Unit' },
  BLR: { id: 'BLR', name: 'Bengaluru unit (boxes)', godown: 'Bengaluru Unit' },
};
// Tally godowns used for goods between units, damaged goods and losses
export const GODOWNS = { transit: 'Goods in Transit', damaged: 'Damaged Goods', loss: 'Transit Loss' };

export type Item = { code: string; name: string; unit: string; hsn: string; rate: number; gst: number };
export const ITEMS: Record<string, Item> = {
  'OKU-AB-91': { code: 'OKU-AB-91', name: 'Face veneer Okoume AB, 91 × 45.5 × 6 mm (bundle of 100)', unit: 'bundles', hsn: '4408', rate: 18500, gst: 18 },
  'OKU-DG-90': { code: 'OKU-DG-90', name: 'Face veneer Okoume D/G, 90 × 48 × 15 mm (bundle of 100)', unit: 'bundles', hsn: '4408', rate: 24000, gst: 18 },
  'BRP-1148': { code: 'BRP-1148', name: 'Face veneer Barpas, 1148 × 452 × 6 mm (bundle of 100)', unit: 'bundles', hsn: '4408', rate: 26500, gst: 18 },
  'BRP-1136': { code: 'BRP-1136', name: 'Face veneer Barpas, 1136 × 452 × 6 mm (bundle of 100)', unit: 'bundles', hsn: '4408', rate: 26000, gst: 18 },
  'PLY-12': { code: 'PLY-12', name: 'Plywood 12 mm, 8 × 4 ft (pack of 25)', unit: 'packs', hsn: '4412', rate: 36250, gst: 18 },
  'PLY-18': { code: 'PLY-18', name: 'Plywood 18 mm, 8 × 4 ft (pack of 25)', unit: 'packs', hsn: '4412', rate: 51250, gst: 18 },
  'BOX-RB': { code: 'BOX-RB', name: 'RB box, nailed, 600 × 400 × 400 mm (bundle of 50)', unit: 'bundles', hsn: '4415', rate: 19000, gst: 18 },
  'BOX-NL': { code: 'BOX-NL', name: 'Nail-less box, 800 × 600 × 500 mm (bundle of 50)', unit: 'bundles', hsn: '4415', rate: 21000, gst: 18 },
  'LOG-RW': { code: 'LOG-RW', name: 'Rubberwood logs, bundle', unit: 'bundles', hsn: '4403', rate: 48000, gst: 18 },
  'LOG-SIL': { code: 'LOG-SIL', name: 'Silver oak logs, bundle', unit: 'bundles', hsn: '4403', rate: 42000, gst: 18 },
};

export const PARTIES: Record<string, { id: string; name: string; kind: 'supplier' | 'customer' | 'jobworker'; city: string; state: string; gstin: string }> = {
  lakshmi: { id: 'lakshmi', name: 'Sri Lakshmi Timbers', kind: 'supplier', city: 'Hunsur', state: 'Karnataka', gstin: '29BBBBB1111B1Z2' },
  coastal: { id: 'coastal', name: 'Coastal Veneers', kind: 'supplier', city: 'Mangaluru', state: 'Karnataka', gstin: '29CCCCC2222C1Z9' },
  deccan: { id: 'deccan', name: 'Deccan Pumps Ltd', kind: 'customer', city: 'Hosur', state: 'Tamil Nadu', gstin: '33DDDDD3333D1Z4' },
  sunrise: { id: 'sunrise', name: 'Sunrise Ceramics', kind: 'customer', city: 'Bengaluru', state: 'Karnataka', gstin: '29EEEEE4444E1Z7' },
  // another company that processes your goods and sends them back (no sale)
  ganesh: { id: 'ganesh', name: 'Sri Ganesh Wood Finishers', kind: 'jobworker', city: 'Mandya', state: 'Karnataka', gstin: '29FFFFF5555F1Z3' },
};

export const LOADING_POINTS = ['Dock 1', 'Dock 2', 'Gate'];

const H = 3600000, M = 60000, D = 24 * H;

// Seed events, replayed through the same reducer as live actions, so their numbers obey the same rules.
export function makeSeed(anchor: number) {
  const at = (h: number, m = 0) => anchor + h * H + m * M;
  const ev: any[] = [];
  const tok = (n: number) => `demo${n}k`;

  // A month of routine transfers and deliveries that matched (for the reports)
  const routine = [
    { d: 28, flow: 'transfer', lines: [['OKU-AB-91', 180], ['BRP-1148', 210]] },
    { d: 26, flow: 'outbound', party: 'sunrise', lines: [['BOX-RB', 300]] },
    { d: 24, flow: 'inbound', party: 'coastal', lines: [['OKU-AB-91', 400]] },
    { d: 21, flow: 'transfer', lines: [['OKU-DG-90', 150], ['BRP-1136', 190]] },
    { d: 19, flow: 'outbound', party: 'deccan', lines: [['BOX-NL', 120]] },
    { d: 17, flow: 'transfer', lines: [['PLY-12', 60], ['PLY-18', 40]] },
    { d: 14, flow: 'inbound', party: 'lakshmi', lines: [['LOG-RW', 40]] },
    { d: 12, flow: 'transfer', lines: [['OKU-AB-91', 220], ['BRP-1148', 200]] },
    { d: 10, flow: 'outbound', party: 'sunrise', lines: [['BOX-RB', 250]] },
    { d: 7, flow: 'transfer', lines: [['OKU-DG-90', 120], ['PLY-12', 50]] },
    { d: 5, flow: 'inbound', party: 'coastal', lines: [['BRP-1136', 300]] },
    { d: 3, flow: 'outbound', party: 'deccan', lines: [['BOX-NL', 90]] },
  ];
  routine.forEach((r, i) => {
    const t0 = anchor - r.d * D - 6 * H;
    const id = `TRK-${String(1001 + i)}`;
    const base: any = { type: 'CREATE_SHIPMENT', id, flow: r.flow, at: t0, actor: r.flow === 'inbound' ? 'Gate (Mysuru)' : 'Dispatch staff', lines: r.lines.map(([item, qty]) => ({ item, qty })) };
    if (r.flow === 'transfer') Object.assign(base, { fromUnit: 'MYS', toUnit: 'BLR', truckNo: 'KA 09 B 4471', ref: `DC-${310 + i}` });
    if (r.flow === 'outbound') Object.assign(base, { fromUnit: 'BLR', party: r.party, truckNo: 'KA 05 M 8812', ref: `INV-${2480 + i}` });
    if (r.flow === 'inbound') Object.assign(base, { toUnit: 'MYS', party: r.party, truckNo: 'KA 12 T 0931', ref: `SB-${700 + i}` });
    ev.push(base);
    if (r.flow !== 'inbound') {
      ev.push({ type: 'LOADING', id, point: 'Dock 1', phase: 'start', at: t0 + 20 * M, actor: 'Dispatch staff' });
      ev.push({ type: 'LOADING', id, point: 'Dock 1', phase: 'end', at: t0 + 90 * M, actor: 'Dispatch staff' });
    }
    ev.push({ type: 'SEND_TO_RECEIVER', id, token: tok(i), at: t0 + 95 * M, actor: 'Dispatch staff' });
    ev.push({ type: 'SUBMIT_RECEIPT', id, token: tok(i), by: r.flow === 'outbound' ? 'Customer stores' : 'Stores', lines: Object.fromEntries(r.lines.map(([, qty], j) => [`L${j + 1}`, { counted: qty, damaged: 0 }])), at: t0 + 9 * H, actor: 'Receiver' });
  });
  // The owner already sent those entries to the accountant (transfers make two stock journals, supplier deliveries one receipt note)
  const routineDrafts = routine.reduce((n, r) => n + (r.flow === 'transfer' ? 2 : r.flow === 'inbound' ? 1 : 0), 0);
  // Job work: 200 plywood sheets sent for sanding 340 days ago; 150 came back. 50 are still with the job worker,
  // and inputs must come back within a year, so this shows as due soon.
  ev.push({ type: 'CREATE_SHIPMENT', id: 'TRK-1018', flow: 'jobwork_out', fromUnit: 'MYS', party: 'ganesh', truckNo: 'KA 11 B 2207', ref: 'JW-0107', at: anchor - 340 * D, actor: 'Dispatch staff', lines: [{ item: 'PLY-12', qty: 200 }] });
  ev.push({ type: 'LOADING', id: 'TRK-1018', point: 'Dock 1', phase: 'start', at: anchor - 340 * D + 20 * M, actor: 'Dispatch staff' });
  ev.push({ type: 'LOADING', id: 'TRK-1018', point: 'Dock 1', phase: 'end', at: anchor - 340 * D + 70 * M, actor: 'Dispatch staff' });
  ev.push({ type: 'SEND_TO_RECEIVER', id: 'TRK-1018', token: 'demo18k', at: anchor - 340 * D + 75 * M, actor: 'Dispatch staff' });
  ev.push({ type: 'SUBMIT_RECEIPT', id: 'TRK-1018', token: 'demo18k', by: 'Ganesh stores', at: anchor - 340 * D + 5 * H, actor: 'Receiver', lines: { L1: { counted: 200, damaged: 0 } } });
  ev.push({ type: 'CREATE_SHIPMENT', id: 'TRK-1019', flow: 'jobwork_in', parentId: 'TRK-1018', toUnit: 'MYS', party: 'ganesh', truckNo: 'KA 11 B 2207', ref: 'GW-0231', at: anchor - 200 * D, actor: 'Gate (Mysuru)', lines: [{ item: 'PLY-12', qty: 150 }] });
  ev.push({ type: 'SEND_TO_RECEIVER', id: 'TRK-1019', token: 'demo19k', at: anchor - 200 * D, actor: 'Gate (Mysuru)' });
  ev.push({ type: 'SUBMIT_RECEIPT', id: 'TRK-1019', token: 'demo19k', by: 'Gate (Mysuru)', at: anchor - 200 * D + 40 * M, actor: 'Receiver', lines: { L1: { counted: 150, damaged: 0 } } });
  const routineIds = Array.from({ length: routineDrafts + 2 }, (_, i) => `D-${String(i + 1).padStart(4, '0')}`);
  ev.push({ type: 'SEND_TO_ACCOUNTANT', ids: routineIds, at: anchor - 2 * D, actor: 'Owner' });
  // TRK-1021: Coastal Veneers sent 3 bundles less yesterday; the owner decided "supplier pays", so the accountant has a debit note to make
  ev.push({ type: 'CREATE_SHIPMENT', id: 'TRK-1021', flow: 'inbound', toUnit: 'MYS', party: 'coastal', truckNo: 'KA 19 D 4410', ref: 'SB-0947', at: anchor - 30 * H, actor: 'Owner', lines: [{ item: 'OKU-DG-90', qty: 60 }] });
  ev.push({ type: 'SEND_TO_RECEIVER', id: 'TRK-1021', token: 'demo21k', at: anchor - 30 * H, actor: 'Owner' });
  ev.push({ type: 'SUBMIT_RECEIPT', id: 'TRK-1021', token: 'demo21k', by: 'Ramesh', at: anchor - 28 * H, actor: 'Receiver', lines: { L1: { counted: 57, damaged: 0 } } });
  ev.push({ type: 'DECIDE', diffId: 'DIF-0001', action: 'debit_note', at: anchor - 27 * H, actor: 'Owner' });

  // TRK-1013: last night's transfer, like the dispatch list from the field visit. 5 short, 2 damaged.
  ev.push({ type: 'CREATE_SHIPMENT', id: 'TRK-1013', flow: 'transfer', fromUnit: 'MYS', toUnit: 'BLR', truckNo: 'KA 40 A 2541', ref: 'DC-0418', driver: 'Manjunath', driverPhone: '9845012345', at: at(-12), actor: 'Dispatch staff',
    lines: [{ item: 'OKU-DG-90', qty: 119 }, { item: 'OKU-AB-91', qty: 248 }, { item: 'BRP-1148', qty: 203 }, { item: 'BRP-1136', qty: 208 }] });
  ev.push({ type: 'LOADING', id: 'TRK-1013', point: 'Dock 2', phase: 'start', at: at(-11, -20), actor: 'Dispatch staff' });
  ev.push({ type: 'LOADING', id: 'TRK-1013', point: 'Dock 2', phase: 'end', at: at(-9, -5), actor: 'Dispatch staff' });
  ev.push({ type: 'SEND_TO_RECEIVER', id: 'TRK-1013', token: 'demo13k', at: at(-9), actor: 'Dispatch staff' });
  ev.push({ type: 'SUBMIT_RECEIPT', id: 'TRK-1013', token: 'demo13k', by: 'Ravi', at: at(-1, -30), actor: 'Receiver',
    lines: { L1: { counted: 119, damaged: 0 }, L2: { counted: 248, damaged: 0 }, L3: { counted: 198, damaged: 0 }, L4: { counted: 208, damaged: 0 } },
    photos: ['unloading-bay.jpg'], note: 'Barpas 1148 count is short.' });

  // TRK-1014: supplier delivery yesterday: 100 billed, 90 arrived; owner asked for replacement in the next batch
  ev.push({ type: 'CREATE_SHIPMENT', id: 'TRK-1014', flow: 'inbound', toUnit: 'MYS', party: 'lakshmi', truckNo: 'KA 45 C 7720', ref: 'SB-0951', at: at(-26), actor: 'Gate (Mysuru)', lines: [{ item: 'LOG-RW', qty: 100 }] });
  ev.push({ type: 'SEND_TO_RECEIVER', id: 'TRK-1014', token: 'demo14k', at: at(-26), actor: 'Gate (Mysuru)' });
  ev.push({ type: 'SUBMIT_RECEIPT', id: 'TRK-1014', token: 'demo14k', by: 'Gate (Mysuru)', at: at(-25, -30), actor: 'Receiver', lines: { L1: { counted: 90, damaged: 0 } } });
  ev.push({ type: 'DECIDE', diffId: 'DIF-0003', action: 'replace', dueAt: at(-3), note: 'Supplier will send 10 bundles with the next load.', at: at(-24), actor: 'Owner' });

  // TRK-1015: customer dispatch this morning, customer reports 3 extra boxes
  ev.push({ type: 'CREATE_SHIPMENT', id: 'TRK-1015', flow: 'outbound', fromUnit: 'BLR', party: 'sunrise', truckNo: 'KA 05 M 8812', ref: 'INV-2519', at: at(-6), actor: 'Dispatch staff', lines: [{ item: 'BOX-RB', qty: 300 }] });
  ev.push({ type: 'LOADING', id: 'TRK-1015', point: 'Dock 1', phase: 'start', at: at(-5, -40), actor: 'Dispatch staff' });
  ev.push({ type: 'LOADING', id: 'TRK-1015', point: 'Dock 1', phase: 'end', at: at(-5, -5), actor: 'Dispatch staff' });
  ev.push({ type: 'SEND_TO_RECEIVER', id: 'TRK-1015', token: 'demo15k', at: at(-5), actor: 'Dispatch staff' });
  ev.push({ type: 'SUBMIT_RECEIPT', id: 'TRK-1015', token: 'demo15k', by: 'Sunrise stores', at: at(-2), actor: 'Receiver', lines: { L1: { counted: 303, damaged: 0 } } });

  // TRK-1022: yesterday's transfer came 6 sheets short; the owner asked Mysuru and they replied "left here, next truck"
  ev.push({ type: 'CREATE_SHIPMENT', id: 'TRK-1022', flow: 'transfer', fromUnit: 'MYS', toUnit: 'BLR', truckNo: 'KA 09 B 5512', ref: 'DC-0417', driver: 'Prakash', driverPhone: '9886054321', at: at(-20), actor: 'Ramesh (staff)', lines: [{ item: 'PLY-18', qty: 60 }, { item: 'PLY-12', qty: 40 }] });
  ev.push({ type: 'LOADING', id: 'TRK-1022', point: 'Dock 1', phase: 'start', at: at(-20, 10), actor: 'Ramesh (staff)' });
  ev.push({ type: 'LOADING', id: 'TRK-1022', point: 'Dock 1', phase: 'end', at: at(-19, -10), actor: 'Ramesh (staff)' });
  ev.push({ type: 'SEND_TO_RECEIVER', id: 'TRK-1022', token: 'demo22k', at: at(-19), actor: 'Ramesh (staff)' });
  ev.push({ type: 'SUBMIT_RECEIPT', id: 'TRK-1022', token: 'demo22k', by: 'Ravi', at: at(-14), actor: 'Receiver', lines: { L1: { counted: 54, damaged: 0 }, L2: { counted: 40, damaged: 0 } }, photos: ['stack.jpg'] });
  ev.push({ type: 'ASK_SENDER', id: 'TRK-1022', token: 'ask22k', at: at(-13), actor: 'Owner' });
  ev.push({ type: 'SENDER_REPLY', id: 'TRK-1022', kind: 'send_next', by: 'Ramesh', at: at(-2), actor: 'Ramesh (staff)' });

  // TRK-1016: transfer that left 3 hours ago, still on the road
  ev.push({ type: 'CREATE_SHIPMENT', id: 'TRK-1016', parentId: 'TRK-1014', flow: 'transfer', fromUnit: 'MYS', toUnit: 'BLR', truckNo: 'KA 09 B 4471', ref: 'DC-0419', driver: 'Prakash', driverPhone: '9886054321', at: at(-4), actor: 'Dispatch staff', lines: [{ item: 'PLY-12', qty: 80 }, { item: 'PLY-18', qty: 45 }] });
  ev.push({ type: 'LOADING', id: 'TRK-1016', point: 'Dock 1', phase: 'start', at: at(-3, -50), actor: 'Dispatch staff' });
  ev.push({ type: 'LOADING', id: 'TRK-1016', point: 'Dock 1', phase: 'end', at: at(-3, -10), actor: 'Dispatch staff' });
  ev.push({ type: 'SEND_TO_RECEIVER', id: 'TRK-1016', token: 'demo16k', at: at(-3), actor: 'Dispatch staff' });
  // Ravi at Bengaluru asked the owner to add an item that is not in the list yet
  ev.push({ type: 'ASK_ADD', what: 'item', name: 'Teak veneer 6 mm', by: 'Ravi (staff)', at: at(-1), actor: 'Ravi (staff)' });

  // TRK-1020: the owner ordered veneer from Coastal Veneers; expected at Mysuru today. The store marks it arrived and counts it.
  ev.push({ type: 'CREATE_SHIPMENT', id: 'TRK-1020', flow: 'inbound', toUnit: 'MYS', party: 'coastal', truckNo: 'KA 19 D 6630', ref: 'PO-0332', expectedOn: at(0), at: at(-20), actor: 'Owner', lines: [{ item: 'OKU-AB-91', qty: 200 }, { item: 'BRP-1136', qty: 150 }] });
  ev.push({ type: 'SEND_TO_RECEIVER', id: 'TRK-1020', token: 'demo20k', at: at(-20), actor: 'Owner' });

  // TRK-1017: customer dispatch being loaded now
  ev.push({ type: 'CREATE_SHIPMENT', id: 'TRK-1017', flow: 'outbound', fromUnit: 'BLR', party: 'deccan', truckNo: 'TN 70 K 3390', ref: 'INV-2520', driver: 'Selvam', driverPhone: '9443067890', ewayBill: '3410 2251 7788', at: at(0, -30), actor: 'Dispatch staff', lines: [{ item: 'BOX-NL', qty: 150 }, { item: 'BOX-RB', qty: 60 }] });

  return ev;
}

export const DEFAULT_SETTINGS = {
  // losses above this value need an explicit confirmation from the owner
  writeOffLimit: 200000,
  // a truck not confirmed within this many hours shows as overdue
  receiptHours: 24,
  languages: { en: true, hi: true, kn: true, te: true },
  // true = the receiver counts without seeing the sent quantity. Off by default: the store sees what was sent and
  // the app shows what is missing as they count (the owner can turn blind counting on in Settings).
  blindCount: false,
  // who hears about a difference: 'owner_sender' (owner and the sending staff) or 'owner' (owner only)
  differencesTo: 'owner', // from the interview: the receiver reports to the owner, not to the sender (fraud worry)
  // GSTIN and state per unit (same as the company unless the owner changes it)
  units: {
    MYS: { gstin: '29AAAAA0000A1Z5', state: 'Karnataka' },
    BLR: { gstin: '29AAAAA0000A1Z5', state: 'Karnataka' },
  } as Record<string, { gstin: string; state: string }>,
};
