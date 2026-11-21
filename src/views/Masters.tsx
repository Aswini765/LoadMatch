import React, { useState } from 'react';
import { Plus, ClipboardPaste } from 'lucide-react';
import { useStore, unitTax } from '../store.tsx';
import { ITEMS, PARTIES, UNITS } from '../data/seed.ts';

// Owner → Setup: the company's own lists. Staff only pick from these (or ask the owner to add).
const inp = 'w-full p-2 rounded-lg border border-slate-300 text-xs bg-white';
const btn = 'w-full py-2 rounded-lg bg-slate-900 text-white text-xs font-bold disabled:opacity-40 cursor-pointer flex items-center justify-center';
const KIND: Record<string, string> = { supplier: 'Supplier', customer: 'Customer', jobworker: 'Job worker' };

function Card({ id, title, sub, children }: { id: string; title: string; sub: string; children: React.ReactNode }) {
  return (
    <div id={id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
      <div><div className="font-bold text-slate-900">{title}</div><div className="text-[11px] text-slate-500">{sub}</div></div>
      {children}
    </div>
  );
}

export default function Masters() {
  const { state, dispatch } = useStore();
  const add = (what: string, data: any) => dispatch({ type: 'ADD_MASTER', what, data, actor: 'Owner' });
  const [item, setItem] = useState({ name: '', unit: 'pcs', rate: '' });
  const [paste, setPaste] = useState('');
  const [party, setParty] = useState({ name: '', kind: 'customer', city: '', gstin: '', phone: '' });
  const [unit, setUnitF] = useState({ name: '', gstin: '' });
  const [staff, setStaff] = useState({ name: '', unit: 'MYS' });
  const pasteRows = paste.split('\n').map((l) => l.split(/\t|,/).map((x) => x.trim())).filter((r) => r[0]);

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-950">Setup</h1>
        <p className="text-xs text-slate-600">Your company's own lists. Staff pick from these when they send or receive. If something is missing they tap “Ask owner”, and it shows in your requests. Demo data is already filled in; Reset demo data removes what you add.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card id="setup-units" title={`Our units · ${Object.keys(UNITS).length}`} sub="Factories and godowns of this company. Same GST number = stock transfer on a delivery challan.">
          <div className="space-y-1">{Object.values(UNITS).map((u) => <div key={u.id} className="text-xs flex justify-between border-b border-slate-100 py-1"><span className="font-semibold">{u.name}</span><span className="font-mono text-slate-500">{unitTax(state, u.id).gstin}</span></div>)}</div>
          <input id="unit-name" value={unit.name} onChange={(e) => setUnitF({ ...unit, name: e.target.value })} placeholder="New unit name, e.g. Hosur godown" className={inp} />
          <input id="unit-gstin" value={unit.gstin} onChange={(e) => setUnitF({ ...unit, gstin: e.target.value })} placeholder="GST no. (empty = same as company)" className={inp} />
          <button id="btn-add-unit" disabled={!unit.name.trim()} onClick={() => { add('unit', unit); setUnitF({ name: '', gstin: '' }); }} className={btn}><Plus className="w-3.5 h-3.5 mr-1" />Add unit</button>
        </Card>

        <Card id="setup-staff" title={`Staff · ${(state.staff || []).length}`} sub="One staff person per unit sends and receives. The owner sees everything.">
          <div className="space-y-1">{(state.staff || []).map((p: any, i: number) => <div key={i} className="text-xs flex justify-between border-b border-slate-100 py-1"><span className="font-semibold">{p.name}</span><span className="text-slate-500">{UNITS[p.unit]?.name.split(' (')[0]}</span></div>)}</div>
          <input id="staff-name" value={staff.name} onChange={(e) => setStaff({ ...staff, name: e.target.value })} placeholder="Name" className={inp} />
          <select id="staff-unit" value={staff.unit} onChange={(e) => setStaff({ ...staff, unit: e.target.value })} className={inp}>{Object.values(UNITS).map((u) => <option key={u.id} value={u.id}>{u.name.split(' (')[0]}</option>)}</select>
          <button id="btn-add-staff" disabled={!staff.name.trim()} onClick={() => { add('staff', staff); setStaff({ ...staff, name: '' }); }} className={btn}><Plus className="w-3.5 h-3.5 mr-1" />Add staff</button>
        </Card>

        <Card id="setup-items" title={`Items · ${Object.keys(ITEMS).length}`} sub="What you send and receive. Add one, or paste many rows from Excel: name, unit, rate.">
          <div className="max-h-40 overflow-y-auto space-y-1">{Object.values(ITEMS).map((it) => <div key={it.code} className="text-xs flex justify-between border-b border-slate-100 py-1 gap-2"><span className="truncate">{it.name}</span><span className="text-slate-500 shrink-0">{it.unit} · ₹{it.rate}</span></div>)}</div>
          <input id="item-name" value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} placeholder="Item name and size, e.g. Teak veneer 6 mm" className={inp} />
          <div className="grid grid-cols-2 gap-2">
            <input id="item-unit" value={item.unit} onChange={(e) => setItem({ ...item, unit: e.target.value })} placeholder="Unit (pcs, kg)" className={inp} />
            <input id="item-rate" type="number" value={item.rate} onChange={(e) => setItem({ ...item, rate: e.target.value })} placeholder="Rate ₹" className={inp} />
          </div>
          <button id="btn-add-item" disabled={!item.name.trim()} onClick={() => { add('item', item); setItem({ name: '', unit: 'pcs', rate: '' }); }} className={btn}><Plus className="w-3.5 h-3.5 mr-1" />Add item</button>
          <textarea id="item-paste" value={paste} onChange={(e) => setPaste(e.target.value)} rows={3} placeholder={'Paste from Excel, one item per row:\nTeak veneer 6 mm, pcs, 150\nPine plank 2 in, pcs, 90'} className={inp} />
          <button id="btn-paste-items" disabled={!pasteRows.length} onClick={() => { pasteRows.forEach(([name, u, rate]) => add('item', { name, unit: u || 'pcs', rate })); setPaste(''); }} className={btn}><ClipboardPaste className="w-3.5 h-3.5 mr-1" />Add {pasteRows.length || ''} pasted items</button>
        </Card>

        <Card id="setup-parties" title={`Customers, suppliers, job workers · ${Object.keys(PARTIES).length}`} sub="Outside companies (other GST number). They get the count link from the company WhatsApp.">
          <div className="max-h-40 overflow-y-auto space-y-1">{Object.values(PARTIES).map((p: any) => <div key={p.id} className="text-xs flex justify-between border-b border-slate-100 py-1 gap-2"><span className="truncate"><b>{p.name}</b> · {KIND[p.kind]}</span><span className="font-mono text-slate-500 shrink-0">{p.gstin || 'GST no. missing'}</span></div>)}</div>
          <input id="party-name" value={party.name} onChange={(e) => setParty({ ...party, name: e.target.value })} placeholder="Company name" className={inp} />
          <div className="grid grid-cols-2 gap-2">
            <select id="party-kind" value={party.kind} onChange={(e) => setParty({ ...party, kind: e.target.value })} className={inp}>{Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <input id="party-city" value={party.city} onChange={(e) => setParty({ ...party, city: e.target.value })} placeholder="City" className={inp} />
            <input id="party-gstin" value={party.gstin} onChange={(e) => setParty({ ...party, gstin: e.target.value })} placeholder="GST no." className={inp} />
            <input id="party-phone" value={party.phone} onChange={(e) => setParty({ ...party, phone: e.target.value })} placeholder="WhatsApp no." className={inp} />
          </div>
          <button id="btn-add-party" disabled={!party.name.trim()} onClick={() => { add('party', party); setParty({ name: '', kind: party.kind, city: '', gstin: '', phone: '' }); }} className={btn}><Plus className="w-3.5 h-3.5 mr-1" />Add {KIND[party.kind].toLowerCase()}</button>
        </Card>
      </div>
    </div>
  );
}
