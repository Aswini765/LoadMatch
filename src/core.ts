// LoadMatch core: state, reducer and selectors. No React here, so the same code runs in the
// browser, in the shared-data replay (sync.ts) and in tests.
//
// A shipment (one truck) is listed by the sender, counted by the receiver through a link, and
// compared line by line. Each difference stays open until the owner settles it. Settled
// differences, and normal dispatches and receipts, become Tally drafts for the accountant.
import { UNITS, GODOWNS, ITEMS, PARTIES, DEFAULT_SETTINGS, makeSeed } from './data/seed.ts';
import { inr } from './lib/format.ts';

export const VERSION = 1;
const HOUR = 3600000;

export const FLOW_LABEL: Record<string, string> = {
  transfer: 'Transfer between units',
  inbound: 'Supplier delivery',
  outbound: 'Customer dispatch',
};
export const KIND_LABEL: Record<string, string> = { short: 'Short', excess: 'Excess', damaged: 'Damaged' };

// What the owner can do with a difference. due = stays open until a date; settles = closed at once;
// loss = the business absorbs the value (needs an explicit confirmation above the limit).
export const ACTIONS: Record<string, { label: string; due?: boolean; settles?: boolean; loss?: boolean; draft?: string }> = {
  write_off: { label: 'Write off as transit loss', settles: true, loss: true, draft: 'Stock journal to Transit Loss' },
  correct_list: { label: 'Loading list was wrong: record the extra as sent', settles: true, draft: 'Stock journal between units' },
  replace: { label: 'Supplier replaces it in the next batch', due: true },
  debit_note: { label: 'Debit note to the supplier', settles: true, draft: 'Debit note' },
  accept: { label: 'Accept the loss', settles: true, loss: true },
  keep_extra: { label: 'Keep the extra; supplier bills it', settles: true },
  return_extra: { label: 'Return the extra to the supplier', due: true },
  send_rest: { label: 'Send the missing quantity', due: true },
  send_replacement: { label: 'Send replacements', due: true },
  credit_note: { label: 'Credit note to the customer', settles: true, loss: true, draft: 'Credit note' },
  bill_extra: { label: 'Bill the extra to the customer', settles: true, draft: 'Sales invoice' },
  customer_returns: { label: 'Customer returns the extra', due: true },
  investigate: { label: 'Investigate first (CCTV, driver, sender)' },
};
export const OPTIONS: Record<string, Record<string, string[]>> = {
  transfer: { short: ['write_off', 'investigate'], damaged: ['write_off', 'investigate'], excess: ['correct_list', 'investigate'] },
  inbound: { short: ['replace', 'debit_note', 'accept', 'investigate'], damaged: ['replace', 'debit_note', 'accept', 'investigate'], excess: ['keep_extra', 'return_extra', 'investigate'] },
  outbound: { short: ['send_rest', 'credit_note', 'investigate'], damaged: ['send_replacement', 'credit_note', 'investigate'], excess: ['bill_extra', 'customer_returns', 'investigate'] },
};

export const DRAFT_LABEL: Record<string, string> = {
  stock_journal: 'Stock Journal',
  receipt_note: 'Receipt Note',
  debit_note: 'Debit Note',
  credit_note: 'Credit Note',
  sales_invoice: 'Sales Invoice',
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
  if (s.flow === 'inbound') return `${PARTIES[s.party].name} → ${UNITS[s.toUnit].name.split(' (')[0]}`;
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
  IN_TRANSIT: { label: 'Waiting for receiver', cls: 'bg-sky-50 text-sky-800 border-sky-200' },
  MATCHED: { label: 'All matched', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  TO_DECIDE: { label: 'Owner to decide', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  WAITING: { label: 'Waiting on promise', cls: 'bg-violet-50 text-violet-800 border-violet-200' },
  SETTLED: { label: 'Settled', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};
export const receiptOverdue = (state: any, s: any, now = Date.now()) => Boolean(s.sentAt && !s.receipt && !s.cancelledAt && now - s.sentAt > state.settings.receiptHours * HOUR);
export const diffOverdue = (d: any, now = Date.now()) => d.status === 'waiting' && d.decision?.dueAt && now > d.decision.dueAt;
export const lossValue = (d: any) => (d.decision && ACTIONS[d.decision.action]?.loss ? d.value : 0);

// The receiver's link: opens one truck, no login
export const receiverPath = (s: any) => `#/r/${s.id}/${s.token}`;
export const evidencePath = (d: any) => `#/e/${d.id}/${d.evidenceToken}`;

// One WhatsApp-ready summary per truck for the owner
export function truckSummary(state: any, s: any) {
  const ds = diffsOf(state, s.id);
  const head = `${s.id} · ${s.truckNo} · ${route(s)}`;
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
    `Evidence: ${d.id} · ${s.id} · ${s.truckNo}`,
    `${route(s)} · ref ${s.ref}`,
    `${it.name}: sent ${l.qty}, counted ${r.counted}${r.damaged ? `, damaged ${r.damaged}` : ''} → ${KIND_LABEL[d.kind].toLowerCase()} ${d.qty} ${it.unit}`,
  ];
  if (s.loading?.startAt) parts.push(`Loading: ${s.loading.point}, ${fmtTime(s.loading.startAt)}–${fmtTime(s.loading.endAt)} on ${fmtDate(s.loading.startAt)} (check CCTV for this window)`);
  parts.push(`Counted by ${s.receipt.by}, ${fmtDate(s.receipt.at)} ${fmtTime(s.receipt.at)}${s.receipt.photos?.length ? ` · ${s.receipt.photos.length} photo(s)` : ''}`);
  if (d.evidence.clips.length) parts.push(`CCTV: ${d.evidence.clips.map((c: any) => c.link || c.name).join(', ')}`);
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

function addDraft(state: any, d: any) {
  const id = `D-${pad(state.counters.draft + 1)}`;
  return { ...state, counters: { ...state.counters, draft: state.counters.draft + 1 }, drafts: [...state.drafts, { ...d, id, status: 'pending' }] };
}
const priced = (code: string, qty: number) => ({ item: code, qty, rate: ITEMS[code].rate, gst: ITEMS[code].gst });

// Drafts made from a decision on a difference (null = nothing to enter in Tally)
function decisionDraft(s: any, d: any, action: string, at: number) {
  const it = ITEMS[d.item];
  const base = { createdAt: at, shipmentId: s.id, diffId: d.id, purpose: 'decision' };
  if (action === 'write_off' && s.flow === 'transfer') {
    const from = d.kind === 'damaged' ? GODOWNS.damaged : GODOWNS.transit;
    return { ...base, type: 'stock_journal', moves: [{ item: d.item, qty: d.qty, from, to: GODOWNS.loss }], narration: `${s.id} (${s.ref}): ${d.qty} ${it.unit} ${it.name} ${d.kind === 'damaged' ? 'damaged' : 'lost'} in transit, ${route(s)}. Written off by the owner.` };
  }
  if (action === 'correct_list') {
    return { ...base, type: 'stock_journal', moves: [{ item: d.item, qty: d.qty, from: godownOf(s.fromUnit), to: godownOf(s.toUnit) }], narration: `${s.id} (${s.ref}): ${d.qty} ${it.unit} ${it.name} loaded but not on the list; recorded as sent.` };
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
      const n = state.counters.trk + 1;
      const id = action.id || `TRK-${1000 + n}`;
      if (shipmentOf(state, id)) return state;
      let s: any = {
        id, flow, fromUnit: action.fromUnit || null, toUnit: action.toUnit || null, party: action.party || null,
        truckNo: String(action.truckNo).trim().toUpperCase(), ref: String(action.ref).trim(),
        lines: lines.map((l: any, i: number) => ({ id: `L${i + 1}`, item: l.item, qty: l.qty })),
        createdAt: at, createdBy: actor, loading: null, sentAt: null, token: null, receipt: null, cancelledAt: null, audit: [],
      };
      s = audit(s, at, actor, 'LISTED', `${lines.length} line(s), ${lines.reduce((a: number, l: any) => a + l.qty, 0)} units, ${FLOW_LABEL[flow].toLowerCase()}, ref ${s.ref}.`);
      return { ...state, counters: { ...state.counters, trk: Math.max(state.counters.trk, Number(id.slice(4)) - 1000) }, shipments: [...state.shipments, s] };
    }

    case 'CANCEL_SHIPMENT': {
      const s = shipmentOf(state, action.id);
      if (!s || s.sentAt || s.cancelledAt) return state;
      return putShipment(state, audit({ ...s, cancelledAt: at }, at, actor, 'CANCELLED', action.note || 'Cancelled before dispatch.'));
    }

    case 'LOADING': {
      const s = shipmentOf(state, action.id);
      if (!s || s.sentAt || s.cancelledAt || s.flow === 'inbound') return state;
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
      if (s.flow !== 'inbound' && !s.loading?.endAt) return state; // the loading window is the CCTV evidence
      if (!action.token || String(action.token).length < 6) return state;
      let next = putShipment(state, audit({ ...s, sentAt: at, token: action.token }, at, actor, s.flow === 'inbound' ? 'COUNT_STARTED' : 'SENT', s.flow === 'inbound' ? 'Gate count opened.' : 'Truck left; receiver link shared.'));
      if (s.flow === 'transfer') {
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
          diffs.push({ id: `DIF-${pad(dn)}`, shipmentId: s.id, lineId: l.id, item: l.item, kind, qty, value: qty * ITEMS[l.item].rate, status: 'open', createdAt: at, decision: null, settledAt: null, evidence: { clips: [], shares: [] }, evidenceToken: null, history: [] });
        };
        if (damaged > 0) add('damaged', damaged);
        if (counted < l.qty) add('short', l.qty - counted);
        if (counted > l.qty) add('excess', counted - l.qty);
      }
      next = { ...next, diffs: [...next.diffs, ...diffs], counters: { ...next.counters, dif: dn } };
      // the normal Tally entry for what arrived
      if (s.flow === 'transfer') {
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
      if (!a || !OPTIONS[s.flow][d.kind].includes(action.action)) return state;
      if (a.due && !(Number(action.dueAt) > at)) return state;
      if (a.loss && d.value > state.settings.writeOffLimit && !action.confirm) return state;
      const decision = { action: action.action, dueAt: a.due ? Number(action.dueAt) : null, note: action.note || '', at, by: actor };
      const status = a.settles ? 'settled' : a.due ? 'waiting' : 'investigating';
      let next = putDiff(state, { ...d, decision, status, settledAt: a.settles ? at : null, history: [...d.history, { at, by: actor, text: `${a.label}${decision.note ? `: ${decision.note}` : ''}` }] });
      const draft = decisionDraft(s, d, action.action, at);
      if (draft) next = addDraft(next, draft);
      return putShipment(next, audit(s, at, actor, 'DECIDED', `${d.id} ${KIND_LABEL[d.kind].toLowerCase()} ${d.qty}: ${a.label}.`));
    }

    case 'SETTLE': {
      const d = diffOf(state, action.diffId);
      if (!d || d.status !== 'waiting') return state;
      return putDiff(state, { ...d, status: 'settled', settledAt: at, history: [...d.history, { at, by: actor, text: `Settled${action.note ? `: ${action.note}` : ''}` }] });
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

    case 'APPROVE_DRAFTS': {
      const ids = new Set(action.ids || []);
      return { ...state, drafts: state.drafts.map((x: any) => (ids.has(x.id) && x.status === 'pending' ? { ...x, status: 'approved', approvedAt: at, approvedBy: actor } : x)) };
    }

    // The accountant downloaded these for Tally: the next batch leaves them out, so nothing is imported twice
    case 'EXPORT_DRAFTS': {
      const ids = new Set(action.ids || []);
      return { ...state, drafts: state.drafts.map((x: any) => (ids.has(x.id) && x.status === 'approved' && !x.exportedAt ? { ...x, exportedAt: at } : x)) };
    }

    case 'REJECT_DRAFT': {
      const x = state.drafts.find((y: any) => y.id === action.id);
      const note = String(action.note || '').trim().replace(/\.+$/, '');
      if (!x || x.status !== 'pending' || !note) return state;
      let next = { ...state, drafts: state.drafts.map((y: any) => (y.id === x.id ? { ...y, status: 'rejected', rejectedAt: at, rejectedBy: actor, rejectNote: note } : y)) };
      // a rejected decision goes back to the owner
      if (x.diffId) {
        const d = diffOf(next, x.diffId);
        next = putDiff(next, { ...d, status: 'open', decision: null, settledAt: null, history: [...d.history, { at, by: actor, text: `${DRAFT_LABEL[x.type]} ${x.id} rejected: ${note}. Back to the owner.` }] });
      }
      return next;
    }

    default:
      return state;
  }
}

// Tally import order: stock journals first, then receipt notes, then party vouchers
const TYPE_ORDER: Record<string, number> = { stock_journal: 0, receipt_note: 1, debit_note: 2, credit_note: 2, sales_invoice: 2 };
export const importOrder = (a: any, b: any) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.createdAt - b.createdAt;

export function buildInitialState(anchor = Date.now()): any {
  const base = {
    version: VERSION, anchor,
    settings: { ...DEFAULT_SETTINGS, languages: { ...DEFAULT_SETTINGS.languages } },
    settingsLog: [], shipments: [], diffs: [], drafts: [],
    counters: { trk: 0, dif: 0, draft: 0 },
  };
  return makeSeed(anchor).reduce((s: any, a: any) => reducer(s, a), base);
}
