import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, Plus, Trash2, Truck, Play, Square, Send, Copy, MessageCircle, ClipboardPaste, PackageCheck, AlertTriangle, Mic, CheckCircle2, Wrench, Link2 } from 'lucide-react';
import { useStore, item, party, route, shipmentStatus, receiptOverdue, receiverPath, sameGstin, atGate, jobworkOpen, jobworkBalance, parentOf, childrenOf, loadName, FLOW_LABEL, STATUS_META } from '../store.tsx';
import { useVoice, findNumber } from '../lib/voice.ts';
import { resultText } from './Receive.tsx';
import { ITEMS, PARTIES, UNITS, LOADING_POINTS } from '../data/seed.ts';
import { inr0 } from '../lib/format.ts';
import { t, unitWord } from '../i18n.ts';
import { PhoneFrame, Note, PhotoStrip, savedLang, saveLang, shareWhatsApp, appLink, newToken, type Go } from './ui.tsx';
import { challanHtml, printReport } from '../lib/report.ts';
import { time, when, duration } from '../lib/format.ts';

const BADGE: Record<string, string> = Object.fromEntries(Object.entries(STATUS_META).map(([k, v]) => [k, v.cls]));

export default function Dispatch({ go, initialId }: { go: Go; initialId?: string | null }) {
  const [lang, setLangState] = useState(savedLang);
  const setLang = (l: string) => { setLangState(l); saveLang(l); };
  const [screen, setScreen] = useState<string>(initialId ? `truck:${initialId}` : 'list');
  const sub = screen.startsWith('truck:') ? loadName(screen.slice(6)) : screen.startsWith('new:') ? t(screen === 'new:transfer' ? 'newTransfer' : screen === 'new:jobwork_out' ? 'newJobwork' : 'newCustomer', lang) : t('trucks', lang);
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
    .filter((s: any) => !atGate(s.flow))
    .filter((s: any) => !s.receipt || now - s.receipt.at < 48 * 3600000)
    .filter((s: any) => !s.cancelledAt || now - s.cancelledAt < 12 * 3600000)
    .sort((a: any, b: any) => rank[shipmentStatus(state, a)] - rank[shipmentStatus(state, b)] || b.createdAt - a.createdAt);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2">
        {([['transfer', 'newTransfer', 'newTransferSub', Truck], ['outbound', 'newCustomer', 'newCustomerSub', Send]] as const).map(([f, k, sub, Icon]) => (
          <button key={f} id={`btn-new-${f}`} onClick={() => create(f)} className="w-full py-3 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-left cursor-pointer shadow-2xs flex items-center justify-between">
            <span className="flex items-start"><Icon className="w-4 h-4 mr-2 mt-0.5 text-emerald-700 shrink-0" /><span><span className="block text-sm font-bold text-slate-900">{t(k, lang)}</span><span className="block text-[11px] text-slate-500">{t(sub, lang)}</span></span></span><Plus className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
        ))}
        <button id="btn-new-jobwork_out" onClick={() => create('jobwork_out')} className="text-left text-[11px] text-slate-600 px-1 cursor-pointer flex items-start"><Wrench className="w-3.5 h-3.5 mr-1.5 mt-0.5 shrink-0" /><span><b className="text-slate-800">{t('otherLabel', lang)}:</b> {t('newJobworkSub', lang)}</span></button>
      </div>
      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide pt-1">{t('trucks', lang)}</div>
      {list.map((s: any) => {
        const st = shipmentStatus(state, s);
        const late = receiptOverdue(state, s, now);
        return (
          <button key={s.id} id={`truck-${s.id}`} onClick={() => open(s.id)} className="w-full text-left bg-white hover:bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-2xs cursor-pointer flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-900">{s.truckNo}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${BADGE[st]}`}>{s.cameBack ? t('cameBackShort', lang) : t(`st_${st}`, lang)}</span>
                {late && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-rose-50 text-rose-800 border-rose-200">{duration(now - s.sentAt)}</span>}
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5 truncate">{route(s)}</div>
              <div className="text-[11px] text-slate-500">{loadName(s.id)} • {s.lines.length} {s.lines.length === 1 ? 'item' : 'items'} • {when(s.createdAt, now)}</div>
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
    const byCode = Object.values(ITEMS).find((it) => it.code.toLowerCase().replace(/[^a-z0-9]/g, '') === key);
    const byName = key.length >= 4 ? Object.values(ITEMS).filter((it) => it.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(key)) : [];
    // a name that fits more than one item is not guessed: the sender picks the right one
    if (byCode) ok.push({ item: byCode.code, qty: Number(m[2]) });
    else if (byName.length === 1) ok.push({ item: byName[0].code, qty: Number(m[2]) });
    else bad.push(byName.length > 1 ? `${raw} (${byName.length}?)` : raw);
  }
  return { ok, bad };
}

export function NewList({ lang, flow, onBack, onSaved }: { lang: string; flow: string; onBack: () => void; onSaved: (id: string) => void }) {
  const { state, dispatch } = useStore();
  const customers = Object.values(PARTIES).filter((p) => p.kind === 'customer');
  const suppliers = Object.values(PARTIES).filter((p) => p.kind === 'supplier');
  const jobworkers = Object.values(PARTIES).filter((p) => p.kind === 'jobworker');
  const partyList = flow === 'outbound' ? customers : flow === 'inbound' ? suppliers : jobworkers;
  const gate = atGate(flow);
  const hasFrom = !gate;
  const hasTo = flow === 'transfer' || gate;
  const [fromUnit, setFrom] = useState(flow === 'outbound' ? 'BLR' : 'MYS');
  const [toUnit, setTo] = useState(gate ? 'MYS' : 'BLR');
  const [partyId, setParty] = useState(partyList[0]?.id || '');
  // "made from": the earlier load this one continues (a job work return must say which load it returns)
  const [parentId, setParentId] = useState('');
  const openJobwork = flow === 'jobwork_in' ? jobworkOpen(state) : [];
  const madeFromOptions = hasFrom ? state.shipments.filter((x: any) => x.receipt && !x.cancelledAt && x.toUnit === fromUnit && Date.now() - x.receipt.at < 60 * 24 * 3600000).sort((a: any, b: any) => b.receipt.at - a.receipt.at) : [];
  const pickReturn = (id: string) => {
    setParentId(id);
    const out = state.shipments.find((x: any) => x.id === id);
    if (!out) return;
    setParty(out.party); setTo(out.fromUnit);
    setLines(jobworkBalance(state, out).filter((b: any) => b.pending > 0).map((b: any) => ({ item: b.item, qty: String(b.pending) })));
  };
  // Prototype: the form opens filled with sample values; everything can still be changed
  const demo = flow !== 'jobwork_in';
  const [truckNo, setTruck] = useState(demo ? `KA 09 B ${1000 + Math.floor(Math.random() * 9000)}` : '');
  const [driver, setDriver] = useState(demo ? 'Manju' : '');
  const [driverPhone, setDriverPhone] = useState(demo ? '9845012345' : '');
  const [ewayBill, setEwayBill] = useState('');
  const [ref, setRef] = useState(demo ? `${flow === 'outbound' ? 'INV' : flow === 'inbound' ? 'SB' : 'DC'}-${100 + Math.floor(Math.random() * 900)}` : '');
  const [lines, setLines] = useState<any[]>(demo ? Object.keys(ITEMS).slice(0, 2).map((item, i) => ({ item, qty: i ? '30' : '50' })) : [{ item: '', qty: '' }]);
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
  const missing: string[] = [];
  if (flow === 'jobwork_in' && !parentId) missing.push(t('whichJobwork', lang));
  if (!truckNo.trim()) missing.push(t('truckNo', lang));
  if (!ref.trim()) missing.push(t(flow === 'transfer' || flow === 'jobwork_out' ? 'challanNo' : flow === 'outbound' ? 'invoiceNo' : flow === 'jobwork_in' ? 'jwChallanNo' : 'billNo', lang));
  if (flow === 'transfer' && fromUnit === toUnit) missing.push(t('sameUnit', lang));
  if (!clean.length) missing.push(t('needItem', lang));
  else if (clean.length !== lines.filter((l) => l.item || l.qty).length) missing.push(t('fixLines', lang));
  const valid = missing.length === 0;
  // promises this load can keep (supplier's replacement, goods we owe a customer, job worker's balance)
  const promiseActions = flow === 'inbound' ? ['replace'] : flow === 'outbound' ? ['send_rest', 'send_replacement'] : flow === 'jobwork_in' ? ['jobworker_sends_rest', 'jobworker_replaces'] : [];
  const openPromises = state.diffs.filter((d: any) => d.status === 'waiting' && promiseActions.includes(d.decision?.action) && state.shipments.find((x: any) => x.id === d.shipmentId)?.party === partyId);
  const [fulfils, setFulfils] = useState<string[]>([]);
  const save = () => {
    const id = `TRK-${1000 + state.counters.trk + 1}`;
    dispatch({ type: 'CREATE_SHIPMENT', id, flow, fromUnit: hasFrom ? fromUnit : null, toUnit: hasTo ? toUnit : null, party: flow === 'transfer' ? null : partyId, parentId: parentId || undefined, fulfils: fulfils.filter((id) => openPromises.some((d: any) => d.id === id)), truckNo, ref, driver, driverPhone, ewayBill, lines: clean, billing: flow === 'transfer' ? billing : undefined, docs, actor: gate ? 'Gate' : 'Dispatch staff' });
    onSaved(id);
  };
  const sel = 'mt-1 w-full p-2.5 rounded-lg border border-slate-300 bg-white text-sm';
  return (
    <div className="space-y-3">
      <button onClick={onBack} className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 flex items-center cursor-pointer"><ChevronLeft className="w-3.5 h-3.5" />{t('back', lang)}</button>
      <div className="grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-700">
        {flow === 'jobwork_in' && (
          <label className="col-span-2">{t('whichJobwork', lang)}
            <select id="f-parent" value={parentId} onChange={(e) => pickReturn(e.target.value)} className={sel}>
              <option value="">…</option>
              {openJobwork.map((x: any) => <option key={x.id} value={x.id}>{loadName(x.id)} · {party(x.party).name} · {jobworkBalance(state, x).reduce((a: number, b: any) => a + b.pending, 0)} {t('stillThere', lang)}</option>)}
            </select>
          </label>
        )}
        {hasFrom && <label>{t('fromUnit', lang)}<select id="f-from" value={fromUnit} onChange={(e) => setFrom(e.target.value)} className={sel}>{Object.values(UNITS).map((u) => <option key={u.id} value={u.id}>{u.name.split(' (')[0]}</option>)}</select></label>}
        {hasTo && <label>{t('toUnit', lang)}<select id="f-to" value={toUnit} onChange={(e) => setTo(e.target.value)} className={sel}>{Object.values(UNITS).map((u) => <option key={u.id} value={u.id}>{u.name.split(' (')[0]}</option>)}</select></label>}
        {flow !== 'transfer' && <label>{t(flow === 'outbound' ? 'customer' : flow === 'inbound' ? 'supplier' : 'jobworker', lang)}<select id="f-party" disabled={flow === 'jobwork_in'} value={partyId} onChange={(e) => setParty(e.target.value)} className={sel}>{partyList.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
        <label className="col-span-2">{t('truckNo', lang)}<input id="f-truck" value={truckNo} onChange={(e) => setTruck(e.target.value)} placeholder="KA 40 A 2541" className={sel} /></label>
        <label>{t('driver', lang)} <span className="font-normal text-slate-400">({t('optional', lang)})</span><input id="f-driver" value={driver} onChange={(e) => setDriver(e.target.value)} className={sel} /></label>
        <label>{t('driverPhone', lang)} <span className="font-normal text-slate-400">({t('optional', lang)})</span><input id="f-driver-phone" type="tel" inputMode="tel" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} className={sel} /></label>
        <label className="col-span-2">{t(flow === 'transfer' || flow === 'jobwork_out' ? 'challanNo' : flow === 'outbound' ? 'invoiceNo' : flow === 'jobwork_in' ? 'jwChallanNo' : 'billNo', lang)}<input id="f-ref" value={ref} onChange={(e) => setRef(e.target.value)} className={sel} /></label>
      </div>
      {hasFrom && madeFromOptions.length > 0 && (
        <label className="block text-[11px] font-bold text-slate-700">{t('madeFrom', lang)}
          <select id="f-madefrom" value={parentId} onChange={(e) => setParentId(e.target.value)} className={sel}>
            <option value="">—</option>
            {madeFromOptions.map((x: any) => <option key={x.id} value={x.id}>{loadName(x.id)} · {route(x)}</option>)}
          </select>
        </label>
      )}
      {flow === 'transfer' && fromUnit === toUnit && <Note tone="warn">{t('sameUnit', lang)}</Note>}
      {openPromises.length > 0 && (
        <div id="f-promises" className="rounded-xl border border-sky-200 bg-sky-50 p-2.5 space-y-1.5 text-xs">
          <div className="font-bold text-sky-950">{t(flow === 'outbound' ? 'promisesWeOwe' : 'promisesTheyOwe', lang)}</div>
          {openPromises.map((d: any) => (
            <label key={d.id} className="flex items-start gap-2 cursor-pointer text-sky-950">
              <input type="checkbox" id={`f-promise-${d.id}`} checked={fulfils.includes(d.id)} onChange={(e) => {
                setFulfils(e.target.checked ? [...fulfils, d.id] : fulfils.filter((x) => x !== d.id));
                if (e.target.checked && !lines.some((l) => l.item === d.item)) setLines([...lines.filter((l) => l.item || l.qty), { item: d.item, qty: String(d.qty) }]);
              }} className="mt-0.5 accent-sky-700" />
              <span>{d.qty} {unitWord(item(d.item).unit, lang)} {item(d.item).name} <span className="text-sky-700">({loadName(d.shipmentId)})</span></span>
            </label>
          ))}
          <div className="text-[10px] text-sky-800">{t('promiseHint', lang)}</div>
        </div>
      )}
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
        <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">{t(gate ? 'billedQty' : 'qty', lang)}</div>
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
      {!gate && (
        <label className="block text-[11px] font-bold text-slate-700">{t('ewayBill', lang)} <span className="font-normal text-slate-400">({t('optional', lang)})</span>
          <input id="f-eway" value={ewayBill} onChange={(e) => setEwayBill(e.target.value)} className={sel} />
          {clean.reduce((a, l) => a + l.qty * ITEMS[l.item].rate, 0) > 50000 && !ewayBill.trim() && <span className="block mt-1 font-normal text-amber-800">{t('ewayNeeded', lang)} ({inr0(clean.reduce((a, l) => a + l.qty * ITEMS[l.item].rate, 0))})</span>}
        </label>
      )}
      <PhotoStrip photos={docs} onAdd={(r) => setDocs([...docs, ...r])} label={t('addPaper', lang)} lang={lang} kinds={flow === 'inbound' ? ['supplier bill', 'order', 'delivery note'] : flow === 'jobwork_in' ? ['job worker challan', 'delivery note'] : ['dispatch list', 'challan', 'order']} />
      {!valid && <div id="f-missing" className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2">{t('stillNeeded', lang)}: {missing.join(' · ')}</div>}
      <button id="btn-save-list" disabled={!valid} onClick={save} className="w-full min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-bold cursor-pointer">{t('saveList', lang)} ({clean.length} {t(clean.length === 1 ? 'itemWord' : 'itemsWord', lang)})</button>
    </div>
  );
}

function TruckDetail({ lang, id, onBack }: { lang: string; id: string; onBack: () => void }) {
  const { state, dispatch } = useStore();
  const s = state.shipments.find((x: any) => x.id === id);
  const [point, setPoint] = useState(LOADING_POINTS[0]);
  const [copied, setCopied] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  if (!s) return <Note>…</Note>;
  const st = shipmentStatus(state, s);
  const now = Date.now();
  const link = s.token ? appLink(receiverPath(s, state.settings)) : '';
  const msg = `${t('linkMessage', lang)} ${loadName(s.id)} · ${s.truckNo} · ${route(s)}${s.driver ? ` · ${s.driver}` : ''}${s.driverPhone ? ` ${s.driverPhone}` : ''}\n${link}`;
  const sendOrCount = () => {
    const token = newToken();
    dispatch({ type: 'SEND_TO_RECEIVER', id: s.id, token, actor: atGate(s.flow) ? 'Gate' : 'Dispatch staff' });
    if (atGate(s.flow)) window.location.hash = `#/r/${s.id}/${token}`;
  };
  return (
    <div className="space-y-3">
      <button onClick={onBack} className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 flex items-center cursor-pointer"><ChevronLeft className="w-3.5 h-3.5" />{t('back', lang)}</button>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-slate-900">{route(s)}</div>
          <div className="text-[11px] text-slate-500">{FLOW_LABEL[s.flow]} • {t('truck', lang)} {s.truckNo} • {t('ref', lang)} {s.ref}</div>
          {(s.driver || s.driverPhone) && <div className="text-[11px] text-slate-500">{t('driver', lang)}: {s.driver || '—'}{s.driverPhone && <> • <a href={`tel:${s.driverPhone}`} className="text-emerald-800 font-bold">{s.driverPhone}</a></>}</div>}
          {s.ewayBill && <div className="text-[11px] text-slate-500">{t('ewayBill', lang)}: {s.ewayBill}</div>}
        </div>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${BADGE[st]}`}>{s.cameBack ? t('cameBackShort', lang) : t(`st_${st}`, lang)}</span>
      </div>
      {s.receipt && (
        <div id="sender-result" className={`rounded-xl p-3 text-xs border space-y-1 ${st === 'MATCHED' ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-amber-50 border-amber-200 text-amber-950'}`}>
          <div className="font-bold flex items-center">{st === 'MATCHED' ? <CheckCircle2 className="w-4 h-4 mr-1" /> : <AlertTriangle className="w-4 h-4 mr-1" />}{t('receiverResult', lang)} · {s.receipt.by}, {when(s.receipt.at, now)}</div>
          <pre className="whitespace-pre-wrap font-sans leading-relaxed">{resultText(state, s, lang).split('\n').slice(1).join('\n')}</pre>
        </div>
      )}
      {s.cameBack && <Note tone="stop">{t('cameBackNote', lang)}</Note>}
      <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
        {s.lines.map((l: any) => (
          <div key={l.id} className="px-3 py-2 flex items-center justify-between text-xs">
            <span className="text-slate-800 pr-2">{item(l.item).name}</span>
            <span className="font-mono font-bold whitespace-nowrap">{l.qty} {unitWord(item(l.item).unit, lang)}</span>
          </div>
        ))}

      </div>

      <div className="space-y-1">
        <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">{t('papers', lang)}</div>
        <PhotoStrip photos={s.docs || []} onAdd={(r) => dispatch({ type: 'ATTACH_DOC', id: s.id, docs: r, actor: s.flow === 'inbound' ? 'Gate' : 'Dispatch staff' })} label={t('addPaper', lang)} lang={lang} kinds={s.flow === 'inbound' ? ['supplier bill', 'order', 'delivery note'] : ['dispatch list', 'challan', 'order']} />
        {((s.flow === 'transfer' && s.billing === 'none') || s.flow === 'jobwork_out') && <button id="btn-challan" onClick={() => printReport(challanHtml(state, s))} className="w-full py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 cursor-pointer">{t('printChallan', lang)}</button>}
      </div>
      <Chain s={s} lang={lang} />
      {st === 'LOADING' && !atGate(s.flow) && (
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
          <button id="btn-send" disabled={!atGate(s.flow) && !s.loading?.endAt} onClick={sendOrCount} className="w-full min-h-[52px] rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-bold flex items-center justify-center cursor-pointer shadow-md">
            {atGate(s.flow) ? <><PackageCheck className="w-5 h-5 mr-2" />{t('countNow', lang)}</> : <><Send className="w-5 h-5 mr-2" />{t('sendReceiver', lang)}</>}
          </button>
          {!cancelling ? <button id="btn-cancel" onClick={() => setCancelling(true)} className="w-full py-2 text-[11px] font-bold text-rose-700 cursor-pointer">{t('cancelTruck', lang)}</button> : (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 space-y-2 text-xs">
              <div className="font-bold text-rose-950">{t('cancelSure', lang)}</div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setCancelling(false)} className="py-2.5 rounded-lg border border-slate-300 bg-white font-bold cursor-pointer">{t('keepTruck', lang)}</button>
                <button id="btn-cancel-ok" onClick={() => { dispatch({ type: 'CANCEL_SHIPMENT', id: s.id, actor: 'Dispatch staff' }); onBack(); }} className="py-2.5 rounded-lg bg-rose-600 text-white font-bold cursor-pointer">{t('yesCancel', lang)}</button>
              </div>
            </div>)}
        </>
      )}
      {st === 'IN_TRANSIT' && (
        <div className="space-y-2">
          {receiptOverdue(state, s, now) && <Note tone="stop"><AlertTriangle className="w-4 h-4 inline mr-1" />{duration(now - s.sentAt)}</Note>}
          {atGate(s.flow)
            ? <a id="btn-count" href={receiverPath(s, state.settings)} className="w-full min-h-[52px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center cursor-pointer"><PackageCheck className="w-5 h-5 mr-2" />{t('countNow', lang)}</a>
            : <>
              <div className="text-[11px] text-slate-500 break-all bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono">{link}</div>
              <div className="grid grid-cols-2 gap-2">
                <a id="btn-share-link" href={shareWhatsApp(msg)} target="_blank" rel="noreferrer" className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center"><MessageCircle className="w-4 h-4 mr-1" />{t(s.sentAt && now - s.sentAt > 3600000 ? 'remind' : 'shareWhatsApp', lang)}</a>
                <button onClick={() => { try { navigator.clipboard.writeText(link); setCopied(true); } catch { /* ignore */ } }} className="py-3 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold flex items-center justify-center cursor-pointer"><Copy className="w-4 h-4 mr-1" />{copied ? t('copied', lang) : t('copyLink', lang)}</button>
              </div>
            </>}
          {!cancelling ? <button id="btn-came-back" onClick={() => setCancelling(true)} className="w-full py-2 text-[11px] font-bold text-rose-700 cursor-pointer">{t('truckCameBack', lang)}</button> : (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 space-y-2 text-xs">
              <div className="font-bold text-rose-950">{t('cameBackQ', lang)}</div>
              <input id="f-came-back-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('cameBackReason', lang)} className="w-full p-2 rounded-lg border border-slate-300 bg-white" />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setCancelling(false)} className="py-2.5 rounded-lg border border-slate-300 bg-white font-bold cursor-pointer">{t('goBack', lang)}</button>
                <button id="btn-came-back-ok" disabled={!reason.trim()} onClick={() => { dispatch({ type: 'CANCEL_SHIPMENT', id: s.id, note: reason.trim(), actor: 'Dispatch staff' }); setCancelling(false); }} className="py-2.5 rounded-lg bg-rose-600 disabled:opacity-40 text-white font-bold cursor-pointer">{t('confirmWord', lang)}</button>
              </div>
              {!reason.trim() && <div className="text-[10px] text-rose-800">{t('reasonNeeded', lang)}</div>}
            </div>)}
        </div>
      )}
    </div>
  );
}

// Where this load came from and what was made from it
export function Chain({ s, lang }: { s: any; lang: string }) {
  const { state } = useStore();
  const parent = parentOf(state, s);
  const kids = childrenOf(state, s);
  if (!parent && !kids.length) return null;
  return (
    <div id="chain" className="rounded-lg bg-slate-50 border border-slate-200 p-2 text-[11px] text-slate-700 space-y-0.5">
      {parent && <div><Link2 className="w-3 h-3 inline mr-1" />{t(s.flow === 'jobwork_in' ? 'returnOf' : 'madeFromShort', lang)} <b>{loadName(parent.id)}</b> · {route(parent)}</div>}
      {kids.map((k: any) => <div key={k.id}><Link2 className="w-3 h-3 inline mr-1" />{t(k.flow === 'jobwork_in' ? 'cameBack' : 'nextLoad', lang)} <b>{loadName(k.id)}</b> · {route(k)}</div>)}
    </div>
  );
}
