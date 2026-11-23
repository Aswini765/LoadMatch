import React, { useEffect, useRef, useState } from 'react';
import { useStore, route, diffsOf, countedByUs, atGate, receiverPath, loadName } from '../store.tsx';
import { UNITS, COMPANY } from '../data/seed.ts';
import { getUnit, setUnit, setMeName, me } from '../lib/who.ts';
import { PhoneFrame, savedLang, saveLang, newToken, shareWhatsApp, appLink } from './ui.tsx';
import { when } from '../lib/format.ts';
import type { Go } from './ui.tsx';

// Staff screen, made for people who read little: pictures, big buttons, one next step per truck, their language.
const uname = (id: string) => UNITS[id]?.name.split(' (')[0] || id;
const staffName = (state: any) => (state.staff || []).find((p: any) => p.unit === getUnit())?.name || 'Staff';

type L = 'en' | 'hi' | 'kn' | 'te';
const W: Record<string, Record<L, string>> = {
  back: { en: 'Back', hi: 'वापस', kn: 'ಹಿಂದೆ', te: 'వెనక్కి' },
  iAmAt: { en: 'I am at', hi: 'मैं यहाँ हूँ', kn: 'ನಾನು ಇಲ್ಲಿದ್ದೇನೆ', te: 'నేను ఉన్నది' },
  updates: { en: 'Updates', hi: 'खबर', kn: 'ಸುದ್ದಿ', te: 'సమాచారం' },
  send: { en: 'Send', hi: 'भेजें', kn: 'ಕಳುಹಿಸಿ', te: 'పంపండి' },
  receive: { en: 'Receive', hi: 'माल आया', kn: 'ಸ್ವೀಕರಿಸಿ', te: 'స్వీకరించండి' },
  myTrucks: { en: 'Trucks I send', hi: 'भेजने वाली गाड़ियाँ', kn: 'ಕಳುಹಿಸುವ ಲಾರಿಗಳು', te: 'పంపే లారీలు' },
  startLoading: { en: 'Start loading', hi: 'लोडिंग शुरू', kn: 'ಲೋಡಿಂಗ್ ಶುರು', te: 'లోడింగ్ మొదలు' },
  loadingDone: { en: 'Loading done', hi: 'लोडिंग पूरी', kn: 'ಲೋಡಿಂಗ್ ಮುಗಿಯಿತು', te: 'లోడింగ్ పూర్తి' },
  truckLeft: { en: 'Truck left', hi: 'गाड़ी निकल गई', kn: 'ಲಾರಿ ಹೊರಟಿತು', te: 'లారీ బయలుదేరింది' },
  arrived: { en: 'Truck arrived', hi: 'गाड़ी पहुँच गई', kn: 'ಲಾರಿ ಬಂತು', te: 'లారీ వచ్చింది' },
  count: { en: 'Count', hi: 'गिनें', kn: 'ಎಣಿಸಿ', te: 'లెక్కించండి' },
  onTheWay: { en: 'On the way', hi: 'रास्ते में', kn: 'ದಾರಿಯಲ್ಲಿದೆ', te: 'దారిలో ఉంది' },
  reached: { en: 'Reached', hi: 'पहुँच गई', kn: 'ತಲುಪಿತು', te: 'చేరింది' },
  loading: { en: 'Loading', hi: 'लोड हो रहा है', kn: 'ಲೋಡ್ ಆಗುತ್ತಿದೆ', te: 'లోడ్ అవుతోంది' },
  oldTrucks: { en: 'Old trucks', hi: 'पुरानी गाड़ियाँ', kn: 'ಹಳೆಯ ಲಾರಿಗಳು', te: 'పాత లారీలు' },
  problem: { en: 'Problem? Ask owner', hi: 'दिक्कत? मालिक से पूछें', kn: 'ಸಮಸ್ಯೆ? ಮಾಲೀಕರನ್ನು ಕೇಳಿ', te: 'సమస్యా? యజమానిని అడగండి' },
  nothing: { en: 'Nothing to do now ✓', hi: 'अभी कुछ नहीं ✓', kn: 'ಈಗ ಏನೂ ಇಲ್ಲ ✓', te: 'ఇప్పుడు ఏమీ లేదు ✓' },
  noNews: { en: 'No news', hi: 'कोई खबर नहीं', kn: 'ಸುದ್ದಿ ಇಲ್ಲ', te: 'సమాచారం లేదు' },
  ourUnit: { en: 'Our other unit', hi: 'हमारी दूसरी यूनिट', kn: 'ನಮ್ಮ ಇನ್ನೊಂದು ಘಟಕ', te: 'మా ఇంకో యూనిట్' },
  customer: { en: 'Customer', hi: 'ग्राहक', kn: 'ಗ್ರಾಹಕ', te: 'కస్టమర్' },
  supplierGate: { en: 'Supplier truck at the gate', hi: 'सप्लायर की गाड़ी गेट पर', kn: 'ಸರಬರಾಜುದಾರರ ಲಾರಿ ಗೇಟ್‌ನಲ್ಲಿ', te: 'సరఫరాదారు లారీ గేటు వద్ద' },
  fromOur: { en: 'Every truck coming to you (our unit or a supplier) is below. Tap Truck arrived, then Count.', hi: 'आपके पास आने वाली हर गाड़ी नीचे है। “गाड़ी पहुँच गई” दबाएँ, फिर गिनें।', kn: 'ನಿಮಗೆ ಬರುವ ಪ್ರತಿ ಲಾರಿ ಕೆಳಗಿದೆ. “ಲಾರಿ ಬಂತು” ಒತ್ತಿ, ನಂತರ ಎಣಿಸಿ.', te: 'మీకు వచ్చే ప్రతి లారీ కింద ఉంది. “లారీ వచ్చింది” నొక్కి, తర్వాత లెక్కించండి.' },
  ownerTells: { en: 'owner will tell them', hi: 'मालिक उन्हें बताएंगे', kn: 'ಮಾಲೀಕರು ಅವರಿಗೆ ತಿಳಿಸುತ್ತಾರೆ', te: 'యజమాని వారికి చెబుతారు' },
  ownerSends: { en: 'The owner sends the count link to the customer.', hi: 'मालिक ग्राहक को गिनती का लिंक भेजेंगे।', kn: 'ಮಾಲೀಕರು ಗ್ರಾಹಕರಿಗೆ ಎಣಿಕೆ ಲಿಂಕ್ ಕಳುಹಿಸುತ್ತಾರೆ.', te: 'యజమాని కస్టమర్‌కు లెక్క లింక్ పంపుతారు.' },
  waLink: { en: 'Send count link on WhatsApp', hi: 'WhatsApp पर गिनती लिंक भेजें', kn: 'WhatsApp‌ನಲ್ಲಿ ಎಣಿಕೆ ಲಿಂಕ್ ಕಳುಹಿಸಿ', te: 'WhatsAppలో లెక్క లింక్ పంపండి' },
  yes: { en: 'Owner said YES', hi: 'मालिक ने हाँ कहा', kn: 'ಮಾಲೀಕರು ಹೌದು ಎಂದರು', te: 'యజమాని సరే అన్నారు' },
  no: { en: 'Owner said NO', hi: 'मालिक ने ना कहा', kn: 'ಮಾಲೀಕರು ಬೇಡ ಎಂದರು', te: 'యజమాని వద్దు అన్నారు' },
  waiting: { en: 'Waiting for owner', hi: 'मालिक के जवाब का इंतज़ार', kn: 'ಮಾಲೀಕರ ಉತ್ತರಕ್ಕೆ ಕಾಯುತ್ತಿದೆ', te: 'యజమాని సమాధానం కోసం' },
  okCount: { en: 'counted, all OK', hi: 'गिनती ठीक', kn: 'ಎಣಿಕೆ ಸರಿ', te: 'లెక్క సరిగ్గా ఉంది' },
  diff: { en: 'does not match. Owner is checking', hi: 'मेल नहीं खाता, मालिक देख रहे हैं', kn: 'ಹೊಂದುತ್ತಿಲ್ಲ, ಮಾಲೀಕರು ನೋಡುತ್ತಿದ್ದಾರೆ', te: 'సరిపోలలేదు, యజమాని చూస్తున్నారు' },
  backAccident: { en: 'Coming back after accident', hi: 'दुर्घटना के बाद वापस', kn: 'ಅಪಘಾತದ ನಂತರ ವಾಪಸ್', te: 'ప్రమాదం తర్వాత తిరిగి' },
  expected: { en: 'Expected', hi: 'आने वाली', kn: 'ಬರಬೇಕಿದೆ', te: 'రావాల్సింది' },
  notInList: { en: 'A truck came that is not in the list? Tell owner', hi: 'सूची में नहीं है ऐसी गाड़ी आई? मालिक को बताएं', kn: 'ಪಟ್ಟಿಯಲ್ಲಿಲ್ಲದ ಲಾರಿ ಬಂತೇ? ಮಾಲೀಕರಿಗೆ ತಿಳಿಸಿ', te: 'జాబితాలో లేని లారీ వచ్చిందా? యజమానికి చెప్పండి' },
  comingToday: { en: 'Coming to you', hi: 'आपके पास आ रही हैं', kn: 'ನಿಮಗೆ ಬರುತ್ತಿವೆ', te: 'మీకు వస్తున్నవి' },
  tapWhenHere: { en: 'Truck is here? Tap it to count.', hi: 'गाड़ी आ गई? दबाएँ और गिनें।', kn: 'ಲಾರಿ ಬಂತೇ? ಒತ್ತಿ ಎಣಿಸಿ.', te: 'లారీ వచ్చిందా? నొక్కి లెక్కించండి.' },
  noneComing: { en: 'No truck coming now', hi: 'अभी कोई गाड़ी नहीं आ रही', kn: 'ಈಗ ಯಾವ ಲಾರಿಯೂ ಬರುತ್ತಿಲ್ಲ', te: 'ఇప్పుడు ఏ లారీ రావడం లేదు' },
  cancelled: { en: 'Cancelled', hi: 'रद्द', kn: 'ರದ್ದು', te: 'రద్దు' },
};
const fromX = (x: string, l: L) => ({ en: `From ${x}`, hi: `${x} से`, kn: `${x}ಇಂದ`, te: `${x} నుండి` }[l]);
const toX = (x: string, l: L) => ({ en: `To ${x}`, hi: `${x} को`, kn: `${x}ಗೆ`, te: `${x}కు` }[l]);
const comingX = (x: string, l: L) => ({ en: `Truck coming from ${x}`, hi: `${x} से गाड़ी आ रही है`, kn: `${x}ಇಂದ ಲಾರಿ ಬರುತ್ತಿದೆ`, te: `${x} నుండి లారీ వస్తోంది` }[l]);
const dayText = (ms: number) => { const d = new Date(ms).toDateString(), t = new Date(), y = new Date(Date.now() + 86400000); return d === t.toDateString() ? 'today' : d === y.toDateString() ? 'tomorrow' : new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); };
const reachedX = (x: string, l: L) => ({ en: `reached ${x}`, hi: `${x} पहुँची`, kn: `${x} ತಲುಪಿತು`, te: `${x} చేరింది` }[l]);

const big = 'w-full min-h-[56px] rounded-2xl text-base font-bold flex items-center justify-center cursor-pointer';

export default function Staff({ go, initialId = null }: { go: Go; initialId?: string | null }) {
  const { state, dispatch } = useStore();
  const [lang, setLangState] = useState(savedLang);
  const setLang = (l: string) => { setLangState(l); saveLang(l); };
  const l = (['en', 'hi', 'kn', 'te'].includes(lang) ? lang : 'en') as L;
  const w = (k: string) => W[k][l];
  const [unit, setU] = useState(getUnit());
  const [open, setOpen] = useState<'' | 'send' | 'receive'>(initialId ? 'send' : '');
  const [showOld, setShowOld] = useState(false);
  const [allNews, setAllNews] = useState(false);
  const pickUnit = (u: string) => { setUnit(u); setU(u); };
  setMeName(staffName(state));

  const live = state.shipments.filter((s: any) => !s.cancelledAt && !s.receipt);
  // trucks this unit loads and sends
  // newest first, so a truck just saved is at the top
  const sending = live.filter((s: any) => s.fromUnit === unit && !s.returning && !atGate(s.flow)).sort((a: any, b: any) => (b.id === initialId ? 1 : 0) - (a.id === initialId ? 1 : 0) || b.createdAt - a.createdAt);
  // trucks coming to this unit (our units' trucks, supplier trucks not yet counted, goods coming back after an accident)
  const receiving = live.filter((s: any) => (s.returning ? s.fromUnit === unit : s.toUnit === unit && countedByUs(s) && (s.flow !== 'transfer' || (s.sentAt && s.linkSentAt))));
  const old = state.shipments.filter((s: any) => (open === 'send' ? s.fromUnit === unit : open === 'receive' ? s.toUnit === unit : s.fromUnit === unit || s.toUnit === unit) && (s.receipt || s.cancelledAt))
    .sort((a: any, b: any) => (b.receipt?.at || b.cancelledAt) - (a.receipt?.at || a.cancelledAt)).slice(0, 10);

  // Demo: there is always a truck coming to you, so the receive path can be tried again and again.
  // When nothing is coming to this unit, a new one is added: Mysuru gets a supplier delivery, Bengaluru a truck from Mysuru.
  const topped = useRef<Record<string, boolean>>({});
  useEffect(() => {
    if (receiving.length || topped.current[unit]) return;
    topped.current[unit] = true;
    const id = `TRK-${1000 + state.counters.trk + 1}`;
    const plate = `KA ${unit === 'MYS' ? '19 D' : '09 B'} ${1000 + Math.floor(Math.random() * 9000)}`;
    const ref = `${unit === 'MYS' ? 'PO' : 'DC'}-${100 + Math.floor(Math.random() * 900)}`;
    if (unit === 'MYS') {
      dispatch({ type: 'CREATE_SHIPMENT', id, flow: 'inbound', toUnit: 'MYS', party: 'coastal', truckNo: plate, ref, expectedOn: Date.now(), lines: [{ item: 'OKU-AB-91', qty: 200 }, { item: 'BRP-1136', qty: 150 }], actor: 'Owner' });
      dispatch({ type: 'SEND_TO_RECEIVER', id, token: newToken(), actor: 'Owner' });
    } else {
      dispatch({ type: 'CREATE_SHIPMENT', id, flow: 'transfer', fromUnit: 'MYS', toUnit: unit, truckNo: plate, ref, driver: 'Manju', driverPhone: '9845012345', lines: [{ item: 'PLY-12', qty: 80 }, { item: 'PLY-18', qty: 45 }], actor: 'Ramesh (staff)' });
      dispatch({ type: 'LOADING', id, point: 'Dock 1', phase: 'start', actor: 'Ramesh (staff)' });
      dispatch({ type: 'LOADING', id, phase: 'end', actor: 'Ramesh (staff)' });
      dispatch({ type: 'SEND_TO_RECEIVER', id, token: newToken(), actor: 'Ramesh (staff)' });
      dispatch({ type: 'LINK_SENT', id, actor: 'Owner' });
    }
  }, [unit, receiving.length]);

  const count = (s: any) => {
    if (s.sentAt) { window.location.hash = receiverPath(s, state.settings); return; }
    const token = newToken();
    dispatch({ type: 'SEND_TO_RECEIVER', id: s.id, token, actor: me() });
    window.location.hash = `#/r/${s.id}/${token}`;
  };

  // Updates: short lines with a picture, newest first
  const news: { at: number; icon: string; text: string; tone: string; pin?: boolean; side?: string }[] = [];
  for (const s of state.shipments) {
    const [from, to] = route(s).split(' → ');
    if (s.cancelledAt) continue;
    if (s.toUnit === unit && s.flow === 'transfer' && s.sentAt && s.linkSentAt && !s.arrivedAt && !s.receipt) news.push({ at: s.sentAt, pin: true, icon: '🚚', text: `${comingX(from, l)} · ${loadName(s.id)}`, tone: 'bg-sky-50 border-sky-200' });
    if (s.toUnit === unit && s.expectedOn && !s.arrivedAt && !s.receipt) news.push({ at: s.expectedOn, pin: true, icon: '🚛', text: `${comingX(from, l)} · ${w('expected')} ${dayText(s.expectedOn)}`, tone: 'bg-sky-50 border-sky-200' });
    if (s.returning && s.fromUnit === unit && !s.receipt) news.push({ at: s.accident?.at || s.sentAt, pin: true, icon: '⚠️', text: `${w('backAccident')} · ${loadName(s.id)}`, tone: 'bg-rose-50 border-rose-200' });
    if (s.fromUnit === unit && s.arrivedAt && !s.receipt && !s.returning) news.push({ side: 'send', at: s.arrivedAt, icon: '📍', text: `${loadName(s.id)} ${reachedX(to, l)}`, tone: 'bg-sky-50 border-sky-200' });
    if (s.fromUnit === unit && s.receipt && Date.now() - s.receipt.at < 48 * 3600000) {
      const bad = diffsOf(state, s.id).length > 0;
      news.push({ side: 'send', at: s.receipt.at, icon: bad ? '⚠️' : '✅', text: `${loadName(s.id)} ${bad ? w('diff') : w('okCount')}`, tone: bad ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200' });
    }
  }
  for (const r of state.requests || []) {
    if (!String(r.by).startsWith(staffName(state))) continue;
    const what = r.kind === 'add' ? r.name : loadName(r.shipmentId);
    const rs = r.shipmentId && state.shipments.find((x: any) => x.id === r.shipmentId);
    const side = rs ? (rs.fromUnit === unit && !rs.returning ? 'send' : 'receive') : r.what === 'delivery' ? 'receive' : r.what === 'item' ? 'send' : '';
    if (r.status === 'pending') news.push({ side, at: r.at, icon: '⏳', text: `${w('waiting')} · ${what}`, tone: 'bg-amber-50 border-amber-200' });
    else news.push({ side, at: r.decidedAt, icon: r.status === 'approved' ? '👍' : '👎', text: `${w(r.status === 'approved' ? 'yes' : 'no')} · ${what}${r.decidedNote ? ` · “${r.decidedNote}”` : ''}`, tone: r.status === 'approved' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200' });
  }
  // trucks coming to you stay on top until they arrive; then newest first
  // trucks coming to you are in their own list above, so updates hold the rest, newest first
  const updates = news.filter((n) => !n.pin && (!open || !n.side || n.side === open)).sort((a, b) => b.at - a.at);

  // one big button: the next step for this truck
  const step = (s: any): { icon: string; status: string; btn?: string; btnCls?: string; act?: () => void } => {
    if (receiving.includes(s)) {
      if (!s.arrivedAt && (!atGate(s.flow) || s.expectedOn)) return { icon: s.expectedOn ? '🚛' : '🚚', status: s.expectedOn ? `${w('expected')} ${dayText(s.expectedOn)}` : w('onTheWay'), btn: `📍 ${w('arrived')} → 🔢 ${w('count')}`, btnCls: 'bg-sky-600 text-white', act: () => { dispatch({ type: 'ARRIVED', id: s.id, by: me(), actor: me() }); count(s); } };
      return { icon: '📍', status: w('reached'), btn: `🔢 ${w('count')}`, btnCls: 'bg-emerald-600 text-white', act: () => count(s) };
    }
    if (!s.loading) return { icon: '📦', status: w('loading'), btn: `📦 ${w('startLoading')}`, btnCls: 'bg-violet-600 text-white', act: () => dispatch({ type: 'LOADING', id: s.id, point: 'Dock 1', phase: 'start', actor: me() }) };
    if (!s.loading.endAt) return { icon: '📦', status: w('loading'), btn: `✅ ${w('loadingDone')}`, btnCls: 'bg-violet-600 text-white', act: () => dispatch({ type: 'LOADING', id: s.id, phase: 'end', actor: me() }) };
    if (!s.sentAt) return { icon: '📦', status: w('loadingDone'), btn: `🚚 ${w('truckLeft')}`, btnCls: 'bg-emerald-600 text-white', act: () => dispatch({ type: 'SEND_TO_RECEIVER', id: s.id, token: newToken(), actor: me() }) };
    return { icon: s.arrivedAt ? '📍' : '🚚', status: s.arrivedAt ? w('reached') : s.linkSentAt ? w('onTheWay') : `${w('onTheWay')} · ${w('ownerTells')}` };
  };

  const Card = ({ s }: { s: any }) => {
    const st = step(s);
    const [from, to] = route(s).split(' → ');
    const incoming = receiving.includes(s);
    return (
      <div id={`staff-${s.id}`} className={`rounded-2xl border-2 p-3 space-y-2 ${s.id === initialId && !s.sentAt ? 'bg-violet-50 border-violet-500 ring-2 ring-violet-300' : `bg-white ${incoming ? 'border-sky-200' : 'border-violet-200'}`}`}>
        <div className="flex items-center gap-3">
          <span className="text-3xl leading-none">{st.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="text-base font-bold text-slate-900 truncate">{s.returning ? w('backAccident') : incoming ? fromX(from, l) : toX(to, l)}</div>
            {s.truckNo && s.truckNo !== 'NOT KNOWN' && <div className="inline-block whitespace-nowrap mt-0.5 px-2 py-0.5 rounded-md border-2 border-slate-800 bg-amber-50 font-mono font-bold text-sm text-slate-900">{s.truckNo}</div>}
            <div className="text-xs text-slate-600">{st.status} · {loadName(s.id)}</div>
          </div>
        </div>
        {st.btn && <button id={`step-${s.id}`} onClick={st.act} className={`${big} ${st.btnCls}`}>{st.btn}</button>}
        {!st.btn && s.flow === 'outbound' && <div id={`owner-link-${s.id}`} className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">💬 {w('ownerSends')}</div>}
        <button id={`open-${s.id}`} onClick={() => go('dispatch', { id: s.id })} className="text-[12px] font-semibold text-slate-500 underline cursor-pointer">{w('problem')}</button>
      </div>
    );
  };

  const mine = sending;
  return (
    <PhoneFrame title="LoadMatch" sub={`${staffName(state)} · ${uname(unit)}`} lang={lang} setLang={setLang}>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">{w('iAmAt')}:</span>
          {Object.keys(UNITS).map((u) => <button key={u} id={`unit-${u}`} onClick={() => pickUnit(u)} className={`px-3 py-1.5 rounded-full border font-bold cursor-pointer ${u === unit ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}>{uname(u)}</button>)}
        </div>

        {!open ? (
          <div className="grid grid-cols-2 gap-3">
            <button id="btn-send-stock" onClick={() => setOpen('send')} className="min-h-[84px] rounded-2xl text-lg font-bold cursor-pointer flex flex-col items-center justify-center border-2 bg-violet-50 text-violet-900 border-violet-200"><span className="text-3xl">📤</span>{w('send')}</button>
            <button id="btn-receive-stock" onClick={() => setOpen('receive')} className="min-h-[84px] rounded-2xl text-lg font-bold cursor-pointer flex flex-col items-center justify-center border-2 bg-sky-50 text-sky-900 border-sky-200"><span className="text-3xl">📥</span>{w('receive')}</button>
          </div>
        ) : (
          // only the chosen side is on screen; a separate Back button returns to both
          <div className="space-y-2">
            <button id={open === 'send' ? 'btn-send-stock' : 'btn-receive-stock'} onClick={() => setOpen('')} className="inline-flex items-center gap-1 rounded-xl border-2 border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 cursor-pointer">← {w('back')}</button>
            <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-white ${open === 'send' ? 'bg-violet-700' : 'bg-sky-700'}`}>
              <span className="text-2xl">{open === 'send' ? '📤' : '📥'}</span>
              <span className="text-lg font-bold">{w(open)}</span>
            </div>
          </div>
        )}
        {open === 'send' && (
          <div className="grid grid-cols-2 gap-3">
            <button id="send-unit" onClick={() => go('dispatch', { id: 'new:transfer' })} className={`${big} flex-col py-3 bg-white border-2 border-violet-300 text-violet-900`}><span className="text-2xl">🏭</span>{w('ourUnit')}</button>
            <button id="send-customer" onClick={() => go('dispatch', { id: 'new:outbound' })} className={`${big} flex-col py-3 bg-white border-2 border-violet-300 text-violet-900`}><span className="text-2xl">🏪</span>{w('customer')}</button>
          </div>
        )}
        {open === 'receive' && (
          <div className="space-y-2">
            <div className="text-xs text-slate-600">👆 {w('tapWhenHere')} (🚚 {w('comingToday')})</div>
            <AskAdd what="delivery" label={w('notInList')} />
          </div>
        )}

        <div className="space-y-2">
          {open !== 'send' && <div id="coming" className="rounded-2xl border-2 border-sky-300 bg-sky-50 p-3 space-y-2">
          <div className="text-base font-bold text-sky-950">🚚 {w('comingToday')} · {receiving.length}</div>
          {!receiving.length && <div className="text-sm text-sky-900">{w('noneComing')}</div>}
          {receiving.length > 0 && <div className="text-xs text-sky-900">👆 {w('tapWhenHere')}</div>}
          {receiving.map((s: any) => {
            const [from] = route(s).split(' → ');
            return (
              <button key={s.id} id={`coming-${s.id}`} onClick={() => { if (!s.arrivedAt) dispatch({ type: 'ARRIVED', id: s.id, by: me(), actor: me() }); count(s); }} className="w-full text-left rounded-xl bg-white border-2 border-sky-200 hover:border-sky-500 p-3 space-y-2 cursor-pointer block">
                <span className="flex items-center gap-3">
                  <span className="text-3xl leading-none">{s.returning ? '⚠️' : s.flow === 'inbound' ? '🚛' : '🚚'}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-base font-bold text-slate-900">{s.returning ? w('backAccident') : fromX(from, l)}</span>
                    {s.truckNo && s.truckNo !== 'NOT KNOWN' && <span className="inline-block whitespace-nowrap my-0.5 px-2 py-0.5 rounded-md border-2 border-slate-800 bg-amber-50 font-mono font-bold text-sm text-slate-900">{s.truckNo}</span>}
                    <span className="block text-xs text-slate-600">{s.arrivedAt ? `📍 ${w('reached')}` : s.expectedOn ? `${w('expected')} ${dayText(s.expectedOn)}` : `${w('onTheWay')} · ${when(s.sentAt)}`} · {loadName(s.id)}</span>
                  </span>
                </span>
                <span className="w-full min-h-[48px] rounded-xl bg-emerald-600 text-white text-base font-bold flex items-center justify-center">📍 {w('arrived')} → 🔢 {w('count')}</span>
              </button>
            );
          })}
        </div>}

        <div id="updates" className="space-y-1.5">
          <div className="text-sm font-bold text-slate-900">🔔 {w('updates')}</div>
          {!updates.length && <div className="text-xs text-slate-500">{w('noNews')}</div>}
          {(allNews ? updates.slice(0, 10) : updates.slice(0, 3)).map((n, i) => <div key={i} className={`rounded-xl border px-3 py-2 text-sm flex items-start gap-2 ${n.tone}`}><span className="text-lg leading-none">{n.icon}</span><span className="flex-1">{n.text}<span className="block text-[11px] text-slate-500">{when(n.at)}</span></span></div>)}
          {updates.length > 3 && <button id="btn-news-all" onClick={() => setAllNews(!allNews)} className="text-xs font-bold text-slate-500 underline cursor-pointer">{allNews ? '−' : `+${Math.min(updates.length, 10) - 3}`}</button>}
        </div>

        {open !== 'receive' && <div className="text-sm font-bold text-slate-900">📤 {w('myTrucks')}</div>}
          {!mine.length && open !== 'receive' && <div id="nothing-pending" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{w('nothing')}</div>}
          {open !== 'receive' && sending.map((s: any) => <Card key={s.id} s={s} />)}
        </div>

        <button id="btn-old" onClick={() => setShowOld(!showOld)} className="text-sm font-bold text-slate-600 underline cursor-pointer">🗂 {w('oldTrucks')} ({old.length})</button>
        {showOld && <div className="space-y-1.5">{old.map((s: any) => {
          const bad = diffsOf(state, s.id).length > 0;
          const [from, to] = route(s).split(' → ');
          return <button key={s.id} id={`old-${s.id}`} onClick={() => go('dispatch', { id: s.id })} className="w-full text-left rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm flex items-center gap-2 cursor-pointer"><span className="text-lg">{s.cancelledAt ? '✖️' : bad ? '⚠️' : '✅'}</span><span className="flex-1 truncate">{s.toUnit === unit ? fromX(from, l) : toX(to, l)} · {loadName(s.id)}</span><span className="text-[11px] text-slate-500">{when(s.receipt?.at || s.cancelledAt)}</span></button>;
        })}</div>}
      </div>
    </PhoneFrame>
  );
}

export function AskAdd({ what, partyKind, label }: { what: 'item' | 'party' | 'delivery'; partyKind?: string; label?: string }) {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(what === 'item' ? 'Rosewood veneer 4 mm' : what === 'delivery' ? 'Sri Lakshmi Timbers' : partyKind === 'supplier' ? 'Kaveri Timber Depot' : 'Hosur Crates');
  const [sent, setSent] = useState('');
  if (sent) return <div className="text-[11px] text-emerald-800">Asked the owner to add “{sent}”. It appears here once approved.</div>;
  if (!open) return <button id={`ask-add-${what}`} onClick={() => setOpen(true)} className="text-[11px] font-bold text-sky-800 underline cursor-pointer text-left">{label || (what === 'item' ? 'Item not in the list? Ask owner to add it' : partyKind === 'supplier' ? 'New supplier at the gate? Ask owner to add them' : `New ${partyKind || 'party'}? Ask owner to add them`)}</button>;
  return (
    <div className="flex gap-2">
      <input id={`ask-add-name-${what}`} value={name} onChange={(e) => setName(e.target.value)} placeholder={what === 'item' ? 'Item name and size' : what === 'delivery' ? 'Whose truck? e.g. Coastal Veneers' : 'Party name'} className="flex-1 p-2 rounded-lg border border-slate-300 text-xs" />
      <button id={`ask-add-send-${what}`} disabled={!name.trim()} onClick={() => { dispatch({ type: 'ASK_ADD', what, name: what === 'delivery' ? `${name.trim()} (at ${uname(getUnit())})` : name, partyKind, by: me() }); setSent(name.trim()); }} className="px-3 rounded-lg bg-slate-900 text-white text-xs font-bold disabled:opacity-40 cursor-pointer">Ask</button>
    </div>
  );
}

