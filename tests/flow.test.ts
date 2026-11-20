// LoadMatch flow checks through the real reducer. Run: npm test
import assert from 'node:assert/strict';
import {
  OPTIONS, jobworkBalance, jobworkDueAt, jobworkOpen, childrenOf, parentOf, JOBWORK_DAYS,
  reducer, buildInitialState, shipmentOf, packLoad, unpackLoad, packCount, unpackCount, optionsFor, diffsOf, diffOf, shipmentStatus, receiptOverdue, diffOverdue, truckSummary, evidenceText, importOrder,
} from '../src/core.ts';
import { voucherXml } from '../src/lib/tally.ts';
import { taxLines } from '../src/lib/tax.ts';
import { PARTIES } from '../src/data/seed.ts';
import { findNumber, parseCount } from '../src/lib/voice.ts';

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ✓ ${name}`); };
const run = (s: any, ...actions: any[]) => actions.reduce((acc, a) => reducer(acc, a), s);
const status = (s: any, id: string) => shipmentStatus(s, shipmentOf(s, id));
const draftsFor = (s: any, id: string) => s.drafts.filter((d: any) => d.shipmentId === id);
const lastShip = (s: any) => s.shipments.at(-1);

// a fresh transfer, loaded and sent
function sentTransfer(s: any, lines = [{ item: 'BRP-1148', qty: 100 }, { item: 'OKU-AB-91', qty: 50 }]) {
  s = run(s, { type: 'CREATE_SHIPMENT', flow: 'transfer', fromUnit: 'MYS', toUnit: 'BLR', truckNo: 'ka 01 x 1', ref: 'DC-9', lines });
  const id = lastShip(s).id;
  s = run(s, { type: 'LOADING', id, point: 'Dock 2', phase: 'start' }, { type: 'LOADING', id, phase: 'end' }, { type: 'SEND_TO_RECEIVER', id, token: 'tok123' });
  return [s, id];
}

console.log('LoadMatch flow tests');

test('seed: one truck to decide, one promise waiting, one in transit, one loading, the rest matched', () => {
  const s = buildInitialState();
  assert.equal(status(s, 'TRK-1013'), 'TO_DECIDE');
  assert.deepEqual(diffsOf(s, 'TRK-1013').map((d: any) => [d.kind, d.qty]), [['damaged', 2], ['short', 5]]);
  assert.equal(status(s, 'TRK-1014'), 'WAITING');
  assert.equal(status(s, 'TRK-1015'), 'TO_DECIDE');
  assert.equal(diffsOf(s, 'TRK-1015')[0].kind, 'excess');
  assert.equal(status(s, 'TRK-1016'), 'IN_TRANSIT');
  assert.equal(status(s, 'TRK-1017'), 'LOADING');
  assert.ok(s.shipments.filter((x: any) => status(s, x.id) === 'MATCHED').length >= 12);
  // last month's entries already went to the accountant; only this week's trucks are waiting
  const pending = s.drafts.filter((d: any) => d.status === 'pending');
  assert.deepEqual([...new Set(pending.map((d: any) => d.shipmentId))].sort(), ['TRK-1013', 'TRK-1014', 'TRK-1016']);
  assert.equal(s.drafts.filter((d: any) => d.status === 'sent').length, 15);
  // the job work example: 50 of 200 still with the job worker, due within the year
  assert.equal(jobworkBalance(s, shipmentOf(s, 'TRK-1018'))[0].pending, 50);
  assert.equal(parentOf(s, shipmentOf(s, 'TRK-1016')).id, 'TRK-1014');
  assert.equal(s.packs.length, 1);
  // sending marks entries so the next pack never repeats them
  const ids = pending.map((d: any) => d.id);
  const t = run(s, { type: 'SEND_TO_ACCOUNTANT', ids: ids.slice(0, 2) });
  assert.equal(t.drafts.filter((d: any) => d.status === 'pending').length, ids.length - 2);
  assert.equal(t.packs.at(-1).ids.length, 2);
  assert.equal(run(t, { type: 'SEND_TO_ACCOUNTANT', ids: ids.slice(0, 2) }), t, 'already sent');
});

test('a truck cannot be sent without its loading window (the CCTV evidence)', () => {
  let s = run(buildInitialState(), { type: 'CREATE_SHIPMENT', flow: 'transfer', fromUnit: 'MYS', toUnit: 'BLR', truckNo: 'KA 1', ref: 'DC-1', lines: [{ item: 'PLY-12', qty: 10 }] });
  const id = lastShip(s).id;
  const before = s;
  assert.equal(run(s, { type: 'SEND_TO_RECEIVER', id, token: 'tok123' }), before);
  s = run(s, { type: 'LOADING', id, point: 'Dock 1', phase: 'start' }, { type: 'LOADING', id, phase: 'end' }, { type: 'SEND_TO_RECEIVER', id, token: 'tok123' });
  assert.equal(status(s, id), 'IN_TRANSIT');
  const j = draftsFor(s, id)[0];
  assert.equal(j.type, 'stock_journal');
  assert.deepEqual(j.moves[0], { item: 'PLY-12', qty: 10, from: 'Mysuru Unit', to: 'Goods in Transit' });
});

test('invalid lists are refused: no lines, zero quantity, unknown item, same unit both ends', () => {
  const s = buildInitialState();
  const n = s.shipments.length;
  const t = run(s,
    { type: 'CREATE_SHIPMENT', flow: 'transfer', fromUnit: 'MYS', toUnit: 'BLR', truckNo: 'KA 1', ref: 'DC-1', lines: [] },
    { type: 'CREATE_SHIPMENT', flow: 'transfer', fromUnit: 'MYS', toUnit: 'BLR', truckNo: 'KA 1', ref: 'DC-1', lines: [{ item: 'PLY-12', qty: 0 }] },
    { type: 'CREATE_SHIPMENT', flow: 'transfer', fromUnit: 'MYS', toUnit: 'BLR', truckNo: 'KA 1', ref: 'DC-1', lines: [{ item: 'NOPE', qty: 3 }] },
    { type: 'CREATE_SHIPMENT', flow: 'transfer', fromUnit: 'MYS', toUnit: 'MYS', truckNo: 'KA 1', ref: 'DC-1', lines: [{ item: 'PLY-12', qty: 3 }] },
    { type: 'CREATE_SHIPMENT', flow: 'outbound', fromUnit: 'BLR', party: 'lakshmi', truckNo: 'KA 1', ref: 'INV-1', lines: [{ item: 'BOX-RB', qty: 3 }] });
  assert.equal(t.shipments.length, n);
});

test('receiver count: wrong token refused, every line required, then locked', () => {
  let [s, id] = sentTransfer(buildInitialState());
  const good = { L1: { counted: 100, damaged: 0 }, L2: { counted: 50, damaged: 0 } };
  const before = s;
  assert.equal(run(s, { type: 'SUBMIT_RECEIPT', id, token: 'wrong', by: 'Ravi', lines: good }), before);
  assert.equal(run(s, { type: 'SUBMIT_RECEIPT', id, token: 'tok123', by: 'Ravi', lines: { L1: { counted: 100, damaged: 0 } } }), before);
  assert.equal(run(s, { type: 'SUBMIT_RECEIPT', id, token: 'tok123', by: 'Ravi', lines: { ...good, L1: { counted: 5, damaged: 6 } } }), before);
  s = run(s, { type: 'SUBMIT_RECEIPT', id, token: 'tok123', by: 'Ravi', lines: good });
  assert.equal(status(s, id), 'MATCHED');
  const locked = s;
  assert.equal(run(s, { type: 'SUBMIT_RECEIPT', id, token: 'tok123', by: 'Someone', lines: { ...good, L1: { counted: 90, damaged: 0 } } }), locked, 'a submitted count cannot be changed');
  assert.match(truckSummary(s, shipmentOf(s, id)), /All 2 lines matched ✓/);
});

test('transfer short and damaged: differences per line, goods-in-transit journals balance', () => {
  let [s, id] = sentTransfer(buildInitialState());
  s = run(s, { type: 'SUBMIT_RECEIPT', id, token: 'tok123', by: 'Ravi', lines: { L1: { counted: 95, damaged: 0 }, L2: { counted: 50, damaged: 3 } } });
  const ds = diffsOf(s, id);
  assert.deepEqual(ds.map((d: any) => [d.kind, d.qty, d.value]), [['short', 5, 700], ['damaged', 3, 255]]);
  assert.equal(status(s, id), 'TO_DECIDE');
  const rj = draftsFor(s, id).find((d: any) => d.purpose === 'receipt');
  assert.deepEqual(rj.moves.map((m: any) => [m.item, m.qty, m.to]), [['BRP-1148', 95, 'Bengaluru Unit'], ['OKU-AB-91', 47, 'Bengaluru Unit'], ['OKU-AB-91', 3, 'Damaged Goods']]);
  // write off the short: 5 left in transit go to Transit Loss
  s = run(s, { type: 'DECIDE', diffId: ds[0].id, action: 'write_off', actor: 'Owner' });
  const wj = draftsFor(s, id).find((d: any) => d.diffId === ds[0].id);
  assert.deepEqual(wj.moves[0], { item: 'BRP-1148', qty: 5, from: 'Goods in Transit', to: 'Transit Loss' });
  s = run(s, { type: 'DECIDE', diffId: ds[1].id, action: 'write_off', actor: 'Owner' });
  assert.equal(draftsFor(s, id).find((d: any) => d.diffId === ds[1].id).moves[0].from, 'Damaged Goods');
  assert.equal(status(s, id), 'SETTLED');
});

test('a loss above the owner limit needs an explicit confirmation', () => {
  let [s, id] = sentTransfer(buildInitialState(), [{ item: 'PLY-18', qty: 20 }]);
  s = run(s, { type: 'SUBMIT_RECEIPT', id, token: 'tok123', by: 'Ravi', lines: { L1: { counted: 15, damaged: 0 } } });
  const d = diffsOf(s, id)[0];
  assert.equal(d.value, 10250);
  const before = s;
  assert.equal(run(s, { type: 'DECIDE', diffId: d.id, action: 'write_off' }), before, '₹10,250 is above the ₹5,000 limit');
  s = run(s, { type: 'DECIDE', diffId: d.id, action: 'write_off', confirm: true });
  assert.equal(diffOf(s, d.id).status, 'settled');
});

test('options depend on the flow: no supplier replacement on a transfer', () => {
  let [s, id] = sentTransfer(buildInitialState());
  s = run(s, { type: 'SUBMIT_RECEIPT', id, token: 'tok123', by: 'Ravi', lines: { L1: { counted: 99, damaged: 0 }, L2: { counted: 50, damaged: 0 } } });
  const d = diffsOf(s, id)[0];
  const before = s;
  assert.equal(run(s, { type: 'DECIDE', diffId: d.id, action: 'replace', dueAt: Date.now() + 86400000 }), before);
  assert.equal(run(s, { type: 'DECIDE', diffId: d.id, action: 'credit_note' }), before);
});

test('investigate first, then decide; evidence pack with loading window and CCTV clip', () => {
  let s = buildInitialState();
  const d = diffsOf(s, 'TRK-1013').find((x: any) => x.kind === 'short');
  s = run(s, { type: 'DECIDE', diffId: d.id, action: 'investigate', note: 'Check Dock 2 CCTV' });
  assert.equal(diffOf(s, d.id).status, 'investigating');
  assert.equal(status(s, 'TRK-1013'), 'TO_DECIDE');
  s = run(s, { type: 'ATTACH_CLIP', diffId: d.id, name: 'dock2-2240-0055.mp4', actor: 'Owner' });
  const blocked = run(s, { type: 'ATTACH_CLIP', diffId: d.id, name: 'x.mp4', actor: 'Dispatch staff' });
  assert.equal(diffOf(blocked, d.id).evidence.clips.length, 1, 'only the owner attaches CCTV');
  s = run(s, { type: 'SHARE_EVIDENCE', diffId: d.id, to: 'Bengaluru manager', token: 'ev12345', actor: 'Owner' });
  const text = evidenceText(s, diffOf(s, d.id));
  assert.match(text, /Loading: Dock 2/); assert.match(text, /dock2-2240-0055\.mp4/); assert.match(text, /sent 203, counted 198/);
  assert.equal(diffOf(s, d.id).evidence.shares[0].to, 'Bengaluru manager');
  s = run(s, { type: 'DECIDE', diffId: d.id, action: 'write_off', confirm: true });
  assert.equal(diffOf(s, d.id).status, 'settled');
});

test('supplier delivery: receipt note at counted good units; replacement promise tracked until settled', () => {
  let s = buildInitialState();
  const rn = draftsFor(s, 'TRK-1014').find((d: any) => d.type === 'receipt_note');
  assert.equal(rn.lines[0].qty, 90, 'book what arrived, not what was billed');
  const d = diffsOf(s, 'TRK-1014')[0];
  assert.equal(d.status, 'waiting');
  assert.equal(diffOverdue(d, s.anchor), false);
  assert.equal(diffOverdue(d, s.anchor + 3 * 86400000), true, 'flagged once the promised date passes');
  s = run(s, { type: 'SETTLE', diffId: d.id, note: '10 bundles came with TRK-1020' });
  assert.equal(status(s, 'TRK-1014'), 'SETTLED');
});

test('supplier short settled by debit note: GST draft balances', () => {
  let s = run(buildInitialState(), { type: 'CREATE_SHIPMENT', flow: 'inbound', toUnit: 'MYS', party: 'coastal', truckNo: 'KA 2', ref: 'SB-1', lines: [{ item: 'OKU-AB-91', qty: 500 }] });
  const id = lastShip(s).id;
  s = run(s, { type: 'SEND_TO_RECEIVER', id, token: 'gate123' }, { type: 'SUBMIT_RECEIPT', id, token: 'gate123', by: 'Gate', lines: { L1: { counted: 480, damaged: 0 } } });
  const d = diffsOf(s, id)[0];
  s = run(s, { type: 'DECIDE', diffId: d.id, action: 'debit_note' });
  const dn = draftsFor(s, id).find((x: any) => x.type === 'debit_note');
  assert.equal(taxLines(dn.lines, PARTIES.coastal).total, 2006); // 20 × ₹85 = ₹1,700 + 18% GST
  const xml = voucherXml(dn);
  assert.match(xml, /VCHTYPE="Debit Note"/); assert.match(xml, /Input CGST/); assert.doesNotMatch(xml, /VOUCHERNUMBER/);
});

test('customer excess: bill the extra; customer short: credit note against the invoice', () => {
  let s = buildInitialState();
  const ex = diffsOf(s, 'TRK-1015')[0];
  s = run(s, { type: 'DECIDE', diffId: ex.id, action: 'bill_extra' });
  const si = draftsFor(s, 'TRK-1015').find((d: any) => d.type === 'sales_invoice');
  assert.equal(si.lines[0].qty, 3); assert.equal(si.ref, 'INV-2519');
  // a new dispatch where the customer is short
  s = run(s, { type: 'LOADING', id: 'TRK-1017', point: 'Dock 1', phase: 'start' }, { type: 'LOADING', id: 'TRK-1017', phase: 'end' }, { type: 'SEND_TO_RECEIVER', id: 'TRK-1017', token: 'cust999' },
    { type: 'SUBMIT_RECEIPT', id: 'TRK-1017', token: 'cust999', by: 'Deccan stores', lines: { L1: { counted: 148, damaged: 0 }, L2: { counted: 60, damaged: 0 } } });
  const sh = diffsOf(s, 'TRK-1017')[0];
  s = run(s, { type: 'DECIDE', diffId: sh.id, action: 'credit_note' });
  const cn = draftsFor(s, 'TRK-1017').find((d: any) => d.type === 'credit_note');
  const t = taxLines(cn.lines, PARTIES.deccan);
  assert.equal(t.igst, 151.2, 'Tamil Nadu customer: IGST');
  assert.match(voucherXml(cn), /Output IGST/);
});

test('a rejected decision goes back to the owner', () => {
  let s = buildInitialState();
  const ex = diffsOf(s, 'TRK-1015')[0];
  s = run(s, { type: 'DECIDE', diffId: ex.id, action: 'bill_extra' });
  const si = s.drafts.find((d: any) => d.diffId === ex.id);
  assert.equal(run(s, { type: 'REJECT_DRAFT', id: si.id, note: '' }), s, 'a reason is required');
  s = run(s, { type: 'REJECT_DRAFT', id: si.id, note: 'Customer says it will return them.', actor: 'Owner' });
  assert.equal(diffOf(s, ex.id).status, 'open');
  assert.equal(status(s, 'TRK-1015'), 'TO_DECIDE');
});

test('receipt overdue after the set hours; import order puts journals first', () => {
  const s = buildInitialState();
  const t = shipmentOf(s, 'TRK-1016');
  assert.equal(receiptOverdue(s, t, s.anchor), false);
  assert.equal(receiptOverdue(s, t, s.anchor + 22 * 3600000), true);
  const ordered = [...s.drafts].sort(importOrder).map((d: any) => d.type);
  assert.ok(ordered.indexOf('receipt_note') > ordered.lastIndexOf('stock_journal'));
});

test('cancel only before the truck leaves', () => {
  let s = buildInitialState();
  s = run(s, { type: 'CANCEL_SHIPMENT', id: 'TRK-1017' }, { type: 'CANCEL_SHIPMENT', id: 'TRK-1016' });
  assert.equal(status(s, 'TRK-1017'), 'CANCELLED');
  assert.equal(status(s, 'TRK-1016'), 'IN_TRANSIT');
});

test('voice counts in any script: digits and Telugu, Kannada, Hindi words', () => {
  assert.equal(findNumber('198'), 198);
  assert.equal(findNumber('౧౯౮'), 198);
  assert.equal(findNumber('೧೯೮'), 198);
  assert.equal(findNumber('నలభై రెండు'), 42);
  assert.equal(findNumber('ಇಪ್ಪತ್ತೈದು'), 25);
  assert.equal(findNumber('साठ'), 60);
});

test('replaying the same events gives the same state on every device', () => {
  const A = 1_794_450_000_000;
  const events = [{ type: 'RESET', at: A }, { type: 'DECIDE', diffId: 'DIF-0002', action: 'investigate', at: A + 1 }];
  const a = events.reduce(reducer, buildInitialState());
  const b = events.reduce(reducer, buildInitialState(A + 99999));
  assert.deepEqual(a, b);
});

test('units with different GSTINs: same internal flow, branch invoice paperwork', () => {
  let s = buildInitialState();
  s = run(s, { type: 'UPDATE_SETTINGS', settings: { units: { ...s.settings.units, BLR: { gstin: '33ZZZZZ9999Z1Z1', state: 'Tamil Nadu' } } } });
  const [s1, id] = sentTransfer(s, [{ item: 'BRP-1148', qty: 100 }]);
  s = s1 as any;
  const inv = draftsFor(s, id as string).find((d: any) => d.purpose === 'dispatch');
  assert.equal(inv.type, 'branch_invoice');
  assert.match(voucherXml(inv), /IGST/);
  assert.match(voucherXml(inv), /Branch: Bengaluru unit/);
  s = run(s, { type: 'SUBMIT_RECEIPT', id, token: 'tok123', by: 'Ravi', lines: { L1: { counted: 96, damaged: 0 } } });
  assert.equal(status(s, id as string), 'TO_DECIDE', 'still an internal move: owner decides, no customer');
  const rn = draftsFor(s, id as string).find((d: any) => d.purpose === 'receipt');
  assert.equal(rn.type, 'receipt_note');
  assert.equal(rn.lines[0].qty, 96);
  const d = diffsOf(s, id as string)[0];
  s = run(s, { type: 'DECIDE', diffId: d.id, action: 'write_off' });
  const cn = draftsFor(s, id as string).find((x: any) => x.diffId === d.id);
  assert.equal(cn.type, 'credit_note');
  assert.match(voucherXml(cn), /IGST/);
  // same GSTIN suggests a stock transfer with no money
  const [s2, id2] = sentTransfer(buildInitialState());
  assert.equal(draftsFor(s2, id2 as string).find((x: any) => x.purpose === 'dispatch').type, 'stock_journal');
});

test('the sender decides whether a move between units involves money', () => {
  let s = buildInitialState();
  // same GSTIN, but the sender chooses an invoice
  s = run(s, { type: 'CREATE_SHIPMENT', flow: 'transfer', billing: 'invoice', fromUnit: 'MYS', toUnit: 'BLR', truckNo: 'KA 1', ref: 'BT-1', lines: [{ item: 'PLY-12', qty: 10 }] });
  let id = lastShip(s).id;
  s = run(s, { type: 'LOADING', id, phase: 'start' }, { type: 'LOADING', id, phase: 'end' }, { type: 'SEND_TO_RECEIVER', id, token: 'tok999' });
  const inv = draftsFor(s, id).find((d: any) => d.purpose === 'dispatch');
  assert.equal(inv.type, 'branch_invoice');
  assert.match(voucherXml(inv), /CGST/, 'same state: CGST + SGST');
  // different GSTIN, but the sender chooses no money
  s = run(s, { type: 'UPDATE_SETTINGS', settings: { units: { ...s.settings.units, BLR: { gstin: '33ZZZZZ9999Z1Z1', state: 'Tamil Nadu' } } } });
  s = run(s, { type: 'CREATE_SHIPMENT', flow: 'transfer', billing: 'none', fromUnit: 'MYS', toUnit: 'BLR', truckNo: 'KA 2', ref: 'DC-2', lines: [{ item: 'PLY-12', qty: 10 }] });
  id = lastShip(s).id;
  assert.equal(lastShip(s).billing, 'none');
  s = run(s, { type: 'LOADING', id, phase: 'start' }, { type: 'LOADING', id, phase: 'end' }, { type: 'SEND_TO_RECEIVER', id, token: 'tok998' });
  assert.equal(draftsFor(s, id).find((d: any) => d.purpose === 'dispatch').type, 'stock_journal');
});

test('voice: count and damaged in one sentence, in any of the four languages', () => {
  assert.deepEqual(parseCount('48, 2 damaged'), { counted: 48, damaged: 2 });
  assert.deepEqual(parseCount('अड़तालीस, दो खराब'), { counted: 48, damaged: 2 });
  assert.deepEqual(parseCount('48 ಹಾಳಾದವು 2'), { counted: 48, damaged: 2 });
  assert.deepEqual(parseCount('నలభై ఎనిమిది, రెండు పాడైనవి'), { counted: 48, damaged: 2 });
  assert.deepEqual(parseCount('120'), { counted: 120, damaged: null });
  assert.deepEqual(parseCount('nothing'), { counted: null, damaged: null });
});

test('photos of challans and bills stay with the truck and show in the evidence', () => {
  let s = buildInitialState();
  s = run(s, { type: 'CREATE_SHIPMENT', flow: 'inbound', toUnit: 'MYS', party: 'coastal', truckNo: 'KA 3', ref: 'SB-1', lines: [{ item: 'BRP-1148', qty: 50 }], docs: [{ id: 'ph-1', name: 'bill.jpg', kind: 'supplier bill' }], actor: 'Gate' });
  const id = lastShip(s).id;
  assert.equal(lastShip(s).docs.length, 1);
  s = run(s, { type: 'ATTACH_DOC', id, docs: [{ id: 'ph-2', name: 'po.jpg', kind: 'order' }], actor: 'Gate' });
  assert.deepEqual(shipmentOf(s, id).docs.map((d: any) => d.kind), ['supplier bill', 'order']);
  assert.equal(run(s, { type: 'ATTACH_DOC', id, docs: [] }), s, 'nothing to add');
  s = run(s, { type: 'SEND_TO_RECEIVER', id, token: 'tok777', actor: 'Gate' }, { type: 'SUBMIT_RECEIPT', id, token: 'tok777', by: 'Gate', lines: { L1: { counted: 45, damaged: 0 } } });
  assert.match(evidenceText(s, diffsOf(s, id)[0]), /Papers: supplier bill, order \(2 photos\)/);
});

test('job work: sent out, comes back in parts, balance and one-year date', () => {
  let s = buildInitialState();
  s = run(s, { type: 'CREATE_SHIPMENT', flow: 'jobwork_out', fromUnit: 'MYS', party: 'ganesh', truckNo: 'KA 9', ref: 'JW-1', lines: [{ item: 'PLY-12', qty: 100 }] });
  const out = lastShip(s).id;
  assert.equal(lastShip(s).billing, 'none', 'job work is not a sale');
  assert.equal(run(s, { type: 'SEND_TO_RECEIVER', id: out, token: 'tokjw1' }), s, 'needs the loading window');
  s = run(s, { type: 'LOADING', id: out, phase: 'start' }, { type: 'LOADING', id: out, phase: 'end' }, { type: 'SEND_TO_RECEIVER', id: out, token: 'tokjw1' });
  const sj = draftsFor(s, out)[0];
  assert.equal(sj.moves[0].to, 'At job worker: Sri Ganesh Wood Finishers');
  // the job worker counts 98 good + 2 damaged on arrival
  s = run(s, { type: 'SUBMIT_RECEIPT', id: out, token: 'tokjw1', by: 'Ganesh stores', lines: { L1: { counted: 100, damaged: 2 } } });
  assert.equal(jobworkBalance(s, shipmentOf(s, out))[0].pending, 100);
  // a return must name the load it returns
  assert.equal(run(s, { type: 'CREATE_SHIPMENT', flow: 'jobwork_in', toUnit: 'MYS', party: 'ganesh', truckNo: 'X', ref: 'R', lines: [{ item: 'PLY-12', qty: 1 }] }), s);
  s = run(s, { type: 'CREATE_SHIPMENT', flow: 'jobwork_in', parentId: out, toUnit: 'MYS', party: 'ganesh', truckNo: 'KA 9', ref: 'GL-55', lines: [{ item: 'PLY-12', qty: 60 }] });
  const back = lastShip(s).id;
  s = run(s, { type: 'SEND_TO_RECEIVER', id: back, token: 'tokjw2' }, { type: 'SUBMIT_RECEIPT', id: back, token: 'tokjw2', by: 'Stores', lines: { L1: { counted: 57, damaged: 0 } } });
  const bal = jobworkBalance(s, shipmentOf(s, out))[0];
  assert.equal(bal.returned, 57);
  assert.equal(bal.pending, 43);
  const rj = draftsFor(s, back).find((d: any) => d.purpose === 'receipt');
  assert.equal(rj.moves[0].from, 'At job worker: Sri Ganesh Wood Finishers');
  // 3 short on the return: written off reduces what is still with them
  const short = diffsOf(s, back)[0];
  assert.deepEqual(short.kind, 'short');
  s = run(s, { type: 'DECIDE', diffId: short.id, action: 'write_off' });
  assert.equal(jobworkBalance(s, shipmentOf(s, out))[0].pending, 40);
  assert.equal(jobworkDueAt(shipmentOf(s, out)), shipmentOf(s, out).sentAt + JOBWORK_DAYS * 24 * 3600000);
  assert.ok(jobworkOpen(s).some((x: any) => x.id === out));
  assert.equal(parentOf(s, shipmentOf(s, back)).id, out);
  assert.deepEqual(childrenOf(s, shipmentOf(s, out)).map((x: any) => x.id), [back]);
});

test('adjust in the next bill: what the factory does with supplier and customer differences', () => {
  let s = buildInitialState();
  const d = diffsOf(s, 'TRK-1015')[0]; // customer got 3 extra: not offered there
  assert.ok(!OPTIONS.outbound.excess.includes('adjust_next_bill'));
  assert.ok(OPTIONS.inbound.short.includes('adjust_next_bill') && OPTIONS.outbound.short.includes('adjust_next_bill'));
  s = run(s, { type: 'CREATE_SHIPMENT', flow: 'inbound', toUnit: 'MYS', party: 'coastal', truckNo: 'KA 3', ref: 'SB-9', lines: [{ item: 'BRP-1148', qty: 50 }] });
  const id = lastShip(s).id;
  s = run(s, { type: 'SEND_TO_RECEIVER', id, token: 'tokadj1' }, { type: 'SUBMIT_RECEIPT', id, token: 'tokadj1', by: 'Gate', lines: { L1: { counted: 46, damaged: 0 } } });
  const short = diffsOf(s, id)[0];
  s = run(s, { type: 'DECIDE', diffId: short.id, action: 'adjust_next_bill' });
  assert.equal(diffOf(s, short.id).status, 'settled');
  const dn = draftsFor(s, id).find((x: any) => x.diffId === short.id);
  assert.equal(dn.type, 'debit_note');
  assert.match(dn.narration, /next bill/);
  void d;
});

test('a promised replacement closes itself when it arrives on a later truck', () => {
  let s = buildInitialState();
  const promise = diffsOf(s, 'TRK-1014')[0];
  assert.equal(promise.status, 'waiting');
  // a later delivery from the same supplier carries only 6 of the 10
  s = run(s, { type: 'CREATE_SHIPMENT', flow: 'inbound', toUnit: 'MYS', party: 'lakshmi', truckNo: 'KA 7', ref: 'SB-0990', fulfils: [promise.id], lines: [{ item: promise.item, qty: 6 }] });
  let id = lastShip(s).id;
  assert.deepEqual(lastShip(s).fulfils, [promise.id]);
  s = run(s, { type: 'SEND_TO_RECEIVER', id, token: 'tokr111' }, { type: 'SUBMIT_RECEIPT', id, token: 'tokr111', by: 'Gate', lines: { L1: { counted: 6, damaged: 0 } } });
  assert.equal(diffOf(s, promise.id).status, 'waiting', 'only 6 of 10');
  assert.match(diffOf(s, promise.id).history.at(-1).text, /Only 6 of 10/);
  // the next one carries 10
  s = run(s, { type: 'CREATE_SHIPMENT', flow: 'inbound', toUnit: 'MYS', party: 'lakshmi', truckNo: 'KA 7', ref: 'SB-0991', fulfils: [promise.id], lines: [{ item: promise.item, qty: 10 }] });
  id = lastShip(s).id;
  s = run(s, { type: 'SEND_TO_RECEIVER', id, token: 'tokr222' }, { type: 'SUBMIT_RECEIPT', id, token: 'tokr222', by: 'Gate', lines: { L1: { counted: 10, damaged: 0 } } });
  assert.equal(diffOf(s, promise.id).status, 'settled');
  // a load cannot claim a promise for an item it does not carry
  s = run(buildInitialState(), { type: 'CREATE_SHIPMENT', flow: 'inbound', toUnit: 'MYS', party: 'lakshmi', truckNo: 'KA 8', ref: 'SB-1', fulfils: [promise.id], lines: [{ item: 'PLY-12', qty: 1 }] });
  assert.deepEqual(lastShip(s).fulfils, []);
});

test('truck came back after leaving: needs a reason, the dispatch entry is undone', () => {
  let [s, id] = sentTransfer(buildInitialState());
  assert.equal(run(s, { type: 'CANCEL_SHIPMENT', id }), s, 'reason required once it has left');
  s = run(s, { type: 'CANCEL_SHIPMENT', id, note: 'Truck broke down at Mandya, came back' });
  assert.ok(shipmentOf(s, id as string).cameBack);
  assert.equal(draftsFor(s, id as string).find((x: any) => x.purpose === 'dispatch').status, 'rejected', 'not yet sent, so withdrawn');
  assert.equal(run(s, { type: 'SUBMIT_RECEIPT', id, token: 'tok123', by: 'X', lines: { L1: { counted: 1, damaged: 0 } } }), s, 'link no longer works');
  // if the entry already went to the accountant, a reversing entry is made
  let [t, id2] = sentTransfer(buildInitialState());
  const disp = draftsFor(t, id2 as string).find((x: any) => x.purpose === 'dispatch');
  t = run(t, { type: 'SEND_TO_ACCOUNTANT', ids: [disp.id] }, { type: 'CANCEL_SHIPMENT', id: id2, note: 'Did not reach' });
  const rev = draftsFor(t, id2 as string).find((x: any) => x.purpose === 'reversal');
  assert.equal(rev.moves[0].to, disp.moves[0].from);
});

test('owner can correct a wrong count before deciding anything', () => {
  let [s, id] = sentTransfer(buildInitialState(), [{ item: 'BRP-1148', qty: 100 }]);
  s = run(s, { type: 'SUBMIT_RECEIPT', id, token: 'tok123', by: 'Ravi', lines: { L1: { counted: 10, damaged: 0 } } });
  assert.equal(diffsOf(s, id as string).length, 1);
  assert.equal(run(s, { type: 'REOPEN_COUNT', id, note: 'typed 10 instead of 100', actor: 'Receiver' }), s, 'owner only');
  assert.equal(run(s, { type: 'REOPEN_COUNT', id, actor: 'Owner' }), s, 'reason required');
  const r = run(s, { type: 'REOPEN_COUNT', id, note: 'typed 10 instead of 100', actor: 'Owner' });
  assert.equal(shipmentOf(r, id as string).receipt, null);
  assert.equal(diffsOf(r, id as string).length, 0);
  const again = run(r, { type: 'SUBMIT_RECEIPT', id, token: 'tok123', by: 'Ravi', lines: { L1: { counted: 100, damaged: 0 } } });
  assert.equal(status(again, id as string), 'MATCHED');
  // not after a decision
  const decided = run(s, { type: 'DECIDE', diffId: diffsOf(s, id as string)[0].id, action: 'investigate' });
  assert.equal(run(decided, { type: 'REOPEN_COUNT', id, note: 'x', actor: 'Owner' }), decided);
});

test('two phones, no database: the link carries the load, the count comes back by link', () => {
  // sender's phone
  let [sender, id] = sentTransfer(buildInitialState());
  const sent = shipmentOf(sender, id as string);
  const link = packLoad(sent, { blindCount: true, differencesTo: 'all' });
  // receiver's phone has its own, different records under the same load number
  const other = run(buildInitialState(), { type: 'CREATE_SHIPMENT', flow: 'outbound', fromUnit: 'MYS', party: Object.keys(PARTIES).find((k) => PARTIES[k].kind === 'customer'), truckNo: 'KA 09 Z 9', ref: 'X-1', lines: [{ item: 'BRP-1148', qty: 1 }] });
  const got = unpackLoad(id as string, 'tok123', link)!;
  assert.ok(got, 'link decodes');
  assert.notEqual(shipmentOf(other, id as string)?.truckNo, got.shipment.truckNo, 'not mistaken for the local load');
  assert.equal(got.settings.blindCount, true);
  assert.deepEqual(got.shipment.lines.map((l: any) => [l.id, l.item, l.qty]), sent.lines.map((l: any) => [l.id, l.item, l.qty]));
  // receiver counts on a scratch copy
  const scratch = { ...other, shipments: [got.shipment], diffs: [], drafts: [] };
  const counted = reducer(scratch, { type: 'SUBMIT_RECEIPT', id, token: 'tok123', by: 'ರವಿ', lines: { L1: { counted: 97, damaged: 1 }, L2: { counted: 50, damaged: 0 } }, at: 5 });
  assert.equal(diffsOf(counted, id as string).length, 2);
  // the count goes back by link, and the sender's phone records it
  const back = unpackCount(packCount(shipmentOf(counted, id as string).receipt))!;
  assert.equal(back.by, 'ರವಿ');
  sender = run(sender, { type: 'SUBMIT_RECEIPT', id, token: 'tok123', by: back.by, lines: back.lines, at: back.at });
  assert.deepEqual(diffsOf(sender, id as string).map((d: any) => [d.kind, d.qty]), [['damaged', 1], ['short', 3]]);
  // a second tap does nothing; a wrong token does nothing; a damaged link is refused
  assert.equal(run(sender, { type: 'SUBMIT_RECEIPT', id, token: 'tok123', by: back.by, lines: back.lines }), sender);
  assert.equal(unpackLoad(id as string, 'tok123', link.slice(0, 10)), null);
  assert.equal(unpackCount('garbage'), null);
});

test('staff ask, owner approves: new driver after the truck left', () => {
  let [s, id] = sentTransfer(buildInitialState());
  // staff cannot change it directly, and a request needs a reason
  assert.equal(run(s, { type: 'REQUEST_CHANGE', id, kind: 'details', details: { driver: 'Kumar' }, note: '' }), s);
  s = run(s, { type: 'REQUEST_CHANGE', id, kind: 'details', details: { driver: 'Kumar', driverPhone: '9900112233' }, note: 'Prakash fell sick', by: 'Ramesh', actor: 'Dispatch staff' });
  const req = s.requests.at(-1);
  assert.equal(req.status, 'pending');
  // only one open request per load; staff cannot approve
  assert.equal(run(s, { type: 'REQUEST_CHANGE', id, kind: 'came_back', note: 'x' }), s);
  assert.equal(run(s, { type: 'DECIDE_REQUEST', reqId: req.id, approve: true, actor: 'Dispatch staff' }), s);
  s = run(s, { type: 'DECIDE_REQUEST', reqId: req.id, approve: true, actor: 'Owner' });
  assert.equal(shipmentOf(s, id).driver, 'Kumar');
  assert.equal(s.requests.at(-1).status, 'approved');
  assert.ok(shipmentOf(s, id).audit.some((a: any) => a.detail.includes('Prakash fell sick')));
});

test('owner says no: nothing changes', () => {
  let [s, id] = sentTransfer(buildInitialState());
  s = run(s, { type: 'REQUEST_CHANGE', id, kind: 'came_back', note: 'gate closed' });
  s = run(s, { type: 'DECIDE_REQUEST', reqId: s.requests.at(-1).id, approve: false, note: 'wait till morning', actor: 'Owner' });
  assert.equal(shipmentOf(s, id).cancelledAt, null);
  assert.equal(s.requests.at(-1).status, 'rejected');
});

test('accident: good pieces moved to another truck, receiver counts, differences are accident ones', () => {
  let [s, id] = sentTransfer(buildInitialState());
  s = run(s, { type: 'REQUEST_CHANGE', id, kind: 'accident', outcome: 'moved', details: { truckNo: 'KA 09 C 4410' }, place: 'Mandya', note: 'Truck tipped over' });
  s = run(s, { type: 'DECIDE_REQUEST', reqId: s.requests.at(-1).id, approve: true, actor: 'Owner' });
  assert.equal(shipmentOf(s, id).truckNo, 'KA 09 C 4410');
  s = run(s, { type: 'SUBMIT_RECEIPT', id, token: 'tok123', by: 'Ravi', lines: { L1: { counted: 90, damaged: 5 }, L2: { counted: 50, damaged: 0 } } });
  const ds = diffsOf(s, id);
  assert.ok(ds.length && ds.every((d: any) => d.cause === 'accident'));
  assert.deepEqual(optionsFor(shipmentOf(s, id), ds[0]), ['claim', 'write_off', 'investigate']);
  s = run(s, { type: 'DECIDE', diffId: ds[0].id, action: 'claim', dueAt: Date.now() + 86400000, note: 'Insurance claim filed', actor: 'Owner' });
  assert.equal(diffsOf(s, id)[0].status, 'waiting');
});

test('accident: goods collected and sent back; old link stops; sender counts what came back', () => {
  let [s, id] = sentTransfer(buildInitialState());
  s = run(s, { type: 'REQUEST_CHANGE', id, kind: 'accident', outcome: 'returned', note: 'Lorry crashed; loaded what was left into a tempo' });
  const reqId = s.requests.at(-1).id;
  assert.equal(run(s, { type: 'DECIDE_REQUEST', reqId, approve: true, actor: 'Owner' }), s, 'needs a new link token');
  s = run(s, { type: 'DECIDE_REQUEST', reqId, approve: true, token: 'back999', actor: 'Owner' });
  assert.ok(shipmentOf(s, id).returning);
  assert.equal(run(s, { type: 'SUBMIT_RECEIPT', id, token: 'tok123', by: 'Ravi', lines: { L1: { counted: 100, damaged: 0 }, L2: { counted: 50, damaged: 0 } } }), s, 'receiver link no longer works');
  s = run(s, { type: 'SUBMIT_RECEIPT', id, token: 'back999', by: 'Mysuru stores', lines: { L1: { counted: 70, damaged: 10 }, L2: { counted: 50, damaged: 0 } } });
  const back = draftsFor(s, id).find((d: any) => d.purpose === 'receipt');
  assert.ok(back.moves.some((m: any) => m.qty === 60 && m.to !== 'Damaged stock' && m.to.includes('Mysuru')), JSON.stringify(back.moves));
  assert.deepEqual(diffsOf(s, id).map((d: any) => [d.kind, d.qty, d.cause]), [['damaged', 10, 'accident'], ['short', 30, 'accident']]);
});

test('customer counted our load: owner agrees or disagrees (with a reason), once', () => {
  let s = buildInitialState();
  const id = 'TRK-1015'; // Sunrise counted 303 of 300
  assert.ok(shipmentOf(s, id).receipt);
  assert.equal(run(s, { type: 'RESPOND_COUNT', id, agree: false, note: '', actor: 'Owner' }), s, 'a reason is needed to disagree');
  assert.equal(run(s, { type: 'RESPOND_COUNT', id, agree: true, actor: 'Dispatch staff' }), s, 'only the owner answers');
  s = run(s, { type: 'RESPOND_COUNT', id, agree: false, note: 'CCTV shows 300 loaded', actor: 'Owner' });
  assert.equal(shipmentOf(s, id).response.agree, false);
  assert.equal(run(s, { type: 'RESPOND_COUNT', id, agree: true, actor: 'Owner' }), s, 'answered once');
  const [t2, own] = sentTransfer(buildInitialState());
  const t3 = run(t2, { type: 'SUBMIT_RECEIPT', id: own, token: 'tok123', by: 'Ravi', lines: { L1: { counted: 99, damaged: 0 }, L2: { counted: 50, damaged: 0 } } });
  assert.equal(run(t3, { type: 'RESPOND_COUNT', id: own, agree: true, actor: 'Owner' }), t3, 'own units: nothing to agree with');
});

console.log(`\n${passed} tests passed`);
