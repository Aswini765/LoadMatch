import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Camera, Lock, CheckCircle2, AlertTriangle, Minus, Plus, ChevronLeft, ChevronRight, MessageCircle, PackageCheck, Warehouse, ArrowRight, Wrench } from 'lucide-react';
import { useStore, item, party, route, shipmentOf, diffsOf, shipmentStatus, receiverPath, countBackPath, unpackLoad, unpackCount, reducer, countedByUs, atGate, jobworkOpen, loadName, FLOW_LABEL } from '../store.tsx';
import { LOADING_POINTS } from '../data/seed.ts';
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

export default function Receive({ id, token, payload }: { id: string; token: string; payload?: string }) {
  const store = useStore();
  const [lang, setLangState] = useState(savedLang);
  const setLang = (l: string) => { setLangState(l); saveLang(l); };
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
  const saved = loadDraft(`${id}-${token}`);
  // our staff: their own name; an outside receiver: the last name typed on this phone
  const [by, setBy] = useState(() => saved?.by || (getWho() ? me().replace(' (staff)', '') : (() => { try { return localStorage.getItem('loadmatch-name') || (s?.party ? `${party(s.party)?.name.split(' ')[0]} stores` : 'Store person'); } catch { return 'Store person'; } })()));
  // Prototype: counts open filled in with exactly what was sent (the happy path). For a sad path, press − to make some missing or + damaged.
  const demoCounts = () => Object.fromEntries(s.lines.map((l: any) => [l.id, { counted: String(l.qty), damaged: '0' }]));
  const [counts, setCounts] = useState<Record<string, Count>>(() => saved?.counts || (ok ? demoCounts() : {}));
  // with the shared database the load can arrive a moment after this screen opens: fill the demo counts then
  useEffect(() => { if (ok && !s.receipt && !saved?.counts && !Object.keys(counts).length) setCounts(demoCounts()); }, [ok]);
  const [photos, setPhotos] = useState<any[]>(saved?.photos || []);
  const [note, setNote] = useState(saved?.note || '');
  const [step, setStep] = useState<number>(saved?.step ?? 0); // 0..n-1 lines, n = review
  const [confirming, setConfirming] = useState(false);
  const [heard, setHeard] = useState<{ text: string; ok: boolean } | null>(null);
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => { if (ok && !s.receipt) saveDraft(`${id}-${token}`, { by, counts, photos, note, step }); }, [ok, s?.receipt, id, by, counts, photos, note, step]);

  const lineIds: string[] = ok ? s.lines.map((l: any) => l.id) : [];
  const onText = useCallback((alts: string[]) => {
    const lineId = lineIds[stepRef.current];
    if (!lineId) return;
    const parsed = alts.map(parseCount).find((p) => p.counted != null || p.damaged != null);
    if (!parsed) { setHeard({ text: alts[0] || '', ok: false }); return; }
    setHeard({ text: alts[0], ok: true });
    setCounts((c) => {
      const cur = c[lineId] || { counted: '', damaged: '0' };
      return { ...c, [lineId]: { counted: parsed.counted != null ? String(parsed.counted) : cur.counted, damaged: parsed.damaged != null ? String(parsed.damaged) : cur.damaged || '0' } };
    });
  }, [lineIds.join(',')]);
  const voice = useVoice(lang, onText);

  if (!ok) {
    return (
      <PhoneFrame title="LoadMatch" sub={id} lang={lang} setLang={setLang}>
        <Note tone="stop"><AlertTriangle className="w-4 h-4 inline mr-1" />{mine?.returning ? 'This truck had an accident on the way. The goods are going back to the sender, so there is nothing to count here.' : t('invalidLink', lang)}</Note>
      </PhoneFrame>
    );
  }

  const head = (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-0.5">
      <div className="font-bold text-slate-900 text-sm">{route(s)}</div>
      <div className="text-slate-600">{t('truck', lang)} <span className="font-mono font-bold">{s.truckNo}</span> • {t('ref', lang)} {s.ref} • {loadName(s.id)}</div>
      {(s.driver || s.driverPhone) && <div className="text-slate-600">{t('driver', lang)}: {s.driver || '—'}{s.driverPhone && <a href={`tel:${s.driverPhone}`} className="ml-2 inline-block font-bold text-emerald-800">📞 {t('callDriver', lang)}</a>}</div>}
    </div>
  );

  if (s.receipt) return <Done s={s} state={state} remote={Boolean(remote)} lang={lang} setLang={setLang} head={head} />;

  const n = s.lines.length;
  const get = (lineId: string): Count => counts[lineId] || { counted: '', damaged: '0' };
  const set = (lineId: string, k: keyof Count, v: string) => setCounts((c) => ({ ...c, [lineId]: { ...get(lineId), ...c[lineId], [k]: v.replace(/[^0-9]/g, '') } }));
  const bump = (lineId: string, k: keyof Count, d: number) => set(lineId, k, String(Math.max(0, Number(get(lineId)[k] || 0) + d)));
  const lineValid = (lineId: string) => { const c = get(lineId); return c.counted !== '' && Number(c.damaged || 0) <= Number(c.counted); };
  const left = s.lines.filter((l: any) => !lineValid(l.id)).length;
  const ready = left === 0 && by.trim().length > 0;
  const go = (to: number) => { voice.stop(); setHeard(null); setStep(Math.max(0, Math.min(n, to))); };

  const submit = () => {
    try { localStorage.setItem('loadmatch-name', by.trim()); } catch { /* ignore */ }
    const lines = Object.fromEntries(s.lines.map((l: any) => [l.id, { counted: Number(get(l.id).counted), damaged: Number(get(l.id).damaged || 0) }]));
    dispatch({ type: 'SUBMIT_RECEIPT', id: s.id, token, by: by.trim(), lines, photos, note: note.trim(), actor: 'Receiver' });
    clearDraft(`${s.id}-${token}`);
    setConfirming(false);
  };

  const num = 'w-20 p-2 rounded-lg border border-slate-300 text-center text-xl font-mono font-bold';
  const stepBtn = 'w-11 h-11 rounded-lg border border-slate-300 bg-white flex items-center justify-center text-slate-700 cursor-pointer active:bg-slate-100';

  // ----- one line at a time -----
  if (step < n) {
    const l = s.lines[step];
    const c = get(l.id);
    const bad = c.counted !== '' && Number(c.damaged || 0) > Number(c.counted);
    return (
      <PhoneFrame title={countTitle()} sub={`${t('recvSide', lang)}: ${route(s).split(' → ')[1]} · ${loadName(s.id)}`} lang={lang} setLang={setLang}>
        {head}
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
          <span>{fill(t('lineOf', lang), { n: step + 1, total: n })}</span>
          <span>{n - left}/{n} ✓</span>
        </div>
        <div className="flex gap-1">{s.lines.map((x: any, i: number) => <button key={x.id} aria-label={`line ${i + 1}`} onClick={() => go(i)} className={`h-1.5 flex-1 rounded-full cursor-pointer ${i === step ? 'bg-slate-900' : lineValid(x.id) ? 'bg-emerald-500' : 'bg-slate-200'}`} />)}</div>

        <div id={`rline-${l.id}`} className="rounded-2xl border-2 border-slate-200 p-4 space-y-4">
          <div>
            <div className="text-base font-bold text-slate-900 leading-snug">{item(l.item).name}</div>
            <div className="text-[11px] text-slate-500">{unitWord(item(l.item).unit, lang)}{!state.settings.blindCount && <> • {t('sentQty', lang)}: <b className="text-slate-800">{l.qty}</b></>}</div>
          </div>

          {voice.supported ? (
            <div className="flex flex-col items-center gap-2">
              <button id={`r-mic-${l.id}`} onClick={() => (voice.listening ? voice.stop() : (setHeard(null), voice.start()))}
                className={`w-20 h-20 rounded-full flex items-center justify-center cursor-pointer shadow-md ${voice.listening ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-900 text-white'}`} aria-label={t('speakCount', lang)}>
                <Mic className="w-9 h-9" />
              </button>
              <div className="text-xs font-bold text-slate-800">{voice.listening ? t('listening', lang) : t('tapMic', lang)}</div>
              <div className="text-[11px] text-slate-500 text-center">{t('sayLike', lang)}</div>
              {heard && <div id="r-heard" className={`text-xs rounded-lg px-3 py-1.5 ${heard.ok ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-amber-50 text-amber-900 border border-amber-200'}`}>{heard.ok ? <>{t('heard', lang)}: “{heard.text}”</> : t('notUnderstood', lang)}</div>}
              {voice.error && voice.error !== 'lang_fallback' && <div className="text-[11px] text-amber-800"><MicOff className="w-3.5 h-3.5 inline mr-1" />{voice.error.replace(/_/g, ' ')}</div>}
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700">{t('counted', lang)}</span>
              <div className="flex items-center gap-1.5">
                <button className={stepBtn} onClick={() => bump(l.id, 'counted', -1)} aria-label="minus"><Minus className="w-4 h-4" /></button>
                <input id={`r-count-${l.id}`} inputMode="numeric" value={c.counted} onChange={(e) => set(l.id, 'counted', e.target.value)} placeholder="?" className={num} />
                <button className={stepBtn} onClick={() => bump(l.id, 'counted', 1)} aria-label="plus"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700">{t('damaged', lang)}</span>
              <div className="flex items-center gap-1.5">
                <button className={stepBtn} onClick={() => bump(l.id, 'damaged', -1)} aria-label="minus"><Minus className="w-4 h-4" /></button>
                <input id={`r-dmg-${l.id}`} inputMode="numeric" value={c.damaged} onChange={(e) => set(l.id, 'damaged', e.target.value)} className={`${num} ${bad ? 'border-rose-500 text-rose-700' : ''}`} />
                <button className={stepBtn} onClick={() => bump(l.id, 'damaged', 1)} aria-label="plus"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
          {bad && <div id="r-dmg-msg" className="text-xs font-bold text-rose-700">{t('dmgTooMany', lang)}</div>}
          {!state.settings.blindCount ? (() => {
            const n = Number(c.counted);
            const counted = c.counted !== '' && Number.isFinite(n);
            const miss = counted ? Math.max(0, l.qty - n) : null;
            const extra = counted ? Math.max(0, n - l.qty) : 0;
            return (
              <div id={`r-missing-${l.id}`} className={`flex items-center justify-between gap-2 rounded-xl border-2 px-3 py-2 ${miss ? 'border-rose-300 bg-rose-50' : extra ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-slate-50'}`}>
                <span className="text-xs font-bold text-slate-700">{extra ? `➕ ${t('excess', lang)}` : `❌ ${t('short', lang)}`}<span className="block font-normal text-[11px] text-slate-500">{t('sentQty', lang)} {l.qty} − {t('counted', lang)} {counted ? n : '?'}</span></span>
                <span className={`text-2xl font-bold font-mono ${miss ? 'text-rose-700' : extra ? 'text-sky-700' : 'text-slate-900'}`}>{miss === null ? '?' : extra || miss}</span>
              </div>
            );
          })() : <div id="missing-hint" className="text-[11px] text-slate-500">{MISSING_HINT}</div>}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => go(step - 1)} disabled={step === 0} className="py-3 rounded-xl border border-slate-300 text-sm font-bold flex items-center justify-center disabled:opacity-30 cursor-pointer"><ChevronLeft className="w-4 h-4 mr-1" />{t('prev', lang)}</button>
          <button id="btn-next-line" onClick={() => go(step + 1)} disabled={!lineValid(l.id)} className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center disabled:opacity-40 cursor-pointer">{step === n - 1 ? t('checkSubmit', lang) : t('next', lang)}<ChevronRight className="w-4 h-4 ml-1" /></button>
        </div>
        <div className="text-[10px] text-slate-400 text-center">{t('savedPhone', lang)}</div>
      </PhoneFrame>
    );
  }

  // ----- review and submit (still blind) -----
  return (
    <PhoneFrame title={countTitle()} sub={`${t('checkSubmit', lang)} · ${loadName(s.id)}`} lang={lang} setLang={setLang}>
      {head}
      <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
        {s.lines.map((l: any, i: number) => {
          const c = get(l.id);
          return (
            <button key={l.id} onClick={() => go(i)} className="w-full px-3 py-2 flex items-center justify-between text-xs text-left cursor-pointer hover:bg-slate-50">
              <span className="pr-2 text-slate-800">{item(l.item).name}</span>
              <span className={`font-mono font-bold whitespace-nowrap ${lineValid(l.id) ? 'text-slate-900' : 'text-rose-700'}`}>{c.counted || '?'}{Number(c.damaged) ? ` (${c.damaged} ${t('damagedWord', lang)})` : ''}</span>
            </button>
          );
        })}
      </div>
      <PhotoStrip photos={photos} onAdd={(r) => setPhotos([...photos, ...r])} label={t('addPhoto', lang)} lang={lang} kinds={['damage', 'unloading', 'delivery note', 'bill']} />
      <div className="text-[10px] text-slate-400">{t('photosHere', lang)}</div>
      <label className="block text-[11px] font-bold text-slate-700">{t('note', lang)}
        <textarea id="r-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1 w-full p-2 rounded-lg border border-slate-300 text-sm" />
      </label>
      <label className="block text-[11px] font-bold text-slate-700">{t('yourName', lang)}
        <input id="r-name" value={by} onChange={(e) => setBy(e.target.value)} className="mt-1 w-full p-2.5 rounded-lg border border-slate-300 text-sm" />
      </label>
      {!ready && <div id="r-missing" className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2">{t('stillNeeded', lang)}: {[left ? `${left} ${t('linesLeft', lang)}` : '', !by.trim() ? t('yourName', lang) : ''].filter(Boolean).join(' · ')}</div>}
      {!confirming ? (
        <button id="btn-submit-count" disabled={!ready} onClick={() => setConfirming(true)} className="w-full min-h-[52px] rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-bold cursor-pointer shadow-md">
          {t('submit', lang)}{left ? ` · ${left} ${t('linesLeft', lang)}` : ''}
        </button>
      ) : (
        <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
          <div className="text-xs font-bold text-amber-950">{t('confirmSubmit', lang)}</div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setConfirming(false)} className="py-3 rounded-xl border border-slate-300 bg-white text-xs font-bold cursor-pointer">{t('goBack', lang)}</button>
            <button id="btn-confirm-submit" onClick={submit} className="py-3 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer">{t('yesSubmit', lang)}</button>
          </div>
        </div>
      )}
      <div className="text-[10px] text-slate-400 text-center">{t('savedPhone', lang)}</div>
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

// After submitting: the count is locked; now the sent quantity is shown next to the count.
function Done({ s, state, remote, lang, setLang, head }: { s: any; state: any; remote: boolean; lang: string; setLang: (l: string) => void; head: React.ReactNode }) {
  const { dispatch } = useStore();
  // From another phone: the message to the sender carries a link that records this count on their phone.
  // Always: the receiver may be on a different phone even when this phone has a load with the same number.
  // With the shared database the count already reached everyone; the WhatsApp message is just a note.
  const message = sharedMode ? resultText(state, s, lang) : `${resultText(state, s, lang)}\n\n${t('saveCountLink', lang)}:\n${appLink(countBackPath(s, s.receipt))}`;
  const matched = shipmentStatus(state, s) === 'MATCHED';
  // the count is locked now, so the counter can see what is missing or damaged (the owner still decides)
  const showLines = true;
  const tot = s.lines.reduce((a: any, l: any) => { const r = s.receipt.lines[l.id]; a.missing += Math.max(0, l.qty - r.counted); a.extra += Math.max(0, r.counted - l.qty); a.damaged += r.damaged || 0; return a; }, { missing: 0, extra: 0, damaged: 0 });
  return (
    <PhoneFrame title={countTitle()} sub={loadName(s.id)} lang={lang} setLang={setLang}>
      {head}
      <Note tone="go"><CheckCircle2 className="w-4 h-4 inline mr-1" />{t(remote ? 'savedSendNow' : 'submitted', lang)}</Note>
      <Note tone={matched ? 'go' : 'warn'}>{matched ? t('resultMatched', lang) : t('resultDiff', lang)}</Note>
      <div id="count-summary" className="grid grid-cols-3 gap-2 text-center">
        <div className={`rounded-xl border-2 p-2 ${tot.missing ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`}><div className="text-2xl font-bold">{tot.missing}</div><div className="text-xs font-bold">❌ {t('short', lang)}</div></div>
        <div className={`rounded-xl border-2 p-2 ${tot.damaged ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}><div className="text-2xl font-bold">{tot.damaged}</div><div className="text-xs font-bold">⚠️ {t('damagedWord', lang)}</div></div>
        <div className={`rounded-xl border-2 p-2 ${tot.extra ? 'border-sky-300 bg-sky-50' : 'border-slate-200'}`}><div className="text-2xl font-bold">{tot.extra}</div><div className="text-xs font-bold">➕ {t('excess', lang)}</div></div>
      </div>
      {showLines && <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">{t('compare', lang)}</div>}
      {showLines && <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
        {s.lines.map((l: any) => {
          const r = s.receipt.lines[l.id];
          const same = r.counted === l.qty && !r.damaged;
          return (
            <div key={l.id} className="px-3 py-2 text-xs">
              <div className="text-slate-800">{item(l.item).name}</div>
              <div className="flex items-center justify-between font-mono mt-0.5">
                <span className="text-slate-500">{t('sentQty', lang)} {l.qty} → {t('counted', lang)} <b className="text-slate-900">{r.counted}</b>{r.damaged ? ` (${r.damaged} ${t('damagedWord', lang)})` : ''}</span>
                <span className={`font-sans font-bold text-right ${same ? 'text-emerald-700' : 'text-amber-700'}`}>{same ? `✓ ${t('matchedLine', lang)}` : [r.counted < l.qty ? `${l.qty - r.counted} ${t('short', lang)}` : '', r.counted > l.qty ? `${r.counted - l.qty} ${t('excess', lang)}` : '', r.damaged ? `${r.damaged} ${t('damagedWord', lang)}` : ''].filter(Boolean).join(', ')}</span>
              </div>
            </div>
          );
        })}
      </div>}
      {!matched && s.flow !== 'outbound' && <Note tone="warn">{t('lrTip', lang)}</Note>}
      {!sharedMode && !countedByUs(s) && <div id="r-send-back"><Note tone="warn">{t('sendBackNote', lang)}</Note></div>}
      {!matched && !remote && <PhotoStrip photos={(s.docs || []).filter((d: any) => d.by === 'Receiver')} onAdd={(r) => dispatch({ type: 'ATTACH_DOC', id: s.id, docs: r, actor: 'Receiver' })} label={t('addPhoto', lang)} lang={lang} kinds={['signed lorry receipt (bilty)', 'damage']} />}
      {!countedByUs(s) &&       <a id="btn-tell-sender" href={shareWhatsApp(message)} target="_blank" rel="noreferrer" className="w-full min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center"><MessageCircle className="w-5 h-5 mr-2" />{t(sharedMode ? 'tellSender' : 'sendCountToSender', lang)}</a>}
      <Note><Lock className="w-4 h-4 inline mr-1" />{t('locked', lang)} {s.receipt.by}, {when(s.receipt.at)}</Note>
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

// Store person at the sending unit: trucks dispatch has listed, waiting to be loaded. Start and end times are the CCTV window.
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
