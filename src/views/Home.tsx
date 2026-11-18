import React from 'react';
import { Truck, PackageCheck, Scale, FileCode, ArrowRight, BarChart3, Settings2 } from 'lucide-react';
import { useStore, shipmentStatus, receiptOverdue } from '../store.tsx';
import { COMPANY } from '../data/seed.ts';
import type { Go } from './ui.tsx';

export default function Home({ go }: { go: Go }) {
  const { state } = useStore();
  const now = Date.now();
  const st = state.shipments.map((s: any) => shipmentStatus(state, s));
  const loading = st.filter((x: string) => x === 'LOADING').length;
  const transit = state.shipments.filter((s: any) => s.sentAt && !s.receipt && !s.cancelledAt).length;
  const late = state.shipments.filter((s: any) => receiptOverdue(state, s, now)).length;
  const decide = state.diffs.filter((d: any) => d.status === 'open' || d.status === 'investigating').length;
  const drafts = state.drafts.filter((d: any) => d.status === 'pending').length;
  const firstLink = state.shipments.find((s: any) => s.sentAt && !s.receipt && !s.cancelledAt && s.flow !== 'inbound');

  const roles = [
    { id: 'dispatch', icon: Truck, title: 'Dispatch & gate', who: 'Staff on the phone', what: 'Type or paste the loading list, record loading start and end, send the receiver a WhatsApp link. At the gate, count supplier deliveries.', n: loading, nLabel: 'loading' },
    { id: 'receive', icon: PackageCheck, title: 'Receiver', who: 'Opens a WhatsApp link, no login', what: 'Counts what arrived without seeing what was sent. Marks damaged, adds photos, submits once. The count locks.', n: transit, nLabel: late ? `waiting · ${late} late` : 'waiting' },
    { id: 'owner', icon: Scale, title: 'Owner', who: 'Sees only differences', what: 'Short, excess or damaged lines with the value. Decide per line, set due dates, attach the CCTV clip and share the evidence pack.', n: decide, nLabel: 'to decide' },
    { id: 'accountant', icon: FileCode, title: 'Accountant', who: 'Approves ready entries', what: 'Stock journals, receipt notes, debit and credit notes, already prepared. Approve and import into Tally in one file.', n: drafts, nLabel: 'to approve' },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">LoadMatch</div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">What was loaded, matched against what arrived.</h1>
        <p className="text-sm text-slate-600 max-w-3xl">Every truck between units, to customers and from suppliers is counted at the other end on a phone. Only the differences reach the owner, with the loading time to pull the CCTV. The accountant gets the Tally entries ready to approve.</p>
        <div className="text-xs text-slate-500">Demo: {COMPANY.name}, {COMPANY.city} · two units, two suppliers, two customers</div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {roles.map(({ id, icon: Icon, title, who, what, n, nLabel }) => (
          <button key={id} id={`home-${id}`} onClick={() => (id === 'receive' ? (firstLink ? (window.location.hash = `#/r/${firstLink.id}/${firstLink.token}`) : go('dispatch')) : go(id))}
            className="text-left bg-white border border-slate-200 hover:border-slate-400 rounded-xl p-4 shadow-2xs space-y-2 cursor-pointer transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Icon className="w-5 h-5 text-emerald-700" /><span className="font-bold text-slate-900">{title}</span></div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${n ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-500'}`}>{n} {nLabel}</span>
            </div>
            <div className="text-[11px] font-semibold text-slate-500">{who}</div>
            <div className="text-xs text-slate-700 leading-relaxed">{what}</div>
            <div className="text-[11px] font-bold text-emerald-800 flex items-center">Open<ArrowRight className="w-3.5 h-3.5 ml-1" /></div>
          </button>
        ))}
      </div>
      <div id="home-setup" className="bg-white border border-dashed border-slate-300 rounded-xl p-4 sm:p-5 space-y-2">
        <div className="flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-emerald-700" />
          <span className="font-bold text-slate-900">Set up for your company</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase tracking-wide">Planned</span>
        </div>
        <p className="text-xs text-slate-700 leading-relaxed">LoadMatch will have a web setup page. A company uploads its own Excel (or a Tally export) with items and units, its branches or units, customers, suppliers and staff phone numbers. It then chooses its rules: whether receivers count without seeing the sent quantity, who hears about differences, the loss limit, languages and the accounting software. The app is set up for that company, and the staff use it on their mobile phones.</p>
        <ol className="text-xs text-slate-600 grid sm:grid-cols-3 gap-2 pt-1">
          <li className="bg-slate-50 border border-slate-200 rounded-lg p-2.5"><span className="font-bold text-slate-900 block">1. Upload Excel</span>Your item list, branches, customers, suppliers and staff, in your own column names.</li>
          <li className="bg-slate-50 border border-slate-200 rounded-lg p-2.5"><span className="font-bold text-slate-900 block">2. Choose your rules</span>A few yes/no choices on the web page, changeable any time.</li>
          <li className="bg-slate-50 border border-slate-200 rounded-lg p-2.5"><span className="font-bold text-slate-900 block">3. Use it on the phone</span>Dispatch and receivers work from WhatsApp links; the owner and accountant from phone or laptop.</li>
        </ol>
        <div className="text-[11px] text-slate-500">This demo runs with sample data from a plywood business.</div>
      </div>
      <button onClick={() => go('reports')} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 flex items-center justify-center cursor-pointer hover:bg-slate-50"><BarChart3 className="w-4 h-4 mr-1.5" />Reports: match rate, time to count, lost vs recovered</button>
    </div>
  );
}
