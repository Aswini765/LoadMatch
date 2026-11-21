import React, { useState } from 'react';
import { Send, PackageCheck, ArrowRight, Truck, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useStore, route, diffsOf, countedByUs, atGate, sameGstin, receiverPath, loadName } from '../store.tsx';
import { UNITS } from '../data/seed.ts';
import { getUnit, setUnit } from '../lib/who.ts';
import { PhoneFrame, savedLang, saveLang, newToken } from './ui.tsx';
import { when } from '../lib/format.ts';
import type { Go } from './ui.tsx';

const uname = (id: string) => UNITS[id]?.name.split(' (')[0] || id;
const staffName = (state: any) => (state.staff || []).find((p: any) => p.unit === getUnit())?.name || 'Staff';

// Sending or receiving, and whether the other side has the same GST number (our unit) or another one
export function sideTag(state: any, s: any, unit: string) {
  const sending = s.fromUnit === unit && !s.returning;
  const same = s.flow === 'transfer' && sameGstin(state, s.fromUnit, s.toUnit);
  const other = s.flow === 'transfer' ? `our ${uname(sending ? s.toUnit : s.fromUnit)}` : 'outside party';
  return { sending, label: `${sending ? 'Sending' : 'Receiving'} · ${same ? 'Same GST' : 'Other GST'}`, other };
}

const SEND_RULES = [
  'Make the list before loading. Pick items from the list; missing? Ask owner.',
  'The truck cannot leave until loading is marked finished.',
  'Paper: same GST → delivery challan. Other GST → invoice (check e-way bill with your accountant).',
  'After Truck left the list is locked. Changes only through the owner.',
];
const RECEIVE_RULES = [
  'Count first. The sent number is hidden, so count what is really there.',
  'Count damaged pieces separately.',
  'Once submitted the count is locked.',
  'Any difference goes only to the owner. Supplier short → replaced in next batch. Accident → owner.',
];

function Rules({ list, tone }: { list: string[]; tone: string }) {
  return (
    <ol className={`rounded-xl border p-3 text-[11px] space-y-1 list-decimal list-inside ${tone}`}>
      <div className="font-bold uppercase tracking-wide text-[10px] mb-1">Rules</div>
      {list.map((r) => <li key={r}>{r}</li>)}
    </ol>
  );
}

function Choice({ id, title, sub, onClick }: { id: string; title: string; sub: string; onClick: () => void }) {
  return (
    <button id={id} onClick={onClick} className="w-full text-left bg-white hover:bg-slate-50 border border-slate-200 rounded-xl p-3 cursor-pointer flex items-center justify-between shadow-2xs">
      <span><span className="block text-sm font-bold text-slate-900">{title}</span><span className="block text-[11px] text-slate-500">{sub}</span></span>
      <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
    </button>
  );
}

function Row({ s, unit, action, onClick, state }: { s: any; unit: string; action: string; onClick: () => void; state: any }) {
  const tag = sideTag(state, s, unit);
  const diffs = diffsOf(state, s.id).length;
  return (
    <button id={`staff-${s.id}`} onClick={onClick} className="w-full text-left bg-white hover:bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-2xs cursor-pointer flex items-center justify-between gap-2">
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${tag.sending ? 'bg-violet-100 text-violet-900' : 'bg-sky-100 text-sky-900'}`}>{tag.label}</span>
          <span className="text-xs font-bold text-slate-900">{loadName(s.id)}</span>
          {s.returning && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-900">Coming back after accident</span>}
          {s.receipt && diffs > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">Difference · owner</span>}
          {s.receipt && !diffs && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900">Matched</span>}
          {s.cancelledAt && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">Cancelled</span>}
        </span>
        <span className="block text-[11px] text-slate-600 truncate">{route(s)} · {s.truckNo || '—'} · {when(s.receipt?.at || s.sentAt || s.createdAt)}</span>
      </span>
      <span className="text-xs font-bold text-emerald-800 shrink-0 flex items-center">{action}<ArrowRight className="w-3.5 h-3.5 ml-0.5" /></span>
    </button>
  );
}

const Head = ({ icon: Icon, text }: { icon: any; text: string }) => <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide pt-2 flex items-center"><Icon className="w-3.5 h-3.5 mr-1" />{text}</div>;

export default function Staff({ go }: { go: Go }) {
  const { state, dispatch } = useStore();
  const [lang, setLangState] = useState(savedLang);
  const setLang = (l: string) => { setLangState(l); saveLang(l); };
  const [unit, setU] = useState(getUnit());
  const [mode, setMode] = useState<'' | 'send' | 'receive'>('');
  const [filter, setFilter] = useState('all');
  const pickUnit = (u: string) => { setUnit(u); setU(u); };
  const mine = state.shipments;
  const toLoad = mine.filter((s: any) => s.fromUnit === unit && !s.sentAt && !s.cancelledAt && !atGate(s.flow));
  const toCount = mine.filter((s: any) => !s.receipt && !s.cancelledAt && (s.returning ? s.fromUnit === unit : s.toUnit === unit && countedByUs(s) && (s.flow !== 'transfer' || s.sentAt)));
  const onWay = mine.filter((s: any) => s.fromUnit === unit && s.sentAt && !s.receipt && !s.cancelledAt && !s.returning);
  const done = mine.filter((s: any) => (s.fromUnit === unit || s.toUnit === unit) && (s.receipt || s.cancelledAt))
    .filter((s: any) => filter === 'all' || (filter === 'sent' ? s.fromUnit === unit : filter === 'received' ? s.toUnit === unit : diffsOf(state, s.id).length > 0))
    .sort((a: any, b: any) => (b.receipt?.at || b.cancelledAt) - (a.receipt?.at || a.cancelledAt)).slice(0, 30);
  const waiting = (state.requests || []).filter((r: any) => r.status === 'pending' && String(r.by).startsWith(staffName(state))).length;
  const count = (s: any) => {
    if (s.sentAt) { window.location.hash = receiverPath(s, state.settings); return; }
    const token = newToken();
    dispatch({ type: 'SEND_TO_RECEIVER', id: s.id, token, actor: 'Gate' });
    window.location.hash = `#/r/${s.id}/${token}`;
  };
  const open = (s: any) => go('dispatch', { id: s.id });

  return (
    <PhoneFrame title="LoadMatch · Staff" sub={`${staffName(state)} · ${uname(unit)}`} lang={lang} setLang={setLang}>
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-slate-500">My unit:</span>
          {Object.keys(UNITS).map((u) => <button key={u} id={`unit-${u}`} onClick={() => pickUnit(u)} className={`px-2.5 py-1 rounded-full border font-bold cursor-pointer ${u === unit ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}>{uname(u)}</button>)}
        </div>
        <div className="text-[10px] text-slate-500 -mt-1">Demo: switch unit to play the person at the other end of the truck.</div>

        <div className="grid grid-cols-2 gap-2">
          <button id="btn-send-stock" onClick={() => setMode(mode === 'send' ? '' : 'send')} className={`py-4 rounded-xl font-bold text-sm cursor-pointer flex flex-col items-center border-2 ${mode === 'send' ? 'bg-violet-700 text-white border-violet-700' : 'bg-violet-50 text-violet-900 border-violet-200'}`}><Send className="w-5 h-5 mb-1" />Send stock</button>
          <button id="btn-receive-stock" onClick={() => setMode(mode === 'receive' ? '' : 'receive')} className={`py-4 rounded-xl font-bold text-sm cursor-pointer flex flex-col items-center border-2 ${mode === 'receive' ? 'bg-sky-700 text-white border-sky-700' : 'bg-sky-50 text-sky-900 border-sky-200'}`}><PackageCheck className="w-5 h-5 mb-1" />Receive stock</button>
        </div>

        {mode === 'send' && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-900">Where is it going?</div>
            <Choice id="send-unit" title={`Our other unit · Same GST`} sub="Stock transfer. Paper: delivery challan. They see it in their app." onClick={() => go('dispatch', { id: 'new:transfer' })} />
            <Choice id="send-customer" title="Customer · Other GST" sub="Sale. Paper: invoice. Link goes from company WhatsApp." onClick={() => go('dispatch', { id: 'new:outbound' })} />
            <Choice id="send-jobwork" title="Job worker · Other GST" sub="Sent for work, comes back. Paper: job work challan." onClick={() => go('dispatch', { id: 'new:jobwork_out' })} />
            <Rules list={SEND_RULES} tone="border-violet-200 bg-violet-50 text-violet-950" />
          </div>
        )}
        {mode === 'receive' && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-900">Where is it coming from?</div>
            <div id="recv-unit" className="bg-white border border-slate-200 rounded-xl p-3"><div className="text-sm font-bold text-slate-900">Our other unit · Same GST</div><div className="text-[11px] text-slate-500">Nothing to type. The truck is already listed below under <b>To do now → Count</b>.</div></div>
            <Choice id="recv-supplier" title="Supplier delivery · Other GST" sub="Pick the supplier, then count what came." onClick={() => go('receive', { id: 'add:inbound' })} />
            <Choice id="recv-jobwork" title="Back from job work · Other GST" sub="Goods we sent for work, coming back." onClick={() => go('receive', { id: 'add:jobwork_in' })} />
            <Rules list={RECEIVE_RULES} tone="border-sky-200 bg-sky-50 text-sky-950" />
          </div>
        )}

        <Head icon={Clock} text="To do now" />
        {!toLoad.length && !toCount.length && <div id="nothing-pending" className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-3"><CheckCircle2 className="w-4 h-4 inline mr-1" />Nothing pending ✓</div>}
        {toLoad.map((s: any) => <Row key={s.id} s={s} unit={unit} state={state} action={s.loading?.endAt ? 'Truck left' : 'Load'} onClick={() => open(s)} />)}
        {toCount.map((s: any) => <Row key={s.id} s={s} unit={unit} state={state} action="Count" onClick={() => count(s)} />)}
        {waiting > 0 && <div className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2"><AlertTriangle className="w-3.5 h-3.5 inline mr-1" />{waiting} request(s) waiting for the owner.</div>}

        <Head icon={Truck} text={`On the way · ${onWay.length}`} />
        {!onWay.length && <div className="text-[11px] text-slate-500">No truck from {uname(unit)} is on the road.</div>}
        {onWay.map((s: any) => <Row key={s.id} s={s} unit={unit} state={state} action="View" onClick={() => open(s)} />)}

        <Head icon={CheckCircle2} text="Done (history)" />
        <div className="flex gap-1.5 flex-wrap">
          {[['all', 'All'], ['sent', 'Sent'], ['received', 'Received'], ['diff', 'Has difference']].map(([k, l]) => (
            <button key={k} id={`hist-${k}`} onClick={() => setFilter(k)} className={`px-2.5 py-1 rounded-full text-[11px] font-bold border cursor-pointer ${filter === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}>{l}</button>
          ))}
        </div>
        {!done.length && <div className="text-[11px] text-slate-500">Nothing here yet.</div>}
        {done.map((s: any) => <Row key={s.id} s={s} unit={unit} state={state} action="View" onClick={() => open(s)} />)}
        <div className="text-[10px] text-slate-500">Old trucks are read only. To change one, open it and ask the owner.</div>
      </div>
    </PhoneFrame>
  );
}

// "Not in list? Ask owner": staff cannot add items or parties themselves, so the lists stay clean
export function AskAdd({ what, partyKind }: { what: 'item' | 'party'; partyKind?: string }) {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [sent, setSent] = useState('');
  if (sent) return <div className="text-[11px] text-emerald-800">Asked the owner to add “{sent}”. It appears here once approved.</div>;
  if (!open) return <button id={`ask-add-${what}`} onClick={() => setOpen(true)} className="text-[11px] font-bold text-sky-800 underline cursor-pointer text-left">Not in the list? Ask owner to add {what === 'item' ? 'an item' : `a ${partyKind || 'party'}`}</button>;
  return (
    <div className="flex gap-2">
      <input id={`ask-add-name-${what}`} value={name} onChange={(e) => setName(e.target.value)} placeholder={what === 'item' ? 'Item name and size' : 'Party name'} className="flex-1 p-2 rounded-lg border border-slate-300 text-xs" />
      <button id={`ask-add-send-${what}`} disabled={!name.trim()} onClick={() => { dispatch({ type: 'ASK_ADD', what, name, partyKind, by: `${staffName(state)} (staff)` }); setSent(name.trim()); }} className="px-3 rounded-lg bg-slate-900 text-white text-xs font-bold disabled:opacity-40 cursor-pointer">Ask</button>
    </div>
  );
}

