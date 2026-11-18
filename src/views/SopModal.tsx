import React from 'react';
import { X, BookOpen } from 'lucide-react';

const SOPS: [string, string[]][] = [
  ['1 · Dispatch (the person sending)', [
    'Make the list before loading: type it, speak the numbers, or paste from Excel. Add the driver\'s name and phone, and a photo of the dispatch list, challan or order.',
    'Between your own units, choose "No money (stock transfer)" or "With invoice and GST". The app suggests one from the units\' GSTINs; you decide. For no money, print the delivery challan from the app.',
    'Tap "Loading started" and "Loading finished" and say where it is loaded. This time tells the owner where to look in the CCTV.',
    'Goods worth more than ₹50,000 usually need an e-way bill, even when nothing is sold. Write its number in the list.',
    'When the truck leaves, send the receiver link on WhatsApp. You will see the result here when they submit.',
    'Most loads are "To our other unit (next job)": goods move between your own units for the next step. If the load was made from goods that came in earlier, pick it under "Made from".',
    'If a truck comes back or never reaches, tap "Truck came back / did not reach" and write what happened. The receiver link stops working and the paperwork is undone.',
    'Sending goods to another company to process and send back is under "Other" (job work). It is not a sale; print the challan from the app. The job worker counts on arrival through the link.',
    'Carrying goods you promised a customer (the missing ones, or replacements)? Tick them on the list. When the customer counts them, the promise closes by itself.',
  ]],
  ['2 · Receive (floor staff)', [
    'Open the link, or the Receive tab for trucks coming to your unit, supplier deliveries at the gate, and goods coming back from job work (pick the load; what is still with the job worker is filled in).',
    'If a supplier\'s delivery brings the replacement they promised, tick it on the list. When it is counted, the promise closes by itself.',
    'Count one line at a time. Tap the mic and say the number, e.g. "48" or "48, 2 damaged", in your language. Check what was heard; fix with + and −.',
    'The sent quantity is hidden while you count. Your count is saved on the phone as you go.',
    'Add photos of damage or the delivery note, then submit once. The count locks; you then see what was sent next to what you counted, and can tell the sender on WhatsApp.',
    'If something is short or damaged: before the driver leaves, write it on his lorry receipt (bilty), get it signed, and add a photo. Transport claims need this.',
  ]],
  ['3 · Owner', [
    'You see only what did not match; the app has already compared. For each one choose what happens: take the loss, ask for it to be sent or replaced, adjust it in the next bill, pay or charge less now, charge for the extra, or check first.',
    'If a count looks wrong (for example 10 typed instead of 100), ask for a recount before deciding anything. The receiver gets the link again.',
    'Ask the sender to explain with one tap. Add the CCTV video and share the proof only with the people who need it.',
    'Losses above your limit need a tick to confirm. Promises get a due date; mark them done when they happen.',
    'Job work: see what is still with each job worker and how many days are left of the one-year limit. Send a reminder from there.',
  ]],
  ['4 · Accountant (no login)', [
    'The owner sends a report to print, and one Tally file that is already in the right order to load. Until it is sent, the owner can undo a decision.',
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
