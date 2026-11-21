import React from 'react';
import { Truck, PackageCheck, Scale, Calculator, FileCode, ArrowRight, BarChart3, Settings2 } from 'lucide-react';
import { useStore, shipmentStatus, receiptOverdue, countedByUs, atGate } from '../store.tsx';
import { COMPANY } from '../data/seed.ts';
import type { Go } from './ui.tsx';

export default function Home({ go, who, pick }: { go: Go; who?: string; pick?: (w: string) => void }) {
  const { state } = useStore();
  const now = Date.now();
  const st = state.shipments.map((s: any) => shipmentStatus(state, s));
  const loading = st.filter((x: string) => x === 'LOADING').length;
  const transit = state.shipments.filter((s: any) => s.sentAt && !s.receipt && !s.cancelledAt).length;
  const late = state.shipments.filter((s: any) => receiptOverdue(state, s, now)).length;
  const decide = state.diffs.filter((d: any) => d.status === 'open' || d.status === 'investigating').length;
  const drafts = state.drafts.filter((d: any) => d.status === 'pending').length;
  const firstLink = state.shipments.find((s: any) => s.sentAt && !s.receipt && !s.cancelledAt && !atGate(s.flow));

  const toCount = state.shipments.filter((s: any) => !s.receipt && !s.cancelledAt && countedByUs(s) && (s.flow !== 'transfer' || s.sentAt)).length;
  const roles = [
    { id: 'staff', icon: Truck, title: 'Staff', who: 'One person at each unit', what: 'Sees the trucks coming to their unit and taps the one that arrived to count it. Sends trucks with one big button for each step: Start loading, Loading done, Truck left. Asks the owner when there is a problem.', n: toCount + loading, nLabel: late ? `to load or count · ${late} late` : 'to load or count' },
    { id: 'owner', icon: Scale, title: 'Owner', who: 'Sees everything, decides', what: 'Decides what to do when something is missing, damaged or extra. Answers staff requests. Adds expected supplier deliveries, items, customers and staff in Setup. Gets one file for the accountant.', n: decide, nLabel: 'to decide' },
    { id: 'accountant', icon: Calculator, title: 'Accountant', who: 'Does the paperwork', what: 'Gets a to-do list from the owner\'s decisions: debit note to a supplier, credit note or bill for a customer. Ticks each one when done in Tally. Also gets the report and one Tally file.', n: state.drafts.filter((d: any) => d.status === 'pending' && d.diffId).length, nLabel: 'to do' },
  ];


  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">LoadMatch</div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">What was sent. What arrived. What's missing.</h1>
        <p className="text-sm text-slate-600 max-w-3xl">Three people use it. <b>Staff</b> at each unit send trucks and count what arrives, with big buttons, pictures and their own language. The app compares sent and received and shows the <b>Owner</b> only what is missing, damaged or extra. The <b>Accountant</b> gets the paperwork as a to-do list. Customers and suppliers need no app: the owner sends them a link from the company WhatsApp.</p>
        <div className="text-xs text-slate-500">Demo: {COMPANY.name}, {COMPANY.city} · two units, two suppliers, two customers</div>
      </div>

      <div className="text-sm font-bold text-slate-900">Who uses LoadMatch? Tap who you are to start.</div>
      <div className="grid sm:grid-cols-3 gap-4">
        {roles.map(({ id, icon: Icon, title, who, what, n, nLabel }) => (
          <button key={title} id={`home-${title.toLowerCase()}`} onClick={() => (pick ? pick(id) : go(id))}
            className="text-left bg-white border border-slate-200 hover:border-slate-400 rounded-xl p-4 shadow-2xs space-y-2 cursor-pointer transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Icon className="w-5 h-5 text-emerald-700" /><span className="font-bold text-slate-900">{title}</span></div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${n ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-500'}`}>{n} {nLabel}</span>
            </div>
            <div className="text-[11px] font-semibold text-slate-500">{who}</div>
            <div className="text-xs text-slate-700 leading-relaxed">{what}</div>
            <div className="text-[11px] font-bold text-emerald-800 flex items-center">{who === id ? 'You are using this · Open' : `I am the ${title.toLowerCase()}`}<ArrowRight className="w-3.5 h-3.5 ml-1" /></div>
          </button>
        ))}
      </div>
      <div id="home-setup" className="bg-white border border-dashed border-slate-300 rounded-xl p-4 sm:p-5 space-y-2">
        <div className="flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-emerald-700" />
          <span className="font-bold text-slate-900">Set up for your company</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wide">Owner → Setup</span>
        </div>
        <p className="text-xs text-slate-700 leading-relaxed">The owner opens Setup and adds the company's own lists: units (with GST number), staff (one per unit), items (one by one or pasted from Excel) and customers, suppliers and job workers. Staff only pick from these lists; if something is missing they tap “Ask owner”, and the owner adds it with one tap.</p>
        <ol className="text-xs text-slate-600 grid sm:grid-cols-3 gap-2 pt-1">
          <li className="bg-slate-50 border border-slate-200 rounded-lg p-2.5"><span className="font-bold text-slate-900 block">1. Upload Excel</span>Items pasted from Excel; units, parties and staff added in Setup.</li>
          <li className="bg-slate-50 border border-slate-200 rounded-lg p-2.5"><span className="font-bold text-slate-900 block">2. Choose your rules</span>A few yes/no choices on the web page, changeable any time.</li>
          <li className="bg-slate-50 border border-slate-200 rounded-lg p-2.5"><span className="font-bold text-slate-900 block">3. Use it on the phone</span>Staff and the owner use the app on their phones; outside parties get a WhatsApp link; the accountant gets a Tally file.</li>
        </ol>
        <div className="text-[11px] text-slate-500">This demo runs with sample data from a plywood business.</div>
      </div>
      <button onClick={() => go('reports')} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 flex items-center justify-center cursor-pointer hover:bg-slate-50"><BarChart3 className="w-4 h-4 mr-1.5" />Reports: match rate, time to count, lost vs recovered</button>
    </div>
  );
}
