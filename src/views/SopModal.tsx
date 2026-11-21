import React from 'react';
import { X, BookOpen } from 'lucide-react';

const SOPS: [string, string[]][] = [
  ['Two people use LoadMatch', [
    'Staff: one person at each unit. Sends stock and receives stock.',
    'Owner: sees everything, decides every difference, answers staff requests, and sets up the lists.',
    'Nobody else needs a login. Customers and suppliers get a link from the company WhatsApp; the accountant gets a file.',
  ]],
  ['1 · Staff: every truck has one big button', [
    'Sending: 📦 Start loading → ✅ Loading done → 🚚 Truck left.',
    'Receiving: 📍 Truck arrived (the store person taps it, not the driver) → 🔢 Count → Submit.',
    'To send: tap 📤 Send, then 🏭 Our other unit or 🏪 Customer. Choose items, numbers and the truck number. That is all.',
    'Supplier at the gate: tap 📥 Receive → 🚛 Supplier truck at the gate.',
    'While counting, the sent number is hidden. Missing pieces are worked out by the app after you submit.',
  ]],
  ['2 · Staff: updates', [
    '🔔 Updates shows the latest three: truck coming, truck reached, counted OK or not matching, and the owner\'s YES or NO.',
    'Problem with a truck (new truck, came back, accident)? Tap “Problem? Ask owner” on its card.',
    'Old trucks are under 🗂 Old trucks.',
  ]],
  ['3 · Owner', [
    'Your day: today\'s trucks and money at risk.',
    'Staff are asking you: say Yes or No, with a note. Staff see your answer.',
    'Needs your decision: only what did not match, with its value and loading time. Choose: take the loss, ask for it to be sent or replaced, adjust in the next bill, or check first.',
    'Setup: add units (with GST no.), staff, items (one by one or pasted from Excel) and customers or suppliers. Staff only pick from these lists.',
    'More (one button): trucks on the road, promises, the accountant file and recent trucks.',
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
