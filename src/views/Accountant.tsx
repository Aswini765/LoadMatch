import React, { useState } from 'react';
import { Download, Check, X, FileCode } from 'lucide-react';
import { useStore, item, party, shipmentOf, route, importOrder, DRAFT_LABEL } from '../store.tsx';
import { PageHeader, Panel, type Go } from './ui.tsx';
import { taxLines } from '../lib/tax.ts';
import { voucherXml, batchXml, download } from '../lib/tally.ts';
import { inr, dateTime, tallyDate } from '../lib/format.ts';

const TYPE_CLS: Record<string, string> = {
  stock_journal: 'bg-slate-100 text-slate-700 border-slate-200',
  receipt_note: 'bg-sky-50 text-sky-800 border-sky-200',
  debit_note: 'bg-amber-50 text-amber-800 border-amber-200',
  credit_note: 'bg-rose-50 text-rose-800 border-rose-200',
  sales_invoice: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

const amountOf = (d: any) => (d.lines && d.party ? (d.type === 'receipt_note' ? d.lines.reduce((a: number, l: any) => a + l.qty * l.rate, 0) : taxLines(d.lines, party(d.party)).total) : null);

export default function Accountant({ go }: { go: Go }) {
  const { state, dispatch } = useStore();
  const pending = state.drafts.filter((d: any) => d.status === 'pending').sort(importOrder);
  const approved = state.drafts.filter((d: any) => d.status === 'approved').sort(importOrder);
  const rejected = state.drafts.filter((d: any) => d.status === 'rejected');
  const toExport = approved.filter((d: any) => !d.exportedAt);
  const exportBatch = () => {
    download(`loadmatch-tally-${tallyDate(Date.now())}.xml`, batchXml(toExport));
    dispatch({ type: 'EXPORT_DRAFTS', ids: toExport.map((d: any) => d.id), actor: 'Accountant' });
  };
  const [sel, setSel] = useState<Set<string>>(() => new Set(pending.map((d: any) => d.id)));
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const chosen = pending.filter((d: any) => sel.has(d.id));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const list = tab === 'pending' ? pending : tab === 'approved' ? approved : rejected;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader title="Accountant" sub="Tally entries prepared from the counts and the owner's decisions." right={
        <button id="btn-batch-xml" disabled={!toExport.length} onClick={exportBatch} className="px-3 py-2 rounded-lg bg-slate-900 disabled:opacity-40 text-white text-xs font-bold flex items-center cursor-pointer"><Download className="w-3.5 h-3.5 mr-1.5" />{toExport.length ? `Download ${toExport.length} new entr${toExport.length === 1 ? 'y' : 'ies'} for Tally` : 'Nothing new for Tally'}</button>} />

      <div className="inline-flex rounded-lg bg-white border border-slate-200 p-0.5 text-xs">
        {([['pending', `To approve (${pending.length})`], ['approved', `Approved (${approved.length})`], ['rejected', `Rejected (${rejected.length})`]] as const).map(([k, l]) => (
          <button key={k} id={`tab-${k}`} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-md font-bold cursor-pointer ${tab === k ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>{l}</button>
        ))}
      </div>

      <Panel eyebrow={tab === 'pending' ? 'In import order' : tab} title={tab === 'pending' ? `${chosen.length} of ${pending.length} selected` : `${list.length} entr${list.length === 1 ? 'y' : 'ies'}`} right={tab === 'pending' && pending.length > 0 && (
        <div className="flex gap-2">
          <button onClick={() => setSel(sel.size === pending.length ? new Set() : new Set(pending.map((d: any) => d.id)))} className="px-2.5 py-1.5 rounded-md border border-slate-300 text-xs font-bold cursor-pointer">{sel.size === pending.length ? 'Clear' : 'Select all'}</button>
          <button id="btn-approve" disabled={!chosen.length} onClick={() => { dispatch({ type: 'APPROVE_DRAFTS', ids: chosen.map((d: any) => d.id), actor: 'Accountant' }); setSel(new Set()); }} className="px-3 py-1.5 rounded-md bg-emerald-600 disabled:opacity-40 text-white text-xs font-bold flex items-center cursor-pointer"><Check className="w-3.5 h-3.5 mr-1" />Approve {chosen.length}</button>
        </div>)}>
        {!list.length && <div className="text-xs text-slate-500">Nothing here.</div>}
        <div className="space-y-2">
          {list.map((d: any) => <DraftRow key={d.id} d={d} selectable={tab === 'pending'} selected={sel.has(d.id)} toggle={() => toggle(d.id)} />)}
        </div>
      </Panel>
    </div>
  );
}

function DraftRow({ d, selectable, selected, toggle }: { d: any; selectable: boolean; selected: boolean; toggle: () => void }) {
  const { state, dispatch } = useStore();
  const [rejecting, setRejecting] = useState(false);
  const [why, setWhy] = useState('');
  const s = shipmentOf(state, d.shipmentId);
  const amount = amountOf(d);
  return (
    <div id={`draft-${d.id}`} className={`rounded-lg border p-3 text-xs space-y-2 ${selected ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'}`}>
      <div className="flex items-start gap-3">
        {selectable && <input type="checkbox" checked={selected} onChange={toggle} className="mt-1 w-4 h-4 accent-emerald-700 cursor-pointer" aria-label={`Select ${d.id}`} />}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${TYPE_CLS[d.type]}`}>{DRAFT_LABEL[d.type]}</span>
            <span className="font-mono text-slate-500">{d.id}</span>
            {d.party && <span className="font-bold text-slate-900">{party(d.party).name}</span>}
            {d.ref && <span className="text-slate-500">ref {d.ref}</span>}
            <span className="text-slate-400">{s.id} · {route(s)}</span>
          </div>
          {d.moves && <div className="text-slate-700 space-y-0.5">{d.moves.map((m: any, i: number) => <div key={i}>{m.qty} {item(m.item).unit} {item(m.item).name}: <span className="text-slate-500">{m.from} → {m.to}</span></div>)}</div>}
          {d.lines && <div className="text-slate-700 space-y-0.5">{d.lines.map((l: any, i: number) => <div key={i}>{l.qty} {item(l.item).unit} {item(l.item).name} @ {inr(l.rate, 0)} {d.type !== 'receipt_note' && <span className="text-slate-400">+{l.gst}% GST</span>}</div>)}</div>}
          <div className="text-slate-500 italic">{d.narration}</div>
          {d.status === 'rejected' && <div className="text-rose-700 font-semibold">Rejected: {d.rejectNote} ({dateTime(d.rejectedAt)})</div>}
          {d.status === 'approved' && <div className="text-emerald-700 font-semibold">Approved {dateTime(d.approvedAt)}{d.exportedAt ? ` · downloaded for Tally ${dateTime(d.exportedAt)}` : ' · not downloaded yet'}</div>}
        </div>
        <div className="text-right shrink-0 space-y-1">
          {amount != null && <div className="font-bold text-slate-900">{inr(amount)}</div>}
          <button onClick={() => download(`${d.id}-${d.type}.xml`, voucherXml(d))} className="text-[11px] font-bold text-slate-600 flex items-center cursor-pointer ml-auto"><FileCode className="w-3.5 h-3.5 mr-0.5" />XML</button>
        </div>
      </div>
      {selectable && (rejecting ? (
        <div className="flex gap-2">
          <input id={`reject-why-${d.id}`} autoFocus value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Reason" className="flex-1 min-w-0 p-2 rounded border border-slate-300" />
          <button id={`reject-ok-${d.id}`} disabled={!why.trim()} onClick={() => dispatch({ type: 'REJECT_DRAFT', id: d.id, note: why, actor: 'Accountant' })} className="px-3 rounded-md bg-rose-600 disabled:opacity-40 text-white font-bold cursor-pointer">Reject</button>
          <button onClick={() => setRejecting(false)} className="px-2 rounded-md border border-slate-300 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
        </div>
      ) : <button id={`reject-${d.id}`} onClick={() => setRejecting(true)} className="text-[11px] font-bold text-rose-700 cursor-pointer">Reject…</button>)}
    </div>
  );
}
