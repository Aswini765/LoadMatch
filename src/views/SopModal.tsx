import React from 'react';
import { X, BookOpen } from 'lucide-react';

const SOPS: [string, string[]][] = [
  ['Three people use LoadMatch', [
    'Staff: one person at each unit. Sends and receives trucks. Never types: taps, photos and voice.',
    'Owner: one card per truck that needs a decision, with one suggested next step.',
    'Accountant: a to-do list of debit notes, credit notes and bills from the owner\'s decisions.',
    'Customers and suppliers need no app: they get a WhatsApp link. Their owner can save the truck to their own company.',
  ]],
  ['1 · Staff: send a truck', [
    'Tap 📤 Send → choose where (🏭 our unit or 🏪 customer) → 📷 photo of the challan (items and numbers are read from it; fix with − +) → 📷 photo of the number plate (truck no. read, driver remembered) → 🚚 Truck left.',
    'Our other unit sees the truck at once under “Coming to you”. For a customer, the owner sends the count link.',
  ]],
  ['2 · Staff: receive a truck', [
    'Tap the truck under 🚚 Coming to you when it is at the gate (📍 Truck arrived → 🔢 Count).',
    '✅ All came → 📷 photo of the unloaded stack → Send to owner.',
    '⚠️ Something is wrong → 🎤 say it (“two bundles torn”) or tap − + for ❌ missing, 💔 damaged, ➕ extra → 📷 photo of the damage → Send to owner.',
    'The result is one line. The driver writes the shortage on the lorry receipt and signs.',
  ]],
  ['3 · Staff: answer the owner', [
    'When the owner asks “what happened?” about a truck you sent, tap one answer: left here (next truck), we loaded it all, or lost on the road.',
    '🔔 Updates shows the latest three. Problem with a truck (new truck, came back, accident)? Tap “Problem? Ask owner” on its card.',
  ]],
  ['4 · Owner: one card per truck', [
    'Difference found → ❓ Ask the sender (our unit answers in the app; a supplier answers from a WhatsApp link).',
    'Their answer comes back on the card with ONE suggested step, e.g. “Sending unit sends it in the next truck, by Sat”. Tap it. Other options are one tap away.',
    '🤖 The assistant reminds a sender who has not replied, watches the next trucks for promised goods, and reminds them when a promise is late.',
    'Extra goods and accidents get a suggestion straight away. Anything that costs money goes to the accountant.',
    'Staff requests: Yes or No, with a note. Things with nothing to do are under “Also today”.',
  ]],
  ['5 · Accountant', [
    'To do: each debit note, credit note or bill the owner\'s decisions need, with party and amount. Tick “Done in Tally”.',
    'The report to print and one Tally file with all stock entries.',
  ]],
  ['Prototype note', [
    'Reading the challan, the number plate and voice is simulated with demo data. In a real build: a photo-reading model, plate OCR and speech-to-text in Kannada, Hindi and Telugu, always confirmed by the staff member.',
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
