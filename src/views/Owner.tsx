import React, { useState } from 'react';
import { MessageCircle, Film, Share2, CheckCircle2, Clock, AlertTriangle, Truck, ChevronDown, ChevronRight, ShieldCheck, Link2, HelpCircle, Printer, FileCode, Send, Undo2 } from 'lucide-react';
import { useStore, item, party, route, atGate, jobworkOpen, jobworkBalance, jobworkDueAt, shipmentOf, diffsOf, lineOf, shipmentStatus, receiptOverdue, diffOverdue, receiverPath, evidencePath, evidenceText, truckSummary, importOrder, ACTIONS, OPTIONS, KIND_LABEL, FLOW_LABEL, DRAFT_LABEL, DRAFT_PLAIN, loadName } from '../store.tsx';
import { reportHtml, printReport, packSummary, entryAmount, entryLines } from '../lib/report.ts';
import { batchXml, download } from '../lib/tally.ts';
import { tallyDate } from '../lib/format.ts';
import { Chain } from './Dispatch.tsx';
import { PageHeader, Panel, StatusBadge, Note, PhotoStrip, shareWhatsApp, appLink, newToken, type Go } from './ui.tsx';
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
      <PageHeader title="Owner" sub="You only see what did not match. Everything else is already done." right={
        <div className="flex gap-2 text-xs">
          <Stat n={open.length} label="to decide" cls="text-amber-700" />
          <Stat n={waiting.filter((d: any) => diffOverdue(d, now)).length} label="promises late" cls="text-rose-700" />
          <Stat n={unread.filter((s: any) => receiptOverdue(state, s, now)).length} label="trucks not counted" cls="text-sky-700" />
        </div>} />

      <Panel eyebrow="Needs your decision" title={open.length ? `${open.length} difference${open.length > 1 ? 's' : ''} on ${byTruck.length} truck${byTruck.length > 1 ? 's' : ''} · worth ${inr0(openValue)}` : 'Nothing to decide'}>
        {!open.length && <Note tone="go"><CheckCircle2 className="w-4 h-4 inline mr-1" />Every truck that was counted either matched or already has your decision.</Note>}
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
        <Panel eyebrow="Promised by others" title={`Waiting for them to keep it · ${waiting.length}`}>
          {!waiting.length && <div className="text-xs text-slate-500">Nothing pending.</div>}
          <div className="space-y-2">{waiting.map((d: any) => <PromiseRow key={d.id} d={d} />)}</div>
        </Panel>
        <Panel eyebrow="On the way" title={`Trucks not counted yet · ${unread.length}`}>
          {!unread.length && <div className="text-xs text-slate-500">Every truck that left has been counted.</div>}
          <div className="space-y-2">
            {unread.map((s: any) => {
              const late = receiptOverdue(state, s, now);
              return (
                <div key={s.id} id={`own-unread-${s.id}`} className={`rounded-lg border p-2.5 text-xs flex items-center justify-between gap-2 ${late ? 'border-rose-200 bg-rose-50/50' : 'border-slate-200'}`}>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">{s.truckNo} · {route(s)}</div>
                    <div className="text-slate-500">{loadName(s.id)} · left {when(s.sentAt, now)} · {late ? <span className="text-rose-700 font-bold">{duration(now - s.sentAt)} ago, later than {state.settings.receiptHours} hours</span> : `${duration(now - s.sentAt)} ago`}</div>
                  </div>
                  <a href={shareWhatsApp(`Reminder: please count ${loadName(s.id)} (truck ${s.truckNo}, ${route(s)}) and submit:\n${appLink(receiverPath(s))}`)} target="_blank" rel="noreferrer" className="shrink-0 px-2.5 py-1.5 rounded-md bg-emerald-600 text-white font-bold flex items-center"><MessageCircle className="w-3.5 h-3.5 mr-1" />Remind</a>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <JobworkPanel />

      <AccountantPanel />

      <Panel eyebrow="Last 36 hours" title="Recent trucks">
        <div className="grid sm:grid-cols-2 gap-2">
          {recent.map((s: any) => {
            const st = shipmentStatus(state, s);
            return (
              <div key={s.id} className="rounded-lg border border-slate-200 p-2.5 text-xs space-y-1">
                <div className="flex items-center justify-between gap-2"><span className="font-bold">{s.truckNo} <span className="font-normal text-slate-400">{loadName(s.id)}</span></span><StatusBadge status={st} /></div>
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
  const { state, dispatch } = useStore();
  const [fixing, setFixing] = useState(false);
  const [why, setWhy] = useState('');
  // a wrong count can be reopened only before anything was decided or sent to the accountant
  const canFix = diffsOf(state, s.id).every((d: any) => d.status === 'open')
    && state.drafts.filter((x: any) => x.shipmentId === s.id && x.purpose === 'receipt').every((x: any) => x.status === 'pending');
  const refWord = s.flow === 'outbound' ? 'Invoice' : s.flow === 'inbound' ? 'Bill' : 'Challan';
  return (
    <div className="bg-slate-50 px-3 py-2.5 flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-slate-200">
      <div className="text-xs space-y-0.5 min-w-0">
        <div className="font-bold text-slate-900 flex items-center gap-2"><Truck className="w-3.5 h-3.5 text-slate-500 shrink-0" />{route(s)}</div>
        <div className="text-slate-600">{FLOW_LABEL[s.flow]}{s.flow === 'transfer' ? (s.billing === 'invoice' ? ', with bill and GST' : ', no money') : ''} · {loadName(s.id)}</div>
        <div className="text-slate-500">Truck <b className="text-slate-700">{s.truckNo}</b> · {refWord} {s.ref}{s.driver ? <> · Driver {s.driver}</> : null}{s.driverPhone ? <> · <a href={`tel:${s.driverPhone}`} className="font-bold text-emerald-800">{s.driverPhone}</a></> : null}</div>
        {s.loading && <div className="text-slate-500">Loaded at {s.loading.point}, {time(s.loading.startAt)}–{time(s.loading.endAt)}</div>}
        <div className="text-slate-500">Counted by <b className="text-slate-700">{s.receipt.by}</b>, {when(s.receipt.at)}</div>
        {s.receipt.note && <div className="text-slate-700 italic">“{s.receipt.note}”</div>}
        <div className="pt-1"><Chain s={s} lang="en" /></div>
        {canFix && !fixing && <button id={`fix-count-${s.id}`} onClick={() => setFixing(true)} className="text-[11px] font-bold text-slate-600 underline cursor-pointer">Count looks wrong? Ask for a recount</button>}
        {fixing && (
          <div className="mt-1 p-2 rounded-lg border border-slate-300 bg-white space-y-1.5">
            <div className="font-semibold text-slate-800">Reopen the count. The receiver's link will work again for a fresh count.</div>
            <input id={`fix-why-${s.id}`} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why? e.g. typed 10 instead of 100" className="w-full p-1.5 rounded border border-slate-300" />
            <div className="flex gap-2">
              <button id={`fix-ok-${s.id}`} disabled={!why.trim()} onClick={() => { dispatch({ type: 'REOPEN_COUNT', id: s.id, note: why.trim(), actor: 'Owner' }); window.open(shareWhatsApp(`Please count ${loadName(s.id)} (truck ${s.truckNo}, ${route(s)}) again and submit. Reason: ${why.trim()}\n${appLink(receiverPath(s))}`), '_blank'); setFixing(false); }} className="px-2.5 py-1 rounded-md bg-slate-900 disabled:opacity-40 text-white font-bold cursor-pointer">Reopen and send link</button>
              <button onClick={() => setFixing(false)} className="px-2.5 py-1 rounded-md border border-slate-300 cursor-pointer">Keep</button>
            </div>
            {!why.trim() && <div className="text-[10px] text-slate-500">Write why first.</div>}
          </div>
        )}
        {((s.docs || []).length + (s.receipt.photos || []).length) > 0 && (
          <div className="pt-1.5"><PhotoStrip photos={[...(s.docs || []), ...(s.receipt.photos || []).map((p: any) => (typeof p === 'string' ? { id: p, name: p, kind: 'photo' } : p))]} /></div>
        )}
      </div>
      <a href={shareWhatsApp(truckSummary(state, s))} target="_blank" rel="noreferrer" className="self-start shrink-0 text-[11px] font-bold text-emerald-800 border border-emerald-200 bg-white px-2 py-1 rounded-md flex items-center"><MessageCircle className="w-3.5 h-3.5 mr-1" />Share on WhatsApp</a>
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
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${KIND_CLS[d.kind]}`}>{d.qty} {KIND_LABEL[d.kind].toUpperCase()}</span>
            <span className="font-bold text-slate-900">{it.name}</span>
            {d.status === 'investigating' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-violet-50 text-violet-800 border-violet-200">CHECKING</span>}
          </div>
          <div className="text-slate-500 mt-1">Sent {l.qty} · counted {r.counted}{r.damaged ? ` (${r.damaged} damaged)` : ''} {it.unit}</div>
        </div>
        <div className="text-right"><div className="text-sm font-bold text-slate-900">{inr(d.value, 0)}</div><div className="text-[10px] text-slate-400">{inr(it.rate, 0)} each</div></div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {OPTIONS[s.flow][d.kind].filter((o) => !(o === 'investigate' && d.status === 'investigating')).map((o) => (
          <button key={o} id={`opt-${d.id}-${o}`} onClick={() => { setChoice(choice === o ? null : o); setConfirm(false); }}
            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer transition-colors ${choice === o ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'}`}>{ACTIONS[o].label}</button>
        ))}
      </div>

      {a && (
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 space-y-2 text-xs">
          {a.due && <label className="flex items-center justify-between gap-2 font-semibold text-slate-700">By when?<input id={`due-${d.id}`} type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="p-1.5 rounded border border-slate-300 bg-white" /></label>}
          {a.draft && <div className="text-slate-600">Your accountant will get this in the next report{s.flow === 'transfer' && s.billing === 'invoice' ? (choice === 'write_off' ? ' (credit note to your other unit)' : ' (bill to your other unit)') : ''}.</div>}
          {!a.draft && !a.due && choice !== 'investigate' && <div className="text-slate-600">This closes it. Nothing for the accountant.</div>}
          {choice === 'investigate' && <div className="text-slate-600">Keeps it open while you check the CCTV and talk to the driver and sender. Add the CCTV video below.</div>}
          <input id={`note-${d.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note: who agreed, what was said (optional)" className="w-full p-2 rounded border border-slate-300 bg-white" />
          {big && (
            <label className="flex items-start gap-2 p-2 rounded bg-amber-50 border border-amber-200 text-amber-950 font-semibold cursor-pointer">
              <input id={`confirm-${d.id}`} type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 accent-amber-700" />
              <span>This loss of {inr0(d.value)} is more than your limit of {inr0(state.settings.writeOffLimit)}. I agree to take it.</span>
            </label>
          )}
          {!can && <div id={`why-${d.id}`} className="text-[11px] text-amber-900">{a.due && !(new Date(due).getTime() > Date.now()) ? 'Pick a date and time in the future.' : 'Tick the box above to confirm this loss.'}</div>}
          <button id={`decide-${d.id}`} disabled={!can} onClick={decide} className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold cursor-pointer">Confirm</button>
        </div>
      )}

      {!atGate(s.flow) && <a id={`ask-${d.id}`} href={shareWhatsApp(`Please explain this difference on ${loadName(s.id)} (truck ${s.truckNo}, ${route(s)}, ref ${s.ref}):\n${it.name}: sent ${l.qty}, counted ${r.counted}${r.damaged ? `, damaged ${r.damaged}` : ''} → ${KIND_LABEL[d.kind].toLowerCase()} ${d.qty} ${it.unit}.${s.loading ? `\nLoaded at ${s.loading.point}, ${time(s.loading.startAt)}–${time(s.loading.endAt)}.` : ''}`)} target="_blank" rel="noreferrer" className="inline-flex text-[11px] font-bold text-emerald-800 border border-emerald-200 bg-white px-2 py-1 rounded-md items-center mr-2"><HelpCircle className="w-3.5 h-3.5 mr-1" />Ask sender to explain</a>}
      <button onClick={() => setEvOpen(!evOpen)} className="text-[11px] font-bold text-slate-600 inline-flex items-center cursor-pointer">{evOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}Proof to share{d.evidence.clips.length ? ` · ${d.evidence.clips.length} video${d.evidence.clips.length > 1 ? 's' : ''}` : ''}{d.evidence.shares.length ? ` · shared ${d.evidence.shares.length}×` : ''}</button>
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
        <input id={`clip-${d.id}`} value={clip} onChange={(e) => setClip(e.target.value)} placeholder="CCTV video: file name or link" className="flex-1 min-w-0 p-2 rounded border border-slate-300" />
        <button id={`attach-${d.id}`} disabled={!clip.trim()} onClick={() => { const v = clip.trim(); dispatch({ type: 'ATTACH_CLIP', diffId: d.id, name: /^https?:/.test(v) ? '' : v, link: /^https?:/.test(v) ? v : '', actor: 'Owner' }); setClip(''); }} className="px-2.5 rounded-lg bg-slate-900 disabled:opacity-40 text-white font-bold flex items-center cursor-pointer"><Film className="w-3.5 h-3.5 mr-1" />Add</button>
      </div>
      <div className="flex gap-2">
        <input id={`share-to-${d.id}`} value={to} onChange={(e) => setTo(e.target.value)} placeholder="Share with whom? (transporter, supplier…)" className="flex-1 min-w-0 p-2 rounded border border-slate-300" />
        <button id={`share-${d.id}`} disabled={!to.trim()} onClick={share} className="px-2.5 rounded-lg bg-emerald-600 disabled:opacity-40 text-white font-bold flex items-center cursor-pointer"><Share2 className="w-3.5 h-3.5 mr-1" />Share</button>
      </div>
      {d.evidence.shares.length > 0 && <div className="text-[10px] text-slate-500"><ShieldCheck className="w-3 h-3 inline mr-0.5" />You shared it with {d.evidence.shares.map((x: any) => `${x.to} (${when(x.at)})`).join(', ')}</div>}
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
          <div className="text-slate-500 truncate">{d.qty} {item(d.item).unit} {item(d.item).name} · {route(s)}</div>
          {d.decision.note && <div className="text-slate-600 italic">“{d.decision.note}”</div>}
        </div>
        <div className={`text-right shrink-0 font-bold ${late ? 'text-rose-700' : 'text-slate-700'}`}>{late ? <AlertTriangle className="w-3.5 h-3.5 inline mr-0.5" /> : <Clock className="w-3.5 h-3.5 inline mr-0.5" />}{late ? 'late, was due' : 'due'} {when(d.decision.dueAt)}</div>
      </div>
      <button id={`settle-${d.id}`} onClick={() => dispatch({ type: 'SETTLE', diffId: d.id, note: 'Received / done', actor: 'Owner' })} className="w-full py-1.5 rounded-md border border-emerald-300 text-emerald-800 bg-white font-bold cursor-pointer hover:bg-emerald-50">It's done</button>
    </div>
  );
}

// Read-only page behind a shared evidence link: #/e/<diffId>/<token>
export function EvidenceView({ id, token }: { id: string; token: string }) {
  const { state } = useStore();
  const d = state.diffs.find((x: any) => x.id === id);
  if (!d || !d.evidenceToken || d.evidenceToken !== token) return <div className="max-w-md mx-auto"><Note tone="stop">This link is not valid. Ask the sender for a new one.</Note></div>;
  return (
    <div className="max-w-md mx-auto space-y-3">
      <PageHeader title="Proof" sub="Shared by the owner" />
      <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800 bg-white border border-slate-200 rounded-xl p-4 leading-relaxed">{evidenceText(state, d)}</pre>
      {d.evidence.clips.map((c: any, i: number) => (
        <div key={i} className="text-xs bg-white border border-slate-200 rounded-lg p-2.5 flex items-center gap-2"><Film className="w-4 h-4 text-slate-500" />{c.link ? <a href={c.link} target="_blank" rel="noreferrer" className="text-emerald-800 underline break-all"><Link2 className="w-3 h-3 inline" /> {c.link}</a> : c.name}</div>
      ))}
    </div>
  );
}

// The accountant does not log in. The owner sends a pack: a printable report and one Tally file,
// in import order. The owner's decision is the approval; until it is sent, a decision can be undone.
function AccountantPanel() {
  const { state, dispatch } = useStore();
  const ready = state.drafts.filter((d: any) => d.status === 'pending').sort(importOrder);
  const packs = [...(state.packs || [])].reverse();
  const [showAll, setShowAll] = useState(false);
  const [undoing, setUndoing] = useState<string | null>(null);
  const now = Date.now();
  const stamp = tallyDate(now);
  // your own decisions first (they can still be undone); the report and Tally file keep import order
  const listed = [...ready.filter((d: any) => d.diffId).sort((a: any, b: any) => b.createdAt - a.createdAt), ...ready.filter((d: any) => !d.diffId)];
  const shown = showAll ? listed : listed.slice(0, 5);
  const packDrafts = (p: any) => p.ids.map((id: string) => state.drafts.find((d: any) => d.id === id)).filter(Boolean).sort(importOrder);
  return (
    <Panel eyebrow="For your accountant" title={ready.length ? `${ready.length} item${ready.length === 1 ? '' : 's'} ready to send` : 'Nothing new for your accountant'} right={ready.length > 0 && (
      <button id="btn-send-accountant" onClick={() => dispatch({ type: 'SEND_TO_ACCOUNTANT', ids: ready.map((d: any) => d.id), actor: 'Owner' })} className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-bold flex items-center cursor-pointer"><Send className="w-3.5 h-3.5 mr-1" />Mark as sent</button>)}>
      {ready.length > 0 && (
        <>
          <div className="text-xs text-slate-600">Made from the counts and your decisions. Send your accountant the report (to print) or the Tally file, then tap “Mark as sent”.</div>
          <div className="flex flex-wrap gap-2">
            <button id="btn-print-report" onClick={() => printReport(reportHtml(state, ready, `Not yet sent · ${dateTime(now)}`))} className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold flex items-center cursor-pointer"><Printer className="w-3.5 h-3.5 mr-1.5" />Report to print</button>
            <button id="btn-tally-file" onClick={() => download(`loadmatch-tally-${stamp}.xml`, batchXml(ready))} className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold flex items-center cursor-pointer"><FileCode className="w-3.5 h-3.5 mr-1.5" />Tally file</button>
            <a id="btn-wa-accountant" href={shareWhatsApp(packSummary(state, ready, now))} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center"><MessageCircle className="w-3.5 h-3.5 mr-1.5" />WhatsApp summary</a>
          </div>
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
            {shown.map((d: any) => {
              const amt = entryAmount(d);
              return (
                <div key={d.id} id={`entry-${d.id}`} className="p-2.5 text-xs flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900">{DRAFT_PLAIN[d.type]} <span className="font-normal text-slate-400">· {loadName(d.shipmentId)}</span></div>
                    <div className="text-slate-600">{d.narration.replace(/^TRK-\d+( \([^)]*\))?(, truck [^:]+)?: ?/, '')}</div>
                    <div className="text-[10px] text-slate-400">In Tally: {DRAFT_LABEL[d.type]}</div>
                    {undoing === d.id && <div className="mt-1 flex gap-2"><span className="text-slate-700">Undo your decision and decide again?</span><button id={`undo-ok-${d.id}`} onClick={() => { dispatch({ type: 'REJECT_DRAFT', id: d.id, note: 'Owner corrected the decision', actor: 'Owner' }); setUndoing(null); }} className="font-bold text-rose-700 cursor-pointer">Undo</button><button onClick={() => setUndoing(null)} className="text-slate-500 cursor-pointer">Keep</button></div>}
                  </div>
                  <div className="text-right shrink-0">
                    {amt != null && <div className="font-bold text-slate-900">{inr(amt)}</div>}
                    {d.diffId && undoing !== d.id && <button id={`undo-${d.id}`} onClick={() => setUndoing(d.id)} className="text-[11px] font-bold text-slate-500 inline-flex items-center cursor-pointer"><Undo2 className="w-3 h-3 mr-0.5" />Undo</button>}
                  </div>
                </div>
              );
            })}
          </div>
          {ready.length > 5 && <button onClick={() => setShowAll(!showAll)} className="text-[11px] font-bold text-slate-600 cursor-pointer">{showAll ? 'Show fewer' : `Show all ${ready.length}`}</button>}
        </>
      )}
      {packs.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Sent</div>
          {packs.slice(0, 4).map((p: any) => (
            <div key={p.id} id={`pack-${p.id}`} className="flex items-center justify-between gap-2 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5">
              <span className="text-slate-700">{dateTime(p.at)} · {p.ids.length} item{p.ids.length === 1 ? '' : 's'}</span>
              <span className="flex gap-3">
                <button onClick={() => printReport(reportHtml(state, packDrafts(p), `Sent ${dateTime(p.at)}`))} className="font-bold text-slate-600 cursor-pointer inline-flex items-center"><Printer className="w-3.5 h-3.5 mr-0.5" />Report</button>
                <button onClick={() => download(`loadmatch-tally-${tallyDate(p.at)}-${p.id}.xml`, batchXml(packDrafts(p)))} className="font-bold text-slate-600 cursor-pointer inline-flex items-center"><FileCode className="w-3.5 h-3.5 mr-0.5" />Tally</button>
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// Goods with other companies for processing. Inputs must come back within a year of being sent,
// or GST treats them as supplied; the warning starts 30 days before.
function JobworkPanel() {
  const { state } = useStore();
  const open = jobworkOpen(state).sort((a: any, b: any) => jobworkDueAt(a) - jobworkDueAt(b));
  if (!open.length) return null;
  const now = Date.now();
  return (
    <Panel eyebrow="Job work" title={`Your goods with job workers · ${open.length} load${open.length > 1 ? 's' : ''}`}>
      <div className="space-y-2">
        {open.map((s: any) => {
          const bal = jobworkBalance(state, s).filter((b: any) => b.pending > 0);
          const days = Math.ceil((jobworkDueAt(s) - now) / 86400000);
          const tone = days < 0 ? 'border-rose-300 bg-rose-50/60' : days <= 30 ? 'border-amber-300 bg-amber-50/60' : 'border-slate-200';
          const msg = `Reminder from Kaveri Wood Products: please return the goods sent for job work on ${loadName(s.id)} (challan ${s.ref}, ${dateTime(s.sentAt)}):\n${bal.map((b: any) => `• ${b.pending} ${item(b.item).unit} ${item(b.item).name}`).join('\n')}`;
          return (
            <div key={s.id} id={`jw-${s.id}`} className={`rounded-lg border p-2.5 text-xs space-y-1 ${tone}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-slate-900">{party(s.party).name} <span className="font-normal text-slate-400">· {loadName(s.id)}</span></div>
                  <div className="text-slate-500">Sent {dateTime(s.sentAt)} on challan {s.ref}</div>
                </div>
                <div className={`text-right shrink-0 font-bold ${days < 0 ? 'text-rose-700' : days <= 30 ? 'text-amber-800' : 'text-slate-700'}`}>{days < 0 ? `${-days} days past one year` : `${days} days left`}</div>
              </div>
              {bal.map((b: any) => <div key={b.item} className="text-slate-700">Still with them: <b>{b.pending}</b> {item(b.item).unit} {item(b.item).name} <span className="text-slate-400">(sent {b.sent}, back {b.returned}{b.lost ? `, written off ${b.lost}` : ''})</span></div>)}
              {days <= 30 && <div className="text-[11px] text-slate-600">{days < 0 ? 'Goods not back within a year are treated as sold for GST, from the day they were sent. Talk to your accountant.' : 'Under GST these must come back within a year of sending. Get them back before then, or ask your accountant.'}</div>}
              <a href={shareWhatsApp(msg)} target="_blank" rel="noreferrer" className="inline-flex text-[11px] font-bold text-emerald-800 border border-emerald-200 bg-white px-2 py-1 rounded-md items-center"><MessageCircle className="w-3.5 h-3.5 mr-1" />Remind job worker</a>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
