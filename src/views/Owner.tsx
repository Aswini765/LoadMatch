import React, { useState } from 'react';
import { MessageCircle, Film, Share2, CheckCircle2, Clock, AlertTriangle, Truck, ChevronDown, ChevronRight, ShieldCheck, Link2, HelpCircle, Printer, FileCode, Send, Undo2 } from 'lucide-react';
import { OwnerAnswered, KIND_TEXT, FIELD } from './Requests.tsx';
import { useStore, item, party, route, atGate, jobworkOpen, jobworkBalance, jobworkDueAt, shipmentOf, diffsOf, lineOf, shipmentStatus, receiptOverdue, diffOverdue, receiverPath, evidencePath, evidenceText, truckSummary, importOrder, ACTIONS, OPTIONS, optionsFor, countedByUs, KIND_LABEL, FLOW_LABEL, DRAFT_LABEL, DRAFT_PLAIN, loadName, REPLIES, senderName, senderIsUs, suggestFor, cameLater } from '../store.tsx';
import { reportHtml, printReport, packSummary, entryAmount, entryLines } from '../lib/report.ts';
import { batchXml, download } from '../lib/tally.ts';
import { tallyDate } from '../lib/format.ts';
import { Chain } from './Dispatch.tsx';
import { PageHeader, Panel, StatusBadge, Note, PhotoStrip, shareWhatsApp, appLink, newToken, type Go } from './ui.tsx';
import { inr, inr0, inrL, when, duration, dateTime, time } from '../lib/format.ts';
import { COMPANY } from '../data/seed.ts';
import { DateChips, dayFrom, dayLabel } from './sim.tsx';

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
  const [allRecent, setAllRecent] = useState(false);
  const [more, setMore] = useState(false);
  const recent = state.shipments.filter((s: any) => s.receipt && now - s.receipt.at < 36 * 3600000).sort((a: any, b: any) => b.receipt.at - a.receipt.at);
  const byTruck = [...new Set(open.map((d: any) => d.shipmentId))].map((id) => shipmentOf(state, id as string)).sort((a: any, b: any) => (b.receipt?.at || 0) - (a.receipt?.at || 0));
  const openValue = open.reduce((a: number, d: any) => a + d.value, 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader title="Owner" sub="You see only what is missing, damaged or extra, and what staff ask you." />

      <Inbox go={go} initialId={initialId} />

      <button id="btn-expect-supplier" onClick={() => go('dispatch', { id: 'new:inbound' })} className="w-full py-3 rounded-xl border-2 border-dashed border-sky-300 bg-sky-50 text-sm font-bold text-sky-900 cursor-pointer">🚛 + Add expected supplier delivery</button>
      <button id="btn-owner-more" onClick={() => setMore(!more)} className="w-full py-3 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-700 cursor-pointer">{more ? '▲ Less' : '▼ More: today, trucks on the road, accountant, recent trucks'}</button>
      {more && <>
      <TodaySummary />
      <OwnerAnswered />
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
                  <a href={shareWhatsApp(`Reminder: please count ${loadName(s.id)} (truck ${s.truckNo}, ${route(s)}) and submit:\n${appLink(receiverPath(s, state.settings))}`)} target="_blank" rel="noreferrer" className="shrink-0 px-2.5 py-1.5 rounded-md bg-emerald-600 text-white font-bold flex items-center"><MessageCircle className="w-3.5 h-3.5 mr-1" />Remind</a>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>


      <Panel eyebrow="Accountant" title={`${state.drafts.filter((d: any) => d.status === 'pending').length} items waiting for the accountant`}><div className="text-xs text-slate-600">Debit notes, credit notes and bills from your decisions go to the <b>Accountant</b> screen as a to-do list, with the report and the Tally file.</div></Panel>

      <Panel eyebrow="Last 36 hours" title="Recent trucks" right={recent.length > 3 && <button id="btn-recent-all" onClick={() => setAllRecent(!allRecent)} className="text-[11px] font-bold text-slate-600 underline cursor-pointer">{allRecent ? 'Show less' : `Show all ${recent.length}`}</button>}>
        <div className="grid sm:grid-cols-2 gap-2">
          {(allRecent ? recent : recent.slice(0, 3)).map((s: any) => {
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
      </>}
    </div>
  );
}

function Stat({ n, label, cls }: { n: number; label: string; cls: string }) {
  return <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-center shadow-2xs"><div className={`text-lg font-bold leading-none ${n ? cls : 'text-slate-400'}`}>{n}</div><div className="text-[10px] text-slate-500 mt-0.5">{label}</div></div>;
}

// One list, newest first. Each truck is ONE card with ONE suggested next step; everything else is one tap away.
const qtyText = (list: any[]) => [['short', 'missing'], ['damaged', 'damaged'], ['excess', 'extra']].map(([k, w]) => { const n = list.filter((d: any) => d.kind === k).reduce((a: number, d: any) => a + d.qty, 0); return n ? `${n} ${w}` : ''; }).filter(Boolean).join(', ');
const shortItem = (code: string) => item(code)?.name.split(',')[0] || code;
const ico = (code: string) => (/^PLY/.test(code) ? '🟫' : /^BOX/.test(code) ? '📦' : /^LOG/.test(code) ? '🪵' : '📜');
const dueText = (ms: number) => new Date(ms).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const REMIND_H = 2;

function Inbox({ go, initialId }: { go: Go; initialId?: string | null }) {
  const { state, dispatch } = useStore();
  const now = Date.now();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [showInfo, setShowInfo] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const rows: any[] = [];
  const info: any[] = [];
  for (const s of state.shipments) {
    if (s.cancelledAt) continue;
    const ds = diffsOf(state, s.id);
    const openDs = ds.filter((d: any) => d.status === 'open' || d.status === 'investigating');
    if (s.receipt && openDs.length) rows.push({ kind: 'truck', at: s.ask?.reply?.at || s.receipt.at, s, openDs });
    else if (s.receipt && now - s.receipt.at < 24 * 3600000 && !ds.length) info.push({ at: s.receipt.at, icon: '✅', title: `${loadName(s.id)} · all matched`, sub: `${route(s)} · counted by ${s.receipt.by}` });
    for (const d of ds) {
      if (d.status === 'waiting') rows.push({ kind: 'promise', at: diffOverdue(d, now) ? d.decision.dueAt : d.decision.at, s, d });
      else if (d.status === 'settled' && d.settledAt && now - d.settledAt < 24 * 3600000) {
        const toAcc = state.drafts.some((x: any) => x.diffId === d.id);
        info.push({ at: d.settledAt, icon: '✅', title: `${loadName(s.id)} · ${qtyText([d])}: decided`, sub: `${d.decision ? ACTIONS[d.decision.action].label : 'Done'}${toAcc ? ' · sent to the accountant' : ''}` });
      }
    }
    // our other unit sees a truck as soon as it leaves; the owner is only told
    if (s.flow === 'transfer' && s.sentAt && !s.receipt && !s.returning) info.push({ at: s.arrivedAt || s.sentAt, icon: s.arrivedAt ? '📍' : '🚚', title: s.arrivedAt ? `${loadName(s.id)} reached ${route(s).split(' → ')[1]}` : `${loadName(s.id)} left ${route(s).split(' → ')[0]} for ${route(s).split(' → ')[1]}`, sub: s.arrivedAt ? `Being counted · truck ${s.truckNo}` : `${route(s).split(' → ')[1]} sees it in the app · truck ${s.truckNo}` });
    // a customer is outside the app: the owner sends them the count link
    if (s.flow === 'outbound' && s.sentAt && !s.receipt && !s.linkSentAt) rows.push({ kind: 'link', at: s.sentAt, s });
    if (s.flow === 'outbound' && s.sentAt && !s.receipt && s.linkSentAt) info.push({ at: s.linkSentAt, icon: '💬', title: `${loadName(s.id)} · link sent to ${party(s.party).name}`, sub: `Waiting for their count · truck ${s.truckNo}` });
  }
  for (const r of state.requests || []) if (r.status === 'pending') rows.push({ kind: 'req', at: r.at, r });
  rows.sort((a, b) => b.at - a.at);
  info.sort((a, b) => b.at - a.at);
  const btn = 'shrink-0 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer';
  const shown = showAll ? rows : rows.slice(0, 3);
  return (
    <div id="latest-from-staff" className="space-y-2">
      <div className="flex items-baseline justify-between">
        <div className="text-lg font-bold text-slate-950">{rows.length ? `${rows.length} need${rows.length === 1 ? 's' : ''} you` : 'All clear ✓'}</div>
        <div className="text-xs text-slate-500">Newest first</div>
      </div>
      {shown.map((x) => {
        if (x.kind === 'truck') return <TruckCard key={x.s.id} s={x.s} ds={x.openDs} startOpen={Boolean(initialId && (initialId === x.s.id || x.openDs.some((d: any) => d.id === initialId)))} />;
        if (x.kind === 'promise') return <PromiseCard key={x.d.id} d={x.d} s={x.s} />;
        if (x.kind === 'link') return (
          <div key={x.s.id} id={`row-link-${x.s.id}`} className="bg-white border border-slate-200 border-l-4 border-l-violet-500 rounded-xl p-3 flex items-center gap-3">
            <span className="text-2xl">🚚</span>
            <div className="flex-1 min-w-0"><div className="text-sm font-bold text-slate-900">{loadName(x.s.id)} left for {party(x.s.party).name}</div><div className="text-xs text-slate-500">They are not in the app: send them the count link · {when(x.at, now)}</div></div>
            <a id={`send-link-${x.s.id}`} href={shareWhatsApp(`${COMPANY.name}: ${loadName(x.s.id)} is on the way (truck ${x.s.truckNo}). When it reaches you, open this link, tap Truck arrived and count:\n${appLink(receiverPath(x.s, state.settings))}`)} target="_blank" rel="noreferrer" onClick={() => dispatch({ type: 'LINK_SENT', id: x.s.id, actor: 'Owner' })} className={`${btn} bg-emerald-600 text-white`}>💬 Send to receiver</a>
          </div>
        );
        const r = x.r;
        const who = String(r.by).replace(' (staff)', '');
        const ch = Object.entries(r.details || {}).filter(([, v]) => String(v || '').trim()).map(([k, v]) => `${FIELD[k] || k} ${v}`).join(', ');
        const title = r.kind === 'add' ? (r.what === 'delivery' ? `${who}: a truck not in the list came · “${r.name}”` : `${who}: please add “${r.name}”`) : `${who}: ${KIND_TEXT[r.kind]} · ${loadName(r.shipmentId)}${r.kind === 'accident' ? (r.outcome === 'moved' ? ' · goods moved to another truck' : ' · goods coming back') : ''}${ch ? ` · ${ch}` : ''}`;
        return (
          <div key={r.id} id={`req-${r.id}`} className={`bg-white border border-slate-200 border-l-4 ${r.kind === 'accident' ? 'border-l-rose-500' : 'border-l-sky-500'} rounded-xl p-3 space-y-2`}>
            <div className="flex items-center gap-3"><span className="text-2xl">{r.kind === 'accident' ? '🚨' : '🙋'}</span><div className="flex-1 min-w-0"><div className="text-sm font-bold text-slate-900">{title}</div><div className="text-xs text-slate-500">{r.note ? `“${r.note}” · ` : ''}{when(r.at, now)}</div></div></div>
            <div className="flex gap-2 items-center">
              <input value={notes[r.id] || ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} placeholder="Note to staff (optional)" className="flex-1 min-w-0 p-2 rounded-lg border border-slate-300 text-xs" />
              {r.kind === 'add' && r.what === 'delivery' ? <>
                <button id={`req-no-${r.id}`} onClick={() => dispatch({ type: 'DECIDE_REQUEST', reqId: r.id, approve: false, note: notes[r.id] || 'Do not unload. Not ordered.', actor: 'Owner' })} className={`${btn} border border-slate-300 bg-white`}>Not ours</button>
                <button id={`req-add-delivery-${r.id}`} onClick={() => { dispatch({ type: 'DECIDE_REQUEST', reqId: r.id, approve: true, note: 'Added; please count it.', actor: 'Owner' }); go('dispatch', { id: 'new:inbound' }); }} className={`${btn} bg-emerald-600 text-white`}>+ Add delivery</button>
              </> : <>
                <button id={`req-no-${r.id}`} onClick={() => dispatch({ type: 'DECIDE_REQUEST', reqId: r.id, approve: false, note: notes[r.id] || '', actor: 'Owner' })} className={`${btn} border border-slate-300 bg-white`}>No</button>
                <button id={`req-yes-${r.id}`} onClick={() => dispatch({ type: 'DECIDE_REQUEST', reqId: r.id, approve: true, note: notes[r.id] || '', token: newToken(), actor: 'Owner' })} className={`${btn} bg-emerald-600 text-white`}>Yes</button>
              </>}
            </div>
          </div>
        );
      })}
      {rows.length > 3 && <button id="btn-show-all" onClick={() => setShowAll(!showAll)} className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 cursor-pointer">{showAll ? '▲ Show only 3' : `▼ Show ${rows.length - 3} more`}</button>}
      {!rows.length && <Note tone="go">Nothing needs you right now.</Note>}
      {info.length > 0 && <button id="btn-info" onClick={() => setShowInfo(!showInfo)} className="w-full text-left text-xs font-bold text-slate-500 py-1 cursor-pointer">{showInfo ? '▲' : '▼'} Also today, nothing to do · {info.length}</button>}
      {showInfo && <div id="info-list" className="space-y-1">{info.map((x, i) => <div key={i} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs flex items-center gap-2"><span className="text-base">{x.icon}</span><span className="flex-1 min-w-0"><b className="text-slate-800">{x.title}</b><span className="block text-slate-500 truncate">{x.sub} · {when(x.at, now)}</span></span></div>)}</div>}
    </div>
  );
}

// Plain words for each choice: what happens and who pays
const PLAIN: Record<string, string> = {
  unit_sends_rest: '📦 Our unit sends it in the next truck',
  replace: '📦 Supplier sends it in the next truck',
  send_rest: '📦 We send it in the next truck',
  send_replacement: '📦 We send a good one in the next truck',
  claim: '🚚 Transporter pays (claim)',
  debit_note: '🧾 Supplier pays (debit note)',
  credit_note: '🧾 Customer pays less (credit note)',
  write_off: '❌ We take the loss',
};
const plain = (a: string) => PLAIN[a] || ACTIONS[a].label;

// One truck with a difference: what happened, the one next step, and a short list of other choices.
function TruckCard({ s, ds, startOpen }: { s: any; ds: any[]; startOpen?: boolean }) {
  const { dispatch } = useStore();
  const now = Date.now();
  const [more, setMore] = useState(Boolean(startOpen));
  const [pick, setPick] = useState<{ kind: string; action: string } | null>(null);
  const [due, setDue] = useState<number | null>(null);
  const value = ds.reduce((a: number, d: any) => a + d.value, 0);
  const sender = senderName(s);
  const sugg = ds.map((d: any) => [d, suggestFor(s, d)] as [any, string | null]);
  const ready = sugg.filter(([, a]) => a);
  const needsReply = ds.some((d: any) => d.kind !== 'excess' && d.cause !== 'accident');
  const reply = s.ask?.reply;
  const checking = ds.every((d: any) => d.status === 'investigating');
  // the date comes from the sender's answer; otherwise two days
  const replyDue = reply?.dueAt && reply.dueAt > now ? reply.dueAt : dayFrom(2);
  const decide = (d: any, a: string, dueAt: number) => dispatch({ type: 'DECIDE', diffId: d.id, action: a, dueAt: ACTIONS[a].due ? dueAt : undefined, confirm: true, note: reply ? `${sender}: ${REPLIES[reply.kind].label}` : '', actor: 'Owner' });
  const apply = () => ready.forEach(([d, a]) => decide(d, a!, a === 'claim' ? dayFrom(7) : replyDue));
  const acts = [...new Set(ready.map(([, a]) => a))];
  const dueOf = (a: string) => (a === 'claim' ? dayFrom(7) : replyDue);
  const label = acts.length === 1 ? `${plain(acts[0]!)}${ACTIONS[acts[0]!].due ? ` · by ${dayLabel(dueOf(acts[0]!))}` : ''}` : `Do these ${ready.length} steps`;
  const askToken = s.token;
  const ask = () => dispatch({ type: 'ASK_SENDER', id: s.id, token: askToken, actor: 'Owner' });
  const askMsg = `${COMPANY.name}: we counted ${loadName(s.id)} (your bill ${s.ref}, truck ${s.truckNo}): ${qtyText(ds)}. Owner to owner, what happened? Tap one answer:\n${appLink(`#/a/${s.id}/${askToken}`)}`;
  const reminded = s.ask && !reply && now - s.ask.at > REMIND_H * 3600000;
  const byText = reply ? (reply.by.includes(sender) ? reply.by : `${reply.by} (${sender})`) : '';
  // other choices, per kind of difference (missing / damaged / extra), applied to every item of that kind
  const kinds = [...new Set(ds.map((d: any) => d.kind))];
  const choices = (k: string) => [...new Set(ds.filter((d: any) => d.kind === k).flatMap((d: any) => optionsFor(s, d)))].filter((a) => a !== 'investigate' && ds.filter((d: any) => d.kind === k).every((d: any) => optionsFor(s, d).includes(a)));
  const doPick = () => { if (!pick) return; ds.filter((d: any) => d.kind === pick.kind).forEach((d: any) => decide(d, pick.action, due || dayFrom(2))); setPick(null); };
  const b = 'w-full min-h-[44px] rounded-xl text-sm font-bold cursor-pointer flex items-center justify-center px-3';
  return (
    <div id={`own-truck-${s.id}`} className={`bg-white border border-slate-200 border-l-4 ${checking ? 'border-l-violet-500' : 'border-l-amber-500'} rounded-xl overflow-hidden`}>
      <div className="p-3 space-y-2.5">
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none">{checking ? '🔍' : '⚠️'}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-slate-900">{loadName(s.id)} · {qtyText(ds)} <span className="text-rose-700">· {inrL(value)}</span></div>
            <div className="text-xs text-slate-500">{route(s)} · counted by {s.receipt.by} · {when(s.receipt.at, now)}</div>
            <div className="text-xs text-slate-700 mt-1">{[...new Set(ds.map((d: any) => d.item))].map((it: any) => `${ico(it)} ${shortItem(it)}: ${qtyText(ds.filter((d: any) => d.item === it))}`).join(' · ')}</div>
          </div>
        </div>

        {s.ask && !reply && <div id={`asked-${s.id}`} className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700">⏳ Asked {sender} {when(s.ask.at, now)}.<span className="block">🤖 {reminded ? `Assistant reminded ${sender} at ${time(s.ask.at + REMIND_H * 3600000)}. Still no reply.` : `Assistant reminds ${sender} if there is no reply in ${REMIND_H} hours.`}</span></div>}
        {reply && <div id={`reply-${s.id}`} className="rounded-lg bg-sky-50 border border-sky-200 px-3 py-2 text-xs text-sky-950">💬 <b>{byText}</b>, {when(reply.at, now)}: “{REPLIES[reply.kind].label}{reply.dueAt ? `, by ${dayLabel(reply.dueAt)}` : ''}”</div>}
        {reply && !ready.length && <div className="text-xs text-slate-600">🤖 They say they sent it all. Compare their loading photo with your stack photo, then choose below.</div>}

        {ready.length > 0 && (!needsReply || reply) ? (
          <div className="space-y-1.5">
            {acts.length > 1 && <ul id={`steps-${s.id}`} className="text-xs text-slate-700 space-y-0.5">{ready.map(([d, a]) => <li key={d.id}>• {d.qty} {KIND_LABEL[d.kind].toLowerCase()}: {plain(a!)}{ACTIONS[a!].due ? ` · by ${dayLabel(dueOf(a!))}` : ''}</li>)}</ul>}
            <button id={`apply-${s.id}`} onClick={apply} className={`${b} bg-emerald-600 text-white`}>✓ {label}</button>
          </div>
        ) : needsReply && !s.ask ? (
          senderIsUs(s)
            ? <button id={`ask-${s.id}`} onClick={ask} className={`${b} bg-slate-900 text-white`}>❓ Ask {sender}</button>
            : <a id={`ask-${s.id}`} href={shareWhatsApp(askMsg)} target="_blank" rel="noreferrer" onClick={ask} className={`${b} bg-emerald-600 text-white`}>💬 Ask the owner of {sender} on WhatsApp</a>
        ) : null}
        {needsReply && !s.ask && <div className="text-[11px] text-slate-500 -mt-1">{senderIsUs(s) ? `${sender} sees the question in their app and answers with one tap.` : `Only their owner can open it (code to the owner's phone).`}</div>}

        <button id={`more-opts-${s.id}`} onClick={() => { setMore(!more); setPick(null); }} className="text-xs font-bold text-slate-500 underline cursor-pointer">{more ? '▲ Close' : '▼ Other options'}</button>
        {more && <div id={`opts-${s.id}`} className="space-y-2.5 border-t border-slate-100 pt-2">
          {kinds.map((k) => (
            <div key={k} className="space-y-1.5">
              <div className="text-xs font-bold text-slate-700">For the {qtyText(ds.filter((d: any) => d.kind === k))}:</div>
              {choices(k).map((a) => {
                const loss = ACTIONS[a].loss ? ` · ${inrL(ds.filter((d: any) => d.kind === k).reduce((x: number, d: any) => x + d.value, 0))}` : '';
                const on = pick?.kind === k && pick.action === a;
                return <button key={a} id={`opt-${s.id}-${k}-${a}`} onClick={() => { setPick(on ? null : { kind: k, action: a }); setDue(null); }} className={`w-full text-left rounded-lg border-2 px-3 py-2 text-xs font-bold cursor-pointer ${on ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white'}`}>{plain(a)}{loss}</button>;
              })}
            </div>
          ))}
          {pick && (ACTIONS[pick.action].due
            ? <div className="space-y-2"><div className="text-xs font-bold text-slate-700">By when?</div><DateChips id={`odue-${s.id}`} value={due} onPick={setDue} /><button id={`opt-ok-${s.id}`} disabled={!due} onClick={doPick} className={`${b} bg-emerald-600 text-white disabled:opacity-40`}>✓ {plain(pick.action)}</button></div>
            : <button id={`opt-ok-${s.id}`} onClick={doPick} className={`${b} ${ACTIONS[pick.action].loss ? 'bg-rose-600' : 'bg-emerald-600'} text-white`}>✓ {plain(pick.action)}</button>)}
          <div className="text-[11px] text-slate-500">Truck {s.truckNo}{s.driver ? ` · driver ${s.driver}${s.driverPhone ? ` (${s.driverPhone})` : ''}` : ''}{(s.receipt.photos || []).length ? ` · photos: ${(s.receipt.photos || []).join(', ')}` : ''}</div>
        </div>}
      </div>
    </div>
  );
}

// A promise (the rest comes in the next truck, the transporter pays…). The sender marks the truck that carries it;
// when that truck is counted the owner accepts it and the accountant notes it on the first bill.
function PromiseCard({ d, s }: { d: any; s: any }) {
  const { state, dispatch } = useStore();
  const now = Date.now();
  const late = diffOverdue(d, now);
  const carrying = state.shipments.find((x: any) => !x.cancelledAt && (x.fulfils || []).includes(d.id) && !x.receipt);
  const guess = !d.came && !carrying ? cameLater(state, d) : null;
  const sender = s.flow === 'outbound' ? route(s).split(' → ')[0] : senderName(s);
  const delivers = ['unit_sends_rest', 'replace', 'send_rest', 'send_replacement'].includes(d.decision.action);
  const btn = 'px-3 py-2 rounded-lg text-xs font-bold cursor-pointer';
  const icon = d.came ? '📦' : carrying ? '🚚' : late ? '⏰' : '⏳';
  return (
    <div id={`promise-${d.id}`} className={`bg-white border border-slate-200 border-l-4 ${d.came ? 'border-l-emerald-500' : late ? 'border-l-rose-500' : 'border-l-slate-400'} rounded-xl p-3 space-y-2`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-900">{loadName(s.id)} · {d.qty} {shortItem(d.item)} {KIND_LABEL[d.kind].toLowerCase()} · {plain(d.decision.action).replace(/^\S+ /, '').toLowerCase()}</div>
          <div className="text-xs text-slate-500">{late && !d.came ? `Late: was due ${dayLabel(d.decision.dueAt)}` : `Due ${dayLabel(d.decision.dueAt)}`} · {route(s)}</div>
        </div>
      </div>
      <div id={`agent-${d.id}`} className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700">{d.came
        ? `📦 ${sender} sent the ${d.qty} in ${loadName(d.came.load)}. ${d.came.by} counted them: all there, ${when(d.came.at, now)}. Accept, and the accountant notes it on the first bill.`
        : carrying ? `🚚 ${sender} marked ${loadName(carrying.id)} as carrying these ${d.qty}. ${carrying.sentAt ? 'On the way.' : 'Being loaded.'}`
        : guess ? `🤖 ${loadName(guess.id)} from ${sender} had ${shortItem(d.item)}, but they did not mark it as these ${d.qty}. Is it?`
        : late ? `🤖 Due ${dayLabel(d.decision.dueAt)} and nothing came. Assistant reminded ${sender} on WhatsApp at ${time(d.decision.dueAt)}.`
        : delivers ? `🤖 ${sender} marks the truck that carries it. Assistant reminds them on ${dayLabel(d.decision.dueAt)} if nothing comes.`
        : `🤖 Assistant reminds you on ${dayLabel(d.decision.dueAt)}.`}</div>
      {(d.came || guess) && <div className="flex gap-2">
        <button id={`settle-${d.id}`} onClick={() => dispatch({ type: 'SETTLE', diffId: d.id, note: `Came in ${loadName((d.came?.load) || guess.id)}`, actor: 'Owner' })} className={`${btn} bg-emerald-600 text-white`}>✓ Accept: it came</button>
        {guess && <button id={`broken-${d.id}`} onClick={() => dispatch({ type: 'PROMISE_BROKEN', diffId: d.id, actor: 'Owner' })} className={`${btn} border border-slate-300 bg-white`}>No</button>}
      </div>}
      {!d.came && !guess && !carrying && (late || !delivers) && <div className="flex gap-2">
        {!delivers && <button id={`settle-${d.id}`} onClick={() => dispatch({ type: 'SETTLE', diffId: d.id, note: 'Done', actor: 'Owner' })} className={`${btn} bg-emerald-600 text-white`}>✓ Done</button>}
        {late && <button id={`broken-${d.id}`} onClick={() => dispatch({ type: 'PROMISE_BROKEN', diffId: d.id, actor: 'Owner' })} className={`${btn} border border-slate-300 bg-white`}>Did not come: choose again</button>}
      </div>}
    </div>
  );
}

// Newest things staff did, at the very top: counts submitted (matched or not) and requests
function LatestFromStaff() {
  const { state, dispatch } = useStore();
  const now = Date.now();
  const items: { at: number; icon: string; text: string; tone: string; target: string; link?: any }[] = [];
  for (const s of state.shipments) {
    if (!s.receipt || now - s.receipt.at > 24 * 3600000) continue;
    const n = diffsOf(state, s.id).filter((d: any) => d.status === 'open' || d.status === 'investigating').length;
    const bad = diffsOf(state, s.id).length > 0;
    items.push({ at: s.receipt.at, icon: bad ? '⚠️' : '✅', text: `${s.receipt.by} counted ${loadName(s.id)} (${route(s)}): ${bad ? (n ? 'does not match. Decide below.' : 'does not match. Decided.') : 'all matched.'}`, tone: bad && n ? 'border-amber-300 bg-amber-50' : 'border-emerald-200 bg-emerald-50', target: n ? `own-truck-${s.id}` : '' });
  }
  for (const s of state.shipments) {
    if (s.flow !== 'outbound' || !s.sentAt || s.receipt || s.cancelledAt || s.linkSentAt) continue;
    items.push({ at: s.sentAt, icon: '🚚', text: `${loadName(s.id)} left for ${party(s.party).name} (truck ${s.truckNo}). Send them the count link.`, tone: 'border-violet-300 bg-violet-50', target: '', link: s } as any);
  }
  for (const r of state.requests || []) {
    if (r.status !== 'pending') continue;
    items.push({ at: r.at, icon: '🙋', text: `${String(r.by).replace(' (staff)', '')} asks: ${r.kind === 'add' ? (r.what === 'delivery' ? `truck not in the list “${r.name}”` : `add “${r.name}”`) : r.kind === 'accident' ? `accident on ${loadName(r.shipmentId)}` : r.kind === 'came_back' ? `${loadName(r.shipmentId)} came back` : `change truck/driver on ${loadName(r.shipmentId)}`}. Answer below.`, tone: 'border-sky-300 bg-sky-50', target: `req-${r.id}` });
  }
  items.sort((a, b) => b.at - a.at);
  if (!items.length) return null;
  const go = (id: string) => id && document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <div id="latest-from-staff" className="bg-white border-2 border-slate-900 rounded-xl p-4 space-y-2">
      <div className="text-sm font-bold text-slate-900">🆕 Latest from staff</div>
      {items.slice(0, 5).map((x, i) => (
        <div key={i} role="button" onClick={() => go(x.target)} className={`w-full text-left rounded-lg border px-3 py-2 text-sm flex items-start gap-2 ${x.tone} ${x.target ? 'cursor-pointer' : 'cursor-default'}`}>
          <span className="text-lg leading-none">{x.icon}</span>
          <span className="flex-1">{x.text}<span className="block text-[11px] text-slate-500">{when(x.at, now)}</span>
            {(x as any).link && <a id={`send-link-${(x as any).link.id}`} href={shareWhatsApp(`${COMPANY.name}: ${loadName((x as any).link.id)} is on the way (truck ${(x as any).link.truckNo}). When it arrives, please count and submit here:\n${appLink(receiverPath((x as any).link, state.settings))}`)} target="_blank" rel="noreferrer" onClick={() => dispatch({ type: 'LINK_SENT', id: (x as any).link.id, actor: 'Owner' })} className="mt-1.5 inline-flex px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold">💬 Send count link to customer</a>}
          </span>
        </div>
      ))}
    </div>
  );
}

function TruckHead({ s }: { s: any }) {
  const { state, dispatch } = useStore();
  const [fixing, setFixing] = useState(false);
  const [more, setMore] = useState(false);
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
        {s.accident && <div id={`accident-${s.id}`} className="text-rose-800 font-bold">Accident on the way{s.accident.place ? ` near ${s.accident.place}` : ''}: {s.accident.outcome === 'returned' ? 'goods collected and brought back, counted here' : `good pieces moved to truck ${s.truckNo}`}</div>}
        <div className="text-slate-500">Counted by <b className="text-slate-700">{s.receipt.by}</b>, {when(s.receipt.at)}</div>
        {s.receipt.note && <div className="text-slate-700 italic">“{s.receipt.note}”</div>}
        <button id={`more-${s.id}`} onClick={() => setMore(!more)} className="text-[11px] font-bold text-slate-500 underline cursor-pointer pt-1">{more ? '▲ Less' : '⋯ More for this truck (recount, photos, history, share)'}</button>
        {more && <>
        <AgreeCount s={s} />
        <div className="pt-1"><Chain s={s} lang="en" /></div>
        {canFix && !fixing && <button id={`fix-count-${s.id}`} onClick={() => setFixing(true)} className="text-[11px] font-bold text-slate-600 underline cursor-pointer">Count looks wrong? Ask for a recount</button>}
        {fixing && (
          <div className="mt-1 p-2 rounded-lg border border-slate-300 bg-white space-y-1.5">
            <div className="font-semibold text-slate-800">Reopen the count. The receiver's link will work again for a fresh count.</div>
            <input id={`fix-why-${s.id}`} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why? e.g. typed 10 instead of 100" className="w-full p-1.5 rounded border border-slate-300" />
            <div className="flex gap-2">
              <button id={`fix-ok-${s.id}`} disabled={!why.trim()} onClick={() => { dispatch({ type: 'REOPEN_COUNT', id: s.id, note: why.trim(), actor: 'Owner' }); window.open(shareWhatsApp(`Please count ${loadName(s.id)} (truck ${s.truckNo}, ${route(s)}) again and submit. Reason: ${why.trim()}\n${appLink(receiverPath(s, state.settings))}`), '_blank'); setFixing(false); }} className="px-2.5 py-1 rounded-md bg-slate-900 disabled:opacity-40 text-white font-bold cursor-pointer">Reopen and send link</button>
              <button onClick={() => setFixing(false)} className="px-2.5 py-1 rounded-md border border-slate-300 cursor-pointer">Keep</button>
            </div>
            {!why.trim() && <div className="text-[10px] text-slate-500">Write why first.</div>}
          </div>
        )}
        {((s.docs || []).length + (s.receipt.photos || []).length) > 0 && (
          <div className="pt-1.5"><PhotoStrip photos={[...(s.docs || []), ...(s.receipt.photos || []).map((p: any) => (typeof p === 'string' ? { id: p, name: p, kind: 'photo' } : p))]} /></div>
        )}
        <div className="pt-1"><a href={shareWhatsApp(truckSummary(state, s))} target="_blank" rel="noreferrer" className="inline-flex text-[11px] font-bold text-emerald-800 border border-emerald-200 bg-white px-2 py-1 rounded-md flex items-center"><MessageCircle className="w-3.5 h-3.5 mr-1" />Share on WhatsApp</a></div>
        </>}
      </div>

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
  const [more, setMore] = useState(d.status === 'investigating');
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
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${KIND_CLS[d.kind]}`}>{d.qty} {KIND_LABEL[d.kind].toUpperCase()}</span>{d.cause === 'accident' && <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded border border-rose-300 bg-rose-50 text-rose-800">ACCIDENT ON THE WAY</span>}
            <span className="font-bold text-slate-900">{it.name}</span>
            {d.status === 'investigating' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-violet-50 text-violet-800 border-violet-200">CHECKING</span>}
          </div>
          <div className="text-slate-500 mt-1">Sent {l.qty} · counted {r.counted}{r.damaged ? ` (${r.damaged} damaged)` : ''} {it.unit}</div>
        </div>
        <div className="text-right"><div className="text-sm font-bold text-slate-900">{inr(d.value, 0)}</div><div className="text-[10px] text-slate-400">{inr(it.rate, 0)} each</div></div>
      </div>

      {d.status === 'investigating' && <div id={`checking-${d.id}`} className="rounded-lg bg-violet-50 border border-violet-200 px-3 py-2 text-xs text-violet-950">🔍 You chose <b>Check first</b> {when(d.decision?.at)}. Nothing goes to the accountant yet. Talk to the driver and the sender; when you know what happened, choose below.</div>}
      <div className="flex flex-wrap gap-1.5">
        {optionsFor(s, d).filter((o) => !(o === 'investigate' && d.status === 'investigating')).map((o) => (
          <button key={o} id={`opt-${d.id}-${o}`} onClick={() => { setChoice(choice === o ? null : o); setConfirm(false); }}
            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer transition-colors ${choice === o ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'}`}>{ACTIONS[o].label}</button>
        ))}
      </div>

      {a && (
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 space-y-2 text-xs">
          {a.due && <label className="flex items-center justify-between gap-2 font-semibold text-slate-700">By when?<input id={`due-${d.id}`} type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="p-1.5 rounded border border-slate-300 bg-white" /></label>}
          {a.draft && <div className="text-slate-600">Your accountant will get this in the next report{s.flow === 'transfer' && s.billing === 'invoice' ? (choice === 'write_off' ? ' (credit note to your other unit)' : ' (bill to your other unit)') : ''}.</div>}
          {!a.draft && !a.due && choice !== 'investigate' && <div className="text-slate-600">This closes it. Nothing for the accountant.</div>}
          {choice === 'investigate' && <div className="text-slate-600">Keeps it open while you talk to the driver and the sender. You can add a photo or video link below.</div>}
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

      <button id={`dmore-${d.id}`} onClick={() => setMore(!more)} className="text-[11px] font-bold text-slate-500 underline cursor-pointer">{more ? '▲ Less' : '⋯ Proof to share'}</button>
      {more && <div className="space-y-2">
      <button onClick={() => setEvOpen(!evOpen)} className="text-[11px] font-bold text-slate-600 inline-flex items-center cursor-pointer">{evOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}Proof to share{d.evidence.clips.length ? ` · ${d.evidence.clips.length} video${d.evidence.clips.length > 1 ? 's' : ''}` : ''}{d.evidence.shares.length ? ` · shared ${d.evidence.shares.length}×` : ''}</button>
      {evOpen && <Evidence d={d} />}
      </div>}
      {d.history.length > 0 && <div className="text-[10px] text-slate-500 space-y-0.5">{d.history.map((h: any, i: number) => <div key={i}>{dateTime(h.at)} · {h.by}: {h.text}</div>)}</div>}
    </div>
  );
}

// The loading times staff recorded help find the right video. The owner attaches the clip
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
        <input id={`clip-${d.id}`} value={clip} onChange={(e) => setClip(e.target.value)} placeholder="Video or photo: file name or link" className="flex-1 min-w-0 p-2 rounded border border-slate-300" />
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
export function AccountantPanel({ mode = 'owner' }: { mode?: 'owner' | 'accountant' } = {}) {
  const { state, dispatch } = useStore();
  const ready = state.drafts.filter((d: any) => d.status === 'pending').sort(importOrder);
  const packs = [...(state.packs || [])].reverse();
  const [showAll, setShowAll] = useState(false);
  const [undoing, setUndoing] = useState<string | null>(null);
  const now = Date.now();
  const stamp = tallyDate(now);
  // your own decisions first (they can still be undone); the report and Tally file keep import order
  const listed = [...ready.filter((d: any) => d.diffId).sort((a: any, b: any) => b.createdAt - a.createdAt), ...(mode === 'accountant' ? [] : ready.filter((d: any) => !d.diffId))];
  // the accountant sees every to-do from the owner's decisions; routine stock entries go in the Tally file
  const shown = showAll || mode === 'accountant' ? listed : listed.slice(0, 3);
  const stockOnly = ready.filter((d: any) => !d.diffId).length;
  const packDrafts = (p: any) => p.ids.map((id: string) => state.drafts.find((d: any) => d.id === id)).filter(Boolean).sort(importOrder);
  return (
    <Panel eyebrow={mode === 'accountant' ? 'Tally' : 'For your accountant'} title={ready.length ? (mode === 'accountant' ? `${ready.length} entr${ready.length === 1 ? 'y' : 'ies'} to put in Tally` : `${ready.length} item${ready.length === 1 ? '' : 's'} ready to send`) : (mode === 'accountant' ? 'Nothing new to enter' : 'Nothing new for your accountant')} right={ready.length > 0 && (
      <button id="btn-send-accountant" onClick={() => dispatch({ type: 'SEND_TO_ACCOUNTANT', ids: ready.map((d: any) => d.id), actor: mode === 'accountant' ? 'Accountant' : 'Owner' })} className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-bold flex items-center cursor-pointer"><Send className="w-3.5 h-3.5 mr-1" />{mode === 'accountant' ? 'Mark all as entered' : 'Mark as sent'}</button>)}>
      {ready.length > 0 && (
        <>
          <div className="text-xs text-slate-600">{mode === 'accountant' ? 'Made from the counts and the owner’s decisions. Print the report or download the Tally file, enter them, then tap “Mark all as entered”.' : 'Made from the counts and your decisions. Send your accountant the report (to print) or the Tally file, then tap “Mark as sent”.'}</div>
          <div className="flex flex-wrap gap-2">
            <button id="btn-print-report" onClick={() => printReport(reportHtml(state, ready, `Not yet sent · ${dateTime(now)}`))} className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold flex items-center cursor-pointer"><Printer className="w-3.5 h-3.5 mr-1.5" />Report to print</button>
            <button id="btn-tally-file" onClick={() => download(`loadmatch-tally-${stamp}.xml`, batchXml(ready))} className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold flex items-center cursor-pointer"><FileCode className="w-3.5 h-3.5 mr-1.5" />Tally file</button>
            {/* no WhatsApp here: the accountant prints the report or downloads the Tally file */}
          </div>
          {mode === 'accountant' && <div id="acc-todo-head" className="text-sm font-bold text-slate-900">To do · {listed.length}{stockOnly ? <span className="font-normal text-xs text-slate-500"> (plus {stockOnly} routine stock entries, already in the Tally file)</span> : null}</div>}
          {mode === 'accountant' && !listed.length && <div className="text-xs text-emerald-800">✓ Nothing to do from the owner's decisions.</div>}
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
            {shown.map((d: any) => {
              const amt = entryAmount(d);
              return (
                <div key={d.id} id={`entry-${d.id}`} className="p-2.5 text-xs flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900">{mode === 'accountant' ? `Make a ${DRAFT_LABEL[d.type].toLowerCase()}${d.party && party(d.party) ? `: ${party(d.party).name}` : ''}` : DRAFT_PLAIN[d.type]} <span className="font-normal text-slate-400">· {loadName(d.shipmentId)}</span></div>
                    <div className="text-slate-600">{d.narration.replace(/^TRK-\d+( \([^)]*\))?(, truck [^:]+)?: ?/, '')}</div>
                    <div className="text-[10px] text-slate-400">In Tally: {DRAFT_LABEL[d.type]}</div>
                    {undoing === d.id && <div className="mt-1 flex gap-2"><span className="text-slate-700">Undo your decision and decide again?</span><button id={`undo-ok-${d.id}`} onClick={() => { dispatch({ type: 'REJECT_DRAFT', id: d.id, note: 'Owner corrected the decision', actor: 'Owner' }); setUndoing(null); }} className="font-bold text-rose-700 cursor-pointer">Undo</button><button onClick={() => setUndoing(null)} className="text-slate-500 cursor-pointer">Keep</button></div>}
                  </div>
                  <div className="text-right shrink-0">
                    {amt != null && <div className="font-bold text-slate-900">{inr(amt)}</div>}
                    {mode === 'accountant' && <button id={`done-${d.id}`} onClick={() => dispatch({ type: 'SEND_TO_ACCOUNTANT', ids: [d.id], actor: 'Accountant' })} className="mt-1 px-3 py-1.5 rounded-md bg-emerald-600 text-white text-[11px] font-bold cursor-pointer">✓ Done in Tally</button>}
                    {mode === 'owner' && d.diffId && undoing !== d.id && <button id={`undo-${d.id}`} onClick={() => setUndoing(d.id)} className="text-[11px] font-bold text-slate-500 inline-flex items-center cursor-pointer"><Undo2 className="w-3 h-3 mr-0.5" />Undo</button>}
                  </div>
                </div>
              );
            })}
          </div>
          {mode === 'owner' && listed.length > 3 && <button onClick={() => setShowAll(!showAll)} className="text-[11px] font-bold text-slate-600 cursor-pointer">{showAll ? 'Show fewer' : `Show all ${listed.length}`}</button>}
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

// The customer (or job worker) counted our load: do we agree? Like an e-way bill, silence for 72 hours = agreed.
function AgreeCount({ s }: { s: any }) {
  const { state, dispatch } = useStore();
  const [why, setWhy] = React.useState('');
  const [disagreeing, setDisagreeing] = React.useState(false);
  if (countedByUs(s) || !diffsOf(state, s.id).length) return null;
  if (s.response) return <div id={`resp-${s.id}`} className={`text-[11px] font-bold ${s.response.agree ? 'text-emerald-800' : 'text-rose-800'}`}>{s.response.agree ? '✓ We agreed with their count' : `✗ We disputed their count: ${s.response.note}`}</div>;
  const left = 72 - Math.floor((Date.now() - s.receipt.at) / 3600000);
  if (left <= 0) return <div className="text-[11px] font-bold text-emerald-800">✓ Agreed (no answer in 72 hours)</div>;
  return (
    <div id={`agree-${s.id}`} className="rounded-lg border border-sky-200 bg-sky-50 p-2 space-y-1.5 text-[11px] text-sky-950">
      <div className="font-bold">{party(s.party)?.name || 'They'} counted this load. Do you agree? <span className="font-normal">({left} h left, then it counts as agreed)</span></div>
      {!disagreeing ? (
        <div className="flex gap-2">
          <button id={`agree-yes-${s.id}`} onClick={() => dispatch({ type: 'RESPOND_COUNT', id: s.id, agree: true, actor: 'Owner' })} className="px-3 py-1.5 rounded-md bg-emerald-600 text-white font-bold cursor-pointer">Agree</button>
          <button id={`agree-no-${s.id}`} onClick={() => setDisagreeing(true)} className="px-3 py-1.5 rounded-md border border-rose-300 bg-white text-rose-800 font-bold cursor-pointer">Disagree</button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input id={`agree-why-${s.id}`} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why? e.g. we loaded 50, the driver signed" className="flex-1 p-1.5 rounded-md border border-slate-300 bg-white" />
          <button id={`agree-no-ok-${s.id}`} disabled={!why.trim()} onClick={() => dispatch({ type: 'RESPOND_COUNT', id: s.id, agree: false, note: why, actor: 'Owner' })} className="px-3 py-1.5 rounded-md bg-rose-600 disabled:opacity-40 text-white font-bold cursor-pointer">Send</button>
        </div>
      )}
    </div>
  );
}

// The owner's day in one card, ready to send to their own WhatsApp in the evening
function TodaySummary() {
  const { state } = useStore();
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const today = (t: any) => t && t >= start.getTime();
  const sent = state.shipments.filter((s: any) => today(s.sentAt));
  const counted = state.shipments.filter((s: any) => s.receipt && today(s.receipt.at));
  const withDiff = counted.filter((s: any) => diffsOf(state, s.id).length);
  const diffs = state.diffs.filter((d: any) => today(d.createdAt));
  const value = diffs.reduce((a: number, d: any) => a + (d.value || 0), 0);
  const open = state.diffs.filter((d: any) => d.status === 'open' || d.status === 'investigating').length;
  const tomorrow = start.getTime() + 2 * 86400000;
  const due = state.diffs.filter((d: any) => d.status === 'waiting' && d.decision?.dueAt && d.decision.dueAt < tomorrow).length;
  const asks = (state.requests || []).filter((r: any) => r.status === 'pending').length;
  const lines = [
    `Today: ${sent.length} truck${sent.length === 1 ? '' : 's'} sent, ${counted.length} counted.`,
    `${counted.length - withDiff.length} matched, ${withDiff.length} with a difference (${inr0(value)}).`,
    `${open} difference${open === 1 ? '' : 's'} waiting for your decision.`,
    due ? `${due} promise${due === 1 ? '' : 's'} due by tomorrow.` : '',
    asks ? `${asks} staff request${asks === 1 ? '' : 's'} waiting.` : '',
  ].filter(Boolean);
  return (
    <div id="today-summary" className="bg-slate-900 text-white rounded-xl p-4 space-y-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Your day</div>
      {lines.map((l) => <div key={l} className="text-sm">{l}</div>)}
      <a id="btn-summary-wa" href={shareWhatsApp(`LoadMatch · ${COMPANY.name}\n${lines.join('\n')}`)} target="_blank" rel="noreferrer" className="inline-flex items-center text-[11px] font-bold bg-emerald-500 hover:bg-emerald-600 px-2.5 py-1.5 rounded-md">Send this summary to my WhatsApp</a>
    </div>
  );
}
