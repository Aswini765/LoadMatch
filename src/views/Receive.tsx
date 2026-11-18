import React, { useCallback, useRef, useState } from 'react';
import { Mic, MicOff, Camera, Lock, CheckCircle2, AlertTriangle, Minus, Plus } from 'lucide-react';
import { useStore, item, route, shipmentOf } from '../store.tsx';
import { t, unitWord } from '../i18n.ts';
import { useVoice, findNumber } from '../lib/voice.ts';
import { PhoneFrame, Note, savedLang, saveLang } from './ui.tsx';
import { when } from '../lib/format.ts';

// Opened from the WhatsApp link: #/r/<truck>/<token>. No login. Blind count: the sent quantity is not shown.
export default function Receive({ id, token }: { id: string; token: string }) {
  const { state, dispatch } = useStore();
  const [lang, setLangState] = useState(savedLang);
  const setLang = (l: string) => { setLangState(l); saveLang(l); };
  const s = shipmentOf(state, id);
  const ok = s && s.token && s.token === token && !s.cancelledAt;
  const [by, setBy] = useState(() => { try { return localStorage.getItem('loadmatch-name') || ''; } catch { return ''; } });
  const [counts, setCounts] = useState<Record<string, { counted: string; damaged: string }>>({});
  const [photos, setPhotos] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [micLine, setMicLine] = useState<string | null>(null);
  const micLineRef = useRef<string | null>(null);

  const onText = useCallback((alts: string[]) => {
    const lineId = micLineRef.current;
    if (!lineId) return;
    const n = alts.map((a) => findNumber(a)).find((x) => x != null);
    if (n != null) setCounts((c) => ({ ...c, [lineId]: { counted: String(n), damaged: c[lineId]?.damaged || '0' } }));
  }, []);
  const voice = useVoice(lang, onText);

  if (!ok) {
    return (
      <PhoneFrame title="LoadMatch" sub={id} lang={lang} setLang={setLang}>
        <Note tone="stop"><AlertTriangle className="w-4 h-4 inline mr-1" />{t('invalidLink', lang)}</Note>
      </PhoneFrame>
    );
  }

  const head = (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-0.5">
      <div className="font-bold text-slate-900 text-sm">{route(s)}</div>
      <div className="text-slate-600">{t('truck', lang)} <span className="font-mono font-bold">{s.truckNo}</span> • {t('ref', lang)} {s.ref} • {s.id}</div>
    </div>
  );

  if (s.receipt) {
    return (
      <PhoneFrame title="LoadMatch · Receive" sub={s.id} lang={lang} setLang={setLang}>
        {head}
        <Note tone="go"><CheckCircle2 className="w-4 h-4 inline mr-1" />{t('submitted', lang)}</Note>
        <Note><Lock className="w-4 h-4 inline mr-1" />{t('locked', lang)} {s.receipt.by}, {when(s.receipt.at)}</Note>
        <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
          {s.lines.map((l: any) => {
            const r = s.receipt.lines[l.id];
            return (
              <div key={l.id} className="px-3 py-2 flex items-center justify-between text-xs">
                <span className="pr-2">{item(l.item).name}</span>
                <span className="font-mono font-bold whitespace-nowrap">{r.counted}{r.damaged ? ` (${r.damaged} ✗)` : ''}</span>
              </div>
            );
          })}
        </div>
      </PhoneFrame>
    );
  }

  const get = (lineId: string) => counts[lineId] || { counted: '', damaged: '0' };
  const set = (lineId: string, k: 'counted' | 'damaged', v: string) => setCounts((c) => ({ ...c, [lineId]: { ...get(lineId), ...c[lineId], [k]: v.replace(/[^0-9]/g, '') } }));
  const bump = (lineId: string, k: 'counted' | 'damaged', by: number) => set(lineId, k, String(Math.max(0, Number(get(lineId)[k] || 0) + by)));
  const lineValid = (lineId: string) => { const c = get(lineId); return c.counted !== '' && Number(c.damaged || 0) <= Number(c.counted); };
  const left = s.lines.filter((l: any) => !lineValid(l.id)).length;
  const ready = left === 0 && by.trim().length > 0;

  const listen = (lineId: string) => {
    if (voice.listening && micLine === lineId) { voice.stop(); return; }
    micLineRef.current = lineId; setMicLine(lineId); voice.start();
  };

  const submit = () => {
    try { localStorage.setItem('loadmatch-name', by.trim()); } catch { /* ignore */ }
    const lines = Object.fromEntries(s.lines.map((l: any) => [l.id, { counted: Number(get(l.id).counted), damaged: Number(get(l.id).damaged || 0) }]));
    dispatch({ type: 'SUBMIT_RECEIPT', id: s.id, token, by: by.trim(), lines, photos, note: note.trim(), actor: 'Receiver' });
    setConfirming(false);
  };

  const num = 'w-16 p-2 rounded-lg border border-slate-300 text-center text-base font-mono font-bold';
  const step = 'w-9 h-9 rounded-lg border border-slate-300 bg-white flex items-center justify-center text-slate-700 cursor-pointer active:bg-slate-100';

  return (
    <PhoneFrame title="LoadMatch · Receive" sub={`${t('rcvTitle', lang)} · ${s.id}`} lang={lang} setLang={setLang}>
      {head}
      <Note>{t('rcvIntro', lang)}</Note>
      {voice.error && voice.error !== 'lang_fallback' && <Note tone="warn"><MicOff className="w-4 h-4 inline mr-1" />{voice.error.replace(/_/g, ' ')}</Note>}

      <div className="space-y-3">
        {s.lines.map((l: any) => {
          const c = get(l.id);
          const bad = c.counted !== '' && Number(c.damaged || 0) > Number(c.counted);
          const listening = voice.listening && micLine === l.id;
          return (
            <div key={l.id} id={`rline-${l.id}`} className={`rounded-xl border p-3 space-y-2 ${lineValid(l.id) ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs font-bold text-slate-900">{item(l.item).name}</div>
                <span className="text-[10px] text-slate-500 whitespace-nowrap">{unitWord(item(l.item).unit, lang)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-700">{t('counted', lang)}</span>
                <div className="flex items-center gap-1.5">
                  <button className={step} onClick={() => bump(l.id, 'counted', -1)} aria-label="minus"><Minus className="w-4 h-4" /></button>
                  <input id={`r-count-${l.id}`} inputMode="numeric" value={c.counted} onChange={(e) => set(l.id, 'counted', e.target.value)} placeholder="?" className={num} />
                  <button className={step} onClick={() => bump(l.id, 'counted', 1)} aria-label="plus"><Plus className="w-4 h-4" /></button>
                  {voice.supported && (
                    <button id={`r-mic-${l.id}`} onClick={() => listen(l.id)} title={t('speakCount', lang)} className={`w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer ${listening ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-900 text-white'}`}><Mic className="w-4 h-4" /></button>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-700">{t('damaged', lang)}</span>
                <div className="flex items-center gap-1.5">
                  <button className={step} onClick={() => bump(l.id, 'damaged', -1)} aria-label="minus"><Minus className="w-4 h-4" /></button>
                  <input id={`r-dmg-${l.id}`} inputMode="numeric" value={c.damaged} onChange={(e) => set(l.id, 'damaged', e.target.value)} className={`${num} ${bad ? 'border-rose-500 text-rose-700' : ''}`} />
                  <button className={step} onClick={() => bump(l.id, 'damaged', 1)} aria-label="plus"><Plus className="w-4 h-4" /></button>
                  {voice.supported && <span className="w-9" />}
                </div>
              </div>
              {listening && voice.heard && <div className="text-[11px] text-slate-500">“{voice.heard}”</div>}
            </div>
          );
        })}
      </div>

      <label className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-slate-300 text-xs font-bold text-slate-700 cursor-pointer">
        <Camera className="w-4 h-4" />{t('addPhoto', lang)}{photos.length ? ` · ${photos.length} ${t('photos', lang)}` : ''}
        <input id="r-photo" type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => setPhotos([...photos, ...Array.from(e.target.files || []).map((f) => f.name)])} />
      </label>
      <label className="block text-[11px] font-bold text-slate-700">{t('note', lang)}
        <textarea id="r-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1 w-full p-2 rounded-lg border border-slate-300 text-sm" />
      </label>
      <label className="block text-[11px] font-bold text-slate-700">{t('yourName', lang)}
        <input id="r-name" value={by} onChange={(e) => setBy(e.target.value)} className="mt-1 w-full p-2.5 rounded-lg border border-slate-300 text-sm" />
      </label>

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
    </PhoneFrame>
  );
}
