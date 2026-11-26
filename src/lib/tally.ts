import { COMPANY, ITEMS, PARTIES } from '../data/seed.ts';
import { taxLines } from './tax.ts';
import { tallyDate } from './format.ts';

const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const amt = (n: number) => Number(n).toFixed(2);
const qty = (q: number, code: string) => ` ${q} ${esc(ITEMS[code].unit)}`;

// Draft Tally XML for an approved draft. Ledger and godown names (Sales, Purchase, Output CGST,
// Goods in Transit, ...) must match the company's own masters: import into a test company first.
// No VOUCHERNUMBER: Tally numbers vouchers in its own series.
function voucherBody(d: any) {
  if (d.type === 'match_note') return ''; // a note for the accountant, not a voucher
  const date = tallyDate(d.approvedAt || d.createdAt);
  let body = '';
  if (d.type === 'stock_journal') {
    const out = d.moves.map((m: any) => `
        <INVENTORYENTRIESOUT.LIST>
          <STOCKITEMNAME>${esc(ITEMS[m.item].name)}</STOCKITEMNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <ACTUALQTY>${qty(m.qty, m.item)}</ACTUALQTY>
          <BATCHALLOCATIONS.LIST><GODOWNNAME>${esc(m.from)}</GODOWNNAME><ACTUALQTY>${qty(m.qty, m.item)}</ACTUALQTY></BATCHALLOCATIONS.LIST>
        </INVENTORYENTRIESOUT.LIST>`).join('');
    const inn = d.moves.map((m: any) => `
        <INVENTORYENTRIESIN.LIST>
          <STOCKITEMNAME>${esc(ITEMS[m.item].name)}</STOCKITEMNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <ACTUALQTY>${qty(m.qty, m.item)}</ACTUALQTY>
          <BATCHALLOCATIONS.LIST><GODOWNNAME>${esc(m.to)}</GODOWNNAME><ACTUALQTY>${qty(m.qty, m.item)}</ACTUALQTY></BATCHALLOCATIONS.LIST>
        </INVENTORYENTRIESIN.LIST>`).join('');
    body = `
      <VOUCHER VCHTYPE="Stock Journal" ACTION="Create">
        <DATE>${date}</DATE>
        <VOUCHERTYPENAME>Stock Journal</VOUCHERTYPENAME>
        <NARRATION>${esc(d.narration)}</NARRATION>${out}${inn}
      </VOUCHER>`;
  } else if (d.type === 'receipt_note') {
    const p = d.partyInfo || PARTIES[d.party];
    const inv = d.lines.map((l: any) => `
        <ALLINVENTORYENTRIES.LIST>
          <STOCKITEMNAME>${esc(ITEMS[l.item].name)}</STOCKITEMNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <RATE>${amt(l.rate)}/${esc(ITEMS[l.item].unit)}</RATE>
          <AMOUNT>-${amt(l.qty * l.rate)}</AMOUNT>
          <ACTUALQTY>${qty(l.qty, l.item)}</ACTUALQTY>
          <BILLEDQTY>${qty(l.qty, l.item)}</BILLEDQTY>
          <BATCHALLOCATIONS.LIST><GODOWNNAME>${esc(l.godown)}</GODOWNNAME><AMOUNT>-${amt(l.qty * l.rate)}</AMOUNT><ACTUALQTY>${qty(l.qty, l.item)}</ACTUALQTY><BILLEDQTY>${qty(l.qty, l.item)}</BILLEDQTY></BATCHALLOCATIONS.LIST>
        </ALLINVENTORYENTRIES.LIST>`).join('');
    body = `
      <VOUCHER VCHTYPE="Receipt Note" ACTION="Create" OBJVIEW="Invoice Voucher View">
        <DATE>${date}</DATE>
        <VOUCHERTYPENAME>Receipt Note</VOUCHERTYPENAME>
        <PARTYLEDGERNAME>${esc(p.name)}</PARTYLEDGERNAME>
        <REFERENCE>${esc(d.ref)}</REFERENCE>
        <NARRATION>${esc(d.narration)}</NARRATION>${inv}
      </VOUCHER>`;
  } else {
    // party vouchers with GST: debit note to a supplier, credit note or sales invoice to a customer
    const p = d.partyInfo || PARTIES[d.party];
    const t = taxLines(d.lines, p, d.fromState);
    const vch = d.type === 'debit_note' ? 'Debit Note' : d.type === 'credit_note' ? 'Credit Note' : 'Sales';
    const itemLedger = d.type === 'debit_note' ? 'Purchase' : d.partyInfo ? 'Branch Transfer' : 'Sales';
    const taxPrefix = d.type === 'debit_note' ? 'Input' : 'Output';
    // party side: Dr on a debit note and a sales invoice, Cr on a credit note
    const partyDr = d.type !== 'credit_note';
    const lineDr = !partyDr;
    const sign = (dr: boolean) => (dr ? '-' : '');
    const inv = t.rows.map((r: any) => `
        <ALLINVENTORYENTRIES.LIST>
          <STOCKITEMNAME>${esc(ITEMS[r.item].name)}</STOCKITEMNAME>
          <ISDEEMEDPOSITIVE>${lineDr ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
          <RATE>${amt(r.rate)}/${esc(ITEMS[r.item].unit)}</RATE>
          <AMOUNT>${sign(lineDr)}${amt(r.value)}</AMOUNT>
          <ACTUALQTY>${qty(r.qty, r.item)}</ACTUALQTY>
          <BILLEDQTY>${qty(r.qty, r.item)}</BILLEDQTY>
          <ACCOUNTINGALLOCATIONS.LIST><LEDGERNAME>${itemLedger}</LEDGERNAME><ISDEEMEDPOSITIVE>${lineDr ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE><AMOUNT>${sign(lineDr)}${amt(r.value)}</AMOUNT></ACCOUNTINGALLOCATIONS.LIST>
        </ALLINVENTORYENTRIES.LIST>`).join('');
    const tax = (name: string, v: number) => (v ? `
        <LEDGERENTRIES.LIST><LEDGERNAME>${taxPrefix} ${name}</LEDGERNAME><ISDEEMEDPOSITIVE>${lineDr ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE><AMOUNT>${sign(lineDr)}${amt(v)}</AMOUNT></LEDGERENTRIES.LIST>` : '');
    body = `
      <VOUCHER VCHTYPE="${vch}" ACTION="Create" OBJVIEW="Invoice Voucher View">
        <DATE>${date}</DATE>
        <VOUCHERTYPENAME>${vch}</VOUCHERTYPENAME>
        <PARTYLEDGERNAME>${esc(p.name)}</PARTYLEDGERNAME>
        <PARTYGSTIN>${esc(p.gstin)}</PARTYGSTIN>
        <PLACEOFSUPPLY>${esc(d.type === 'debit_note' ? (d.fromState || COMPANY.state) : p.state)}</PLACEOFSUPPLY>
        <ISINVOICE>Yes</ISINVOICE>
        <REFERENCE>${esc(d.ref)}</REFERENCE>
        <NARRATION>${esc(d.narration)}</NARRATION>
        <LEDGERENTRIES.LIST><LEDGERNAME>${esc(p.name)}</LEDGERNAME><ISDEEMEDPOSITIVE>${partyDr ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE><AMOUNT>${sign(partyDr)}${amt(t.total)}</AMOUNT></LEDGERENTRIES.LIST>${tax('CGST', t.cgst)}${tax('SGST', t.sgst)}${tax('IGST', t.igst)}${inv}
      </VOUCHER>`;
  }
  return body;
}

const envelope = (body: string) => `<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES><SVCURRENTCOMPANY>${esc(COMPANY.name)}</SVCURRENTCOMPANY></STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">${body}
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>
`;

export const voucherXml = (d: any) => envelope(voucherBody(d));
// One file for a batch; pass drafts already sorted in import order
export const batchXml = (ds: any[]) => envelope(ds.map(voucherBody).join(''));

export async function download(filename: string, text: string, type = 'application/xml') {
  // Inside a claude.ai artifact preview, files go through the viewer's downloads capability.
  const host = (window as any).claude;
  if (host?.use) {
    try {
      const dl = await host.use('downloads');
      if (dl) { await dl.save({ filename, data: text }); return; }
    } catch { /* declined or unavailable: fall back below */ }
  }
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
