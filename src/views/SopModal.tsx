import React from 'react';
import { X, BookOpen } from 'lucide-react';

const SOPS: [string, string[]][] = [
  ['Two people use LoadMatch', [
    'Staff: one person at each unit. Sends stock and receives stock.',
    'Owner: sees everything, decides every difference, answers staff requests, and sets up the lists.',
    'Nobody else needs a login. Customers and suppliers get a link from the company WhatsApp; the accountant gets a file.',
  ]],
  ['1 · Staff: sending stock', [
    'Tap Send stock, then Our other unit or Customer.',
    'Pick items and type or say the numbers. Item not in the list? Tap “Ask owner”.',
    'Save, then Loading started and Loading finished. The truck cannot leave before this (the time helps check CCTV).',
    'Tap Truck left. Our other unit sees it straight away in its app; a customer gets the link from the company WhatsApp. The driver carries the challan with a QR code.',
    'After Truck left the list is locked. Need a change (new truck, came back, accident)? Ask the owner from the truck page.',
  ]],
  ['2 · Staff: receiving stock', [
    '“Stock coming to you” at the top shows every truck on its way, and from where.',
    'Tap Count. Count one item at a time; say the number into the mic or type it. Count damaged pieces separately.',
    'The sent number is hidden so you count what is really there. You do not enter missing pieces: the app works them out after you submit.',
    'Supplier at the gate? Receive stock → Supplier delivery, type what their bill says, then count.',
    'Submit once; the count locks. Any difference goes only to the owner.',
    'Short or damaged? Write it on the driver\'s lorry receipt before he leaves and add a photo.',
  ]],
  ['3 · Staff: checking later', [
    'To send and To receive: what is waiting for you now.',
    'On the way: trucks your unit sent that are not counted yet.',
    'Done: every old truck (sent, received, or with a difference). Read only.',
    'Asked the owner: every request with the answer: Waiting, Owner said YES or Owner said NO, and the owner\'s note.',
  ]],
  ['4 · Owner', [
    'Your day: today\'s trucks and money at risk.',
    'Staff are asking you: say Yes or No, with a note. Staff see your answer.',
    'Needs your decision: only what did not match, with its value and loading time. Choose: take the loss, ask for it to be sent or replaced, adjust in the next bill, or check first.',
    'Setup: add units (with GST no.), staff, items (one by one or pasted from Excel) and customers or suppliers. Staff only pick from these lists.',
    'For your accountant: one report and one Tally file. Send when ready.',
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
