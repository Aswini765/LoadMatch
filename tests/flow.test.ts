// LoadMatch flow checks through the real reducer. Run: npm test
import assert from 'node:assert/strict';
import {
  reducer, buildInitialState, shipmentOf, diffsOf, diffOf, shipmentStatus, receiptOverdue, diffOverdue, truckSummary, evidenceText, importOrder,
} from '../src/core.ts';
import { voucherXml } from '../src/lib/tally.ts';
import { taxLines } from '../src/lib/tax.ts';
import { PARTIES } from '../src/data/seed.ts';
import { findNumber } from '../src/lib/voice.ts';

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
  // last month's entries are already approved; only this week's trucks wait for the accountant
  const pending = s.drafts.filter((d: any) => d.status === 'pending');
  assert.deepEqual([...new Set(pending.map((d: any) => d.shipmentId))].sort(), ['TRK-1013', 'TRK-1014', 'TRK-1016']);
  assert.ok(s.drafts.filter((d: any) => d.status === 'approved' && d.exportedAt).length === 13);
  // downloading for Tally marks entries so the next batch never repeats them
  const ids = pending.map((d: any) => d.id);
  const t = run(s, { type: 'APPROVE_DRAFTS', ids, actor: 'Accountant' }, { type: 'EXPORT_DRAFTS', ids: ids.slice(0, 2), actor: 'Accountant' });
  assert.equal(t.drafts.filter((d: any) => d.status === 'approved' && !d.exportedAt).length, ids.length - 2);
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
  s = run(s, { type: 'REJECT_DRAFT', id: si.id, note: 'Customer says it will return them.', actor: 'Accountant' });
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

console.log(`\n${passed} tests passed`);
