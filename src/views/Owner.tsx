import React, { useState } from 'react';
import { MessageCircle, Film, Share2, CheckCircle2, Clock, AlertTriangle, Truck, ChevronDown, ChevronRight, ShieldCheck, Link2 } from 'lucide-react';
import { useStore, item, route, shipmentOf, diffsOf, lineOf, shipmentStatus, receiptOverdue, diffOverdue, receiverPath, evidencePath, evidenceText, truckSummary, ACTIONS, OPTIONS, KIND_LABEL, FLOW_LABEL } from '../store.tsx';
import { PageHeader, Panel, StatusBadge, Note, shareWhatsApp, appLink, newToken, type Go } from './ui.tsx';
import { inr, inr0, when, duration, dateTime, time } from '../lib/format.ts';

const KIND_CLS: Record<string, string> = {
  short: 'bg-amber-50 text-amber-800 border-amber-200',
  damaged: 'bg-rose-50 text-rose-800 border-rose-200',
  excess: 'bg-sky-50 text-sky-800 border-sky-200',
};

const inDays = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(17, 0, 0, 0); return d; };
const toLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default function Owner({ go, initialId }: { go: Go; initialId?: string | null }) {
  const { state } = useStore();
  const now = Date.now();
  const open = state.diffs.filter((d: any) => d.status === 'open' || d.status === 'investigating');
  const waiting = state.diffs.filter((d: any) => d.status === 'waiting').sort((a: any, b: any) => a.decision.dueAt - b.decision.dueAt);
  const unread = state.shipments.filter((s: any) => s.sentAt && !s.receipt && !s.cancelledAt).sort((a: any, b: any) => a.sentAt - b.sentAt);
  const recent = state.shipments.filter((s: any) => s.receipt && now - s.receipt.at < 36 * 3600000).sort((a: any, b: any) => b.receipt.at - a.receipt.at);
  const byTruck = [...new Set(open.map((d: any) => d.shipmentId))].map((id) => shipmentOf(state, id as string));
  const openValue = open.reduce((a: number, d: any) => a + d.value, 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader title="Owner" sub="Only what did not match. Everything that matched is already done." right={
        <div className="flex gap-2 text-xs">
          <Stat n={open.length} label="to decide" cls="text-amber-700" />
          <Stat n={waiting.filter((d: any) => diffOverdue(d, now)).length} label="promises overdue" cls="text-rose-700" />
          <Stat n={unread.filter((s: any) => receiptOverdue(state, s, now)).length} label="trucks not counted" cls="text-sky-700" />
        </div>} />

      <Panel eyebrow="Decide" title={open.length ? `${open.length} difference${open.length > 1 ? 's' : ''} on ${byTruck.length} truck${byTruck.length > 1 ? 's' : ''} · ${inr0(openValue)}` : 'Nothing to decide'}>
        {!open.length && <Note tone="go"><CheckCircle2 className="w-4 h-4 inline mr-1" />Every counted truck either matched or has a decision.</Note>}
        <div className="space-y-4">
          {byTruck.map((s: any) => (
            <div key={s.id} id={`own-truck-${s.id}`} className="rounded-xl border border-slate-200 overflow-hidden">
              <TruckHead s={s} />
              <div className="divide-y divide-slate-100">
                {diffsOf(state, s.id).filter((d: any) => d.status === 'open' || d.status === 'investigating').map((d: any) => <DiffCard key={d.id} d={d} s={s} startOpen={initialId === d.id || initialId === s.id} />)}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid md:grid-cols-2 gap-6">
        <Panel eyebrow="Promises" title={`Waiting on someone · ${waiting.length}`}>
          {!waiting.length && <div className="text-xs text-slate-500">No open promises.</div>}
          <div className="space-y-2">{waiting.map((d: any) => <PromiseRow key={d.id} d={d} />)}</div>
        </Panel>
        <Panel eyebrow="Receipts" title={`Trucks not counted yet · ${unread.length}`}>
          {!unread.length && <div className="text-xs text-slate-500">Every truck that left has been counted.</div>}
          <div className="space-y-2">
            {unread.map((s: any) => {
              const late = receiptOverdue(state, s, now);
              return (
                <div key={s.id} id={`own-unread-${s.id}`} className={`rounded-lg border p-2.5 text-xs flex items-center justify-between gap-2 ${late ? 'border-rose-200 bg-rose-50/50' : 'border-slate-200'}`}>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate"><span className="font-mono">{s.id}</span> · {route(s)}</div>
                    <div className="text-slate-500">{s.truckNo} · left {when(s.sentAt, now)} · {late ? <span className="text-rose-700 font-bold">{duration(now - s.sentAt)}, over {state.settings.receiptHours}h</span> : duration(now - s.sentAt)}</div>
                  </div>
                  <a href={shareWhatsApp(`Reminder: please count ${s.id} (${s.truckNo}, ${route(s)}) and submit:\n${appLink(receiverPath(s))}`)} target="_blank" rel="noreferrer" className="shrink-0 px-2.5 py-1.5 rounded-md bg-emerald-600 text-white font-bold flex items-center"><MessageCircle className="w-3.5 h-3.5 mr-1" />Remind</a>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <Panel eyebrow="Last 36 hours" title="Truck messages">
        <div className="grid sm:grid-cols-2 gap-2">
          {recent.map((s: any) => {
            const st = shipmentStatus(state, s);
            return (
              <div key={s.id} className="rounded-lg border border-slate-200 p-2.5 text-xs space-y-1">
                <div className="flex items-center justify-between gap-2"><span className="font-mono font-bold">{s.id}</span><StatusBadge status={st} /></div>
                <pre className="whitespace-pre-wrap font-sans text-slate-700 text-[11px] leading-relaxed">{truckSummary(state, s).split('\n').slice(1).join('\n')}</pre>
                <div className="text-[10px] text-slate-400">{route(s)} · {when(s.receipt.at, now)}</div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function Stat({ n, label, cls }: { n: number; label: string; cls: string }) {
  return <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-center shadow-2xs"><div className={`text-lg font-bold leading-none ${n ? cls : 'text-slate-400'}`}>{n}</div><div className="text-[10px] text-slate-500 mt-0.5">{label}</div></div>;
}

function TruckHead({ s }: { s: any }) {
  const { state } = useStore();
  return (
    <div className="bg-slate-50 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200">
      <div className="text-xs">
        <div className="font-bold text-slate-900 flex items-center gap-2"><Truck className="w-3.5 h-3.5 text-slate-500" /><span className="font-mono">{s.id}</span> · {route(s)}</div>
        <div className="text-slate-500 mt-0.5">{FLOW_LABEL[s.flow]} · {s.truckNo} · ref {s.ref} · counted by {s.receipt.by}, {when(s.receipt.at)}{s.receipt.photos?.length ? ` · ${s.receipt.photos.length} photo(s)` : ''}</div>
        {s.loading && <div className="text-slate-500">Loading {s.loading.point}, {time(s.loading.startAt)}–{time(s.loading.endAt)}</div>}
        {s.receipt.note && <div className="text-slate-700 italic">“{s.receipt.note}”</div>}
      </div>
      <a href={shareWhatsApp(truckSummary(state, s))} target="_blank" rel="noreferrer" className="self-start sm:self-center shrink-0 text-[11px] font-bold text-emerald-800 border border-emerald-200 bg-white px-2 py-1 rounded-md flex items-center"><MessageCircle className="w-3.5 h-3.5 mr-1" />Share summary</a>
    </div>
  );
}

function DiffCard({ d, s, startOpen }: { d: any; s: any; startOpen?: boolean }) {
  const { state, dispatch } = useStore();
  const [choice, setChoice] = useState<string | null>(null);
  const [due, setDue] = useState(toLocal(inDays(2)));
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [evOpen, setEvOpen] = useState(!!startOpen || d.status === 'investigating');
  const it = item(d.item);
  const l = lineOf(s, d.lineId);
  const r = s.receipt.lines[d.lineId];
  const a = choice ? ACTIONS[choice] : null;
  const big = a?.loss && d.value > state.settings.writeOffLimit;
  const can = choice && (!a!.due || new Date(due).getTime() > Date.now()) && (!big || confirm);
  const decide = () => {
    dispatch({ type: 'DECIDE', diffId: d.id, action: choice, dueAt: a!.due ? new Date(due).getTime() : undefined, note: note.trim(), confirm, actor: 'Owner' });
    if (choice === 'investigate') setEvOpen(true);
    setChoice(null); setNote(''); setConfirm(false);
  };
  return (
    <div id={`diff-${d.id}`} className="p-3 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
        <div className="text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${KIND_CLS[d.kind]}`}>{KIND_LABEL[d.kind].toUpperCase()} {d.qty}</span>
            <span className="font-bold text-slate-900">{it.name}</span>
            {d.status === 'investigating' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-violet-50 text-violet-800 border-violet-200">INVESTIGATING</span>}
          </div>
          <div className="text-slate-500 mt-1">Sent {l.qty} · counted {r.counted}{r.damaged ? ` · damaged ${r.damaged}` : ''} {it.unit} · <span className="font-mono">{d.id}</span></div>
        </div>
        <div className="text-right"><div className="text-sm font-bold text-slate-900">{inr(d.value, 0)}</div><div className="text-[10px] text-slate-400">at {inr(it.rate, 0)}/{it.unit}</div></div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {OPTIONS[s.flow][d.kind].filter((o) => !(o === 'investigate' && d.status === 'investigating')).map((o) => (
          <button key={o} id={`opt-${d.id}-${o}`} onClick={() => { setChoice(choice === o ? null : o); setConfirm(false); }}
            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer transition-colors ${choice === o ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'}`}>{ACTIONS[o].label}</button>
        ))}
      </div>

      {a && (
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 space-y-2 text-xs">
          {a.due && <label className="flex items-center justify-between gap-2 font-semibold text-slate-700">Due by<input id={`due-${d.id}`} type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="p-1.5 rounded border border-slate-300 bg-white" /></label>}
          {a.draft && <div className="text-slate-600">Makes a draft for the accountant: <b>{a.draft}</b>.</div>}
          {!a.draft && !a.due && choice !== 'investigate' && <div className="text-slate-600">Closes the difference. Nothing to enter in Tally.</div>}
          {choice === 'investigate' && <div className="text-slate-600">Keeps it open while you check CCTV and talk to the driver and sender. Attach the clip below.</div>}
          <input id={`note-${d.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (who agreed, what was said)" className="w-full p-2 rounded border border-slate-300 bg-white" />
          {big && (
            <label className="flex items-start gap-2 p-2 rounded bg-amber-50 border border-amber-200 text-amber-950 font-semibold cursor-pointer">
              <input id={`confirm-${d.id}`} type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 accent-amber-700" />
              <span>{inr0(d.value)} is above your limit of {inr0(state.settings.writeOffLimit)}. I accept this loss.</span>
            </label>
          )}
          <button id={`decide-${d.id}`} disabled={!can} onClick={decide} className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold cursor-pointer">Confirm: {a.label}</button>
        </div>
      )}

      <button onClick={() => setEvOpen(!evOpen)} className="text-[11px] font-bold text-slate-600 flex items-center cursor-pointer">{evOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}Evidence pack{d.evidence.clips.length ? ` · ${d.evidence.clips.length} clip(s)` : ''}{d.evidence.shares.length ? ` · shared ${d.evidence.shares.length}×` : ''}</button>
      {evOpen && <Evidence d={d} />}
      {d.history.length > 0 && <div className="text-[10px] text-slate-500 space-y-0.5">{d.history.map((h: any, i: number) => <div key={i}>{dateTime(h.at)} · {h.by}: {h.text}</div>)}</div>}
    </div>
  );
}

// The CCTV window comes from the loading times the dispatch staff recorded. The owner attaches the clip
// (a name or a link to where it is stored) and decides who sees the pack: it is shared only on purpose.
function Evidence({ d }: { d: any }) {
  const { state, dispatch } = useStore();
  const [clip, setClip] = useState('');
  const [to, setTo] = useState('');
  const text = evidenceText(state, d);
  const share = () => {
    const token = d.evidenceToken || newToken();
    dispatch({ type: 'SHARE_EVIDENCE', diffId: d.id, to, token, actor: 'Owner' });
    const link = appLink(evidencePath({ ...d, evidenceToken: token }));
    window.open(shareWhatsApp(`${text}\n${link}`), '_blank');
    setTo('');
  };
  return (
    <div className="rounded-lg border border-slate-200 p-2.5 space-y-2 text-xs">
      <pre id={`ev-${d.id}`} className="whitespace-pre-wrap font-sans text-[11px] text-slate-700 bg-slate-50 rounded p-2 leading-relaxed">{text}</pre>
      <div className="flex gap-2">
        <input id={`clip-${d.id}`} value={clip} onChange={(e) => setClip(e.target.value)} placeholder="CCTV clip name or link" className="flex-1 min-w-0 p-2 rounded border border-slate-300" />
        <button id={`attach-${d.id}`} disabled={!clip.trim()} onClick={() => { const v = clip.trim(); dispatch({ type: 'ATTACH_CLIP', diffId: d.id, name: /^https?:/.test(v) ? '' : v, link: /^https?:/.test(v) ? v : '', actor: 'Owner' }); setClip(''); }} className="px-2.5 rounded-lg bg-slate-900 disabled:opacity-40 text-white font-bold flex items-center cursor-pointer"><Film className="w-3.5 h-3.5 mr-1" />Attach</button>
      </div>
      <div className="flex gap-2">
        <input id={`share-to-${d.id}`} value={to} onChange={(e) => setTo(e.target.value)} placeholder="Share with (e.g. transporter, supplier)" className="flex-1 min-w-0 p-2 rounded border border-slate-300" />
        <button id={`share-${d.id}`} disabled={!to.trim()} onClick={share} className="px-2.5 rounded-lg bg-emerald-600 disabled:opacity-40 text-white font-bold flex items-center cursor-pointer"><Share2 className="w-3.5 h-3.5 mr-1" />Share</button>
      </div>
      {d.evidence.shares.length > 0 && <div className="text-[10px] text-slate-500"><ShieldCheck className="w-3 h-3 inline mr-0.5" />Shared with {d.evidence.shares.map((x: any) => `${x.to} (${when(x.at)})`).join(', ')}</div>}
    </div>
  );
}

function PromiseRow({ d }: { d: any }) {
  const { state, dispatch } = useStore();
  const s = shipmentOf(state, d.shipmentId);
  const late = diffOverdue(d, Date.now());
  return (
    <div id={`promise-${d.id}`} className={`rounded-lg border p-2.5 text-xs space-y-1.5 ${late ? 'border-rose-200 bg-rose-50/50' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold text-slate-900">{ACTIONS[d.decision.action].label}</div>
          <div className="text-slate-500 truncate">{d.qty} {item(d.item).unit} {item(d.item).name} · {route(s)} · <span className="font-mono">{d.id}</span></div>
          {d.decision.note && <div className="text-slate-600 italic">“{d.decision.note}”</div>}
        </div>
        <div className={`text-right shrink-0 font-bold ${late ? 'text-rose-700' : 'text-slate-700'}`}>{late ? <AlertTriangle className="w-3.5 h-3.5 inline mr-0.5" /> : <Clock className="w-3.5 h-3.5 inline mr-0.5" />}{late ? 'overdue' : 'due'} {when(d.decision.dueAt)}</div>
      </div>
      <button id={`settle-${d.id}`} onClick={() => dispatch({ type: 'SETTLE', diffId: d.id, note: 'Received / done', actor: 'Owner' })} className="w-full py-1.5 rounded-md border border-emerald-300 text-emerald-800 bg-white font-bold cursor-pointer hover:bg-emerald-50">Mark done</button>
    </div>
  );
}

// Read-only page behind a shared evidence link: #/e/<diffId>/<token>
export function EvidenceView({ id, token }: { id: string; token: string }) {
  const { state } = useStore();
  const d = state.diffs.find((x: any) => x.id === id);
  if (!d || !d.evidenceToken || d.evidenceToken !== token) return <div className="max-w-md mx-auto"><Note tone="stop">This evidence link is not valid.</Note></div>;
  return (
    <div className="max-w-md mx-auto space-y-3">
      <PageHeader title="Evidence" sub={`${d.id} · shared by the owner`} />
      <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800 bg-white border border-slate-200 rounded-xl p-4 leading-relaxed">{evidenceText(state, d)}</pre>
      {d.evidence.clips.map((c: any, i: number) => (
        <div key={i} className="text-xs bg-white border border-slate-200 rounded-lg p-2.5 flex items-center gap-2"><Film className="w-4 h-4 text-slate-500" />{c.link ? <a href={c.link} target="_blank" rel="noreferrer" className="text-emerald-800 underline break-all"><Link2 className="w-3 h-3 inline" /> {c.link}</a> : c.name}</div>
      ))}
    </div>
  );
}
