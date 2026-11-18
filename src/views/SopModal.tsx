import React from 'react';
import { X, BookOpen } from 'lucide-react';

const SOPS: [string, string[]][] = [
  ['1 · Loading (dispatch staff)', [
    'Make the list before loading: type it or paste it from Excel. Item names come from the Tally item list.',
    'Tap "Loading started" when the first item goes on the truck and "Loading finished" when the last one does. Choose the loading point. This time window is how the owner finds the CCTV footage later.',
    'When the truck leaves, send the receiver link on WhatsApp. For a customer, send it to the person who receives the goods.',
  ]],
  ['2 · Supplier deliveries (gate)', [
    'Enter the quantities on the supplier bill, then tap "Count now" and count what is on the truck. Do not look at the bill while counting.',
  ]],
  ['3 · Receiving (anyone with the link)', [
    'Count every line. The sent quantity is hidden on purpose.',
    'Damaged units are counted too, then entered again under Damaged.',
    'Take photos of damage. Submit once: the count locks and goes to the owner.',
  ]],
  ['4 · Owner', [
    'Decide each difference: write off, debit or credit note, replacement, bill the extra, or investigate first.',
    'Losses above your limit need a tick to confirm.',
    'Promises (replacement, returns) get a due date. Mark them done when they happen.',
    'Attach the CCTV clip and share the evidence pack only with the people who need it.',
  ]],
  ['5 · Accountant', [
    'Approve entries once a day. Reject with a reason if something is wrong: a rejected decision goes back to the owner.',
    'Download the approved entries as one file. It is already in import order: stock journals, then receipt notes, then debit and credit notes and invoices.',
    'Ledger and godown names must match your Tally masters (Goods in Transit, Damaged Goods, Transit Loss). Try the file on a test company first.',
  ]],
];

export default function SopModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
          <div className="flex items-center space-x-2 text-sm font-bold text-slate-900"><BookOpen className="w-4 h-4 text-amber-600" /><span>How LoadMatch is used</span></div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 cursor-pointer" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4 text-xs">
          {SOPS.map(([h, items]) => (
            <div key={h} className="space-y-1.5">
              <div className="font-bold text-slate-900">{h}</div>
              <ul className="list-disc pl-4 space-y-1 text-slate-700 leading-relaxed">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
