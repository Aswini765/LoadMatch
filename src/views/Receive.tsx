import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Camera, Lock, CheckCircle2, AlertTriangle, Minus, Plus, ChevronLeft, ChevronRight, MessageCircle, PackageCheck, Warehouse, ArrowRight, Wrench } from 'lucide-react';
import { useStore, item, party, route, shipmentOf, diffsOf, shipmentStatus, receiverPath, countBackPath, unpackLoad, unpackCount, reducer, countedByUs, atGate, jobworkOpen, loadName, FLOW_LABEL, REPLIES, ACTIONS, CO_ACTIONS, coSuggest } from '../store.tsx';
import Home from './Home.tsx';
import { Stepper } from './Staff.tsx';
import { TruckSheet } from './Owner.tsx';
import { CameraButton, DateChips, dayLabel } from './sim.tsx';
import { LOADING_POINTS, COMPANY } from '../data/seed.ts';
import { t, fill, unitWord } from '../i18n.ts';
import { useVoice, parseCount } from '../lib/voice.ts';
import { PhoneFrame, Note, PhotoStrip, savedLang, saveLang, shareWhatsApp, newToken, appLink } from './ui.tsx';
import { NewList, Chain } from './Dispatch.tsx';
import { when, time } from '../lib/format.ts';
import { sharedMode } from '../sync.ts';
import { getWho, me } from '../lib/who.ts';
// Our own staff see "Store"; an outside party who opened the QR or link sees "Count".
// shown under the count boxes
const MISSING_HINT = 'Count only what is in the truck. You don\'t type missing pieces: after you submit, the app shows how many are missing.';
const countTitle = () => (getWho() ? 'LoadMatch · Store' : 'LoadMatch · Count');

// ---------- the Receive tab: your own floor staff ----------
// Trucks heading to your units, and supplier deliveries at the gate.
export function ReceiveTab({ initialAdd = null }: { initialAdd?: string | null } = {}) {
  const { state, dispatch } = useStore();
  const [lang, setLangState] = useState(savedLang);
  const setLang = (l: string) => { setLangState(l); saveLang(l); };
  const [adding, setAdding] = useState<string | null>(initialAdd);
  const open = state.shipments
    .filter((s: any) => !s.receipt && !s.cancelledAt && (s.returning || (countedByUs(s) && (s.flow !== 'transfer' || s.sentAt))))
    .sort((a: any, b: any) => (a.sentAt || a.createdAt) - (b.sentAt || b.createdAt));
  const start = (s: any) => {
    if (s.sentAt) { window.location.hash = receiverPath(s, state.settings); return; }
    const token = newToken();
    dispatch({ type: 'SEND_TO_RECEIVER', id: s.id, token, actor: me() });
    window.location.hash = `#/r/${s.id}/${token}`;
  };
  return (
    <PhoneFrame title="LoadMatch · Store" sub={adding ? t(adding === 'jobwork_in' ? 'backFromJobwork' : 'supplierDelivery', lang) : t('toCount', lang)} lang={lang} setLang={setLang}>
      {adding ? (
        <NewList lang={lang} flow={adding} onBack={() => setAdding(null)} onSaved={(id) => { setAdding(null); const s = state.shipments.find((x: any) => x.id === id); start(s || { id, sentAt: null }); }} />
      ) : (
        <div className="space-y-3">
          <button id="btn-new-inbound" onClick={() => setAdding('inbound')} className="w-full py-3 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-left text-sm font-bold text-slate-900 flex items-center justify-between cursor-pointer shadow-2xs">
            <span className="flex items-center"><Warehouse className="w-4 h-4 mr-2 text-emerald-700" />{t('supplierDelivery', lang)}</span><Plus className="w-4 h-4 text-slate-400" />
          </button>
          {jobworkOpen(state).length > 0 && (
            <button id="btn-new-jobwork-in" onClick={() => setAdding('jobwork_in')} className="w-full py-3 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-left text-sm font-bold text-slate-900 flex items-center justify-between cursor-pointer shadow-2xs">
              <span className="flex items-center"><Wrench className="w-4 h-4 mr-2 text-emerald-700" />{t('backFromJobwork', lang)}</span><Plus className="w-4 h-4 text-slate-400" />
            </button>
          )}
          <TrucksToLoad />
          <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide pt-1">{t('toCount', lang)} · {t('recvSide', lang)}</div>
          {!open.length && <Note>{t('nothingToCount', lang)}</Note>}
          {open.map((s: any) => (
            <button key={s.id} id={`count-${s.id}`} onClick={() => start(s)} className="w-full text-left bg-white hover:bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-2xs cursor-pointer flex items-center justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-900">{s.truckNo}</span><span className="text-[10px] text-slate-500">{FLOW_LABEL[s.flow]}</span>{s.returning && <span className="text-[10px] font-bold text-rose-700">Coming back after accident</span>}</div>
                <div className="text-[11px] text-slate-600 mt-0.5 truncate">{route(s)}</div>
                <div className="text-[11px] text-slate-500">{loadName(s.id)} • {s.lines.length} {s.lines.length === 1 ? 'item' : 'items'} • {s.sentAt ? when(s.sentAt) : when(s.createdAt)}</div>
              </div>
              <span className="text-xs font-bold text-emerald-800 flex items-center shrink-0"><PackageCheck className="w-4 h-4 mr-1" />{t('countThis', lang)}<ArrowRight className="w-3.5 h-3.5 ml-0.5" /></span>
            </button>
          ))}
        </div>
      )}
    </PhoneFrame>
  );
}

// ---------- counting: opened from the WhatsApp link #/r/<truck>/<token>, no login ----------
type Count = { counted: string; damaged: string };
const draftKey = (id: string) => `loadmatch-count-${id}`;
const loadDraft = (id: string) => { try { return JSON.parse(localStorage.getItem(draftKey(id)) || 'null'); } catch { return null; } };
const saveDraft = (id: string, v: any) => { try { localStorage.setItem(draftKey(id), JSON.stringify(v)); } catch { /* ignore */ } };
const clearDraft = (id: string) => { try { localStorage.removeItem(draftKey(id)); } catch { /* ignore */ } };

// The receiver's own finished count of a load from another phone (kept so reopening the link shows it again)
const remoteKey = (id: string, token: string) => `loadmatch-remote-${id}-${token}`;

// Words on the count screen, in the four languages
type RL = 'en' | 'hi' | 'kn' | 'te';
const R: Record<string, Record<RL, string>> = {
  onWay: { en: 'is on the way', hi: 'रास्ते में है', kn: 'ದಾರಿಯಲ್ಲಿದೆ', te: 'దారిలో ఉంది' },
  whenHere: { en: 'When this truck is at your gate, tap the button and count.', hi: 'गाड़ी गेट पर आए तो बटन दबाएँ और गिनें।', kn: 'ಲಾರಿ ಗೇಟ್‌ಗೆ ಬಂದಾಗ ಬಟನ್ ಒತ್ತಿ ಎಣಿಸಿ.', te: 'లారీ గేటుకు వచ్చినప్పుడు బటన్ నొక్కి లెక్కించండి.' },
  arrivedCount: { en: 'Truck arrived → Count', hi: 'गाड़ी पहुँची → गिनें', kn: 'ಲಾರಿ ಬಂತು → ಎಣಿಸಿ', te: 'లారీ వచ్చింది → లెక్కించండి' },
  iAmOwner: { en: 'I am the owner: save it to my company', hi: 'मैं मालिक हूँ: अपनी कंपनी में जोड़ें', kn: 'ನಾನು ಮಾಲೀಕ: ನನ್ನ ಕಂಪನಿಗೆ ಸೇರಿಸಿ', te: 'నేను యజమాని: నా కంపెనీలో చేర్చండి' },
  iAmStore: { en: 'I am at the store:', hi: 'मैं स्टोर पर हूँ:', kn: 'ನಾನು ಸ್ಟೋರ್‌ನಲ್ಲಿದ್ದೇನೆ:', te: 'నేను స్టోర్‌లో ఉన్నాను:' },
  savedCo: { en: 'Saved to your company. Your store staff see it under “Coming to you” and count it when it arrives; you see the result on your Owner screen.', hi: 'आपकी कंपनी में जुड़ गया। स्टोर स्टाफ इसे “आपके पास आ रही हैं” में देखेंगे और आने पर गिनेंगे।', kn: 'ನಿಮ್ಮ ಕಂಪನಿಗೆ ಸೇರಿಸಲಾಗಿದೆ. ಸ್ಟೋರ್ ಸಿಬ್ಬಂದಿ ಇದನ್ನು “ನಿಮಗೆ ಬರುತ್ತಿವೆ” ಅಡಿ ನೋಡಿ, ಬಂದಾಗ ಎಣಿಸುತ್ತಾರೆ.', te: 'మీ కంపెనీలో చేర్చబడింది. స్టోర్ సిబ్బంది దీన్ని “మీకు వస్తున్నవి”లో చూసి, వచ్చాక లెక్కిస్తారు.' },
  openApp: { en: 'Open your LoadMatch', hi: 'अपना LoadMatch खोलें', kn: 'ನಿಮ್ಮ LoadMatch ತೆರೆಯಿರಿ', te: 'మీ LoadMatch తెరవండి' },
  backStore: { en: 'Back to the store screen', hi: 'स्टोर स्क्रीन पर वापस', kn: 'ಸ್ಟೋರ್ ಪರದೆಗೆ ಹಿಂದೆ', te: 'స్టోర్ స్క్రీన్‌కు వెనక్కి' },
  sent: { en: 'Sent', hi: 'भेजा', kn: 'ಕಳುಹಿಸಿದ್ದು', te: 'పంపినవి' },
  allCame: { en: 'All came', hi: 'सब आ गया', kn: 'ಎಲ್ಲಾ ಬಂತು', te: 'అన్నీ వచ్చాయి' },
  wrong: { en: 'Something is wrong', hi: 'कुछ गड़बड़ है', kn: 'ಏನೋ ಸರಿಯಿಲ್ಲ', te: 'ఏదో సరిగా లేదు' },
  stackPhoto: { en: 'Photo of the unloaded stack', hi: 'उतारे गए माल की फोटो', kn: 'ಇಳಿಸಿದ ಸರಕಿನ ಫೋಟೋ', te: 'దించిన సరుకు ఫోటో' },
  damagePhoto: { en: 'Photo of the damage', hi: 'खराब माल की फोटो', kn: 'ಹಾಳಾದ ಸರಕಿನ ಫೋಟೋ', te: 'పాడైన సరుకు ఫోటో' },
  photoOk: { en: 'Photo added', hi: 'फोटो जुड़ गई', kn: 'ಫೋಟೋ ಸೇರಿತು', te: 'ఫోటో చేరింది' },
  speak: { en: 'Say what is wrong', hi: 'बोलकर बताएं क्या गड़बड़ है', kn: 'ಏನು ಸರಿಯಿಲ್ಲ ಎಂದು ಹೇಳಿ', te: 'ఏమి సరిగా లేదో చెప్పండి' },
  listening: { en: 'Listening…', hi: 'सुन रहे हैं…', kn: 'ಕೇಳುತ್ತಿದೆ…', te: 'వింటోంది…' },
  heard: { en: 'Heard', hi: 'सुना', kn: 'ಕೇಳಿದ್ದು', te: 'విన్నది' },
  orTap: { en: 'or tap − + on each item', hi: 'या हर माल पर − + दबाएँ', kn: 'ಅಥವಾ ಪ್ರತಿ ಸರಕಿನಲ್ಲಿ − + ಒತ್ತಿ', te: 'లేదా ప్రతి సరుకుపై − + నొక్కండి' },
  missing: { en: 'Missing', hi: 'कम', kn: 'ಕಡಿಮೆ', te: 'తక్కువ' },
  damaged: { en: 'Damaged', hi: 'खराब', kn: 'ಹಾಳು', te: 'పాడైనవి' },
  extra: { en: 'Extra', hi: 'ज़्यादा', kn: 'ಹೆಚ್ಚು', te: 'ఎక్కువ' },
  moreCame: { en: '+ More came than sent?', hi: '+ भेजे से ज़्यादा आया?', kn: '+ ಕಳುಹಿಸಿದ್ದಕ್ಕಿಂತ ಹೆಚ್ಚು ಬಂತೇ?', te: '+ పంపినదానికంటే ఎక్కువ వచ్చిందా?' },
  counted: { en: 'Counted', hi: 'गिना', kn: 'ಎಣಿಸಿದ್ದು', te: 'లెక్కించినవి' },
  sayCount: { en: 'Say the count', hi: 'गिनती बोलें', kn: 'ಎಣಿಕೆ ಹೇಳಿ', te: 'లెక్క చెప్పండి' },
  sendOwner: { en: 'Send to owner', hi: 'मालिक को भेजें', kn: 'ಮಾಲೀಕರಿಗೆ ಕಳುಹಿಸಿ', te: 'యజమానికి పంపండి' },
  nothingMarked: { en: 'Nothing marked yet. Tap − + or speak.', hi: 'अभी कुछ नहीं चुना। − + दबाएँ या बोलें।', kn: 'ಇನ್ನೂ ಏನೂ ಗುರುತಿಸಿಲ್ಲ. − + ಒತ್ತಿ ಅಥವಾ ಹೇಳಿ.', te: 'ఇంకా ఏమీ గుర్తించలేదు. − + నొక్కండి లేదా చెప్పండి.' },
  allOkDone: { en: 'All matched. The owner is told.', hi: 'सब मिल गया। मालिक को खबर हो गई।', kn: 'ಎಲ್ಲಾ ಸರಿ. ಮಾಲೀಕರಿಗೆ ತಿಳಿಸಲಾಗಿದೆ.', te: 'అన్నీ సరిపోయాయి. యజమానికి తెలిసింది.' },
  sentToOwner: { en: 'Sent to the owner', hi: 'मालिक को भेजा', kn: 'ಮಾಲೀಕರಿಗೆ ಕಳುಹಿಸಲಾಗಿದೆ', te: 'యజమానికి పంపబడింది' },
  seeItems: { en: 'See items', hi: 'माल देखें', kn: 'ಸರಕು ನೋಡಿ', te: 'సరుకు చూడండి' },
  yourName: { en: 'Your name', hi: 'आपका नाम', kn: 'ನಿಮ್ಮ ಹೆಸರು', te: 'మీ పేరు' },
  lockedBy: { en: 'Locked. Counted by', hi: 'लॉक। गिना', kn: 'ಲಾಕ್. ಎಣಿಸಿದವರು', te: 'లాక్. లెక్కించినవారు' },
};
const SAMPLE: Record<RL, string> = { en: 'two bundles torn', hi: 'दो बंडल फटे हैं', kn: 'ಎರಡು ಬಂಡಲ್ ಹರಿದಿದೆ', te: 'రెండు బండిల్స్ చిరిగిపోయాయి' };
const itemIco = (code: string) => (/^PLY/.test(code) ? '🟫' : /^BOX/.test(code) ? '📦' : /^LOG/.test(code) ? '🪵' : '📜');
const shortN = (code: string) => item(code)?.name.split(',')[0] || code;
type Marks = Record<string, { missing: number; damaged: number; extra: number; counted?: number }>;

export default function Receive({ id, token, payload }: { id: string; token: string; payload?: string }) {
  const store = useStore();
  const [lang, setLangState] = useState(savedLang);
  const setLang = (l: string) => { setLangState(l); saveLang(l); };
  const L = (['en', 'hi', 'kn', 'te'].includes(lang) ? lang : 'en') as RL;
  const w = (k: string) => R[k][L];
  // This phone made the load (same truck and ref): its own record decides. Otherwise the load comes from the link.
  const mine = shipmentOf(store.state, id);
  const fromLink = payload ? unpackLoad(id, token, payload) : null;
  const sameLoad = mine && (!fromLink || mine.token === token);
  const remote = !sameLoad && fromLink ? fromLink : null;
  const [remoteDone, setRemoteDone] = useState<any>(() => { try { return JSON.parse(localStorage.getItem(remoteKey(id, token)) || 'null'); } catch { return null; } });
  // For a load from another phone, work on a scratch copy: nothing is added to this phone's own records.
  const state = React.useMemo(() => {
    if (!remote) return store.state;
    const scratch = { ...store.state, settings: { ...store.state.settings, ...remote.settings }, shipments: [remote.shipment], diffs: [], drafts: [] };
    return remoteDone ? reducer(scratch, remoteDone) : scratch;
  }, [store.state, payload, remoteDone]);
  const dispatch = (a: any) => {
    if (!remote) return store.dispatch(a);
    if (a.type !== 'SUBMIT_RECEIPT') return;
    const stamped = { ...a, at: Date.now() };
    try { localStorage.setItem(remoteKey(id, token), JSON.stringify(stamped)); } catch { /* ignore */ }
    setRemoteDone(stamped);
  };
  const s = sameLoad ? mine : remote ? shipmentOf(state, id) : null;
  const ok = s && s.token && s.token === token && !s.cancelledAt;
  const asStore = (() => { try { return sessionStorage.getItem('lm-as-store') || ''; } catch { return ''; } })();
  const staff = Boolean(getWho()) || Boolean(asStore);
  // our staff: their own name; an outside receiver: the last name used on this phone
  const [by, setBy] = useState(() => (asStore ? `${party(s?.party)?.name.split(' ')[0] || 'Customer'} stores` : staff ? me().replace(' (staff)', '') : (() => { try { return localStorage.getItem('loadmatch-name') || (s?.party ? `${party(s.party)?.name.split(' ')[0]} stores` : 'Store person'); } catch { return 'Store person'; } })()));
  const [arrivedHere, setArrivedHere] = useState(() => { try { const n = sessionStorage.getItem('lm-arrive-now') === id; sessionStorage.removeItem('lm-arrive-now'); return n; } catch { return false; } });
  const [savedCo, setSavedCo] = useState(false);
  const [mode, setMode] = useState<'' | 'ok' | 'wrong'>('');
  const [marks, setMarks] = useState<Marks>({});
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState<'' | 'voice' | 'photo'>('');
  const [heard, setHeard] = useState('');
  const [extraOpen, setExtraOpen] = useState<Record<string, boolean>>({});

  if (!ok) {
    return (
      <PhoneFrame title="LoadMatch" sub={id} lang={lang} setLang={setLang}>
        <Note tone="stop"><AlertTriangle className="w-4 h-4 inline mr-1" />{mine?.returning ? 'This truck had an accident on the way. The goods are going back to the sender, so there is nothing to count here.' : t('invalidLink', lang)}</Note>
      </PhoneFrame>
    );
  }

  const from = route(s).split(' → ')[0];
  const head = (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
      <div className="font-bold text-slate-900 text-sm">{route(s)}</div>
      <div className="text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1"><span className="inline-block px-2 py-0.5 rounded-md border-2 border-slate-800 bg-amber-50 font-mono font-bold text-slate-900">{s.truckNo}</span>{loadName(s.id)}{s.driverPhone && <a href={`tel:${s.driverPhone}`} className="font-bold text-emerald-800">📞 {s.driver || t('driver', lang)}</a>}</div>
    </div>
  );

  if (s.receipt) return <Done s={s} state={state} remote={Boolean(remote)} lang={lang} setLang={setLang} head={head} w={w} />;

  // the truck is on the way: our staff tap Truck arrived; someone outside who opened the link is asked who they are
  if (!s.arrivedAt && !arrivedHere && (!atGate(s.flow) || s.expectedOn)) {
    return (
      <PhoneFrame title="LoadMatch" sub={loadName(s.id)} lang={lang} setLang={setLang}>
        <div className="space-y-4">
          {head}
          <div id="not-arrived" className="rounded-2xl border-2 border-sky-300 bg-sky-50 p-4 text-center space-y-2">
            <div className="text-4xl">🚚</div>
            <div className="text-base font-bold text-sky-950">{loadName(s.id)} {w('onWay')}</div>
            <div className="text-sm text-sky-900">{from}</div>
            <div className="text-xs text-slate-600">{w('whenHere')}</div>
          </div>
          {!staff && !savedCo && <button id="btn-save-company" onClick={() => { saveToCompany(s, window.location.hash, store.dispatch); setSavedCo(true); }} className="w-full min-h-[56px] rounded-2xl bg-slate-900 text-white text-base font-bold cursor-pointer">🏢 {w('iAmOwner')}</button>}
          {!staff && !savedCo && <div className="text-[11px] text-slate-500 text-center">{party(s.party)?.name}</div>}
          {savedCo && <div id="saved-company" className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950">✅ {w('savedCo')}</div>}
          {savedCo && <a id="btn-open-store" href={`#/co/${s.party}/home`} className="w-full min-h-[52px] rounded-2xl bg-emerald-600 text-white text-base font-bold flex items-center justify-center">📦 {w('openApp')} →</a>}
          {staff && <button id="btn-arrived" onClick={() => { if (!remote) store.dispatch({ type: 'ARRIVED', id: s.id, by: me(), actor: me() }); setArrivedHere(true); }} className="w-full min-h-[56px] rounded-2xl bg-emerald-600 text-white text-base font-bold cursor-pointer">📍 {w('arrivedCount')}</button>}
        </div>
      </PhoneFrame>
    );
  }

  const blind = Boolean(state.settings.blindCount);
  const m = (lineId: string) => marks[lineId] || { missing: 0, damaged: 0, extra: 0 };
  const put = (lineId: string, k: string, v: number) => setMarks((x) => ({ ...x, [lineId]: { ...m(lineId), ...x[lineId], [k]: v } }));
  const countedOf = (l: any) => (blind ? m(l.id).counted ?? 0 : l.qty - m(l.id).missing + m(l.id).extra);
  const anyMark = s.lines.some((l: any) => m(l.id).missing || m(l.id).damaged || m(l.id).extra);
  // simulated: in a real build the phone records the voice and a speech model turns it into item + number
  const speak = () => {
    setBusy('voice'); setHeard('');
    setTimeout(() => {
      const l0 = s.lines[0];
      if (blind) { s.lines.forEach((l: any) => put(l.id, 'counted', l.qty)); setHeard(`“${s.lines.map((l: any) => `${shortN(l.item)} ${l.qty}`).join(', ')}”`); }
      else { put(l0.id, 'damaged', Math.min(l0.qty, m(l0.id).damaged + 2)); setHeard(`“${SAMPLE[L]}” → ${shortN(l0.item)}: 2 ${w('damaged').toLowerCase()}`); }
      setBusy('');
    }, 1200);
  };
  const photo = (name: string) => { setBusy('photo'); setTimeout(() => { setPhotos((p) => [...p, name]); setBusy(''); }, 700); };
  const ready = by.trim() && (blind ? s.lines.every((l: any) => countedOf(l) >= m(l.id).damaged) : mode === 'ok' ? photos.includes('stack.jpg') : mode === 'wrong' && anyMark);
  const submit = () => {
    try { localStorage.setItem('loadmatch-name', by.trim()); } catch { /* ignore */ }
    const lines = Object.fromEntries(s.lines.map((l: any) => [l.id, { counted: countedOf(l), damaged: Math.min(m(l.id).damaged, countedOf(l)) }]));
    dispatch({ type: 'SUBMIT_RECEIPT', id: s.id, token, by: by.trim(), lines, photos, note: '', actor: 'Receiver' });
  };
  const tile = 'rounded-2xl border-2 bg-white p-3 space-y-2';
  const markRow = (l: any, k: 'missing' | 'damaged' | 'extra', icon: string, tone: string, max: number) => (
    <div className="flex items-center justify-between gap-2"><span className="text-sm font-bold text-slate-700">{icon} {w(k)}</span><Stepper id={`r-${k}-${l.id}`} value={m(l.id)[k]} max={max} tone={tone} onChange={(v) => put(l.id, k, v)} /></div>
  );

  return (
    <PhoneFrame title={staff ? 'LoadMatch · Store' : 'LoadMatch · Count'} sub={`${route(s).split(' → ')[1]} · ${loadName(s.id)}`} lang={lang} setLang={setLang}>
      <div className="space-y-3">
        {head}
        {s.lines.map((l: any) => (
          <div key={l.id} id={`rline-${l.id}`} className={`${tile} ${mode === 'ok' ? 'border-emerald-300' : 'border-slate-200'}`}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{itemIco(l.item)}</span>
              <span className="flex-1 min-w-0 text-sm font-bold text-slate-900 leading-tight">{shortN(l.item)}<span className="block text-[11px] font-normal text-slate-500">{unitWord(item(l.item).unit, lang)}</span></span>
              {!blind && <span className="text-right"><span className="block text-[11px] text-slate-500">{w('sent')}</span><span className="text-2xl font-mono font-bold text-slate-900">{l.qty}</span></span>}
              {mode === 'ok' && <span className="text-2xl">✅</span>}
            </div>
            {blind && <div className="flex items-center justify-between gap-2"><span className="text-sm font-bold text-slate-700">🔢 {w('counted')}</span><Stepper id={`r-count-${l.id}`} value={countedOf(l)} onChange={(v) => put(l.id, 'counted', v)} /></div>}
            {(mode === 'wrong' || blind) && <>
              {!blind && markRow(l, 'missing', '❌', 'rose', l.qty - m(l.id).extra)}
              {markRow(l, 'damaged', '💔', 'amber', Math.max(0, countedOf(l)))}
              {!blind && (extraOpen[l.id] || m(l.id).extra ? markRow(l, 'extra', '➕', 'sky', 999) : <button id={`r-more-${l.id}`} onClick={() => setExtraOpen({ ...extraOpen, [l.id]: true })} className="text-[12px] font-bold text-sky-800 underline cursor-pointer">{w('moreCame')}</button>)}
            </>}
          </div>
        ))}

        {!blind && !mode && <div className="grid grid-cols-2 gap-3">
          <button id="btn-all-came" onClick={() => setMode('ok')} className="min-h-[72px] rounded-2xl bg-emerald-600 text-white text-base font-bold cursor-pointer flex flex-col items-center justify-center"><span className="text-2xl">✅</span>{w('allCame')}</button>
          <button id="btn-something-wrong" onClick={() => setMode('wrong')} className="min-h-[72px] rounded-2xl bg-amber-500 text-white text-base font-bold cursor-pointer flex flex-col items-center justify-center"><span className="text-2xl">⚠️</span>{w('wrong')}</button>
        </div>}

        {(mode === 'wrong' || blind) && <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-3 space-y-2">
          <button id="btn-speak" disabled={busy === 'voice'} onClick={speak} className={`w-full min-h-[52px] rounded-2xl text-white text-base font-bold cursor-pointer ${busy === 'voice' ? 'bg-rose-600 animate-pulse' : 'bg-slate-900'}`}>🎤 {busy === 'voice' ? w('listening') : blind ? w('sayCount') : w('speak')}</button>
          {heard && <div id="r-heard" className="text-xs rounded-lg px-3 py-1.5 bg-emerald-50 text-emerald-900 border border-emerald-200">🤖 {w('heard')}: {heard}</div>}
          {!blind && <div className="text-[11px] text-slate-500 text-center">{w('orTap')}</div>}
        </div>}

        {mode === 'ok' && <CameraButton id="btn-photo-stack" kind="stack" label={w('stackPhoto')} done={photos.includes('stack.jpg')} onShot={() => setPhotos((p) => [...p, 'stack.jpg'])} busyText={w('photoOk')} />}
        {mode === 'wrong' && s.lines.some((l: any) => m(l.id).damaged) && <CameraButton id="btn-photo-damage" kind="damage" label={w('damagePhoto')} done={photos.includes('damage.jpg')} onShot={() => setPhotos((p) => [...p, 'damage.jpg'])} busyText={w('photoOk')} />}
        {!staff && (mode || blind) && <label className="block text-[11px] font-bold text-slate-700">{w('yourName')}<input id="r-name" value={by} onChange={(e) => setBy(e.target.value)} className="mt-1 w-full p-2.5 rounded-lg border border-slate-300 text-sm" /></label>}
        {mode === 'wrong' && !anyMark && <div id="r-missing" className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2">{w('nothingMarked')}</div>}
        {(mode || blind) && <button id="btn-submit-count" disabled={!ready} onClick={submit} className="w-full min-h-[56px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-base font-bold cursor-pointer">📨 {w('sendOwner')}</button>}
        {mode && <button id="btn-change-mode" onClick={() => { setMode(''); setMarks({}); setHeard(''); }} className="text-xs font-bold text-slate-500 underline cursor-pointer">← {t('goBack', lang)}</button>}
      </div>
    </PhoneFrame>
  );
}

// What the receiver and the sender are told. With "owner only", details stay with the owner.
export function resultText(state: any, s: any, lang: string) {
  const ds = diffsOf(state, s.id);
  const head = `${loadName(s.id)} · ${s.truckNo} · ${route(s)}`;
  if (!ds.length) return `${head}\n✓ ${t('resultMatched', lang)}`;
  if (state.settings.differencesTo === 'owner') return `${head}\n${t('resultDiff', lang)}`;
  const kind: Record<string, string> = { short: t('short', lang), excess: t('excess', lang), damaged: t('damagedWord', lang) };
  return `${head}\n${t('resultDiff', lang)}\n${ds.map((d: any) => `• ${item(d.item).name}: ${d.qty} ${kind[d.kind]}`).join('\n')}`;
}

// After submitting: one line says what happened; the items are one tap away.
function Done({ s, state, remote, lang, setLang, head, w }: { s: any; state: any; remote: boolean; lang: string; setLang: (l: string) => void; head: React.ReactNode; w: (k: string) => string }) {
  const { dispatch } = useStore();
  const [items, setItems] = useState(false);
  const message = sharedMode ? resultText(state, s, lang) : `${resultText(state, s, lang)}\n\n${t('saveCountLink', lang)}:\n${appLink(countBackPath(s, s.receipt))}`;
  const matched = shipmentStatus(state, s) === 'MATCHED';
  const tot = s.lines.reduce((a: any, l: any) => { const r = s.receipt.lines[l.id]; a.missing += Math.max(0, l.qty - r.counted); a.extra += Math.max(0, r.counted - l.qty); a.damaged += r.damaged || 0; return a; }, { missing: 0, extra: 0, damaged: 0 });
  const what = [[tot.missing, w('missing')], [tot.damaged, w('damaged')], [tot.extra, w('extra')]].filter(([n]) => n).map(([n, x]) => `${n} ${String(x).toLowerCase()}`).join(', ');
  return (
    <PhoneFrame title="LoadMatch" sub={loadName(s.id)} lang={lang} setLang={setLang}>
      <div className="space-y-3">
        {head}
        <div id="count-summary" className={`rounded-2xl border-2 p-4 text-center space-y-1 ${matched ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
          <div className="text-4xl">{matched ? '✅' : '⚠️'}</div>
          <div className="text-base font-bold text-slate-900">{matched ? w('allOkDone') : `${w('sentToOwner')}: ${what}`}</div>
        </div>
        {!matched && s.flow !== 'outbound' && <Note tone="warn">{t('lrTip', lang)}</Note>}
        {!matched && !remote && <PhotoStrip photos={(s.docs || []).filter((d: any) => d.by === 'Receiver')} onAdd={(r) => dispatch({ type: 'ATTACH_DOC', id: s.id, docs: r, actor: 'Receiver' })} label={t('addPhoto', lang)} lang={lang} kinds={['signed lorry receipt (bilty)', 'damage']} />}
        {!sharedMode && !countedByUs(s) && <div id="r-send-back"><Note tone="warn">{t('sendBackNote', lang)}</Note></div>}
        {!countedByUs(s) && <a id="btn-tell-sender" href={shareWhatsApp(message)} target="_blank" rel="noreferrer" className="w-full min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center"><MessageCircle className="w-5 h-5 mr-2" />{t(sharedMode ? 'tellSender' : 'sendCountToSender', lang)}</a>}
        <button id="btn-see-items" onClick={() => setItems(!items)} className="text-sm font-bold text-slate-600 underline cursor-pointer">{items ? '▲' : '▼'} {w('seeItems')}</button>
        {items && <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white">
          {s.lines.map((l: any) => {
            const r = s.receipt.lines[l.id];
            const same = r.counted === l.qty && !r.damaged;
            return (
              <div key={l.id} className="px-3 py-2 text-xs flex items-center justify-between gap-2">
                <span className="text-slate-800">{itemIco(l.item)} {shortN(l.item)}<span className="block font-mono text-slate-500">{w('sent')} {l.qty} → {w('counted')} {r.counted}</span></span>
                <span className={`font-bold text-right ${same ? 'text-emerald-700' : 'text-amber-700'}`}>{same ? '✓' : [r.counted < l.qty ? `${l.qty - r.counted} ${w('missing').toLowerCase()}` : '', r.counted > l.qty ? `${r.counted - l.qty} ${w('extra').toLowerCase()}` : '', r.damaged ? `${r.damaged} ${w('damaged').toLowerCase()}` : ''].filter(Boolean).join(', ')}</span>
              </div>
            );
          })}
        </div>}
        {(() => { try { return sessionStorage.getItem('lm-as-store'); } catch { return null; } })() && <a id="btn-back-store" href={`#/co/${sessionStorage.getItem('lm-as-store')}/staff`} className="block text-sm font-bold text-emerald-800 underline">← {w('backStore')}</a>}
        <div className="text-[11px] text-slate-500 flex items-center"><Lock className="w-3.5 h-3.5 mr-1" />{w('lockedBy')} {s.receipt.by}, {when(s.receipt.at)}</div>
      </div>
    </PhoneFrame>
  );
}

// ---------- a customer who uses LoadMatch too ----------
// Their owner saves our truck from the WhatsApp link; from then on it lives in their LoadMatch: Home, Staff, Owner, Accountant.
const coKey = (partyId: string) => `lm-co-${partyId}`;
function savedLocal(partyId: string): any[] { try { return JSON.parse(localStorage.getItem(coKey(partyId)) || '[]'); } catch { return []; } }
function saveToCompany(s: any, hash: string, dispatch: (a: any) => void) {
  dispatch({ type: 'CO_SAVE', id: s.id, actor: `Owner, ${party(s.party)?.name}` });
  try { localStorage.setItem(coKey(s.party), JSON.stringify([{ id: s.id, hash }, ...savedLocal(s.party).filter((x: any) => x.id !== s.id)])); } catch { /* ignore */ }
}
// the trucks this customer saved, newest first, with what the customer sees about each
export function coTrucks(state: any, partyId: string) {
  return state.shipments.filter((s: any) => s.flow === 'outbound' && s.party === partyId && s.coSaved && !s.cancelledAt)
    .map((s: any) => {
      const ds = diffsOf(state, s.id);
      const open = ds.filter((d: any) => d.status === 'open' || d.status === 'investigating');
      const owed = s.coDecision?.action === 'next_truck' ? ds.filter((d: any) => d.status === 'waiting') : [];
      const came = owed.filter((d: any) => d.came);
      const needsOwner = Boolean(s.receipt && open.length && !s.coDecision && (!s.coAsk || s.coAsk.reply)) || came.length > 0;
      const todo = Boolean(s.coDecision && ['pay_less', 'accept'].includes(s.coDecision.action) && !s.coDecision.doneAt);
      return { s, ds, open, owed, came, needsOwner, todo, at: s.coAsk?.reply?.at || s.receipt?.at || s.sentAt || s.coSaved.at };
    }).sort((x: any, y: any) => y.at - x.at);
}
export const coCounts = (state: any, partyId: string) => {
  const t = coTrucks(state, partyId);
  return { staff: t.filter((x: any) => !x.s.receipt).length, owner: t.filter((x: any) => x.needsOwner).length, accountant: t.filter((x: any) => x.todo).length };
};
const coFrom = (s: any) => `${COMPANY.name}, ${route(s).split(' → ')[0].replace(' unit', '')}`;
const coWhat = (ds: any[]) => [['short', 'missing'], ['damaged', 'damaged'], ['excess', 'extra']].map(([k, w]) => { const n = ds.filter((d: any) => d.kind === k).reduce((a: number, d: any) => a + d.qty, 0); return n ? `${n} ${w}` : ''; }).filter(Boolean).join(', ');
const lakh = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(2).replace(/\.?0+$/, '')} L` : `₹${Math.round(n).toLocaleString('en-IN')}`);

export function PartnerApp({ partyId, tab }: { partyId: string; tab: string }) {
  if (tab === 'staff') return <PartnerStore partyId={partyId} />;
  if (tab === 'owner') return <PartnerOwner partyId={partyId} />;
  if (tab === 'accountant') return <PartnerAccountant partyId={partyId} />;
  return <Home go={() => {}} co={partyId} />;
}

// Their Owner: the same card as ours. Difference → ask the sender (us) → our answer → one suggested step → their accountant.
function PartnerOwner({ partyId }: { partyId: string }) {
  const { state, dispatch } = useStore();
  const [all, setAll] = useState(false);
  const [sheet, setSheet] = useState('');
  const [more, setMore] = useState('');
  const [due, setDue] = useState<number | null>(null);
  const [pick, setPick] = useState('');
  const now = Date.now();
  const rows = coTrucks(state, partyId);
  const need = rows.filter((r: any) => r.needsOwner || (r.s.receipt && r.open.length && !r.s.coDecision));
  const info = rows.filter((r: any) => !need.includes(r));
  const shown = all ? need : need.slice(0, 3);
  const me = `Owner, ${party(partyId)?.name}`;
  const b = 'w-full min-h-[44px] rounded-xl text-sm font-bold cursor-pointer flex items-center justify-center px-3';
  const decide = (id: string, action: string, dueAt?: number) => { dispatch({ type: 'CO_DECIDE', id, action, dueAt, actor: me }); setMore(''); setPick(''); };
  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div><h1 className="text-2xl font-bold text-slate-950">Owner</h1><p className="text-sm text-slate-600">You see only what is missing, damaged or extra, and what your suppliers answer.</p></div>
      <div className="flex items-baseline justify-between"><div className="text-lg font-bold text-slate-950">{need.length ? `${need.length} need${need.length === 1 ? 's' : ''} you` : 'All clear ✓'}</div><div className="text-xs text-slate-500">Newest first</div></div>
      {!rows.length && <Note tone="go">When a supplier sends you a LoadMatch link on WhatsApp, tap “I am the owner: save it to my company”. The truck shows here and at your store.</Note>}
      {shown.map(({ s, open, came, owed }: any) => {
        const value = open.reduce((a: number, d: any) => a + d.value, 0);
        const reply = s.coAsk?.reply;
        const sug = coSuggest(s);
        return (
          <div key={s.id} id={`co-own-${s.id}`} className={`bg-white border border-slate-200 border-l-4 ${came.length ? 'border-l-emerald-500' : 'border-l-amber-500'} rounded-xl p-3 space-y-2.5`}>
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none">{came.length ? '📦' : '⚠️'}</span>
              <div className="flex-1 min-w-0">
                <button id={`co-open-${s.id}`} onClick={() => setSheet(s.id)} className="text-left text-sm font-bold text-slate-900 underline decoration-dotted cursor-pointer">{loadName(s.id)} · {coWhat(came.length ? owed : open)}{!came.length && <span className="text-rose-700"> · {lakh(value)}</span>} ›</button>
                <div className="text-xs text-slate-500">From {coFrom(s)} · counted by {s.receipt.by} · {when(s.receipt.at, now)}</div>
              </div>
            </div>
            {came.length > 0 ? <>
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700">📦 {COMPANY.name} sent them in {loadName(came[0].came.load)}. {came[0].came.by} counted them: all there.</div>
              <button id={`co-accept-${s.id}`} onClick={() => came.forEach((d: any) => dispatch({ type: 'SETTLE', diffId: d.id, note: `Customer accepted: came in ${loadName(d.came.load)}`, actor: 'Owner' }))} className={`${b} bg-emerald-600 text-white`}>✓ Accept: it came</button>
            </> : <>
              {s.coAsk && !reply && <div id={`co-asked-${s.id}`} className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700">⏳ Asked {COMPANY.name} {when(s.coAsk.at, now)}.<span className="block">🤖 Assistant reminds them if there is no reply in 2 hours.</span></div>}
              {reply && <div id={`co-reply-${s.id}`} className="rounded-lg bg-sky-50 border border-sky-200 px-3 py-2 text-xs text-sky-950">💬 <b>{COMPANY.name}</b>, {when(reply.at, now)}: “{REPLIES[reply.kind].label}{reply.dueAt ? `, by ${dayLabel(reply.dueAt)}` : ''}”</div>}
              {!s.coAsk && <button id={`co-ask-${s.id}`} onClick={() => dispatch({ type: 'CO_ASK', id: s.id, actor: me })} className={`${b} bg-slate-900 text-white`}>❓ Ask {COMPANY.name}</button>}
              {!s.coAsk && <div className="text-[11px] text-slate-500 -mt-1">Their owner sees the question in LoadMatch and answers with one tap.</div>}
              {reply && sug && <button id={`co-apply-${s.id}`} onClick={() => decide(s.id, sug, reply.dueAt || undefined)} className={`${b} bg-emerald-600 text-white`}>✓ {CO_ACTIONS[sug]}{sug === 'next_truck' && reply.dueAt ? ` · by ${dayLabel(reply.dueAt)}` : ''}</button>}
              {reply && !sug && <div className="text-xs text-slate-600">🤖 They say they loaded it all. Compare their loading photo with your stack photo, then choose below.</div>}
              {reply && <button id={`co-more-${s.id}`} onClick={() => { setMore(more === s.id ? '' : s.id); setPick(''); setDue(null); }} className="text-xs font-bold text-slate-500 underline cursor-pointer">{more === s.id ? '▲ Close' : '▼ Other options'}</button>}
              {more === s.id && <div id={`co-opts-${s.id}`} className="space-y-1.5 border-t border-slate-100 pt-2">
                {Object.keys(CO_ACTIONS).map((a) => <button key={a} id={`co-opt-${s.id}-${a}`} onClick={() => (a === 'next_truck' ? (setPick(a), setDue(null)) : decide(s.id, a))} className={`w-full text-left rounded-lg border-2 px-3 py-2 text-xs font-bold cursor-pointer ${pick === a ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white'}`}>{a === 'next_truck' ? '📦 ' : a === 'pay_less' ? '🧾 ' : '❌ '}{CO_ACTIONS[a]}{a !== 'next_truck' ? ` · ${lakh(value)}` : ''}</button>)}
                {pick === 'next_truck' && <div className="space-y-2"><DateChips id={`co-due-${s.id}`} value={due} onPick={setDue} /><button id={`co-opt-ok-${s.id}`} disabled={!due} onClick={() => decide(s.id, 'next_truck', due!)} className={`${b} bg-emerald-600 text-white disabled:opacity-40`}>✓ {CO_ACTIONS.next_truck}</button></div>}
              </div>}
            </>}
          </div>
        );
      })}
      {need.length > 3 && <button id="co-show-all" onClick={() => setAll(!all)} className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 cursor-pointer">{all ? '▲ Show only 3' : `▼ Show ${need.length - 3} more`}</button>}
      {info.length > 0 && <div className="space-y-1">
        <div className="text-xs font-bold text-slate-500 pt-1">Also, nothing to do</div>
        {info.slice(0, 5).map(({ s, open, owed }: any) => {
          const t = !s.receipt ? `🚚 ${loadName(s.id)} from ${coFrom(s)} is on the way` : !diffsOf(state, s.id).length ? `✅ ${loadName(s.id)} · all matched` : s.coDecision ? `🧾 ${loadName(s.id)} · decided: ${CO_ACTIONS[s.coDecision.action]}${s.coDecision.dueAt ? ` by ${dayLabel(s.coDecision.dueAt)}` : ''}${owed.length && !owed.some((d: any) => d.came) ? ' · waiting for the truck' : ''}` : `⏳ ${loadName(s.id)} · ${coWhat(open)} · waiting for ${COMPANY.name}'s answer`;
          return <button key={s.id} id={`co-own-${s.id}`} onClick={() => setSheet(s.id)} className="w-full text-left bg-white border border-slate-200 hover:border-slate-400 rounded-lg px-3 py-2 text-xs flex items-center gap-2 cursor-pointer"><span className="flex-1"><b className="text-slate-800">{t}</b><span className="block text-slate-500">{when(s.coDecision?.at || s.receipt?.at || s.sentAt)}</span></span><span className="text-slate-400 font-bold">›</span></button>;
        })}
      </div>}
      {sheet && <TruckSheet id={sheet} onClose={() => setSheet('')} />}
    </div>
  );
}

// Their Accountant: the same to-do list as ours, from their owner's decisions
function PartnerAccountant({ partyId }: { partyId: string }) {
  const { state, dispatch } = useStore();
  const rows = coTrucks(state, partyId).filter((r: any) => r.s.coDecision && ['pay_less', 'accept'].includes(r.s.coDecision.action));
  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div><h1 className="text-2xl font-bold text-slate-950">Accountant</h1><p className="text-sm text-slate-600">What the owner decided, to enter in Tally. Tick each one when it is done.</p></div>
      <div className="text-lg font-bold text-slate-950">To do · {rows.filter((r: any) => !r.s.coDecision.doneAt).length}</div>
      {!rows.length && <Note tone="go">Nothing to enter. When the owner decides that a supplier pays for missing goods, it shows here.</Note>}
      {rows.map(({ s, ds }: any) => {
        const v = ds.filter((d: any) => d.kind !== 'excess').reduce((a: number, d: any) => a + d.value, 0);
        const done = s.coDecision.doneAt;
        return (
          <div key={s.id} id={`co-acc-${s.id}`} className={`bg-white border border-slate-200 border-l-4 ${done ? 'border-l-emerald-500' : 'border-l-violet-500'} rounded-xl p-3 flex items-center gap-3`}>
            <span className="text-2xl">{done ? '✅' : '🧾'}</span>
            <div className="flex-1 min-w-0"><div className="text-sm font-bold text-slate-900">{s.coDecision.action === 'pay_less' ? `Debit note to ${COMPANY.name}` : 'Write off (we take the loss)'} · {lakh(v)}</div><div className="text-xs text-slate-500">{loadName(s.id)} · their bill {s.ref} · {coWhat(ds)} · decided {when(s.coDecision.at)}</div></div>
            {done ? <span className="text-xs font-bold text-emerald-700">Done in Tally</span> : <button id={`co-acc-done-${s.id}`} onClick={() => dispatch({ type: 'CO_DONE', id: s.id, actor: 'Accountant' })} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer">Done in Tally</button>}
          </div>
        );
      })}
    </div>
  );
}

export function PartnerStore({ partyId }: { partyId: string }) {
  const { state } = useStore();
  const [lang, setLangState] = useState(savedLang);
  const setLang = (l: string) => { setLangState(l); saveLang(l); };
  const [open, setOpen] = useState<'' | 'send' | 'receive'>('receive');
  const p = party(partyId);
  const list = coTrucks(state, partyId).map(({ s }: any) => ({ id: s.id, hash: receiverPath(s, state.settings), from: coFrom(s), plate: s.truckNo, at: s.coSaved.at }));
  const doneOf = (x: any) => shipmentOf(state, x.id)?.receipt;
  const coming = list.filter((x: any) => !doneOf(x));
  const counted = list.filter((x: any) => doneOf(x));
  const go = (x: any, arrive: boolean) => { try { sessionStorage.setItem('lm-as-store', partyId); if (arrive) sessionStorage.setItem('lm-arrive-now', x.id); } catch { /* ignore */ } window.location.hash = x.hash; };
  const short = p?.name.split(' ')[0] || 'Store';
  return (
    <PhoneFrame title="LoadMatch" sub={`${short} stores · ${p?.name}`} lang={lang} setLang={setLang}>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs"><span className="text-slate-500">I am at:</span><span className="px-3 py-1.5 rounded-full border font-bold bg-slate-900 text-white border-slate-900">{p?.name} store</span></div>
        <div className="grid grid-cols-2 gap-3">
          <button id="co-send" onClick={() => setOpen('send')} className={`min-h-[96px] rounded-2xl text-lg font-bold cursor-pointer flex flex-col items-center justify-center border-2 ${open === 'send' ? 'bg-violet-700 text-white border-violet-700' : 'bg-violet-50 text-violet-900 border-violet-200'}`}><span className="text-3xl">📤</span>Send</button>
          <button id="co-receive" onClick={() => setOpen('receive')} className={`relative min-h-[96px] rounded-2xl text-lg font-bold cursor-pointer flex flex-col items-center justify-center border-2 ${open === 'receive' ? 'bg-sky-700 text-white border-sky-700' : 'bg-sky-50 text-sky-900 border-sky-200'}`}><span className="text-3xl">📥</span>Receive
            {coming.length > 0 && <span className="absolute top-2 right-2 min-w-6 h-6 px-1.5 rounded-full bg-amber-500 text-white text-sm flex items-center justify-center">{coming.length}</span>}</button>
        </div>
        {open === 'send' && <div id="co-send-note" className="rounded-2xl border-2 border-violet-200 bg-violet-50 p-3 text-sm text-violet-950">📤 {p?.name} sends its own trucks here the same way: photo of the challan, photo of the plate, driver, Start loading → Loading done → Truck left. (Not filled in this demo.)</div>}
        {open === 'receive' && <div id="co-coming" className="rounded-2xl border-2 border-sky-300 bg-sky-50 p-3 space-y-2">
          <div className="text-base font-bold text-sky-950">🚚 Coming to you · {coming.length}</div>
          {!coming.length && <div className="text-sm text-sky-900">No truck coming now</div>}
          {coming.slice(0, 3).map((x: any) => (
            <button key={x.id} id={`co-${x.id}`} onClick={() => go(x, true)} className="w-full text-left rounded-xl bg-white border-2 border-sky-200 hover:border-sky-500 p-3 space-y-2 cursor-pointer block">
              <span className="flex items-center gap-3">
                <span className="text-3xl leading-none">🚚</span>
                <span className="flex-1 min-w-0"><span className="block text-base font-bold text-slate-900">From {x.from}</span><span className="inline-block px-2 py-0.5 rounded-md border-2 border-slate-800 bg-amber-50 font-mono font-bold text-sm text-slate-900">{x.plate}</span><span className="block text-xs text-slate-600">On the way · {loadName(x.id)}</span></span>
              </span>
              <span className="w-full min-h-[48px] rounded-xl bg-emerald-600 text-white text-base font-bold flex items-center justify-center">📍 Truck arrived → 🔢 Count</span>
            </button>
          ))}
        </div>}
        <div id="co-updates" className="space-y-1.5">
          <div className="text-sm font-bold text-slate-900">🔔 Updates</div>
          {!list.length && <div className="text-xs text-slate-500">No news</div>}
          {list.slice(0, 3).map((x: any) => { const r = doneOf(x); const bad = r && Object.values(r.lines || {}).some((v: any, i) => v.damaged || v.counted !== (shipmentOf(state, x.id)?.lines[i]?.qty ?? v.counted)); return (
            <button key={x.id} id={`co-up-${x.id}`} onClick={() => go(x, false)} className={`w-full text-left rounded-xl border px-3 py-2 text-sm flex items-start gap-2 cursor-pointer ${!r ? 'bg-sky-50 border-sky-200' : bad ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}><span className="text-lg leading-none">{!r ? '🚚' : bad ? '⚠️' : '✅'}</span><span className="flex-1">{loadName(x.id)} {!r ? `coming from ${x.from}` : bad ? 'counted: does not match. Your owner is told' : 'counted, all OK'}<span className="block text-[11px] text-slate-500">{when(r?.at || x.at)}</span></span></button>); })}
        </div>
        {counted.length > 0 && <div className="text-[11px] text-slate-500">🗂 Counted trucks: {counted.length}</div>}
        <div className="text-[11px] text-slate-400">Demo: this is {p?.name}'s own LoadMatch. Trucks their owner saved from a WhatsApp link show here.</div>
      </div>
    </PhoneFrame>
  );
}

// ---------- the owner asked a supplier what happened: #/a/<truck>/<token>, one tap to answer ----------
export function SenderReply({ id, token }: { id: string; token: string }) {
  const { state, dispatch } = useStore();
  const [lang, setLangState] = useState(savedLang);
  const setLang = (l: string) => { setLangState(l); saveLang(l); };
  const [step, setStep] = useState<'lock' | 'code' | 'open'>('lock');
  const [pickNext, setPickNext] = useState(false);
  const [due, setDue] = useState<number | null>(null);
  const s = shipmentOf(state, id);
  const valid = s && s.ask && s.ask.token === token;
  const ds = valid ? diffsOf(state, s.id).filter((d: any) => d.kind !== 'excess') : [];
  const p = valid ? party(s.party) : null;
  const phone = String(p?.phone || '9845004321').slice(-4);
  const answer = (k: string, dueAt?: number) => dispatch({ type: 'SENDER_REPLY', id: s.id, token, kind: k, dueAt, by: `Owner, ${p?.name}`, actor: p?.name });
  const b = 'w-full min-h-[52px] rounded-xl text-sm font-bold cursor-pointer flex items-center gap-2 px-3';
  return (
    <PhoneFrame title="LoadMatch" sub={s ? loadName(s.id) : id} lang={lang} setLang={setLang}>
      {!valid ? <Note tone="stop">{t('invalidLink', lang)}</Note> : step !== 'open' && !s.ask.reply ? (
        // owner to owner only: the link opens after a code sent to the owner's own phone (simulated)
        <div className="space-y-3">
          <div className="rounded-2xl border-2 border-slate-300 bg-slate-50 p-4 text-center space-y-2">
            <div className="text-4xl">🔒</div>
            <div className="text-base font-bold text-slate-900">For the owner of {p?.name} only</div>
            <div className="text-xs text-slate-600">{COMPANY.name} is asking about {loadName(s.id)} (your bill {s.ref}). To keep it between owners, we send a code to the owner's phone ••••{phone}.</div>
          </div>
          {step === 'lock' && <button id="btn-send-code" onClick={() => setStep('code')} className={`${b} justify-center bg-slate-900 text-white`}>📲 Send code to ••••{phone}</button>}
          {step === 'code' && <>
            <div id="code-box" className="flex justify-center gap-2">{['4', '8', '2', '1'].map((x, i) => <span key={i} className="w-11 h-12 rounded-lg border-2 border-slate-400 bg-white flex items-center justify-center text-xl font-mono font-bold">{x}</span>)}</div>
            <div className="text-[11px] text-slate-500 text-center">Code filled in from the SMS (demo)</div>
            <button id="btn-open-reply" onClick={() => setStep('open')} className={`${b} justify-center bg-emerald-600 text-white`}>Open</button>
          </>}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
            <div className="font-bold text-slate-900 text-sm">{route(s)} · {loadName(s.id)}</div>
            <div className="text-slate-600">Your bill {s.ref} · truck {s.truckNo}</div>
          </div>
          <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-3 space-y-1">
            <div className="text-base font-bold text-amber-950">❓ {COMPANY.name} counted less than your bill. What happened?</div>
            {ds.map((d: any) => <div key={d.id} className="text-sm text-amber-950">{itemIco(d.item)} {shortN(d.item)}: {d.qty} {d.kind === 'short' ? 'missing' : 'damaged'}</div>)}
          </div>
          {s.ask.reply ? <div id="reply-done" className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-3 text-sm font-bold text-emerald-950">✅ Sent: {REPLIES[s.ask.reply.kind].label}{s.ask.reply.dueAt ? ` by ${dayLabel(s.ask.reply.dueAt)}` : ''}. Thank you.</div>
            : pickNext ? <div className="space-y-2">
                <div className="text-sm font-bold text-slate-900">📦 When will you send it?</div>
                <DateChips id="sdue" value={due} onPick={setDue} />
                <button id="sreply-send" disabled={!due} onClick={() => answer('send_next', due!)} className={`${b} justify-center bg-emerald-600 text-white disabled:opacity-40`}>📨 Send answer</button>
                <button onClick={() => setPickNext(false)} className="text-xs font-bold text-slate-500 underline cursor-pointer">← Back</button>
              </div>
            : Object.keys(REPLIES).map((k) => <button key={k} id={`sreply-${k}`} onClick={() => (k === 'send_next' ? setPickNext(true) : answer(k))} className={`${b} border-2 border-slate-300 bg-white text-slate-900 text-left`}><span className="text-xl">{REPLIES[k].icon}</span>{REPLIES[k].label}</button>)}
        </div>
      )}
    </PhoneFrame>
  );
}

// ---------- the count comes back: the sender opens #/c/<truck>/<token>/<count> on the phone that made the load ----------
export function CountBack({ id, token, payload, onOpen }: { id: string; token: string; payload: string; onOpen: (id: string) => void }) {
  const { state, dispatch } = useStore();
  const [lang, setLangState] = useState(savedLang);
  const setLang = (l: string) => { setLangState(l); saveLang(l); };
  const s = shipmentOf(state, id);
  const r = unpackCount(payload);
  const valid = Boolean(s && r && s.token === token && !s.cancelledAt);
  const tried = useRef(false);
  useEffect(() => {
    if (tried.current || !valid || s.receipt) return;
    tried.current = true;
    dispatch({ type: 'SUBMIT_RECEIPT', id: s.id, token, by: r!.by, lines: r!.lines, photos: [], note: r!.note, at: r!.at, actor: 'Receiver' });
  }, [valid]);
  let body: React.ReactNode;
  if (!s || !r) body = <Note tone="stop"><AlertTriangle className="w-4 h-4 inline mr-1" />{t('countOtherPhone', lang)}</Note>;
  else if (s.cancelledAt) body = <Note tone="stop">{t('countCancelled', lang)}</Note>;
  else if (s.token !== token) body = <Note tone="stop">{t('invalidLink', lang)}</Note>;
  else if (!s.receipt) body = <Note tone="stop">{t('countBad', lang)}</Note>;
  else body = (
    <>
      <Note tone="go"><CheckCircle2 className="w-4 h-4 inline mr-1" />{fill(t('countSaved', lang), { by: s.receipt.by })}</Note>
      <div id="cb-result" className="rounded-xl border border-slate-200 bg-white p-3 text-xs whitespace-pre-line text-slate-800">{resultText(state, s, lang)}</div>
      <button id="btn-open-load" onClick={() => onOpen(s.id)} className="w-full min-h-[48px] rounded-xl bg-slate-900 text-white text-sm font-bold flex items-center justify-center cursor-pointer">{t('openLoad', lang)}<ArrowRight className="w-4 h-4 ml-1" /></button>
    </>
  );
  return <PhoneFrame title="LoadMatch" sub={s ? `${loadName(s.id)} · ${s.truckNo}` : id} lang={lang} setLang={setLang}><div className="space-y-3">{body}</div></PhoneFrame>;
}

// Store person at the sending unit: trucks dispatch has listed, waiting to be loaded. Start and end times help if there is a dispute later.
function TrucksToLoad() {
  const { state, dispatch } = useStore();
  const [points, setPoints] = useState<Record<string, string>>({});
  const list = state.shipments.filter((s: any) => !s.sentAt && !s.cancelledAt && !atGate(s.flow) && !(s.loading && s.loading.endAt));
  if (!list.length) return null;
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide pt-1">Trucks to load · Sending side</div>
      {list.map((s: any) => (
        <div key={s.id} id={`load-${s.id}`} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 shadow-2xs">
          <div className="text-xs"><b>{s.truckNo}</b> · {route(s)} · {loadName(s.id)}</div>
          <div className="text-[11px] text-slate-600">{s.lines.map((l: any) => `${l.qty} ${item(l.item).name}`).join(' · ')}</div>
          <select id={`load-point-${s.id}`} disabled={!!s.loading} value={s.loading?.point || points[s.id] || LOADING_POINTS[0]} onChange={(e) => setPoints({ ...points, [s.id]: e.target.value })} className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs">{LOADING_POINTS.map((p) => <option key={p}>{p}</option>)}</select>
          <div className="grid grid-cols-2 gap-2">
            <button id={`load-start-${s.id}`} disabled={!!s.loading} onClick={() => dispatch({ type: 'LOADING', id: s.id, point: points[s.id] || LOADING_POINTS[0], phase: 'start', actor: me() })} className="py-2.5 rounded-lg border-2 border-slate-900 disabled:border-slate-200 disabled:text-slate-500 text-xs font-bold cursor-pointer">{s.loading ? `Started ${time(s.loading.startAt)}` : 'Loading started'}</button>
            <button id={`load-end-${s.id}`} disabled={!s.loading} onClick={() => dispatch({ type: 'LOADING', id: s.id, phase: 'end', actor: me() })} className="py-2.5 rounded-lg bg-slate-900 disabled:opacity-40 text-white text-xs font-bold cursor-pointer">Loading finished</button>
          </div>
        </div>
      ))}
    </div>
  );
}
