import React from 'react';
import { X, BookOpen } from 'lucide-react';

const SOPS: [string, string[]][] = [
  ['1 · Dispatch (sender)', [
    'Make the list before loading: type it, speak the quantities, or paste from Excel. Add a photo of the dispatch list, challan or order.',
    'Between your own units, choose "No money (stock transfer)" or "With invoice and GST". The app suggests one from the units\' GSTINs; you decide. For no money, print the delivery challan from the app.',
    'Tap "Loading started" and "Loading finished" and pick the dock or gate. This time window is how the owner finds the CCTV footage.',
    'When the truck leaves, send the receiver link on WhatsApp. You will see the result here when they submit.',
  ]],
  ['2 · Receive (floor staff)', [
    'Open the link, or the Receive tab for trucks coming to your unit and supplier deliveries at the gate.',
    'Count one line at a time. Tap the mic and say the number, e.g. "48" or "48, 2 damaged", in your language. Check what was heard; fix with + and −.',
    'The sent quantity is hidden while you count. Your count is saved on the phone as you go.',
    'Add photos of damage or the delivery note, then submit once. The count locks; you then see sent vs counted and can tell the sender on WhatsApp.',
  ]],
  ['3 · Owner', [
    'You see only differences, already compared. Decide each one: write off, replacement, debit or credit note, bill the extra, or investigate first.',
    'Ask the sender to explain with one tap. Attach the CCTV clip and share the evidence pack only with the people who need it.',
    'Losses above your limit need a tick to confirm. Promises get a due date; mark them done when they happen.',
  ]],
  ['4 · Accountant (no login)', [
    'The owner sends the ready entries as a printable report and one Tally file, already in import order. Until they are sent, the owner can undo a decision.',
    'Ledger and godown names must match your Tally masters (Goods in Transit, Damaged Goods, Transit Loss, Branch Transfer). Try the file on a test company first. Invoices themselves are still made in Tally.',
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
