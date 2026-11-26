import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Camera, Lock, CheckCircle2, AlertTriangle, Minus, Plus, ChevronLeft, ChevronRight, MessageCircle, PackageCheck, Warehouse, ArrowRight, Wrench } from 'lucide-react';
import { useStore, item, party, route, shipmentOf, diffsOf, shipmentStatus, receiverPath, countBackPath, unpackLoad, unpackCount, reducer, countedByUs, atGate, jobworkOpen, loadName, FLOW_LABEL, REPLIES } from '../store.tsx';
import { Stepper } from './Staff.tsx';
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
  savedCo: { en: 'Saved to your company. Your store staff now see it under “Coming to you” and count it when it arrives.', hi: 'आपकी कंपनी में जुड़ गया। स्टोर स्टाफ इसे “आपके पास आ रही हैं” में देखेंगे और आने पर गिनेंगे।', kn: 'ನಿಮ್ಮ ಕಂಪನಿಗೆ ಸೇರಿಸಲಾಗಿದೆ. ಸ್ಟೋರ್ ಸಿಬ್ಬಂದಿ ಇದನ್ನು “ನಿಮಗೆ ಬರುತ್ತಿವೆ” ಅಡಿ ನೋಡಿ, ಬಂದಾಗ ಎಣಿಸುತ್ತಾರೆ.', te: 'మీ కంపెనీలో చేర్చబడింది. స్టోర్ సిబ్బంది దీన్ని “మీకు వస్తున్నవి”లో చూసి, వచ్చాక లెక్కిస్తారు.' },
  openApp: { en: 'Open the store screen', hi: 'स्टोर स्क्रीन खोलें', kn: 'ಸ್ಟೋರ್ ಪರದೆ ತೆರೆಯಿರಿ', te: 'స్టోర్ స్క్రీన్ తెరవండి' },
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
  const [arrivedHere, setArrivedHere] = useState(false);
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
          {!staff && !savedCo && <button id="btn-save-company" onClick={() => { saveToCompany(s, window.location.hash); setSavedCo(true); }} className="w-full min-h-[56px] rounded-2xl bg-slate-900 text-white text-base font-bold cursor-pointer">🏢 {w('iAmOwner')}</button>}
          {!staff && !savedCo && <div className="text-[11px] text-slate-500 text-center">{party(s.party)?.name}</div>}
          {savedCo && <div id="saved-company" className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950">✅ {w('savedCo')}</div>}
          {savedCo && <a id="btn-open-store" href={`#/co/${s.party}`} className="w-full min-h-[52px] rounded-2xl bg-emerald-600 text-white text-base font-bold flex items-center justify-center">📦 {w('openApp')} →</a>}
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
        {(() => { try { return sessionStorage.getItem('lm-as-store'); } catch { return null; } })() && <a id="btn-back-store" href={`#/co/${sessionStorage.getItem('lm-as-store')}`} className="block text-sm font-bold text-emerald-800 underline">← {w('backStore')}</a>}
        <div className="text-[11px] text-slate-500 flex items-center"><Lock className="w-3.5 h-3.5 mr-1" />{w('lockedBy')} {s.receipt.by}, {when(s.receipt.at)}</div>
      </div>
    </PhoneFrame>
  );
}

// ---------- a customer's owner saved our truck into their company: their store sees it and counts it ----------
const coKey = (partyId: string) => `lm-co-${partyId}`;
export function savedTrucks(partyId: string): any[] { try { return JSON.parse(localStorage.getItem(coKey(partyId)) || '[]'); } catch { return []; } }
function saveToCompany(s: any, hash: string) {
  const list = savedTrucks(s.party).filter((x: any) => x.id !== s.id);
  try { localStorage.setItem(coKey(s.party), JSON.stringify([{ id: s.id, hash, from: route(s).split(' → ')[0], plate: s.truckNo, at: Date.now() }, ...list])); } catch { /* ignore */ }
}
export function PartnerStore({ partyId }: { partyId: string }) {
  const { state } = useStore();
  const [lang, setLangState] = useState(savedLang);
  const setLang = (l: string) => { setLangState(l); saveLang(l); };
  const p = party(partyId);
  const list = savedTrucks(partyId);
  const done = (x: any) => Boolean(shipmentOf(state, x.id)?.receipt) || (() => { try { const [, , , tok] = x.hash.split('/'); return Boolean(localStorage.getItem(remoteKey(x.id, tok))); } catch { return false; } })();
  const coming = list.filter((x: any) => !done(x));
  const old = list.filter(done).slice(0, 3);
  const open = (x: any) => { try { sessionStorage.setItem('lm-as-store', partyId); } catch { /* ignore */ } window.location.hash = x.hash; };
  return (
    <PhoneFrame title={`${p?.name || 'Customer'} · Store`} sub="LoadMatch" lang={lang} setLang={setLang}>
      <div className="space-y-3">
        <div className="text-[11px] text-slate-500">Demo: this is the customer's own LoadMatch. Trucks their owner saved from a WhatsApp link show here.</div>
        <div id="co-coming" className="rounded-2xl border-2 border-sky-300 bg-sky-50 p-3 space-y-2">
          <div className="text-base font-bold text-sky-950">🚚 Coming to you · {coming.length}</div>
          {!coming.length && <div className="text-sm text-sky-900">No truck coming now</div>}
          {coming.slice(0, 3).map((x: any) => (
            <button key={x.id} id={`co-${x.id}`} onClick={() => open(x)} className="w-full text-left rounded-xl bg-white border-2 border-sky-200 p-3 space-y-2 cursor-pointer block">
              <span className="flex items-center gap-3"><span className="text-3xl">🚚</span><span className="flex-1"><span className="block text-base font-bold text-slate-900">From {x.from}</span><span className="inline-block px-2 py-0.5 rounded-md border-2 border-slate-800 bg-amber-50 font-mono font-bold text-sm">{x.plate}</span><span className="block text-xs text-slate-600">{loadName(x.id)}</span></span></span>
              <span className="w-full min-h-[48px] rounded-xl bg-emerald-600 text-white text-base font-bold flex items-center justify-center">📍 Truck arrived → 🔢 Count</span>
            </button>
          ))}
        </div>
        {old.length > 0 && <div className="space-y-1.5"><div className="text-sm font-bold text-slate-900">🗂 Counted</div>{old.map((x: any) => <button key={x.id} id={`co-old-${x.id}`} onClick={() => open(x)} className="w-full text-left rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm cursor-pointer">✅ From {x.from} · {loadName(x.id)}</button>)}</div>}
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
