import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, Plus, Trash2, Truck, Play, Square, Send, Copy, MessageCircle, ClipboardPaste, PackageCheck, AlertTriangle, Mic, CheckCircle2 } from 'lucide-react';
import { useStore, item, party, route, shipmentStatus, receiptOverdue, receiverPath, sameGstin, FLOW_LABEL, STATUS_META } from '../store.tsx';
import { useVoice, findNumber } from '../lib/voice.ts';
import { resultText } from './Receive.tsx';
import { ITEMS, PARTIES, UNITS, LOADING_POINTS } from '../data/seed.ts';
import { t, unitWord } from '../i18n.ts';
import { PhoneFrame, Note, PhotoStrip, savedLang, saveLang, shareWhatsApp, appLink, newToken, type Go } from './ui.tsx';
import { challanHtml, printReport } from '../lib/report.ts';
import { time, when, duration } from '../lib/format.ts';

const BADGE: Record<string, string> = Object.fromEntries(Object.entries(STATUS_META).map(([k, v]) => [k, v.cls]));

export default function Dispatch({ go, initialId }: { go: Go; initialId?: string | null }) {
  const [lang, setLangState] = useState(savedLang);
  const setLang = (l: string) => { setLangState(l); saveLang(l); };
  const [screen, setScreen] = useState<string>(initialId ? `truck:${initialId}` : 'list');
  const sub = screen.startsWith('truck:') ? screen.slice(6) : screen.startsWith('new:') ? t(screen === 'new:transfer' ? 'newTransfer' : 'newCustomer', lang) : t('trucks', lang);
  return (
    <PhoneFrame title="LoadMatch · Dispatch" sub={sub} lang={lang} setLang={setLang}>
      {screen === 'list' && <TruckList lang={lang} open={(id) => setScreen(`truck:${id}`)} create={(f) => setScreen(`new:${f}`)} />}
      {screen.startsWith('new:') && <NewList lang={lang} flow={screen.slice(4)} onBack={() => setScreen('list')} onSaved={(id) => setScreen(`truck:${id}`)} />}
      {screen.startsWith('truck:') && <TruckDetail lang={lang} id={screen.slice(6)} onBack={() => setScreen('list')} />}
    </PhoneFrame>
  );
}

function TruckList({ lang, open, create }: { lang: string; open: (id: string) => void; create: (flow: string) => void }) {
  const { state } = useStore();
  const now = Date.now();
  const rank: Record<string, number> = { LOADING: 0, IN_TRANSIT: 1, TO_DECIDE: 2, WAITING: 3, MATCHED: 4, SETTLED: 5, CANCELLED: 6 };
  const list = state.shipments
    .filter((s: any) => s.flow !== 'inbound')
    .filter((s: any) => !s.receipt || now - s.receipt.at < 48 * 3600000)
    .filter((s: any) => !s.cancelledAt || now - s.cancelledAt < 12 * 3600000)
    .sort((a: any, b: any) => rank[shipmentStatus(state, a)] - rank[shipmentStatus(state, b)] || b.createdAt - a.createdAt);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2">
        {([['transfer', 'newTransfer', Truck], ['outbound', 'newCustomer', Send]] as const).map(([f, k, Icon]) => (
          <button key={f} id={`btn-new-${f}`} onClick={() => create(f)} className="w-full py-3 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-left text-sm font-bold text-slate-900 flex items-center justify-between cursor-pointer shadow-2xs">
            <span className="flex items-center"><Icon className="w-4 h-4 mr-2 text-emerald-700" />{t(k, lang)}</span><Plus className="w-4 h-4 text-slate-400" />
          </button>
        ))}
      </div>
      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide pt-1">{t('trucks', lang)}</div>
      {list.map((s: any) => {
        const st = shipmentStatus(state, s);
        const late = receiptOverdue(state, s, now);
        return (
          <button key={s.id} id={`truck-${s.id}`} onClick={() => open(s.id)} className="w-full text-left bg-white hover:bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-2xs cursor-pointer flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold text-slate-900">{s.id}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${BADGE[st]}`}>{t(`st_${st}`, lang)}</span>
                {late && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-rose-50 text-rose-800 border-rose-200">{duration(now - s.sentAt)}</span>}
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5 truncate">{route(s)}</div>
              <div className="text-[11px] text-slate-500">{s.truckNo} • {s.lines.length} • {when(s.createdAt, now)}</div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
        );
      })}
    </div>
  );
}

// "BRP-1148, 203" / "Face veneer Barpas 1148 × 452 × 6 mm	203" → { item, qty }
function parsePasted(text: string) {
  const ok: any[] = [], bad: string[] = [];
  for (const raw of text.split(/\n+/).map((x) => x.trim()).filter(Boolean)) {
    const m = raw.match(/^(.*?)[\s,;:\t-]+(\d+)\s*(nos|pcs|bundles)?\.?$/i);
    if (!m) { bad.push(raw); continue; }
    const key = m[1].trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const hit = Object.values(ITEMS).find((it) => it.code.toLowerCase().replace(/[^a-z0-9]/g, '') === key)
      || Object.values(ITEMS).find((it) => it.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(key) && key.length >= 4);
    if (hit) ok.push({ item: hit.code, qty: Number(m[2]) }); else bad.push(raw);
  }
  return { ok, bad };
}

export function NewList({ lang, flow, onBack, onSaved }: { lang: string; flow: string; onBack: () => void; onSaved: (id: string) => void }) {
  const { state, dispatch } = useStore();
  const customers = Object.values(PARTIES).filter((p) => p.kind === 'customer');
  const suppliers = Object.values(PARTIES).filter((p) => p.kind === 'supplier');
  const [fromUnit, setFrom] = useState(flow === 'outbound' ? 'BLR' : 'MYS');
  const [toUnit, setTo] = useState(flow === 'inbound' ? 'MYS' : 'BLR');
  const [partyId, setParty] = useState(flow === 'outbound' ? customers[0].id : suppliers[0].id);
  const [truckNo, setTruck] = useState('');
  const [ref, setRef] = useState('');
  const [lines, setLines] = useState<any[]>([{ item: '', qty: '' }]);
  // between own units: the sender decides if money is involved (default from the units' GSTINs)
  const [billingPick, setBillingPick] = useState<string | null>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const billing = billingPick || (sameGstin(state, fromUnit, toUnit) ? 'none' : 'invoice');
  // speak a quantity for a line
  const micLine = useRef<number | null>(null);
  const [listeningLine, setListeningLine] = useState<number | null>(null);
  const onText = useCallback((alts: string[]) => {
    const i = micLine.current;
    const n = alts.map((a) => findNumber(a)).find((x) => x != null);
    if (i != null && n != null) setLines((ls) => ls.map((x, j) => (j === i ? { ...x, qty: String(n) } : x)));
    setListeningLine(null);
  }, []);
  const voice = useVoice(lang, onText);
  const listen = (i: number) => { if (voice.listening) { voice.stop(); setListeningLine(null); return; } micLine.current = i; setListeningLine(i); voice.start(); };
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const parsed = useMemo(() => parsePasted(pasted), [pasted]);
  const clean = lines.filter((l) => l.item && Number(l.qty) > 0).map((l) => ({ item: l.item, qty: Math.floor(Number(l.qty)) }));
  const valid = clean.length > 0 && clean.length === lines.filter((l) => l.item || l.qty).length && truckNo.trim() && ref.trim() && (flow !== 'transfer' || fromUnit !== toUnit);
  const save = () => {
    const id = `TRK-${1000 + state.counters.trk + 1}`;
    dispatch({ type: 'CREATE_SHIPMENT', id, flow, fromUnit: flow === 'inbound' ? null : fromUnit, toUnit: flow === 'outbound' ? null : toUnit, party: flow === 'transfer' ? null : partyId, truckNo, ref, lines: clean, billing: flow === 'transfer' ? billing : undefined, docs, actor: flow === 'inbound' ? 'Gate' : 'Dispatch staff' });
    onSaved(id);
  };
  const sel = 'mt-1 w-full p-2.5 rounded-lg border border-slate-300 bg-white text-sm';
  return (
    <div className="space-y-3">
      <button onClick={onBack} className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 flex items-center cursor-pointer"><ChevronLeft className="w-3.5 h-3.5" />{t('back', lang)}</button>
      <div className="grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-700">
        {flow !== 'inbound' && <label className={flow === 'outbound' ? 'col-span-1' : ''}>{t('fromUnit', lang)}<select id="f-from" value={fromUnit} onChange={(e) => setFrom(e.target.value)} className={sel}>{Object.values(UNITS).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>}
        {flow !== 'outbound' && <label>{t('toUnit', lang)}<select id="f-to" value={toUnit} onChange={(e) => setTo(e.target.value)} className={sel}>{Object.values(UNITS).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>}
        {flow !== 'transfer' && <label className={flow === 'inbound' ? '' : ''}>{t(flow === 'outbound' ? 'customer' : 'supplier', lang)}<select id="f-party" value={partyId} onChange={(e) => setParty(e.target.value)} className={sel}>{(flow === 'outbound' ? customers : suppliers).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
        <label>{t('truckNo', lang)}<input id="f-truck" value={truckNo} onChange={(e) => setTruck(e.target.value)} placeholder="KA 40 A 2541" className={sel} /></label>
        <label className="col-span-2">{t(flow === 'transfer' ? 'challanNo' : flow === 'outbound' ? 'invoiceNo' : 'billNo', lang)}<input id="f-ref" value={ref} onChange={(e) => setRef(e.target.value)} className={sel} /></label>
      </div>
      {flow === 'transfer' && fromUnit === toUnit && <Note tone="warn">{t('fromUnit', lang)} = {t('toUnit', lang)}</Note>}
      {flow === 'transfer' && fromUnit !== toUnit && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-slate-700">{t('moneyQ', lang)}</div>
          <div className="grid grid-cols-2 gap-2">
            {([['none', 'noMoney'], ['invoice', 'withInvoice']] as const).map(([v, k]) => (
              <button key={v} id={`billing-${v}`} onClick={() => setBillingPick(v)} className={`py-2.5 px-2 rounded-xl border text-xs font-bold cursor-pointer ${billing === v ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-800 border-slate-300'}`}>{t(k, lang)}</button>
            ))}
          </div>
          <div className="text-[10px] text-slate-500">{t(sameGstin(state, fromUnit, toUnit) ? 'gstSame' : 'gstDiff', lang)}</div>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">{t(flow === 'inbound' ? 'billedQty' : 'qty', lang)}</div>
        <button id="btn-paste" onClick={() => setPasting(!pasting)} className="text-[11px] font-bold text-emerald-800 flex items-center cursor-pointer"><ClipboardPaste className="w-3.5 h-3.5 mr-1" />{t('paste', lang)}</button>
      </div>
      {pasting && (
        <div className="space-y-2 rounded-xl border border-slate-200 p-2.5 bg-slate-50">
          <div className="text-[11px] text-slate-600">{t('pasteHelp', lang)}</div>
          <textarea id="f-paste" value={pasted} onChange={(e) => setPasted(e.target.value)} rows={4} placeholder={'BRP-1148, 203\nOKU-AB-91, 248'} className="w-full p-2 rounded-lg border border-slate-300 font-mono text-xs" />
          {parsed.bad.length > 0 && <div className="text-[11px] text-rose-700">{t('notRecognised', lang)}: {parsed.bad.join(' · ')}</div>}
          <button id="btn-use-pasted" disabled={!parsed.ok.length} onClick={() => { setLines(parsed.ok.map((l) => ({ item: l.item, qty: String(l.qty) }))); setPasting(false); }} className="w-full py-2 rounded-lg bg-slate-900 disabled:opacity-40 text-white text-xs font-bold cursor-pointer">{t('usePasted', lang)} ({parsed.ok.length})</button>
        </div>
      )}
      <div className="space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="space-y-1.5 rounded-xl border border-slate-200 p-2">
            <select id={`f-item-${i}`} value={l.item} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, item: e.target.value } : x)))} className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-xs">
              <option value="">{t('item', lang)}…</option>
              {Object.values(ITEMS).map((it) => <option key={it.code} value={it.code}>{it.name}</option>)}
            </select>
            <div className="flex items-center gap-2 justify-end">
            {voice.supported && <button id={`f-mic-${i}`} onClick={() => listen(i)} aria-label={t('speakCount', lang)} className={`p-2 rounded-lg cursor-pointer ${listeningLine === i ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-900 text-white'}`}><Mic className="w-4 h-4" /></button>}
            <input id={`f-qty-${i}`} type="number" inputMode="numeric" min="1" value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} placeholder="0" className="w-20 p-2.5 rounded-lg border border-slate-300 text-sm font-mono font-bold text-right" />
            <button onClick={() => setLines(lines.length > 1 ? lines.filter((_, j) => j !== i) : [{ item: '', qty: '' }])} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer" aria-label="Remove line"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        <button id="btn-add-line" onClick={() => setLines([...lines, { item: '', qty: '' }])} className="text-[11px] font-bold text-slate-700 flex items-center cursor-pointer"><Plus className="w-3.5 h-3.5 mr-1" />{t('addLine', lang)}</button>
      </div>
      <PhotoStrip photos={docs} onAdd={(r) => setDocs([...docs, ...r])} label={t('addPaper', lang)} kinds={flow === 'inbound' ? ['supplier bill', 'order', 'delivery note'] : ['dispatch list', 'challan', 'order']} />
      <button id="btn-save-list" disabled={!valid} onClick={save} className="w-full min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-bold cursor-pointer">{t('saveList', lang)} ({clean.reduce((a, l) => a + l.qty, 0)})</button>
    </div>
  );
}

function TruckDetail({ lang, id, onBack }: { lang: string; id: string; onBack: () => void }) {
  const { state, dispatch } = useStore();
  const s = state.shipments.find((x: any) => x.id === id);
  const [point, setPoint] = useState(LOADING_POINTS[0]);
  const [copied, setCopied] = useState(false);
  if (!s) return <Note>…</Note>;
  const st = shipmentStatus(state, s);
  const now = Date.now();
  const link = s.token ? appLink(receiverPath(s)) : '';
  const msg = `${t('linkMessage', lang)} ${s.id} · ${s.truckNo} · ${route(s)}\n${link}`;
  const sendOrCount = () => {
    const token = newToken();
    dispatch({ type: 'SEND_TO_RECEIVER', id: s.id, token, actor: s.flow === 'inbound' ? 'Gate' : 'Dispatch staff' });
    if (s.flow === 'inbound') window.location.hash = `#/r/${s.id}/${token}`;
  };
  return (
    <div className="space-y-3">
      <button onClick={onBack} className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 flex items-center cursor-pointer"><ChevronLeft className="w-3.5 h-3.5" />{t('back', lang)}</button>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-slate-900">{route(s)}</div>
          <div className="text-[11px] text-slate-500">{FLOW_LABEL[s.flow]} • {t('truck', lang)} {s.truckNo} • {t('ref', lang)} {s.ref}</div>
        </div>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${BADGE[st]}`}>{t(`st_${st}`, lang)}</span>
      </div>
      <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
        {s.lines.map((l: any) => (
          <div key={l.id} className="px-3 py-2 flex items-center justify-between text-xs">
            <span className="text-slate-800 pr-2">{item(l.item).name}</span>
            <span className="font-mono font-bold whitespace-nowrap">{l.qty} {unitWord(item(l.item).unit, lang)}</span>
          </div>
        ))}
        <div className="px-3 py-2 flex items-center justify-between text-xs font-bold bg-slate-50"><span>Total</span><span className="font-mono">{s.lines.reduce((a: number, l: any) => a + l.qty, 0)}</span></div>
      </div>

      <div className="space-y-1">
        <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">{t('papers', lang)}</div>
        <PhotoStrip photos={s.docs || []} onAdd={(r) => dispatch({ type: 'ATTACH_DOC', id: s.id, docs: r, actor: s.flow === 'inbound' ? 'Gate' : 'Dispatch staff' })} label={t('addPaper', lang)} kinds={s.flow === 'inbound' ? ['supplier bill', 'order', 'delivery note'] : ['dispatch list', 'challan', 'order']} />
        {s.flow === 'transfer' && s.billing === 'none' && <button id="btn-challan" onClick={() => printReport(challanHtml(state, s))} className="w-full py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 cursor-pointer">{t('printChallan', lang)}</button>}
      </div>
      {st === 'LOADING' && s.flow !== 'inbound' && (
        <div className="space-y-2">
          <Note>{t('loadingFirst', lang)}</Note>
          <label className="block text-[11px] font-bold text-slate-700">{t('loadingPoint', lang)}
            <select id="f-point" disabled={!!s.loading} value={s.loading?.point || point} onChange={(e) => setPoint(e.target.value)} className="mt-1 w-full p-2.5 rounded-lg border border-slate-300 bg-white text-sm">{LOADING_POINTS.map((p) => <option key={p}>{p}</option>)}</select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button id="btn-load-start" disabled={!!s.loading} onClick={() => dispatch({ type: 'LOADING', id: s.id, point, phase: 'start', actor: 'Dispatch staff' })} className="py-3 rounded-xl border-2 border-slate-900 text-slate-900 disabled:border-slate-200 disabled:text-slate-500 disabled:bg-slate-50 text-xs font-bold flex items-center justify-center cursor-pointer"><Play className="w-4 h-4 mr-1" />{s.loading ? time(s.loading.startAt) : t('startLoading', lang)}</button>
            <button id="btn-load-end" disabled={!s.loading || !!s.loading.endAt} onClick={() => dispatch({ type: 'LOADING', id: s.id, phase: 'end', actor: 'Dispatch staff' })} className="py-3 rounded-xl border-2 border-slate-900 text-slate-900 disabled:border-slate-200 disabled:text-slate-500 disabled:bg-slate-50 text-xs font-bold flex items-center justify-center cursor-pointer"><Square className="w-4 h-4 mr-1" />{s.loading?.endAt ? time(s.loading.endAt) : t('endLoading', lang)}</button>
          </div>
        </div>
      )}
      {st === 'LOADING' && (
        <>
          <button id="btn-send" disabled={s.flow !== 'inbound' && !s.loading?.endAt} onClick={sendOrCount} className="w-full min-h-[52px] rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-bold flex items-center justify-center cursor-pointer shadow-md">
            {s.flow === 'inbound' ? <><PackageCheck className="w-5 h-5 mr-2" />{t('countNow', lang)}</> : <><Send className="w-5 h-5 mr-2" />{t('sendReceiver', lang)}</>}
          </button>
          <button onClick={() => { dispatch({ type: 'CANCEL_SHIPMENT', id: s.id, actor: 'Dispatch staff' }); onBack(); }} className="w-full py-2 text-[11px] font-bold text-rose-700 cursor-pointer">{t('cancelTruck', lang)}</button>
        </>
      )}
      {st === 'IN_TRANSIT' && (
        <div className="space-y-2">
          {receiptOverdue(state, s, now) && <Note tone="stop"><AlertTriangle className="w-4 h-4 inline mr-1" />{duration(now - s.sentAt)}</Note>}
          {s.flow === 'inbound'
            ? <a id="btn-count" href={receiverPath(s)} className="w-full min-h-[52px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center cursor-pointer"><PackageCheck className="w-5 h-5 mr-2" />{t('countNow', lang)}</a>
            : <>
              <div className="text-[11px] text-slate-500 break-all bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono">{link}</div>
              <div className="grid grid-cols-2 gap-2">
                <a id="btn-share-link" href={shareWhatsApp(msg)} target="_blank" rel="noreferrer" className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center"><MessageCircle className="w-4 h-4 mr-1" />{t(s.sentAt && now - s.sentAt > 3600000 ? 'remind' : 'shareWhatsApp', lang)}</a>
                <button onClick={() => { try { navigator.clipboard.writeText(link); setCopied(true); } catch { /* ignore */ } }} className="py-3 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold flex items-center justify-center cursor-pointer"><Copy className="w-4 h-4 mr-1" />{copied ? t('copied', lang) : t('copyLink', lang)}</button>
              </div>
            </>}
        </div>
      )}
      {s.receipt && (
        <div id="sender-result" className={`rounded-xl p-3 text-xs border space-y-1 ${st === 'MATCHED' ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-amber-50 border-amber-200 text-amber-950'}`}>
          <div className="font-bold flex items-center">{st === 'MATCHED' ? <CheckCircle2 className="w-4 h-4 mr-1" /> : <AlertTriangle className="w-4 h-4 mr-1" />}{t('receiverResult', lang)} · {s.receipt.by}, {when(s.receipt.at, now)}</div>
          <pre className="whitespace-pre-wrap font-sans leading-relaxed">{resultText(state, s, lang).split('\n').slice(1).join('\n')}</pre>
        </div>
      )}
    </div>
  );
}
