import React, { useState } from 'react';
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
  iAmAt: { en: 'I am at', hi: 'मैं यहाँ हूँ', kn: 'ನಾನು ಇಲ್ಲಿದ್ದೇನೆ', te: 'నేను ఉన్నది' },
  updates: { en: 'Updates', hi: 'खबर', kn: 'ಸುದ್ದಿ', te: 'సమాచారం' },
  send: { en: 'Send', hi: 'भेजें', kn: 'ಕಳುಹಿಸಿ', te: 'పంపండి' },
  receive: { en: 'Receive', hi: 'माल आया', kn: 'ಸ್ವೀಕರಿಸಿ', te: 'స్వీకరించండి' },
  myTrucks: { en: 'My trucks', hi: 'मेरी गाड़ियाँ', kn: 'ನನ್ನ ಲಾರಿಗಳು', te: 'నా లారీలు' },
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
  fromOur: { en: 'Trucks from our unit are in My trucks below.', hi: 'हमारी यूनिट की गाड़ियाँ नीचे “मेरी गाड़ियाँ” में हैं।', kn: 'ನಮ್ಮ ಘಟಕದ ಲಾರಿಗಳು ಕೆಳಗೆ “ನನ್ನ ಲಾರಿಗಳು” ನಲ್ಲಿವೆ.', te: 'మా యూనిట్ లారీలు కింద “నా లారీలు”లో ఉన్నాయి.' },
  waLink: { en: 'Send count link on WhatsApp', hi: 'WhatsApp पर गिनती लिंक भेजें', kn: 'WhatsApp‌ನಲ್ಲಿ ಎಣಿಕೆ ಲಿಂಕ್ ಕಳುಹಿಸಿ', te: 'WhatsAppలో లెక్క లింక్ పంపండి' },
  yes: { en: 'Owner said YES', hi: 'मालिक ने हाँ कहा', kn: 'ಮಾಲೀಕರು ಹೌದು ಎಂದರು', te: 'యజమాని సరే అన్నారు' },
  no: { en: 'Owner said NO', hi: 'मालिक ने ना कहा', kn: 'ಮಾಲೀಕರು ಬೇಡ ಎಂದರು', te: 'యజమాని వద్దు అన్నారు' },
  waiting: { en: 'Waiting for owner', hi: 'मालिक के जवाब का इंतज़ार', kn: 'ಮಾಲೀಕರ ಉತ್ತರಕ್ಕೆ ಕಾಯುತ್ತಿದೆ', te: 'యజమాని సమాధానం కోసం' },
  okCount: { en: 'counted, all OK', hi: 'गिनती ठीक', kn: 'ಎಣಿಕೆ ಸರಿ', te: 'లెక్క సరిగ్గా ఉంది' },
  diff: { en: 'does not match. Owner is checking', hi: 'मेल नहीं खाता, मालिक देख रहे हैं', kn: 'ಹೊಂದುತ್ತಿಲ್ಲ, ಮಾಲೀಕರು ನೋಡುತ್ತಿದ್ದಾರೆ', te: 'సరిపోలలేదు, యజమాని చూస్తున్నారు' },
  backAccident: { en: 'Coming back after accident', hi: 'दुर्घटना के बाद वापस', kn: 'ಅಪಘಾತದ ನಂತರ ವಾಪಸ್', te: 'ప్రమాదం తర్వాత తిరిగి' },
  cancelled: { en: 'Cancelled', hi: 'रद्द', kn: 'ರದ್ದು', te: 'రద్దు' },
};
const fromX = (x: string, l: L) => ({ en: `From ${x}`, hi: `${x} से`, kn: `${x}ಇಂದ`, te: `${x} నుండి` }[l]);
const toX = (x: string, l: L) => ({ en: `To ${x}`, hi: `${x} को`, kn: `${x}ಗೆ`, te: `${x}కు` }[l]);
const comingX = (x: string, l: L) => ({ en: `Truck coming from ${x}`, hi: `${x} से गाड़ी आ रही है`, kn: `${x}ಇಂದ ಲಾರಿ ಬರುತ್ತಿದೆ`, te: `${x} నుండి లారీ వస్తోంది` }[l]);
const reachedX = (x: string, l: L) => ({ en: `reached ${x}`, hi: `${x} पहुँची`, kn: `${x} ತಲುಪಿತು`, te: `${x} చేరింది` }[l]);

const big = 'w-full min-h-[56px] rounded-2xl text-base font-bold flex items-center justify-center cursor-pointer';

export default function Staff({ go }: { go: Go }) {
  const { state, dispatch } = useStore();
  const [lang, setLangState] = useState(savedLang);
  const setLang = (l: string) => { setLangState(l); saveLang(l); };
  const l = (['en', 'hi', 'kn', 'te'].includes(lang) ? lang : 'en') as L;
  const w = (k: string) => W[k][l];
  const [unit, setU] = useState(getUnit());
  const [open, setOpen] = useState<'' | 'send' | 'receive'>('');
  const [showOld, setShowOld] = useState(false);
  const [allNews, setAllNews] = useState(false);
  const pickUnit = (u: string) => { setUnit(u); setU(u); };
  setMeName(staffName(state));

  const live = state.shipments.filter((s: any) => !s.cancelledAt && !s.receipt);
  // trucks this unit loads and sends
  const sending = live.filter((s: any) => s.fromUnit === unit && !s.returning && !atGate(s.flow));
  // trucks coming to this unit (our units' trucks, supplier trucks not yet counted, goods coming back after an accident)
  const receiving = live.filter((s: any) => (s.returning ? s.fromUnit === unit : s.toUnit === unit && countedByUs(s) && (s.flow !== 'transfer' || s.sentAt)));
  const old = state.shipments.filter((s: any) => (s.fromUnit === unit || s.toUnit === unit) && (s.receipt || s.cancelledAt))
    .sort((a: any, b: any) => (b.receipt?.at || b.cancelledAt) - (a.receipt?.at || a.cancelledAt)).slice(0, 10);

  const count = (s: any) => {
    if (s.sentAt) { window.location.hash = receiverPath(s, state.settings); return; }
    const token = newToken();
    dispatch({ type: 'SEND_TO_RECEIVER', id: s.id, token, actor: me() });
    window.location.hash = `#/r/${s.id}/${token}`;
  };

  // Updates: short lines with a picture, newest first
  const news: { at: number; icon: string; text: string; tone: string }[] = [];
  for (const s of state.shipments) {
    const [from, to] = route(s).split(' → ');
    if (s.cancelledAt) continue;
    if (s.toUnit === unit && s.flow === 'transfer' && s.sentAt && !s.arrivedAt && !s.receipt) news.push({ at: s.sentAt, icon: '🚚', text: `${comingX(from, l)} · ${loadName(s.id)}`, tone: 'bg-sky-50 border-sky-200' });
    if (s.returning && s.fromUnit === unit && !s.receipt) news.push({ at: s.accident?.at || s.sentAt, icon: '⚠️', text: `${w('backAccident')} · ${loadName(s.id)}`, tone: 'bg-rose-50 border-rose-200' });
    if (s.fromUnit === unit && s.arrivedAt && !s.receipt) news.push({ at: s.arrivedAt, icon: '📍', text: `${loadName(s.id)} ${reachedX(to, l)}`, tone: 'bg-sky-50 border-sky-200' });
    if (s.fromUnit === unit && s.receipt && Date.now() - s.receipt.at < 48 * 3600000) {
      const bad = diffsOf(state, s.id).length > 0;
      news.push({ at: s.receipt.at, icon: bad ? '⚠️' : '✅', text: `${loadName(s.id)} ${bad ? w('diff') : w('okCount')}`, tone: bad ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200' });
    }
  }
  for (const r of state.requests || []) {
    if (!String(r.by).startsWith(staffName(state))) continue;
    const what = r.kind === 'add' ? r.name : loadName(r.shipmentId);
    if (r.status === 'pending') news.push({ at: r.at, icon: '⏳', text: `${w('waiting')} · ${what}`, tone: 'bg-amber-50 border-amber-200' });
    else news.push({ at: r.decidedAt, icon: r.status === 'approved' ? '👍' : '👎', text: `${w(r.status === 'approved' ? 'yes' : 'no')} · ${what}${r.decidedNote ? ` · “${r.decidedNote}”` : ''}`, tone: r.status === 'approved' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200' });
  }
  news.sort((a, b) => b.at - a.at);

  // one big button: the next step for this truck
  const step = (s: any): { icon: string; status: string; btn?: string; btnCls?: string; act?: () => void } => {
    if (receiving.includes(s)) {
      if (!s.arrivedAt && !atGate(s.flow)) return { icon: '🚚', status: w('onTheWay'), btn: `📍 ${w('arrived')}`, btnCls: 'bg-sky-600 text-white', act: () => dispatch({ type: 'ARRIVED', id: s.id, by: me(), actor: me() }) };
      return { icon: '📍', status: w('reached'), btn: `🔢 ${w('count')}`, btnCls: 'bg-emerald-600 text-white', act: () => count(s) };
    }
    if (!s.loading) return { icon: '📦', status: w('loading'), btn: `📦 ${w('startLoading')}`, btnCls: 'bg-violet-600 text-white', act: () => dispatch({ type: 'LOADING', id: s.id, point: 'Dock 1', phase: 'start', actor: me() }) };
    if (!s.loading.endAt) return { icon: '📦', status: w('loading'), btn: `✅ ${w('loadingDone')}`, btnCls: 'bg-violet-600 text-white', act: () => dispatch({ type: 'LOADING', id: s.id, phase: 'end', actor: me() }) };
    if (!s.sentAt) return { icon: '📦', status: w('loadingDone'), btn: `🚚 ${w('truckLeft')}`, btnCls: 'bg-emerald-600 text-white', act: () => dispatch({ type: 'SEND_TO_RECEIVER', id: s.id, token: newToken(), actor: me() }) };
    return { icon: s.arrivedAt ? '📍' : '🚚', status: s.arrivedAt ? w('reached') : w('onTheWay') };
  };

  const Card = ({ s }: { s: any }) => {
    const st = step(s);
    const [from, to] = route(s).split(' → ');
    const incoming = receiving.includes(s);
    return (
      <div id={`staff-${s.id}`} className={`rounded-2xl border-2 p-3 space-y-2 bg-white ${incoming ? 'border-sky-200' : 'border-violet-200'}`}>
        <div className="flex items-center gap-3">
          <span className="text-3xl leading-none">{st.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="text-base font-bold text-slate-900 truncate">{s.returning ? w('backAccident') : incoming ? fromX(from, l) : toX(to, l)}</div>
            <div className="text-xs text-slate-600">{st.status} · {loadName(s.id)}{s.truckNo ? ` · ${s.truckNo}` : ''}</div>
          </div>
        </div>
        {st.btn && <button id={`step-${s.id}`} onClick={st.act} className={`${big} ${st.btnCls}`}>{st.btn}</button>}
        {!st.btn && s.flow === 'outbound' && <a id={`wa-${s.id}`} href={shareWhatsApp(`${COMPANY.name}: ${loadName(s.id)}, truck ${s.truckNo}. Please count and submit:\n${appLink(receiverPath(s, state.settings))}`)} target="_blank" rel="noreferrer" className={`${big} border-2 border-emerald-600 text-emerald-800 text-sm`}>💬 {w('waLink')}</a>}
        <button id={`open-${s.id}`} onClick={() => go('dispatch', { id: s.id })} className="text-[12px] font-semibold text-slate-500 underline cursor-pointer">{w('problem')}</button>
      </div>
    );
  };

  const mine = [...receiving, ...sending];
  return (
    <PhoneFrame title="LoadMatch" sub={`${staffName(state)} · ${uname(unit)}`} lang={lang} setLang={setLang}>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">{w('iAmAt')}:</span>
          {Object.keys(UNITS).map((u) => <button key={u} id={`unit-${u}`} onClick={() => pickUnit(u)} className={`px-3 py-1.5 rounded-full border font-bold cursor-pointer ${u === unit ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}>{uname(u)}</button>)}
        </div>

        <div id="updates" className="space-y-1.5">
          <div className="text-sm font-bold text-slate-900">🔔 {w('updates')}</div>
          {!news.length && <div className="text-xs text-slate-500">{w('noNews')}</div>}
          {(allNews ? news.slice(0, 10) : news.slice(0, 3)).map((n, i) => <div key={i} className={`rounded-xl border px-3 py-2 text-sm flex items-start gap-2 ${n.tone}`}><span className="text-lg leading-none">{n.icon}</span><span className="flex-1">{n.text}<span className="block text-[11px] text-slate-500">{when(n.at)}</span></span></div>)}
          {news.length > 3 && <button id="btn-news-all" onClick={() => setAllNews(!allNews)} className="text-xs font-bold text-slate-500 underline cursor-pointer">{allNews ? '−' : `+${Math.min(news.length, 10) - 3}`}</button>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button id="btn-send-stock" onClick={() => setOpen(open === 'send' ? '' : 'send')} className={`min-h-[84px] rounded-2xl text-lg font-bold cursor-pointer flex flex-col items-center justify-center border-2 ${open === 'send' ? 'bg-violet-700 text-white border-violet-700' : 'bg-violet-50 text-violet-900 border-violet-200'}`}><span className="text-3xl">📤</span>{w('send')}</button>
          <button id="btn-receive-stock" onClick={() => setOpen(open === 'receive' ? '' : 'receive')} className={`min-h-[84px] rounded-2xl text-lg font-bold cursor-pointer flex flex-col items-center justify-center border-2 ${open === 'receive' ? 'bg-sky-700 text-white border-sky-700' : 'bg-sky-50 text-sky-900 border-sky-200'}`}><span className="text-3xl">📥</span>{w('receive')}</button>
        </div>
        {open === 'send' && (
          <div className="grid grid-cols-2 gap-3">
            <button id="send-unit" onClick={() => go('dispatch', { id: 'new:transfer' })} className={`${big} flex-col py-3 bg-white border-2 border-violet-300 text-violet-900`}><span className="text-2xl">🏭</span>{w('ourUnit')}</button>
            <button id="send-customer" onClick={() => go('dispatch', { id: 'new:outbound' })} className={`${big} flex-col py-3 bg-white border-2 border-violet-300 text-violet-900`}><span className="text-2xl">🏪</span>{w('customer')}</button>
          </div>
        )}
        {open === 'receive' && (
          <div className="space-y-2">
            <button id="recv-supplier" onClick={() => go('receive', { id: 'add:inbound' })} className={`${big} py-3 bg-white border-2 border-sky-300 text-sky-900`}>🚛 {w('supplierGate')}</button>
            <div className="text-xs text-slate-600">🏭 {w('fromOur')}</div>
          </div>
        )}

        <div className="space-y-2">
          <div className="text-sm font-bold text-slate-900">🚚 {w('myTrucks')}</div>
          {!mine.length && <div id="nothing-pending" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{w('nothing')}</div>}
          {(open === 'send' ? sending : open === 'receive' ? receiving : mine).map((s: any) => <Card key={s.id} s={s} />)}
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

export function AskAdd({ what, partyKind }: { what: 'item' | 'party'; partyKind?: string }) {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [sent, setSent] = useState('');
  if (sent) return <div className="text-[11px] text-emerald-800">Asked the owner to add “{sent}”. It appears here once approved.</div>;
  if (!open) return <button id={`ask-add-${what}`} onClick={() => setOpen(true)} className="text-[11px] font-bold text-sky-800 underline cursor-pointer text-left">{what === 'item' ? 'Item not in the list? Ask owner to add it' : partyKind === 'supplier' ? 'New supplier at the gate? Ask owner to add them' : `New ${partyKind || 'party'}? Ask owner to add them`}</button>;
  return (
    <div className="flex gap-2">
      <input id={`ask-add-name-${what}`} value={name} onChange={(e) => setName(e.target.value)} placeholder={what === 'item' ? 'Item name and size' : 'Party name'} className="flex-1 p-2 rounded-lg border border-slate-300 text-xs" />
      <button id={`ask-add-send-${what}`} disabled={!name.trim()} onClick={() => { dispatch({ type: 'ASK_ADD', what, name, partyKind, by: me() }); setSent(name.trim()); }} className="px-3 rounded-lg bg-slate-900 text-white text-xs font-bold disabled:opacity-40 cursor-pointer">Ask</button>
    </div>
  );
}

