// The accountant pack: a printable report of the entries to pass, in Tally import order.
import { COMPANY, ITEMS, PARTIES, UNITS } from '../data/seed.ts';
import { DRAFT_LABEL, route } from '../core.ts';
import { taxLines } from './tax.ts';
import { inr, dateTime } from './format.ts';

const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const partyOf = (d: any) => d.partyInfo || (d.party ? PARTIES[d.party] : null);

export function entryAmount(d: any) {
  const p = partyOf(d);
  if (!d.lines || !p) return null;
  if (d.type === 'receipt_note') return d.lines.reduce((a: number, l: any) => a + l.qty * l.rate, 0);
  return taxLines(d.lines, p, d.fromState).total;
}

export function entryLines(d: any): string[] {
  if (d.moves) return d.moves.map((m: any) => `${m.qty} ${ITEMS[m.item].unit} ${ITEMS[m.item].name}: ${m.from} → ${m.to}`);
  const p = partyOf(d);
  const t = d.type === 'receipt_note' ? null : taxLines(d.lines, p, d.fromState);
  const rows = d.lines.map((l: any) => `${l.qty} ${ITEMS[l.item].unit} ${ITEMS[l.item].name} @ ${inr(l.rate, 0)}`);
  if (t) rows.push(`Taxable ${inr(t.taxable)} + ${t.igst ? `IGST ${inr(t.igst)}` : `CGST ${inr(t.cgst)} + SGST ${inr(t.sgst)}`} = ${inr(t.total)}`);
  return rows;
}

export function reportHtml(state: any, drafts: any[], title: string) {
  const rows = drafts.map((d, i) => {
    const s = state.shipments.find((x: any) => x.id === d.shipmentId);
    const p = partyOf(d);
    const amt = entryAmount(d);
    return `<tr>
      <td>${i + 1}</td>
      <td><b>${esc(DRAFT_LABEL[d.type])}</b><br><span class="m">${esc(d.id)}</span></td>
      <td>${p ? `${esc(p.name)}<br><span class="m">${esc(p.gstin || '')}</span>` : '—'}</td>
      <td>${entryLines(d).map(esc).join('<br>')}<div class="n">${esc(d.narration)}</div></td>
      <td>${esc(s.id)}<br><span class="m">${esc(route(s))} · ${esc(s.ref)}</span></td>
      <td class="r">${amt != null ? esc(inr(amt)) : '—'}</td>
    </tr>`;
  }).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;margin:24px;font-size:12px}
  h1{font-size:18px;margin:0}.sub{color:#475569;margin:4px 0 16px}
  table{width:100%;border-collapse:collapse}th,td{border:1px solid #cbd5e1;padding:6px;vertical-align:top;text-align:left}
  th{background:#f1f5f9;font-size:11px}.r{text-align:right;white-space:nowrap}.m{color:#64748b;font-size:10px}.n{color:#475569;font-style:italic;margin-top:4px}
  .foot{margin-top:16px;color:#475569;font-size:11px}
  @media print{body{margin:10mm}}
</style></head><body>
<h1>${esc(COMPANY.name)}: entries for Tally</h1>
<div class="sub">${esc(title)} · ${drafts.length} entr${drafts.length === 1 ? 'y' : 'ies'}, in import order (stock journals, then receipts and branch invoices, then debit/credit notes and invoices).</div>
<table><thead><tr><th>#</th><th>Entry</th><th>Party</th><th>Items</th><th>Truck</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div class="foot">Prepared by LoadMatch from counted trucks and the owner's decisions. Ledger and godown names must match your Tally masters. Voucher numbers are left to Tally.</div>
</body></html>`;
}

// Open the report in a new tab and bring up the print dialog (save as PDF from there)
export function printReport(html: string) {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open(); w.document.write(html); w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch { /* ignore */ } }, 300);
  return true;
}

export function packSummary(state: any, drafts: any[], when: number) {
  const total = drafts.reduce((a, d) => a + (entryAmount(d) || 0), 0);
  const byType: Record<string, number> = {};
  for (const d of drafts) byType[DRAFT_LABEL[d.type]] = (byType[DRAFT_LABEL[d.type]] || 0) + 1;
  return `${COMPANY.name}: Tally entries, ${dateTime(when)}\n${Object.entries(byType).map(([k, n]) => `• ${n} × ${k}`).join('\n')}\nValue in party entries: ${inr(total)}\nThe printed report and Tally file follow.`;
}

// A delivery challan for a move with no money (goods moving between own units). Everything comes from the
// dispatch list; the company checks the format against its own challan book.
export function challanHtml(state: any, s: any, qr = '') {
  const from = UNITS[s.fromUnit];
  const jw = s.flow === 'jobwork_out';
  const to = jw ? { name: PARTIES[s.party].name } : UNITS[s.toUnit];
  const tax = (u: string) => state.settings.units?.[u] || { gstin: COMPANY.gstin, state: COMPANY.state };
  const rows = s.lines.map((l: any, i: number) => {
    const it = ITEMS[l.item];
    return `<tr><td>${i + 1}</td><td>${esc(it.name)}</td><td>${esc(it.hsn)}</td><td class="r">${l.qty} ${esc(it.unit)}</td><td class="r">${esc(inr(l.qty * it.rate))}</td></tr>`;
  }).join('');
  const total = s.lines.reduce((a: number, l: any) => a + l.qty * ITEMS[l.item].rate, 0);
  const d = new Date(s.loading?.endAt || s.createdAt);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Delivery challan ${esc(s.ref)}</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;margin:24px;font-size:12px}
h1{font-size:18px;margin:0 0 2px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #94a3b8;padding:6px;text-align:left;vertical-align:top}
th{background:#f1f5f9}.r{text-align:right}.g{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.b{border:1px solid #94a3b8;padding:8px}
.s{margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px}.s div{border-top:1px solid #0f172a;padding-top:4px}@media print{body{margin:10mm}}</style></head><body>
${qr ? `<div style="float:right;text-align:center;font-size:10px;color:#475569"><img src="${qr}" width="120" height="120" alt="QR"/><div>Receiver: scan to count</div></div>` : ''}<h1>Delivery challan</h1><div>${esc(COMPANY.name)} · ${jw ? `Goods sent for job work, to be returned within one year (by ${esc(new Date((s.sentAt || s.createdAt) + 365 * 86400000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }))}). Not a sale.` : 'Transfer between own units, no sale'}</div>
<div class="g">
  <div class="b"><b>Challan no.</b> ${esc(s.ref)}<br><b>Date</b> ${esc(d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }))}<br><b>Vehicle</b> ${esc(s.truckNo)}<br><b>LoadMatch ref</b> ${esc(s.id)}</div>
  <div class="b"><b>From</b> ${esc(from.name)}<br>GSTIN ${esc(tax(s.fromUnit).gstin)}, ${esc(tax(s.fromUnit).state)}<br><b>To</b> ${esc(to.name)}<br>GSTIN ${esc(jw ? PARTIES[s.party].gstin : tax(s.toUnit).gstin)}, ${esc(jw ? PARTIES[s.party].state : tax(s.toUnit).state)}</div>
</div>
<table><thead><tr><th>#</th><th>Item</th><th>HSN</th><th class="r">Quantity</th><th class="r">Value</th></tr></thead><tbody>${rows}
<tr><td></td><td colspan="3"><b>Total</b></td><td class="r"><b>${esc(inr(total))}</b></td></tr></tbody></table>
<div class="s"><div>Sent by (sign)</div><div>Received by (sign)</div></div>
</body></html>`;
}
