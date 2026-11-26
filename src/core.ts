// LoadMatch core: state, reducer and selectors. No React here, so the same code runs in the
// browser, in the shared-data replay (sync.ts) and in tests.
//
// A shipment (one truck) is listed by the sender, counted by the receiver through a link, and
// compared line by line. Each difference stays open until the owner settles it. Settled
// differences, and normal dispatches and receipts, become Tally drafts for the accountant.
import { COMPANY, UNITS, GODOWNS, ITEMS, PARTIES, DEFAULT_SETTINGS, makeSeed } from './data/seed.ts';
import { inr } from './lib/format.ts';

export const VERSION = 1;
const HOUR = 3600000;

export const FLOW_LABEL: Record<string, string> = {
  transfer: 'To our other unit',
  inbound: 'From a supplier',
  outbound: 'To a customer',
  jobwork_out: 'Sent for job work',
  jobwork_in: 'Back from job work',
};
// Loads that our own gate records when they arrive (no loading window at our end)
export const atGate = (flow: string) => flow === 'inbound' || flow === 'jobwork_in';
// Loads our own staff count (the rest are counted by the customer or the job worker through the link)
export const countedByUs = (s: any) => atGate(s.flow) || s.flow === 'transfer';
// Job work: goods sent to another company to process and bring back. Inputs must come back within a year.
export const JOBWORK_DAYS = 365;
const DAY = 24 * 3600000;
export const KIND_LABEL: Record<string, string> = { short: 'Missing', excess: 'Extra', damaged: 'Damaged' };
// How a load is named on screens and in messages: "Load 1013"
export const loadName = (id: string) => `Load ${String(id).replace(/^TRK-/, '')}`;

// What the owner can do with a difference. due = stays open until a date; settles = closed at once;
// loss = the business absorbs the value (needs an explicit confirmation above the limit).
export const ACTIONS: Record<string, { label: string; due?: boolean; settles?: boolean; loss?: boolean; draft?: string }> = {
  write_off: { label: 'Lost for good: write it off', settles: true, loss: true, draft: 'Stock journal to Transit Loss' },
  // between our own units the goods are usually not lost: left at the sender, or the transporter pays
  unit_sends_rest: { label: 'Left behind: sending unit sends it in the next truck', due: true },
  correct_list: { label: 'Our list was wrong: they really got the extra', settles: true, draft: 'Stock journal between units' },
  replace: { label: 'Supplier sends it in the next load', due: true },
  adjust_next_bill: { label: 'Adjust it in the next bill', settles: true, draft: 'Debit or credit note, to adjust in the next bill' },
  debit_note: { label: 'Supplier pays for it (accountant makes a debit note)', settles: true, draft: 'Debit note' },
  accept: { label: 'We take the loss', settles: true, loss: true },
  keep_extra: { label: 'Keep the extra; we pay for it', settles: true },
  return_extra: { label: 'Send the extra back to the supplier', due: true },
  send_rest: { label: 'We send the missing goods', due: true },
  send_replacement: { label: 'We send replacements', due: true },
  credit_note: { label: 'Customer pays less (accountant makes a credit note)', settles: true, loss: true, draft: 'Credit note' },
  bill_extra: { label: 'Customer pays for the extra (accountant bills it)', settles: true, draft: 'Sales invoice' },
  customer_returns: { label: 'Customer sends the extra back', due: true },
  jobworker_sends_rest: { label: 'Job worker sends the rest', due: true },
  jobworker_replaces: { label: 'Job worker replaces the damaged ones', due: true },
  keep_returned: { label: 'They sent back more: add it to our stock', settles: true, draft: 'Stock journal from the job worker' },
  investigate: { label: 'Check first' },
  claim: { label: 'Claim from the transporter or insurance', due: true },
};
export const OPTIONS: Record<string, Record<string, string[]>> = {
  transfer: { short: ['unit_sends_rest', 'claim', 'investigate', 'write_off'], damaged: ['claim', 'investigate', 'write_off'], excess: ['correct_list', 'investigate'] },
  inbound: { short: ['replace', 'debit_note', 'investigate'], damaged: ['replace', 'debit_note', 'investigate'], excess: ['keep_extra', 'return_extra', 'investigate'] },
  outbound: { short: ['send_rest', 'credit_note', 'investigate'], damaged: ['send_replacement', 'credit_note', 'investigate'], excess: ['bill_extra', 'customer_returns', 'investigate'] },
  jobwork_out: { short: ['write_off', 'investigate'], damaged: ['write_off', 'investigate'], excess: ['correct_list', 'investigate'] },
  jobwork_in: { short: ['jobworker_sends_rest', 'write_off', 'investigate'], damaged: ['jobworker_replaces', 'write_off', 'investigate'], excess: ['keep_returned', 'investigate'] },
};

// What the owner can choose for one difference. After an accident on the way: claim, take the loss, or check first.
export const optionsFor = (s: any, d: any): string[] => (d.cause === 'accident' ? ['claim', 'write_off', 'investigate'] : OPTIONS[s.flow][d.kind]);

export const DRAFT_LABEL: Record<string, string> = {
  stock_journal: 'Stock Journal',
  branch_invoice: 'Branch Transfer Invoice',
  receipt_note: 'Receipt Note',
  debit_note: 'Debit Note',
  credit_note: 'Credit Note',
  sales_invoice: 'Sales Invoice',
  match_note: 'Note on the first bill',
};

export const DRAFT_PLAIN: Record<string, string> = {
  stock_journal: 'Stock moved',
  branch_invoice: 'Bill to our other unit',
  receipt_note: 'Goods received',
  debit_note: 'Supplier to be paid less',
  credit_note: 'Customer to be charged less',
  sales_invoice: 'Extra charged to the customer',
  match_note: 'Late goods came: note it on the first bill',
};

export const item = (code: string) => ITEMS[code];
export const party = (id: string) => PARTIES[id];
export const unit = (id: string) => UNITS[id];
export const shipmentOf = (state: any, id: string) => state.shipments.find((s: any) => s.id === id);
export const diffOf = (state: any, id: string) => state.diffs.find((d: any) => d.id === id);
export const diffsOf = (state: any, shipmentId: string) => state.diffs.filter((d: any) => d.shipmentId === shipmentId);
export const lineOf = (s: any, lineId: string) => s.lines.find((l: any) => l.id === lineId);

// "Mysuru unit → Bengaluru unit", "Sri Lakshmi Timbers → Mysuru unit", "Bengaluru unit → Deccan Pumps Ltd"
export function route(s: any) {
  if (s.flow === 'transfer') return `${UNITS[s.fromUnit].name.split(' (')[0]} → ${UNITS[s.toUnit].name.split(' (')[0]}`;
  if (s.flow === 'inbound' || s.flow === 'jobwork_in') return `${PARTIES[s.party].name} → ${UNITS[s.toUnit].name.split(' (')[0]}`;
  return `${UNITS[s.fromUnit].name.split(' (')[0]} → ${PARTIES[s.party].name}`;
}

export function shipmentStatus(state: any, s: any) {
  if (s.cancelledAt) return 'CANCELLED';
  if (!s.sentAt) return 'LOADING';
  if (!s.receipt) return 'IN_TRANSIT';
  const ds = diffsOf(state, s.id);
  if (!ds.length) return 'MATCHED';
  if (ds.some((d: any) => d.status === 'open' || d.status === 'investigating')) return 'TO_DECIDE';
  if (ds.some((d: any) => d.status === 'waiting')) return 'WAITING';
  return 'SETTLED';
}
export const STATUS_META: Record<string, { label: string; cls: string }> = {
  LOADING: { label: 'Loading', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  IN_TRANSIT: { label: 'On the way', cls: 'bg-sky-50 text-sky-800 border-sky-200' },
  MATCHED: { label: 'All matched', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  TO_DECIDE: { label: 'Needs your decision', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  WAITING: { label: 'Promise pending', cls: 'bg-violet-50 text-violet-800 border-violet-200' },
  SETTLED: { label: 'Closed', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};
export const receiptOverdue = (state: any, s: any, now = Date.now()) => Boolean(s.sentAt && !s.receipt && !s.cancelledAt && now - s.sentAt > state.settings.receiptHours * HOUR);
export const diffOverdue = (d: any, now = Date.now()) => d.status === 'waiting' && d.decision?.dueAt && now > d.decision.dueAt;
export const lossValue = (d: any) => (d.decision && ACTIONS[d.decision.action]?.loss ? d.value : 0);

// What is still with the job worker for one job work load: sent − came back − written off, per item
export function jobworkBalance(state: any, out: any) {
  const back = state.shipments.filter((x: any) => x.flow === 'jobwork_in' && x.parentId === out.id && x.receipt);
  return out.lines.map((l: any) => {
    const returned = back.reduce((a: number, b: any) => a + b.lines.filter((x: any) => x.item === l.item).reduce((q: number, x: any) => q + (b.receipt.lines[x.id]?.counted || 0), 0), 0);
    // written off while with the job worker: damaged on arrival there, or short on a return. (A shortage found
    // when the job worker counted on arrival never reached them, so it is already out of "arrived".)
    const lost = state.diffs.filter((d: any) => d.item === l.item && d.decision?.action === 'write_off'
      && ((d.shipmentId === out.id && d.kind === 'damaged') || (d.kind === 'short' && back.some((b: any) => b.id === d.shipmentId)))).reduce((a: number, d: any) => a + d.qty, 0);
    // what the job worker counted on arrival is what they hold; before they count, the list quantity
    const arrived = out.receipt ? out.receipt.lines[l.id].counted : l.qty;
    return { item: l.item, sent: l.qty, arrived, returned, lost, pending: Math.max(0, arrived - returned - lost) };
  });
}
export const jobworkDueAt = (out: any) => (out.sentAt || out.createdAt) + JOBWORK_DAYS * DAY;
export const jobworkOpen = (state: any) => state.shipments.filter((s: any) => s.flow === 'jobwork_out' && s.sentAt && !s.cancelledAt && jobworkBalance(state, s).some((b: any) => b.pending > 0));

// Loads linked by "made from": the earlier load this one came from, and loads made from this one
export const parentOf = (state: any, s: any) => (s.parentId ? shipmentOf(state, s.parentId) : null);
export const childrenOf = (state: any, s: any) => state.shipments.filter((x: any) => x.parentId === s.id && !x.cancelledAt);

// The receiver's link: opens one truck, no login
// Until the shared database is on, each phone keeps its own records. So the link itself carries the load
// (items and quantities, as codes), and the receiver's count comes back to the sender the same way.
const toB64 = (v: any) => { const b = new TextEncoder().encode(JSON.stringify(v)); let s = ''; b.forEach((x) => { s += String.fromCharCode(x); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const fromB64 = (p: string) => { try { const s = atob(p.replace(/-/g, '+').replace(/_/g, '/')); return JSON.parse(new TextDecoder().decode(Uint8Array.from(s, (ch) => ch.charCodeAt(0)))); } catch { return null; } };
export const packLoad = (s: any, settings: any = {}) => toB64({ f: s.flow, fu: s.fromUnit, tu: s.toUnit, p: s.party, tn: s.truckNo, r: s.ref, d: s.driver || '', dp: s.driverPhone || '', s: s.sentAt, l: s.lines.map((l: any) => [l.item, l.qty]), bl: settings.blindCount ? 1 : 0, dt: settings.differencesTo || 'all' });
// The load as the receiver's phone sees it, rebuilt from the link. null if the link is damaged.
export function unpackLoad(id: string, token: string, payload: string) {
  const v = fromB64(payload || '');
  if (!v || !FLOW_LABEL[v.f] || !Array.isArray(v.l) || !v.l.length || !v.l.every((x: any) => ITEMS[x[0]] && Number.isInteger(x[1]) && x[1] > 0)) return null;
  if ((v.fu && !UNITS[v.fu]) || (v.tu && !UNITS[v.tu]) || (v.p && !PARTIES[v.p])) return null;
  return {
    shipment: { id, flow: v.f, fromUnit: v.fu || null, toUnit: v.tu || null, party: v.p || null, truckNo: String(v.tn || ''), ref: String(v.r || ''), driver: String(v.d || ''), driverPhone: String(v.dp || ''),
      lines: v.l.map((x: any, i: number) => ({ id: `L${i + 1}`, item: x[0], qty: x[1] })), createdAt: v.s, sentAt: v.s || Date.now(), token, receipt: null, cancelledAt: null, loading: null, docs: [], audit: [], fulfils: [], parentId: null, billing: 'none', remote: true },
    settings: { blindCount: Boolean(v.bl), differencesTo: v.dt === 'owner' ? 'owner' : 'all' },
  };
}
export const packCount = (r: { by: string; note?: string; at: number; lines: Record<string, { counted: number; damaged: number }> }) => toB64({ b: r.by, n: r.note || '', a: r.at, l: Object.fromEntries(Object.entries(r.lines).map(([k, x]) => [k, [x.counted, x.damaged]])) });
export function unpackCount(payload: string) {
  const v = fromB64(payload || '');
  if (!v || !String(v.b || '').trim() || !v.l || typeof v.l !== 'object') return null;
  return { by: String(v.b), note: String(v.n || ''), at: Number(v.a) || Date.now(), lines: Object.fromEntries(Object.entries(v.l).map(([k, x]: any) => [k, { counted: Number(x[0]), damaged: Number(x[1]) }])) };
}
export const receiverPath = (s: any, settings?: any) => `#/r/${s.id}/${s.token}/${packLoad(s, settings)}`;
export const countBackPath = (s: any, r: any) => `#/c/${s.id}/${s.token}/${packCount(r)}`;
export const evidencePath = (d: any) => `#/e/${d.id}/${d.evidenceToken}`;

// One WhatsApp-ready summary per truck for the owner
export function truckSummary(state: any, s: any) {
  const ds = diffsOf(state, s.id);
  const head = `${loadName(s.id)} · ${s.truckNo} · ${route(s)}`;
  if (!s.receipt) return `${head}\nWaiting for the receiver's count.`;
  if (!ds.length) return `${head}\nAll ${s.lines.length} lines matched ✓ (counted by ${s.receipt.by})`;
  const lines = ds.map((d: any) => `• ${ITEMS[d.item].name}: ${KIND_LABEL[d.kind].toLowerCase()} ${d.qty} ${ITEMS[d.item].unit} (${inr(d.value, 0)})`);
  return `${head}\n${ds.length} difference${ds.length > 1 ? 's' : ''}:\n${lines.join('\n')}`;
}

export function evidenceText(state: any, d: any) {
  const s = shipmentOf(state, d.shipmentId);
  const l = lineOf(s, d.lineId);
  const r = s.receipt.lines[d.lineId];
  const it = ITEMS[d.item];
  const parts = [
    `Proof: ${loadName(s.id)} · truck ${s.truckNo}${s.driver ? ` · driver ${s.driver}${s.driverPhone ? ` (${s.driverPhone})` : ''}` : ''}`,
    `${route(s)} · ${s.flow === 'outbound' ? 'invoice' : s.flow === 'inbound' ? 'bill' : 'challan'} ${s.ref}${s.ewayBill ? ` · e-way bill ${s.ewayBill}` : ''}`,
    `${it.name}: sent ${l.qty}, counted ${r.counted}${r.damaged ? `, damaged ${r.damaged}` : ''} → ${KIND_LABEL[d.kind].toLowerCase()} ${d.qty} ${it.unit}`,
  ];
  if (s.loading?.startAt) parts.push(`Loading: ${s.loading.point}, ${fmtTime(s.loading.startAt)}–${fmtTime(s.loading.endAt)} on ${fmtDate(s.loading.startAt)}`);
  parts.push(`Counted by ${s.receipt.by}, ${fmtDate(s.receipt.at)} ${fmtTime(s.receipt.at)}${s.receipt.photos?.length ? ` · ${s.receipt.photos.length} photo(s)` : ''}`);
  if (s.docs?.length) parts.push(`Papers: ${s.docs.map((x: any) => x.kind).join(', ')} (${s.docs.length} photo${s.docs.length > 1 ? 's' : ''})`);
  if (d.evidence.clips.length) parts.push(`Video: ${d.evidence.clips.map((c: any) => c.link || c.name).join(', ')}`);
  return parts.join('\n');
}
const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
const fmtDate = (ms: number) => new Date(ms).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

// ---------- helpers ----------
const pad = (n: number, w = 4) => String(n).padStart(w, '0');
const audit = (s: any, at: number, actor: string, type: string, detail: string) => ({ ...s, audit: [...s.audit, { at, actor, type, detail }] });
const putShipment = (state: any, s: any) => ({ ...state, shipments: state.shipments.map((x: any) => (x.id === s.id ? s : x)) });
const putDiff = (state: any, d: any) => ({ ...state, diffs: state.diffs.map((x: any) => (x.id === d.id ? d : x)) });
const isInt = (n: any) => Number.isInteger(n) && n >= 0;
const godownOf = (unitId: string) => UNITS[unitId].godown;
export const jobworkerGodown = (partyId: string) => `At job worker: ${PARTIES[partyId].name}`;
export const unitTax = (state: any, unitId: string) => state.settings.units?.[unitId] || { gstin: COMPANY.gstin, state: COMPANY.state };
// Two units are one registration unless the owner gave them different GSTINs (used to suggest the paperwork)
export const sameGstin = (state: any, a: string, b: string) => unitTax(state, a).gstin === unitTax(state, b).gstin;
// A unit as the "party" on a branch transfer voucher
export const isInvoiced = (s: any) => s.flow !== 'transfer' || s.billing === 'invoice';
const branchParty = (state: any, unitId: string) => ({ name: `Branch: ${UNITS[unitId].name.split(' (')[0]}`, gstin: unitTax(state, unitId).gstin, state: unitTax(state, unitId).state });

function addDraft(state: any, d: any) {
  const id = `D-${pad(state.counters.draft + 1)}`;
  return { ...state, counters: { ...state.counters, draft: state.counters.draft + 1 }, drafts: [...state.drafts, { ...d, id, status: 'pending' }] };
}
const priced = (code: string, qty: number) => ({ item: code, qty, rate: ITEMS[code].rate, gst: ITEMS[code].gst });

// Drafts made from a decision on a difference (null = nothing to enter in Tally)
function decisionDraft(state: any, s: any, d: any, action: string, at: number) {
  const it = ITEMS[d.item];
  const base = { createdAt: at, shipmentId: s.id, diffId: d.id, purpose: 'decision' };
  // Transfer sent with an invoice: the goods were invoiced to the receiving branch, so a loss is a credit note
  // from the sending branch and extra goods are invoiced too. Same flow, different paperwork.
  if (s.flow === 'transfer' && s.billing === 'invoice') {
    const branch = { partyInfo: branchParty(state, s.toUnit), fromState: unitTax(state, s.fromUnit).state, ref: s.ref, lines: [priced(d.item, d.qty)] };
    if (action === 'write_off') return { ...base, ...branch, type: 'credit_note', narration: `${s.id} (${s.ref}): ${d.qty} ${it.unit} ${it.name} ${d.kind === 'damaged' ? 'damaged' : 'lost'} on the way, ${route(s)}. Owner took the loss (against the branch bill).` };
    if (action === 'correct_list') return { ...base, ...branch, type: 'branch_invoice', narration: `${s.id} (${s.ref}): ${d.qty} ${it.unit} ${it.name} loaded but not on the list; invoiced to the branch as sent.` };
  }
  if (s.flow === 'jobwork_out' || s.flow === 'jobwork_in') {
    const jw = jobworkerGodown(s.party);
    if (action === 'write_off') return { ...base, type: 'stock_journal', moves: [{ item: d.item, qty: d.qty, from: s.flow === 'jobwork_in' && d.kind === 'damaged' ? GODOWNS.damaged : jw, to: GODOWNS.loss }], narration: `${s.id} (${s.ref}): ${d.qty} ${it.unit} ${it.name} ${d.kind === 'damaged' ? 'damaged' : 'lost'} on job work with ${PARTIES[s.party].name}. Owner took the loss.` };
    if (action === 'correct_list') return { ...base, type: 'stock_journal', moves: [{ item: d.item, qty: d.qty, from: godownOf(s.fromUnit), to: jw }], narration: `${s.id} (${s.ref}): ${d.qty} ${it.unit} ${it.name} loaded but not on the list; recorded as sent for job work.` };
    if (action === 'keep_returned') return { ...base, type: 'stock_journal', moves: [{ item: d.item, qty: d.qty, from: jw, to: godownOf(s.toUnit) }], narration: `${s.id} (${s.ref}): ${d.qty} ${it.unit} ${it.name} more than the job worker's challan; recorded as returned.` };
    return null;
  }
  if (action === 'write_off' && s.flow === 'transfer') {
    const from = d.kind === 'damaged' ? GODOWNS.damaged : GODOWNS.transit;
    return { ...base, type: 'stock_journal', moves: [{ item: d.item, qty: d.qty, from, to: GODOWNS.loss }], narration: `${s.id} (${s.ref}): ${d.qty} ${it.unit} ${it.name} ${d.kind === 'damaged' ? 'damaged' : 'lost'} on the way, ${route(s)}. Owner took the loss.` };
  }
  if (action === 'correct_list') {
    return { ...base, type: 'stock_journal', moves: [{ item: d.item, qty: d.qty, from: godownOf(s.fromUnit), to: godownOf(s.toUnit) }], narration: `${s.id} (${s.ref}): ${d.qty} ${it.unit} ${it.name} loaded but not on the list; recorded as sent.` };
  }
  if (action === 'adjust_next_bill' && s.flow === 'inbound') {
    return { ...base, type: 'debit_note', party: s.party, ref: s.ref, lines: [priced(d.item, d.qty)], narration: `${loadName(s.id)}: ${d.qty} ${it.unit} ${it.name} ${d.kind === 'damaged' ? 'received damaged' : 'not received'} against bill ${s.ref}. To be adjusted in the supplier's next bill.` };
  }
  if (action === 'adjust_next_bill' && s.flow === 'outbound') {
    return { ...base, type: 'credit_note', party: s.party, ref: s.ref, lines: [priced(d.item, d.qty)], narration: `${loadName(s.id)}: ${d.qty} ${it.unit} ${it.name} ${d.kind === 'damaged' ? 'received damaged' : 'short'} by the customer on invoice ${s.ref}. To be adjusted in the customer's next bill.` };
  }
  if (action === 'debit_note') {
    return { ...base, type: 'debit_note', party: s.party, ref: s.ref, lines: [priced(d.item, d.qty)], narration: `${s.id}: ${d.qty} ${it.unit} ${it.name} ${d.kind === 'damaged' ? 'received damaged' : 'not received'} against supplier bill ${s.ref}.` };
  }
  if (action === 'credit_note') {
    return { ...base, type: 'credit_note', party: s.party, ref: s.ref, lines: [priced(d.item, d.qty)], narration: `${s.id}: ${d.qty} ${it.unit} ${it.name} ${d.kind === 'damaged' ? 'received damaged' : 'short'} by the customer against invoice ${s.ref}.` };
  }
  if (action === 'bill_extra') {
    return { ...base, type: 'sales_invoice', party: s.party, ref: s.ref, lines: [priced(d.item, d.qty)], narration: `${s.id}: ${d.qty} ${it.unit} ${it.name} delivered over invoice ${s.ref}; billed as agreed with the customer.` };
  }
  return null;
}


// ---------- the company's own lists (owner adds; staff can ask) ----------
// Prototype: the lists live in the shared objects from seed.ts; anything added is removed again on Reset.
const ADDED: Array<[any, string]> = [];
function undoAdded() { while (ADDED.length) { const [o, k] = ADDED.pop()!; delete o[k]; } }
// Same check as the database: 15 characters, state code + PAN + entity no. + Z + check character
export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const gstinOk = (g: string) => !String(g || '').trim() || GSTIN_RE.test(String(g).trim().toUpperCase());
const slug = (t: string) => t.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 12) || 'X';
export function addMaster(state: any, what: string, d: any, at: number) {
  const name = String(d?.name || '').trim();
  if (!name || !gstinOk(d?.gstin)) return state;
  const n = (state.counters.add || 0) + 1;
  const counters = { ...state.counters, add: n };
  if (what === 'item') {
    if (Object.values(ITEMS).some((i: any) => i.name.toLowerCase() === name.toLowerCase())) return state;
    const code = `${slug(name)}-${n}`;
    ITEMS[code] = { code, name, unit: String(d.unit || 'pcs').trim() || 'pcs', hsn: String(d.hsn || ''), rate: Number(d.rate) || 0, gst: 18 };
    ADDED.push([ITEMS, code]);
  } else if (what === 'party') {
    if (Object.values(PARTIES).some((p: any) => p.name.toLowerCase() === name.toLowerCase())) return state;
    const id = `p${n}`;
    const kind = ['supplier', 'customer', 'jobworker'].includes(d.kind) ? d.kind : 'customer';
    PARTIES[id] = { id, name, kind, city: String(d.city || '').trim(), state: String(d.state || 'Karnataka'), gstin: String(d.gstin || '').trim().toUpperCase(), phone: String(d.phone || '').trim() } as any;
    ADDED.push([PARTIES, id]);
  } else if (what === 'unit') {
    const id = `U${n}`;
    UNITS[id] = { id, name, godown: name };
    ADDED.push([UNITS, id]);
    const gstin = String(d.gstin || '').trim().toUpperCase();
    if (gstin) return { ...state, counters, settings: { ...state.settings, units: { ...state.settings.units, [id]: { gstin, state: String(d.state || 'Karnataka') } } } };
  } else if (what === 'staff') {
    const unit = UNITS[d.unit] ? d.unit : 'MYS';
    return { ...state, counters, staff: [...(state.staff || []), { name, unit }] };
  } else return state;
  return { ...state, counters, addedLog: [...(state.addedLog || []), { at, what, name }] };
}

// ---------- ask the sender, read the reply, suggest one decision ----------
// The owner asks whoever loaded the truck what happened; their one-tap reply decides what the app suggests.
export const REPLIES: Record<string, { icon: string; label: string }> = {
  send_next: { icon: '📦', label: 'Left here. We will send it in the next truck' },
  sent_full: { icon: '✅', label: 'We loaded it all (loading photo)' },
  transporter: { icon: '🚚', label: 'Lost or broken on the road (transporter)' },
};
export const senderName = (s: any) => (s.flow === 'inbound' || s.flow === 'jobwork_in' ? PARTIES[s.party]?.name : UNITS[s.fromUnit]?.name.split(' (')[0]) || 'the sender';
// our own unit loaded it (it answers in the app); a supplier answers from a WhatsApp link
export const senderIsUs = (s: any) => !atGate(s.flow);
const SUGGEST: Record<string, Record<string, Record<string, string>>> = {
  transfer: { short: { send_next: 'unit_sends_rest', sent_full: 'claim', transporter: 'claim' }, damaged: { send_next: 'claim', sent_full: 'claim', transporter: 'claim' }, excess: { _: 'correct_list' } },
  inbound: { short: { send_next: 'replace', sent_full: 'investigate', transporter: 'debit_note' }, damaged: { send_next: 'replace', sent_full: 'investigate', transporter: 'debit_note' }, excess: { _: 'keep_extra' } },
  outbound: { short: { send_next: 'send_rest', sent_full: 'investigate', transporter: 'credit_note' }, damaged: { send_next: 'send_replacement', sent_full: 'investigate', transporter: 'credit_note' }, excess: { _: 'bill_extra' } },
};
export function suggestFor(s: any, d: any): string | null {
  const opts = optionsFor(s, d);
  const r = s.ask?.reply?.kind;
  const m = SUGGEST[s.flow]?.[d.kind];
  const a = d.cause === 'accident' ? 'claim' : m ? (m._ || (r ? m[r] : null)) : null;
  return a && opts.includes(a) && a !== 'investigate' ? a : null;
}
// the agent's check: a later truck on the same route brought the promised item
export function cameLater(state: any, d: any) {
  const s = shipmentOf(state, d.shipmentId);
  if (!s || !d.decision) return null;
  return state.shipments.find((x: any) => x.id !== s.id && x.receipt && x.receipt.at >= d.decision.at && x.flow === s.flow
    && (s.flow === 'transfer' ? x.fromUnit === s.fromUnit && x.toUnit === s.toUnit : x.party === s.party)
    && x.lines.some((l: any) => l.item === d.item)) || null;
}

// ---------- reducer ----------
export function reducer(state: any, action: any): any {
  const at = action.at || Date.now();
  const actor = action.actor || 'Owner';
  switch (action.type) {
    case 'RESET':
      return buildInitialState(at);

    case 'UPDATE_SETTINGS': {
      const changes = Object.entries(action.settings || {}).filter(([k, v]) => JSON.stringify(state.settings[k]) !== JSON.stringify(v));
      if (!changes.length) return state;
      return { ...state, settings: { ...state.settings, ...action.settings }, settingsLog: [...state.settingsLog, { at, actor, changes: Object.fromEntries(changes) }] };
    }

    case 'CREATE_SHIPMENT': {
      const flow = action.flow;
      if (!FLOW_LABEL[flow]) return state;
      const lines = (action.lines || []).filter((l: any) => ITEMS[l.item] && Number.isInteger(l.qty) && l.qty > 0);
      if (!lines.length || lines.length !== (action.lines || []).length) return state;
      if (!String(action.truckNo || '').trim() || !String(action.ref || '').trim()) return state;
      if (flow === 'transfer' && (!UNITS[action.fromUnit] || !UNITS[action.toUnit] || action.fromUnit === action.toUnit)) return state;
      if (flow === 'outbound' && (!UNITS[action.fromUnit] || PARTIES[action.party]?.kind !== 'customer')) return state;
      if (flow === 'inbound' && (!UNITS[action.toUnit] || PARTIES[action.party]?.kind !== 'supplier')) return state;
      if (flow === 'jobwork_out' && (!UNITS[action.fromUnit] || PARTIES[action.party]?.kind !== 'jobworker')) return state;
      if (flow === 'jobwork_in') {
        const out = shipmentOf(state, action.parentId);
        if (!UNITS[action.toUnit] || PARTIES[action.party]?.kind !== 'jobworker' || !out || out.flow !== 'jobwork_out' || out.party !== action.party) return state;
      }
      // "made from" link to an earlier load (optional, except a job work return must name what it returns)
      if (action.parentId && !shipmentOf(state, action.parentId)) return state;
      const n = state.counters.trk + 1;
      const id = action.id || `TRK-${1000 + n}`;
      if (shipmentOf(state, id)) return state;
      let s: any = {
        id, flow, fromUnit: action.fromUnit || null, toUnit: action.toUnit || null, party: action.party || null,
        truckNo: String(action.truckNo).trim().toUpperCase(), ref: String(action.ref).trim(),
        driver: String(action.driver || '').trim(), driverPhone: String(action.driverPhone || '').replace(/[^0-9+]/g, ''), ewayBill: String(action.ewayBill || '').trim(),
        lines: lines.map((l: any, i: number) => ({ id: `L${i + 1}`, item: l.item, qty: l.qty })),
        createdAt: at, createdBy: actor, loading: null, sentAt: null, token: null, receipt: null, cancelledAt: null, audit: [],
        // between own units the sender chooses: 'none' = stock transfer, no money; 'invoice' = branch invoice with GST.
        // Default follows the units' GSTINs as set by the owner.
        docs: (action.docs || []).filter((d: any) => d && d.id).map((d: any) => ({ id: d.id, name: String(d.name || 'photo'), kind: d.kind || 'document', by: actor, at })),
        parentId: action.parentId || null,
        // a supplier delivery the owner expects (from the order); the store marks it arrived and counts it
        expectedOn: action.expectedOn || null,
        // promises this load keeps (a supplier's replacement, goods we owe a customer, a job worker's balance)
        fulfils: (action.fulfils || []).filter((id: string) => { const d = diffOf(state, id); return d && d.status === 'waiting' && (action.lines || []).some((l: any) => l.item === d.item); }),
        billing: flow.startsWith('jobwork') ? 'none' : flow === 'transfer' ? (['none', 'invoice'].includes(action.billing) ? action.billing : (sameGstin(state, action.fromUnit, action.toUnit) ? 'none' : 'invoice')) : 'invoice',
      };
      s = audit(s, at, actor, 'LISTED', `${lines.length} line(s), ${lines.reduce((a: number, l: any) => a + l.qty, 0)} units, ${FLOW_LABEL[flow].toLowerCase()}, ref ${s.ref}.`);
      return { ...state, counters: { ...state.counters, trk: Math.max(state.counters.trk, Number(id.slice(4)) - 1000) }, shipments: [...state.shipments, s] };
    }

    // A photo of the challan, order, supplier bill or damage, added to a truck at any time
    case 'ATTACH_DOC': {
      const s = shipmentOf(state, action.id);
      const docs = (action.docs || []).filter((d: any) => d && d.id);
      if (!s || !docs.length || s.cancelledAt) return state;
      const add = docs.map((d: any) => ({ id: d.id, name: String(d.name || 'photo'), kind: d.kind || 'document', by: actor, at }));
      return putShipment(state, audit({ ...s, docs: [...(s.docs || []), ...add] }, at, actor, 'DOCUMENT', `${add.length} photo(s) added: ${add.map((d: any) => d.kind).join(', ')}.`));
    }

    case 'CANCEL_SHIPMENT': {
      const s = shipmentOf(state, action.id);
      if (!s || s.receipt || s.cancelledAt) return state;
      if (!s.sentAt) return putShipment(state, audit({ ...s, cancelledAt: at }, at, actor, 'CANCELLED', action.note || 'Cancelled before dispatch.'));
      // After it left: the truck came back or never reached. A reason is required; the dispatch entry is undone.
      const reason = String(action.note || '').trim();
      if (!reason) return state;
      let next = putShipment(state, audit({ ...s, cancelledAt: at, cameBack: true }, at, actor, 'CAME_BACK', `Truck came back / did not reach: ${reason}`));
      const disp = next.drafts.find((x: any) => x.shipmentId === s.id && x.purpose === 'dispatch' && x.status !== 'rejected');
      if (disp && disp.status === 'pending') {
        next = { ...next, drafts: next.drafts.map((x: any) => (x.id === disp.id ? { ...x, status: 'rejected', rejectedAt: at, rejectNote: `Truck came back: ${reason}` } : x)) };
      } else if (disp && disp.moves) {
        next = addDraft(next, { type: 'stock_journal', purpose: 'reversal', createdAt: at, shipmentId: s.id, moves: disp.moves.map((m: any) => ({ ...m, from: m.to, to: m.from })), narration: `${loadName(s.id)} (${s.ref}): truck came back, goods returned to stock. ${reason}` });
      } else if (disp && disp.type === 'branch_invoice') {
        next = addDraft(next, { type: 'credit_note', purpose: 'reversal', createdAt: at, shipmentId: s.id, partyInfo: disp.partyInfo, fromState: disp.fromState, ref: s.ref, lines: disp.lines, narration: `${loadName(s.id)} (${s.ref}): truck came back, branch bill cancelled. ${reason}` });
      }
      return next;
    }

    // The owner corrects a wrong count, before anything was decided or sent to the accountant.
    // The receiver's link opens again for a fresh count.
    // A customer or job worker counted our load: our owner agrees with their count or disputes it (like accepting
    // or rejecting an e-way bill). No answer in 72 hours counts as agreed.
    case 'RESPOND_COUNT': {
      const s = shipmentOf(state, action.id);
      if (!s || !s.receipt || countedByUs(s) || s.response || actor !== 'Owner') return state;
      const note = String(action.note || '').trim();
      if (!action.agree && !note) return state;
      return putShipment(state, audit({ ...s, response: { agree: !!action.agree, note, at } }, at, actor, action.agree ? 'COUNT_AGREED' : 'COUNT_DISPUTED', action.agree ? `We agree with ${s.receipt.by}'s count` : `We disagree with ${s.receipt.by}'s count: ${note}`));
    }

    case 'REOPEN_COUNT': {
      const s = shipmentOf(state, action.id);
      const reason = String(action.note || '').trim();
      if (!s || !s.receipt || s.cancelledAt || actor !== 'Owner' || !reason) return state;
      const ds = state.diffs.filter((d: any) => d.shipmentId === s.id);
      if (ds.some((d: any) => d.status !== 'open')) return state;
      const rec = state.drafts.filter((x: any) => x.shipmentId === s.id && x.purpose === 'receipt');
      if (rec.some((x: any) => x.status !== 'pending')) return state;
      if ((s.fulfils || []).some((id: string) => diffOf(state, id)?.history.some((h: any) => h.text.includes(loadName(s.id))))) return state;
      const recIds = new Set(rec.map((x: any) => x.id));
      let next = { ...state, diffs: state.diffs.filter((d: any) => d.shipmentId !== s.id), drafts: state.drafts.map((x: any) => (recIds.has(x.id) ? { ...x, status: 'rejected', rejectedAt: at, rejectNote: `Count reopened: ${reason}` } : x)) };
      return putShipment(next, audit({ ...s, receipt: null, previousReceipts: [...(s.previousReceipts || []), s.receipt] }, at, actor, 'COUNT_REOPENED', `Count by ${s.receipt.by} reopened by the owner: ${reason}`));
    }

    // Staff cannot change a load that has left. They ask the owner: new truck or driver, truck came back, or accident.
    case 'REQUEST_CHANGE': {
      const s = shipmentOf(state, action.id);
      const reason = String(action.note || '').trim();
      if (!s || !s.sentAt || s.receipt || s.cancelledAt || s.returning || !reason) return state;
      if (!['details', 'came_back', 'accident'].includes(action.kind)) return state;
      if ((state.requests || []).some((r: any) => r.shipmentId === s.id && r.status === 'pending')) return state;
      const d = action.details || {};
      if (action.kind === 'details' && !['truckNo', 'driver', 'driverPhone', 'ewayBill'].some((k) => String(d[k] || '').trim())) return state;
      if (action.kind === 'accident' && !['moved', 'returned'].includes(action.outcome)) return state;
      if (action.kind === 'accident' && action.outcome === 'moved' && !String(d.truckNo || '').trim()) return state;
      const n = ((state.counters.req) || 0) + 1;
      const req = { id: `REQ-${pad(n)}`, shipmentId: s.id, kind: action.kind, outcome: action.outcome || null, details: d, note: reason, place: String(action.place || '').trim(), photos: action.photos || [], by: action.by || actor, at, status: 'pending', decidedAt: null, decidedNote: '' };
      const what = action.kind === 'details' ? 'change the truck or driver' : action.kind === 'came_back' ? 'mark the truck as came back' : action.outcome === 'moved' ? 'report an accident (good pieces moved to another truck)' : 'report an accident (goods collected, coming back)';
      const next = { ...state, requests: [...(state.requests || []), req], counters: { ...state.counters, req: n } };
      return putShipment(next, audit(s, at, req.by, 'CHANGE_ASKED', `Asked the owner to ${what}: ${reason}`));
    }

    // Only the owner approves or rejects. Approving makes the change and keeps the history.
    // Staff ask the owner to add a missing item or party
    case 'ASK_ADD': {
      const name = String(action.name || '').trim();
      if (!name || !['item', 'party', 'delivery'].includes(action.what)) return state;
      const n = ((state.counters.req) || 0) + 1;
      const req = { id: `REQ-${pad(n)}`, shipmentId: null, kind: 'add', what: action.what, name, partyKind: action.partyKind || 'customer', note: String(action.note || ''), by: action.by || actor, at, status: 'pending', decidedAt: null, decidedNote: '' };
      return { ...state, requests: [...(state.requests || []), req], counters: { ...state.counters, req: n } };
    }

    case 'ADD_MASTER': {
      if (actor !== 'Owner') return state;
      return addMaster(state, action.what, action.data, at);
    }

    case 'DECIDE_REQUEST': {
      const r0 = (state.requests || []).find((x: any) => x.id === action.reqId);
      if (r0 && r0.kind === 'add' && r0.status === 'pending' && actor === 'Owner') {
        const mark = (st: any, status: string) => ({ ...st, requests: st.requests.map((x: any) => (x.id === r0.id ? { ...x, status, decidedAt: at, decidedNote: String(action.note || '') } : x)) });
        if (!action.approve) return mark(state, 'rejected');
        if (r0.what === 'delivery') return mark(state, 'approved'); // the owner adds it as an expected delivery
        return mark(addMaster(state, r0.what, { name: r0.name, kind: r0.partyKind, unit: 'pcs' }, at), 'approved');
      }
      const r = (state.requests || []).find((x: any) => x.id === action.reqId);
      if (!r || r.status !== 'pending' || actor !== 'Owner') return state;
      const s = shipmentOf(state, r.shipmentId);
      const done = (status: string, st: any) => ({ ...st, requests: st.requests.map((x: any) => (x.id === r.id ? { ...x, status, decidedAt: at, decidedNote: String(action.note || '') } : x)) });
      if (!action.approve) return putShipment(done('rejected', state), audit(s, at, actor, 'CHANGE_REJECTED', `Owner said no: ${r.note}${action.note ? ` (${action.note})` : ''}`));
      if (!s || s.receipt || s.cancelledAt) return state;
      const pick = (o: any) => Object.fromEntries(['truckNo', 'driver', 'driverPhone', 'ewayBill'].filter((k) => String(o?.[k] || '').trim()).map((k) => [k, String(o[k]).trim()]));
      if (r.kind === 'came_back') return done('approved', reducer(state, { type: 'CANCEL_SHIPMENT', id: s.id, note: r.note, at, actor }));
      if (r.kind === 'details') {
        const ch = pick(r.details);
        const said = Object.entries(ch).map(([k, v]) => `${k === 'truckNo' ? 'truck' : k === 'driverPhone' ? 'driver phone' : k === 'ewayBill' ? 'e-way bill' : 'driver'} ${(s as any)[k] || '—'} → ${v}`).join(', ');
        return putShipment(done('approved', state), audit({ ...s, ...ch }, at, actor, 'DETAILS_CHANGED', `Owner approved: ${said}. Reason: ${r.note}`));
      }
      // accident
      const accident = { at: r.at, place: r.place, note: r.note, outcome: r.outcome, photos: r.photos, by: r.by };
      if (r.outcome === 'moved') {
        const ch = pick(r.details);
        return putShipment(done('approved', state), audit({ ...s, ...ch, accident }, at, actor, 'ACCIDENT', `Accident${r.place ? ` near ${r.place}` : ''}: ${r.note}. Good pieces moved to truck ${ch.truckNo}; the receiver counts what arrives.`));
      }
      // goods collected and sent back: the old receiver link stops; the sender counts what came back
      if (String(action.token || '').length < 6) return state;
      return putShipment(done('approved', state), audit({ ...s, accident, returning: true, token: action.token }, at, actor, 'ACCIDENT', `Accident${r.place ? ` near ${r.place}` : ''}: ${r.note}. Goods collected and coming back to ${s.fromUnit ? UNITS[s.fromUnit].name.split(' (')[0] : 'the sender'}; count them there.`));
    }

    // The store person at the receiving end taps "Truck arrived" (drivers don't use the app)
    case 'ARRIVED': {
      const s = shipmentOf(state, action.id);
      if (!s || !s.sentAt || s.receipt || s.cancelledAt || s.arrivedAt) return state;
      return putShipment(state, audit({ ...s, arrivedAt: at }, at, action.by || actor, 'ARRIVED', 'Truck arrived; counting can start.'));
    }

    case 'LOADING': {
      const s = shipmentOf(state, action.id);
      if (!s || s.sentAt || s.cancelledAt || atGate(s.flow)) return state;
      if (action.phase === 'start') {
        if (s.loading?.startAt) return state;
        return putShipment(state, audit({ ...s, loading: { point: action.point || 'Dock 1', startAt: at, endAt: null } }, at, actor, 'LOADING_STARTED', `Loading started at ${action.point || 'Dock 1'}.`));
      }
      if (action.phase === 'end') {
        if (!s.loading?.startAt || s.loading.endAt) return state;
        return putShipment(state, audit({ ...s, loading: { ...s.loading, endAt: at } }, at, actor, 'LOADING_FINISHED', `Loading finished at ${s.loading.point}.`));
      }
      return state;
    }

    case 'SEND_TO_RECEIVER': {
      const s = shipmentOf(state, action.id);
      if (!s || s.sentAt || s.cancelledAt) return state;
      if (!atGate(s.flow) && !s.loading?.endAt) return state; // loading must be finished before the truck leaves
      if (!action.token || String(action.token).length < 6) return state;
      let next = putShipment(state, audit({ ...s, sentAt: at, token: action.token }, at, actor, atGate(s.flow) ? 'COUNT_STARTED' : 'SENT', atGate(s.flow) ? 'Gate count opened.' : 'Truck left; receiver link shared.'));
      if (s.flow === 'transfer' && s.billing === 'invoice') {
        next = addDraft(next, {
          type: 'branch_invoice', purpose: 'dispatch', createdAt: at, shipmentId: s.id, ref: s.ref,
          partyInfo: branchParty(state, s.toUnit), fromState: unitTax(state, s.fromUnit).state,
          lines: s.lines.map((l: any) => priced(l.item, l.qty)),
          narration: `${s.id} (${s.ref}), truck ${s.truckNo}: branch transfer ${route(s)}, invoiced with GST.`,
        });
      } else if (s.flow === 'jobwork_out') {
        next = addDraft(next, {
          type: 'stock_journal', purpose: 'dispatch', createdAt: at, shipmentId: s.id,
          moves: s.lines.map((l: any) => ({ item: l.item, qty: l.qty, from: godownOf(s.fromUnit), to: jobworkerGodown(s.party) })),
          narration: `${s.id} (${s.ref}), truck ${s.truckNo}: sent for job work, ${route(s)}, on delivery challan ${s.ref}. To come back by ${new Date(at + JOBWORK_DAYS * DAY).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}.`,
        });
      } else if (s.flow === 'transfer') {
        next = addDraft(next, {
          type: 'stock_journal', purpose: 'dispatch', createdAt: at, shipmentId: s.id,
          moves: s.lines.map((l: any) => ({ item: l.item, qty: l.qty, from: godownOf(s.fromUnit), to: GODOWNS.transit })),
          narration: `${s.id} (${s.ref}), truck ${s.truckNo}: dispatched ${route(s)}.`,
        });
      }
      return next;
    }

    case 'SUBMIT_RECEIPT': {
      const s = shipmentOf(state, action.id);
      if (!s || !s.sentAt || s.receipt || s.cancelledAt || action.token !== s.token) return state;
      if (!String(action.by || '').trim()) return state;
      const counts = action.lines || {};
      for (const l of s.lines) {
        const c = counts[l.id];
        if (!c || !isInt(c.counted) || !isInt(c.damaged) || c.damaged > c.counted) return state;
      }
      const receipt = { by: String(action.by).trim(), at, lines: counts, photos: action.photos || [], note: action.note || '' };
      let next = putShipment(state, audit({ ...s, receipt }, at, 'Receiver', 'COUNTED', `Counted by ${receipt.by}; locked.`));
      // differences, line by line
      let dn = state.counters.dif;
      const diffs: any[] = [];
      for (const l of s.lines) {
        const { counted, damaged } = counts[l.id];
        const add = (kind: string, qty: number) => {
          dn += 1;
          diffs.push({ id: `DIF-${pad(dn)}`, shipmentId: s.id, lineId: l.id, item: l.item, kind, qty, cause: s.accident ? 'accident' : null, value: qty * ITEMS[l.item].rate, status: 'open', createdAt: at, decision: null, settledAt: null, evidence: { clips: [], shares: [] }, evidenceToken: null, history: [] });
        };
        if (damaged > 0) add('damaged', damaged);
        if (counted < l.qty) add('short', l.qty - counted);
        if (counted > l.qty) add('excess', counted - l.qty);
      }
      next = { ...next, diffs: [...next.diffs, ...diffs], counters: { ...next.counters, dif: dn } };
      // the normal Tally entry for what arrived
      if (s.returning) {
        // after an accident the goods came back to the sender: good ones back into the sender's stock
        const moves: any[] = [];
        for (const l of s.lines) {
          const { counted, damaged } = counts[l.id];
          const good = Math.min(counted - damaged, l.qty);
          const bad = Math.min(damaged, l.qty - good);
          if (good) moves.push({ item: l.item, qty: good, from: GODOWNS.transit, to: godownOf(s.fromUnit) });
          if (bad) moves.push({ item: l.item, qty: bad, from: GODOWNS.transit, to: GODOWNS.damaged });
        }
        if (moves.length) next = addDraft(next, { type: 'stock_journal', purpose: 'receipt', createdAt: at, shipmentId: s.id, moves, narration: `${loadName(s.id)} (${s.ref}): accident on the way; goods collected and brought back, counted by ${receipt.by}.` });
      } else if (s.flow === 'transfer' && s.billing === 'invoice') {
        const lines = s.lines.map((l: any) => ({ ...priced(l.item, Math.min(counts[l.id].counted - counts[l.id].damaged, l.qty)), godown: godownOf(s.toUnit) })).filter((l: any) => l.qty > 0);
        if (lines.length) next = addDraft(next, { type: 'receipt_note', purpose: 'receipt', createdAt: at, shipmentId: s.id, partyInfo: branchParty(state, s.fromUnit), ref: s.ref, lines, narration: `${s.id}: received from ${UNITS[s.fromUnit].name.split(' (')[0]} against branch transfer invoice ${s.ref}; good units only, counted by ${receipt.by}.` });
      } else if (s.flow === 'transfer') {
        const moves: any[] = [];
        for (const l of s.lines) {
          const { counted, damaged } = counts[l.id];
          const good = Math.min(counted - damaged, l.qty);
          const bad = Math.min(damaged, l.qty - good);
          if (good) moves.push({ item: l.item, qty: good, from: GODOWNS.transit, to: godownOf(s.toUnit) });
          if (bad) moves.push({ item: l.item, qty: bad, from: GODOWNS.transit, to: GODOWNS.damaged });
        }
        if (moves.length) next = addDraft(next, { type: 'stock_journal', purpose: 'receipt', createdAt: at, shipmentId: s.id, moves, narration: `${s.id} (${s.ref}): received at ${UNITS[s.toUnit].name.split(' (')[0]}, counted by ${receipt.by}.` });
      }
      if (s.flow === 'jobwork_in') {
        const moves: any[] = [];
        for (const l of s.lines) {
          const { counted, damaged } = counts[l.id];
          if (counted - damaged > 0) moves.push({ item: l.item, qty: counted - damaged, from: jobworkerGodown(s.party), to: godownOf(s.toUnit) });
          if (damaged > 0) moves.push({ item: l.item, qty: damaged, from: jobworkerGodown(s.party), to: GODOWNS.damaged });
        }
        if (moves.length) next = addDraft(next, { type: 'stock_journal', purpose: 'receipt', createdAt: at, shipmentId: s.id, moves, narration: `${s.id} (${s.ref}): back from job work at ${PARTIES[s.party].name} for ${s.parentId}, counted by ${receipt.by}.` });
      }
      // promises kept by this load close themselves when enough good units arrive
      for (const id of s.fulfils || []) {
        const d = diffOf(next, id);
        if (!d || d.status !== 'waiting') continue;
        const good = s.lines.filter((l: any) => l.item === d.item).reduce((a: number, l: any) => a + counts[l.id].counted - counts[l.id].damaged, 0);
        next = putDiff(next, good >= d.qty
          ? { ...d, came: { load: s.id, good, at, by: receipt.by }, history: [...d.history, { at, by: 'LoadMatch', text: `Arrived on ${loadName(s.id)}: ${good} good, counted by ${receipt.by}. Waiting for the owner to accept.` }] }
          : { ...d, history: [...d.history, { at, by: 'LoadMatch', text: `Only ${good} of ${d.qty} arrived on ${loadName(s.id)}. Still waiting.` }] });
      }
      if (s.flow === 'inbound') {
        const lines = s.lines.map((l: any) => ({ ...priced(l.item, counts[l.id].counted - counts[l.id].damaged), godown: godownOf(s.toUnit) })).filter((l: any) => l.qty > 0);
        if (lines.length) next = addDraft(next, { type: 'receipt_note', purpose: 'receipt', createdAt: at, shipmentId: s.id, party: s.party, ref: s.ref, lines, narration: `${s.id}: goods received against supplier bill ${s.ref}, truck ${s.truckNo}; good units only, counted at the gate by ${receipt.by}.` });
      }
      return next;
    }

    case 'DECIDE': {
      const d = diffOf(state, action.diffId);
      if (!d || !['open', 'investigating'].includes(d.status)) return state;
      const s = shipmentOf(state, d.shipmentId);
      const a = ACTIONS[action.action];
      if (!a || !optionsFor(s, d).includes(action.action)) return state;
      if (a.due && !(Number(action.dueAt) > at)) return state;
      if (a.loss && d.value > state.settings.writeOffLimit && !action.confirm) return state;
      const decision = { action: action.action, dueAt: a.due ? Number(action.dueAt) : null, note: action.note || '', at, by: actor };
      const status = a.settles ? 'settled' : a.due ? 'waiting' : 'investigating';
      let next = putDiff(state, { ...d, decision, status, settledAt: a.settles ? at : null, history: [...d.history, { at, by: actor, text: `${a.label}${decision.note ? `: ${decision.note}` : ''}` }] });
      const draft = decisionDraft(state, s, d, action.action, at);
      if (draft) next = addDraft(next, draft);
      return putShipment(next, audit(s, at, actor, 'DECIDED', `${d.id} ${KIND_LABEL[d.kind].toLowerCase()} ${d.qty}: ${a.label}.`));
    }

    case 'SETTLE': {
      const d = diffOf(state, action.diffId);
      if (!d || d.status !== 'waiting') return state;
      let next = putDiff(state, { ...d, status: 'settled', settledAt: at, history: [...d.history, { at, by: actor, text: `Done${action.note ? `: ${action.note}` : ''}` }] });
      // the owed goods came on a later load: the accountant ties that load to the first bill (no new stock entry)
      const s = shipmentOf(state, d.shipmentId);
      const via = d.came && shipmentOf(state, d.came.load);
      if (via) next = addDraft(next, { type: 'match_note', purpose: 'decision', createdAt: at, shipmentId: s.id, diffId: d.id, party: s.party || null,
        narration: `${d.qty} ${ITEMS[d.item].unit} ${ITEMS[d.item].name} missing from ${loadName(s.id)} (${s.ref}) came on ${loadName(via.id)} (${via.ref}). Note it against the first bill; no new bill or payment.` });
      return next;
    }

    case 'ASK_SENDER': {
      const s = shipmentOf(state, action.id);
      if (!s || !s.receipt || s.ask || actor !== 'Owner') return state;
      if (!diffsOf(state, s.id).some((d: any) => d.status === 'open' || d.status === 'investigating')) return state;
      return putShipment(state, audit({ ...s, ask: { at, token: action.token || s.token } }, at, actor, 'ASKED_SENDER', `Owner asked ${senderName(s)} what happened.`));
    }

    case 'SENDER_REPLY': {
      const s = shipmentOf(state, action.id);
      if (!s || !s.ask || s.ask.reply || !REPLIES[action.kind]) return state;
      if (action.token !== undefined && action.token !== s.ask.token) return state;
      const by = String(action.by || actor).trim();
      if (action.kind === 'send_next' && !(Number(action.dueAt) > at)) return state;
      const dueAt = action.kind === 'send_next' ? Number(action.dueAt) : null;
      return putShipment(state, audit({ ...s, ask: { ...s.ask, reply: { kind: action.kind, at, by, dueAt, note: action.note || '' } } }, at, by, 'SENDER_REPLIED', `${by}: ${REPLIES[action.kind].label}.`));
    }

    // A promise was not kept (the rest did not come): back to the owner to choose again
    case 'PROMISE_BROKEN': {
      const d = diffOf(state, action.diffId);
      if (!d || d.status !== 'waiting' || actor !== 'Owner') return state;
      return putDiff(state, { ...d, status: 'open', decision: null, history: [...d.history, { at, by: actor, text: `Did not come${action.note ? `: ${action.note}` : ''}. Choose again.` }] });
    }

    case 'ATTACH_CLIP': {
      const d = diffOf(state, action.diffId);
      if (!d || actor !== 'Owner' || !String(action.name || action.link || '').trim()) return state;
      return putDiff(state, { ...d, evidence: { ...d.evidence, clips: [...d.evidence.clips, { name: action.name || '', link: action.link || '', at }] } });
    }

    case 'SHARE_EVIDENCE': {
      const d = diffOf(state, action.diffId);
      if (!d || actor !== 'Owner' || !String(action.to || '').trim()) return state;
      const token = d.evidenceToken || action.token;
      if (!token) return state;
      return putDiff(state, { ...d, evidenceToken: token, evidence: { ...d.evidence, shares: [...d.evidence.shares, { to: String(action.to).trim(), at }] }, history: [...d.history, { at, by: actor, text: `Evidence pack shared with ${String(action.to).trim()}` }] });
    }

    // The owner sends the ready entries to the accountant (printable report + Tally file). The owner's decision
    // is the approval; a sent entry is kept with the pack it went in.
    // The owner tells the receiver a truck is coming: our other unit (in the app) or a customer (WhatsApp). Staff don't.
    case 'LINK_SENT': {
      const s = shipmentOf(state, action.id);
      if (!s || !s.sentAt || s.receipt || actor !== 'Owner') return state;
      return putShipment(state, audit({ ...s, linkSentAt: at }, at, actor, 'LINK_SENT', 'Owner sent the count link to the customer.'));
    }

    // The accountant marks a to-do (debit note, credit note, bill…) done; the owner or accountant can send the rest as a pack
    case 'SEND_TO_ACCOUNTANT': {
      const ids = new Set((action.ids || []).filter((id: string) => state.drafts.some((x: any) => x.id === id && x.status === 'pending')));
      if (!ids.size || !['Owner', 'Accountant'].includes(actor)) return state;
      const packId = `P-${pad((state.packs || []).length + 1)}`;
      return {
        ...state,
        packs: [...(state.packs || []), { id: packId, at, by: actor, ids: [...ids] }],
        drafts: state.drafts.map((x: any) => (ids.has(x.id) ? { ...x, status: 'sent', sentAt: at, packId } : x)),
      };
    }

    case 'REJECT_DRAFT': {
      const x = state.drafts.find((y: any) => y.id === action.id);
      const note = String(action.note || '').trim().replace(/\.+$/, '');
      if (!x || x.status !== 'pending' || !note) return state;
      let next = { ...state, drafts: state.drafts.map((y: any) => (y.id === x.id ? { ...y, status: 'rejected', rejectedAt: at, rejectedBy: actor, rejectNote: note } : y)) };
      // an undone decision goes back to the owner's list
      if (x.diffId) {
        const d = diffOf(next, x.diffId);
        next = putDiff(next, { ...d, status: 'open', decision: null, settledAt: null, history: [...d.history, { at, by: actor, text: `Decision undone: ${note}. Decide again.` }] });
      }
      return next;
    }

    default:
      return state;
  }
}

// Tally import order: stock journals first, then receipt notes, then party vouchers
const TYPE_ORDER: Record<string, number> = { stock_journal: 0, branch_invoice: 1, receipt_note: 1, debit_note: 2, credit_note: 2, sales_invoice: 2, match_note: 3 };
export const importOrder = (a: any, b: any) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.createdAt - b.createdAt;

export function buildInitialState(anchor = Date.now()): any {
  undoAdded();
  const base = {
    version: VERSION, anchor,
    settings: { ...DEFAULT_SETTINGS, languages: { ...DEFAULT_SETTINGS.languages }, units: JSON.parse(JSON.stringify(DEFAULT_SETTINGS.units)) },
    settingsLog: [], shipments: [], diffs: [], drafts: [], packs: [], requests: [],
    counters: { trk: 0, dif: 0, draft: 0, req: 0, add: 0 },
    staff: [{ name: 'Ramesh', unit: 'MYS' }, { name: 'Ravi', unit: 'BLR' }],
  };
  return makeSeed(anchor).reduce((s: any, a: any) => reducer(s, a), base);
}
