// Staff cannot change a load after it left: they ask the owner, the owner approves or says no.
// Covers: new truck / driver / e-way bill, truck came back, accident on the way.
import { me } from '../lib/who.ts';
import React, { useState } from 'react';
import { AlertTriangle, Clock, Check, X, Truck, Siren, Undo2, Send } from 'lucide-react';
import { useStore, loadName, route, receiverPath } from '../store.tsx';
import { newToken } from './ui.tsx';
import { when } from '../lib/format.ts';

const L: Record<string, Record<string, string>> = {
  en: { ask: 'Something changed on the way? Ask the owner', details: 'New truck or driver', cameBack: 'Truck came back', accident: 'Accident on the way', truckNo: 'New truck number', driver: 'New driver', phone: 'Driver phone', eway: 'New e-way bill no.', why: 'What happened?', place: 'Where? (place)', moved: 'Good pieces moved to another truck, going on', returned: 'Goods collected, coming back to us', send: 'Send to owner', back: 'Back', waiting: 'Waiting for the owner', said: 'Owner said', yes: 'yes', no: 'no', needWhy: 'Say what happened', needTruck: 'Write the new truck number', needOne: 'Change at least one detail', countBack: 'Count what came back', returning: 'Accident: goods are coming back here. Count them when they arrive; whatever is missing or broken goes to the owner.', accidentMoved: 'Accident on the way: good pieces moved to truck' },
  hi: { ask: 'रास्ते में कुछ बदला? मालिक से पूछें', details: 'नया ट्रक या ड्राइवर', cameBack: 'ट्रक वापस आया', accident: 'रास्ते में दुर्घटना', truckNo: 'नया ट्रक नंबर', driver: 'नया ड्राइवर', phone: 'ड्राइवर फ़ोन', eway: 'नया ई-वे बिल नं.', why: 'क्या हुआ?', place: 'कहाँ? (जगह)', moved: 'अच्छा माल दूसरे ट्रक में, आगे जा रहा है', returned: 'माल इकट्ठा करके वापस आ रहा है', send: 'मालिक को भेजें', back: 'वापस', waiting: 'मालिक के जवाब का इंतज़ार', said: 'मालिक ने कहा', yes: 'हाँ', no: 'नहीं', needWhy: 'क्या हुआ लिखें', needTruck: 'नया ट्रक नंबर लिखें', needOne: 'कम से कम एक बदलाव लिखें', countBack: 'जो वापस आया उसे गिनें', returning: 'दुर्घटना: माल यहाँ वापस आ रहा है। आने पर गिनें; जो कम या टूटा है वह मालिक के पास जाएगा।', accidentMoved: 'रास्ते में दुर्घटना: अच्छा माल इस ट्रक में' },
  kn: { ask: 'ದಾರಿಯಲ್ಲಿ ಏನಾದರೂ ಬದಲಾಯಿತೇ? ಮಾಲೀಕರನ್ನು ಕೇಳಿ', details: 'ಹೊಸ ಲಾರಿ ಅಥವಾ ಡ್ರೈವರ್', cameBack: 'ಲಾರಿ ವಾಪಸ್ ಬಂತು', accident: 'ದಾರಿಯಲ್ಲಿ ಅಪಘಾತ', truckNo: 'ಹೊಸ ಲಾರಿ ನಂಬರ್', driver: 'ಹೊಸ ಡ್ರೈವರ್', phone: 'ಡ್ರೈವರ್ ಫೋನ್', eway: 'ಹೊಸ ಇ-ವೇ ಬಿಲ್ ನಂ.', why: 'ಏನಾಯಿತು?', place: 'ಎಲ್ಲಿ? (ಊರು)', moved: 'ಚೆನ್ನಾಗಿರುವ ಸಾಮಾನು ಬೇರೆ ಲಾರಿಯಲ್ಲಿ ಮುಂದೆ ಹೋಗುತ್ತಿದೆ', returned: 'ಸಾಮಾನು ಒಟ್ಟು ಮಾಡಿ ವಾಪಸ್ ಬರುತ್ತಿದೆ', send: 'ಮಾಲೀಕರಿಗೆ ಕಳುಹಿಸಿ', back: 'ಹಿಂದೆ', waiting: 'ಮಾಲೀಕರ ಉತ್ತರಕ್ಕೆ ಕಾಯುತ್ತಿದೆ', said: 'ಮಾಲೀಕರು ಹೇಳಿದರು', yes: 'ಹೌದು', no: 'ಇಲ್ಲ', needWhy: 'ಏನಾಯಿತು ಬರೆಯಿರಿ', needTruck: 'ಹೊಸ ಲಾರಿ ನಂಬರ್ ಬರೆಯಿರಿ', needOne: 'ಕನಿಷ್ಠ ಒಂದು ಬದಲಾವಣೆ ಬರೆಯಿರಿ', countBack: 'ವಾಪಸ್ ಬಂದದ್ದನ್ನು ಎಣಿಸಿ', returning: 'ಅಪಘಾತ: ಸಾಮಾನು ಇಲ್ಲಿಗೆ ವಾಪಸ್ ಬರುತ್ತಿದೆ. ಬಂದಾಗ ಎಣಿಸಿ; ಕಡಿಮೆ ಅಥವಾ ಒಡೆದದ್ದು ಮಾಲೀಕರಿಗೆ ಹೋಗುತ್ತದೆ.', accidentMoved: 'ದಾರಿಯಲ್ಲಿ ಅಪಘಾತ: ಚೆನ್ನಾಗಿರುವ ಸಾಮಾನು ಈ ಲಾರಿಯಲ್ಲಿ' },
  te: { ask: 'దారిలో ఏదైనా మారిందా? యజమానిని అడగండి', details: 'కొత్త లారీ లేదా డ్రైవర్', cameBack: 'లారీ తిరిగి వచ్చింది', accident: 'దారిలో ప్రమాదం', truckNo: 'కొత్త లారీ నంబర్', driver: 'కొత్త డ్రైవర్', phone: 'డ్రైవర్ ఫోన్', eway: 'కొత్త ఇ-వే బిల్ నం.', why: 'ఏం జరిగింది?', place: 'ఎక్కడ? (ఊరు)', moved: 'మంచి సరుకు వేరే లారీలో ముందుకు వెళ్తోంది', returned: 'సరుకు సేకరించి తిరిగి వస్తోంది', send: 'యజమానికి పంపండి', back: 'వెనక్కి', waiting: 'యజమాని జవాబు కోసం ఎదురుచూస్తోంది', said: 'యజమాని చెప్పారు', yes: 'అవును', no: 'కాదు', needWhy: 'ఏం జరిగిందో రాయండి', needTruck: 'కొత్త లారీ నంబర్ రాయండి', needOne: 'కనీసం ఒక మార్పు రాయండి', countBack: 'తిరిగి వచ్చినది లెక్కించండి', returning: 'ప్రమాదం: సరుకు ఇక్కడికి తిరిగి వస్తోంది. వచ్చాక లెక్కించండి; తక్కువ లేదా పగిలినది యజమానికి వెళ్తుంది.', accidentMoved: 'దారిలో ప్రమాదం: మంచి సరుకు ఈ లారీలో' },
};
const w = (lang: string, k: string) => (L[lang] || L.en)[k] || L.en[k];
const inp = 'w-full p-2 rounded-lg border border-slate-300 bg-white text-xs';

// ---------- sender's side: ask the owner ----------
export function AskOwner({ s, lang }: { s: any; lang: string }) {
  const { state, dispatch } = useStore();
  const [kind, setKind] = useState<string | null>(null);
  const [f, setF] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState('returned');
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  const reqs = (state.requests || []).filter((r: any) => r.shipmentId === s.id);
  const pending = reqs.find((r: any) => r.status === 'pending');
  const last = reqs.filter((r: any) => r.status !== 'pending').at(-1);

  if (s.returning && !s.receipt) {
    return (
      <div className="space-y-2">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-950"><Siren className="w-4 h-4 inline mr-1" />{w(lang, 'returning')}{s.accident?.note && <div className="mt-1 text-rose-800">“{s.accident.note}”</div>}</div>
        {false ? <div id="count-back-store" className="text-[11px] text-slate-700">The store will count them in LoadMatch (Store → Trucks to count) when they arrive.</div> :
        <a id="btn-count-back" href={receiverPath(s, state.settings)} className="w-full min-h-[52px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center cursor-pointer"><Undo2 className="w-5 h-5 mr-2" />{w(lang, 'countBack')}</a>}
      </div>
    );
  }
  if (!s.sentAt || s.receipt || s.cancelledAt) return null;

  const outcomeNote = last && <div className={`text-[11px] ${last.status === 'approved' ? 'text-emerald-800' : 'text-rose-800'}`}>{w(lang, 'said')}: <b>{w(lang, last.status === 'approved' ? 'yes' : 'no')}</b>{last.decidedNote ? ` · ${last.decidedNote}` : ''}</div>;
  if (pending) return (
    <div id="ask-pending" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 space-y-1">
      <div className="font-bold"><Clock className="w-3.5 h-3.5 inline mr-1" />{w(lang, 'waiting')}</div>
      <div>{w(lang, pending.kind === 'accident' ? 'accident' : pending.kind === 'came_back' ? 'cameBack' : 'details')}: “{pending.note}”</div>
    </div>
  );
  if (!kind) return (
    <div className="space-y-1.5">
      {s.accident && <div className="text-[11px] text-rose-800"><Siren className="w-3.5 h-3.5 inline mr-1" />{w(lang, 'accidentMoved')} {s.truckNo}</div>}
      {outcomeNote}
      <div className="text-[11px] font-bold text-slate-600">{w(lang, 'ask')}</div>
      <div className="grid grid-cols-3 gap-1.5">
        <button id="ask-details" onClick={() => { setKind('details'); setF({ truckNo: 'KA 09 C 7788', driver: 'Suresh', note: 'Truck broke down near Srirangapatna. Goods moved to another truck.' }); }} className="py-2 rounded-lg border border-slate-300 bg-white text-[11px] font-bold cursor-pointer"><Truck className="w-4 h-4 mx-auto mb-0.5" />{w(lang, 'details')}</button>
        <button id="ask-came-back" onClick={() => { setKind('came_back'); setF({ note: 'Road closed after Mandya. Driver brought the truck back.' }); }} className="py-2 rounded-lg border border-slate-300 bg-white text-[11px] font-bold cursor-pointer"><Undo2 className="w-4 h-4 mx-auto mb-0.5" />{w(lang, 'cameBack')}</button>
        <button id="ask-accident" onClick={() => { setKind('accident'); setF({ place: 'Mandya', note: 'Truck hit a divider. Driver is safe. Some sheets broke.' }); }} className="py-2 rounded-lg border border-rose-300 bg-rose-50 text-rose-800 text-[11px] font-bold cursor-pointer"><Siren className="w-4 h-4 mx-auto mb-0.5" />{w(lang, 'accident')}</button>
      </div>
    </div>
  );
  const details = { truckNo: f.truckNo || '', driver: f.driver || '', driverPhone: f.driverPhone || '', ewayBill: f.ewayBill || '' };
  const missing = !String(f.note || '').trim() ? w(lang, 'needWhy')
    : kind === 'details' && !Object.values(details).some((v) => v.trim()) ? w(lang, 'needOne')
    : kind === 'accident' && outcome === 'moved' && !details.truckNo.trim() ? w(lang, 'needTruck') : '';
  const send = () => {
    dispatch({ type: 'REQUEST_CHANGE', id: s.id, kind, outcome: kind === 'accident' ? outcome : null, details, place: f.place || '', note: f.note, by: me(), actor: me() });
    setKind(null); setF({});
  };
  return (
    <div className={`rounded-xl border p-3 space-y-2 text-xs ${kind === 'accident' ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}>
      <div className="font-bold">{w(lang, kind === 'accident' ? 'accident' : kind === 'came_back' ? 'cameBack' : 'details')}</div>
      {kind === 'accident' && (
        <div className="space-y-1">
          {['returned', 'moved'].map((o) => (
            <label key={o} className="flex items-start gap-2"><input type="radio" name="outcome" id={`acc-${o}`} checked={outcome === o} onChange={() => setOutcome(o)} className="mt-0.5" />{w(lang, o)}</label>
          ))}
          <input id="acc-place" value={f.place || ''} onChange={(e) => set('place', e.target.value)} placeholder={w(lang, 'place')} className={inp} />
        </div>
      )}
      {(kind === 'details' || (kind === 'accident' && outcome === 'moved')) && (
        <div className="grid grid-cols-2 gap-1.5">
          <input id="ask-truck" value={f.truckNo || ''} onChange={(e) => set('truckNo', e.target.value.toUpperCase())} placeholder={w(lang, 'truckNo')} className={inp} />
          <input id="ask-driver" value={f.driver || ''} onChange={(e) => set('driver', e.target.value)} placeholder={w(lang, 'driver')} className={inp} />
          <input id="ask-phone" value={f.driverPhone || ''} onChange={(e) => set('driverPhone', e.target.value)} placeholder={w(lang, 'phone')} className={inp} inputMode="tel" />
          {kind === 'details' && <input id="ask-eway" value={f.ewayBill || ''} onChange={(e) => set('ewayBill', e.target.value)} placeholder={w(lang, 'eway')} className={inp} />}
        </div>
      )}
      <textarea id="ask-why" value={f.note || ''} onChange={(e) => set('note', e.target.value)} rows={2} placeholder={w(lang, 'why')} className={inp} />
      {missing && <div className="text-[10px] text-amber-900">{missing}</div>}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => { setKind(null); setF({}); }} className="py-2.5 rounded-lg border border-slate-300 bg-white font-bold cursor-pointer">{w(lang, 'back')}</button>
        <button id="ask-send" disabled={!!missing} onClick={send} className="py-2.5 rounded-lg bg-slate-900 disabled:opacity-40 text-white font-bold cursor-pointer"><Send className="w-3.5 h-3.5 inline mr-1" />{w(lang, 'send')}</button>
      </div>
    </div>
  );
}

// ---------- owner's side: requests waiting for a yes or no ----------
const KIND_TEXT: Record<string, string> = { details: 'Change truck or driver', came_back: 'Truck came back', accident: 'Accident on the way' };
const FIELD: Record<string, string> = { truckNo: 'Truck', driver: 'Driver', driverPhone: 'Driver phone', ewayBill: 'E-way bill' };

export function OwnerRequests({ go }: { go?: (v: string, o?: any) => void } = {}) {
  const { state, dispatch } = useStore();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const pending = (state.requests || []).filter((r: any) => r.status === 'pending').sort((a: any, b: any) => b.at - a.at); // newest first
  const decided = (state.requests || []).filter((r: any) => r.status !== 'pending').sort((a: any, b: any) => b.decidedAt - a.decidedAt).slice(0, 3);
  const now = Date.now();
  if (!pending.length) return (
    <div id="owner-requests" className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Staff requests · none waiting</div>
      <Decided list={decided} now={now} />
    </div>
  );
  return (
    <div id="owner-requests" className="bg-white border-2 border-amber-300 rounded-xl p-4 space-y-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Staff are asking you · {pending.length}</div>
      {pending.map((r: any) => {
        if (r.kind === 'add' && r.what === 'delivery') return (
          <div key={r.id} id={`req-${r.id}`} className="rounded-xl border border-sky-200 bg-sky-50 p-3 space-y-2 text-xs">
            <div className="flex items-start justify-between gap-2"><div className="font-bold text-slate-900">🚛 Truck came that is not in the list: “{r.name}”</div><span className="text-[10px] text-slate-500 shrink-0">{r.by}, {when(r.at, now)}</span></div>
            <div className="text-slate-600">Add it as an expected delivery (supplier, items from their bill, which unit). The store then counts it.</div>
            <div className="grid grid-cols-2 gap-2">
              <button id={`req-add-delivery-${r.id}`} onClick={() => { dispatch({ type: 'DECIDE_REQUEST', reqId: r.id, approve: true, note: 'Added; please count it.', actor: 'Owner' }); go?.('dispatch', { id: 'new:inbound' }); }} className="py-2.5 rounded-lg bg-emerald-600 text-white font-bold cursor-pointer">+ Add delivery</button>
              <button id={`req-no-${r.id}`} onClick={() => dispatch({ type: 'DECIDE_REQUEST', reqId: r.id, approve: false, note: 'Do not unload. Not ordered.', actor: 'Owner' })} className="py-2.5 rounded-lg border border-slate-300 bg-white font-bold cursor-pointer">Not ours, send back</button>
            </div>
          </div>
        );
        if (r.kind === 'add') return (
          <div key={r.id} id={`req-${r.id}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2 text-xs">
            <div className="flex items-start justify-between gap-2"><div className="font-bold text-slate-900">Add a new {r.what === 'item' ? 'item' : r.partyKind}: “{r.name}”</div><span className="text-[10px] text-slate-500 shrink-0">{r.by}, {when(r.at, now)}</span></div>
            <div className="text-slate-600">Not in the list when making a truck list. Yes adds it now; staff can pick it straight away. You can fill GST no. and rate later in Setup.</div>
            <div className="grid grid-cols-2 gap-2">
              <button id={`req-no-${r.id}`} onClick={() => dispatch({ type: 'DECIDE_REQUEST', reqId: r.id, approve: false, actor: 'Owner' })} className="py-2.5 rounded-lg border border-slate-300 bg-white font-bold cursor-pointer"><X className="w-3.5 h-3.5 inline mr-1" />No</button>
              <button id={`req-yes-${r.id}`} onClick={() => dispatch({ type: 'DECIDE_REQUEST', reqId: r.id, approve: true, actor: 'Owner' })} className="py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"><Check className="w-3.5 h-3.5 inline mr-1" />Yes, add it</button>
            </div>
          </div>
        );
        const s = state.shipments.find((x: any) => x.id === r.shipmentId);
        const changes = Object.entries(r.details || {}).filter(([, v]) => String(v || '').trim());
        return (
          <div key={r.id} id={`req-${r.id}`} className={`rounded-xl border p-3 space-y-2 text-xs ${r.kind === 'accident' ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-bold text-slate-900">{r.kind === 'accident' && <Siren className="w-4 h-4 inline mr-1 text-rose-700" />}{KIND_TEXT[r.kind]} · {loadName(r.shipmentId)}</div>
                <div className="text-slate-600">{s ? `${route(s)} · Truck ${s.truckNo}` : ''}</div>
              </div>
              <span className="text-[10px] text-slate-500 shrink-0">{r.by}, {when(r.at, now)}</span>
            </div>
            <div className="text-slate-800">“{r.note}”{r.place ? ` · near ${r.place}` : ''}</div>
            {r.kind === 'accident' && <div className="font-semibold text-rose-900">{r.outcome === 'moved' ? 'Good pieces moved to another truck; the receiver counts what arrives.' : 'Goods collected and coming back; we count them here. The old receiver link will stop working.'}</div>}
            {changes.length > 0 && <div className="space-y-0.5">{changes.map(([k, v]) => <div key={k}>{FIELD[k]}: <span className="line-through text-slate-400">{s?.[k] || '—'}</span> → <b>{String(v)}</b></div>)}</div>}
            {r.kind === 'came_back' && <div className="text-slate-700">The load will be closed, the receiver link will stop, and the stock goes back.</div>}
            <input value={notes[r.id] || ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} placeholder="Note to staff (optional)" className={inp} />
            <div className="grid grid-cols-2 gap-2">
              <button id={`req-no-${r.id}`} onClick={() => dispatch({ type: 'DECIDE_REQUEST', reqId: r.id, approve: false, note: notes[r.id] || '', actor: 'Owner' })} className="py-2.5 rounded-lg border border-slate-300 bg-white font-bold cursor-pointer"><X className="w-3.5 h-3.5 inline mr-1" />No</button>
              <button id={`req-yes-${r.id}`} onClick={() => dispatch({ type: 'DECIDE_REQUEST', reqId: r.id, approve: true, note: notes[r.id] || '', token: newToken(), actor: 'Owner' })} className="py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"><Check className="w-3.5 h-3.5 inline mr-1" />Yes, approve</button>
            </div>
          </div>
        );
      })}
      <div className="text-[10px] text-slate-500"><AlertTriangle className="w-3 h-3 inline mr-1" />Nothing changes until you say yes. Every request and answer stays in the load's history.</div>
      <Decided list={decided} now={now} />
    </div>
  );
}

// What the owner already answered (staff see the same answers on their Staff screen)
function Decided({ list, now }: { list: any[]; now: number }) {
  if (!list.length) return null;
  return (
    <div className="space-y-1 pt-1 border-t border-slate-100">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">You answered</div>
      {list.map((r: any) => (
        <div key={r.id} className="text-[11px] text-slate-700 flex justify-between gap-2">
          <span className="truncate">{r.kind === 'add' ? `${r.what === 'delivery' ? 'Truck' : 'Add'} “${r.name}”` : `${KIND_TEXT[r.kind]} · ${loadName(r.shipmentId)}`} · {r.by}</span>
          <b className={r.status === 'approved' ? 'text-emerald-700 shrink-0' : 'text-rose-700 shrink-0'}>{r.status === 'approved' ? 'Yes' : 'No'} · {when(r.decidedAt, now)}</b>
        </div>
      ))}
    </div>
  );
}
