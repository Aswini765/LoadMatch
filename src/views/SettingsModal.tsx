import React, { useState } from 'react';
import { X, Settings2, RotateCcw } from 'lucide-react';
import { inr0, dateTime } from '../lib/format.ts';
import { useStore } from '../store.tsx';
import { UNITS } from '../data/seed.ts';
import { LANGS } from '../i18n.ts';

const fmt = (k: string, v: any) => (k === 'writeOffLimit' ? `loss limit ${inr0(v)}` : k === 'receiptHours' ? `count within ${v}h` : k === 'languages' ? 'phone languages' : k === 'blindCount' ? `blind count ${v ? 'on' : 'off'}` : k === 'differencesTo' ? `differences to ${v === 'owner' ? 'owner only' : 'owner and sender'}` : k === 'units' ? 'unit GSTINs' : k);

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { state, dispatch, sync } = useStore();
  const s = state.settings;
  const set = (patch: any) => dispatch({ type: 'UPDATE_SETTINGS', settings: patch, actor: 'Owner' });
  const [limit, setLimit] = useState(String(s.writeOffLimit));
  const [resetting, setResetting] = useState(false);
  const log = (state.settingsLog || []).slice(-4).reverse();
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm font-bold text-slate-900"><Settings2 className="w-4 h-4 text-slate-500" /><span>Owner settings</span></div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 cursor-pointer" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4 text-xs">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
            <div className="flex justify-between items-center text-slate-700 font-semibold"><span>Losses I confirm personally</span>
              <span className="flex items-center gap-1">above ₹<input id="setting-limit" type="number" min="0" step="500" value={limit} onChange={(e) => setLimit(e.target.value)} onBlur={() => Number(limit) >= 0 && set({ writeOffLimit: Math.floor(Number(limit)) })} className="w-20 p-1 rounded border border-slate-300 font-mono text-right" /></span>
            </div>
            <div className="text-[10px] text-slate-400">A write-off, credit note or accepted loss above this value needs an extra tick.</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
            <div className="flex justify-between text-slate-700 font-semibold"><span>Receiver should count within</span><span className="font-mono font-bold text-slate-900">{s.receiptHours} h</span></div>
            <input id="setting-hours" type="range" min="2" max="72" step="2" value={s.receiptHours} onChange={(e) => set({ receiptHours: Number(e.target.value) })} className="w-full accent-slate-900 cursor-pointer" />
            <div className="text-[10px] text-slate-400">After this, the truck is flagged late for the owner and the dispatch staff.</div>
          </div>
          <label className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between gap-3 cursor-pointer">
            <div>
              <div className="text-slate-700 font-semibold">Receiver counts without seeing the sent quantity</div>
              <div className="text-[10px] text-slate-400">Recommended: people count instead of copying. Sent vs counted is shown after they submit.</div>
            </div>
            <input id="setting-blind" type="checkbox" checked={s.blindCount} onChange={(e) => set({ blindCount: e.target.checked })} className="accent-slate-900 w-4 h-4" />
          </label>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
            <div className="text-slate-700 font-semibold">Who sees the details of a difference</div>
            <select id="setting-diffs" value={s.differencesTo} onChange={(e) => set({ differencesTo: e.target.value })} className="w-full p-1.5 rounded border border-slate-300 bg-white">
              <option value="owner_sender">Owner and sender (sender and receiver see which lines differ)</option>
              <option value="owner">Owner only (others see just "difference found")</option>
            </select>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
            <div className="text-slate-700 font-semibold">Your units' GSTINs</div>
            <div className="text-[10px] text-slate-400">Used only to suggest the paperwork for moves between units. The sender still chooses "no money" or "with invoice" on every load.</div>
            {Object.values(UNITS).map((u) => <UnitTax key={u.id} id={u.id} name={u.name} value={s.units[u.id]} onSave={(v) => set({ units: { ...s.units, [u.id]: v } })} />)}
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
            <div className="text-slate-700 font-semibold">Languages on the phone screens</div>
            <div className="flex flex-wrap gap-3">{Object.keys(LANGS).map((l) => (
              <label key={l} className="flex items-center gap-1 cursor-pointer"><input type="checkbox" disabled={l === 'en'} checked={s.languages[l] !== false} onChange={(e) => set({ languages: { ...s.languages, [l]: e.target.checked } })} className="accent-slate-900" />{LANGS[l].label}</label>
            ))}</div>
          </div>
          {log.length > 0 && <div className="text-[10px] text-slate-500 space-y-0.5">{log.map((x: any, i: number) => <div key={i}>{dateTime(x.at)} · {x.actor}: {Object.entries(x.changes).map(([k, v]) => fmt(k, v)).join(', ')}</div>)}</div>}
          <div className="border-t border-slate-200 pt-3">
            {!resetting ? <button onClick={() => setResetting(true)} className="text-rose-700 font-bold flex items-center cursor-pointer"><RotateCcw className="w-3.5 h-3.5 mr-1" />Reset demo data</button> : (
              <div className="space-y-2 p-3 rounded-lg bg-rose-50 border border-rose-200">
                <div className="font-semibold text-rose-900">This clears every truck, decision and entry {sync.shared ? 'for everyone using this shared workspace' : 'on this device'} and loads the demo again.</div>
                <div className="flex gap-2">
                  <button id="btn-reset-confirm" onClick={() => { dispatch({ type: 'RESET', actor: 'Owner' }); setResetting(false); onClose(); }} className="px-3 py-1.5 rounded-md bg-rose-600 text-white font-bold cursor-pointer">Reset</button>
                  <button onClick={() => setResetting(false)} className="px-3 py-1.5 rounded-md border border-slate-300 cursor-pointer">Keep</button>
                </div>
              </div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function UnitTax({ id, name, value, onSave }: { id: string; name: string; value: { gstin: string; state: string }; onSave: (v: { gstin: string; state: string }) => void }) {
  const [gstin, setGstin] = useState(value.gstin);
  const [st, setSt] = useState(value.state);
  const valid = /^[0-9]{2}[A-Z0-9]{13}$/.test(gstin.trim().toUpperCase()) && st.trim().length > 1;
  const save = () => { if (valid && (gstin.trim().toUpperCase() !== value.gstin || st.trim() !== value.state)) onSave({ gstin: gstin.trim().toUpperCase(), state: st.trim() }); };
  return (
    <div className="grid grid-cols-3 gap-1.5 items-center">
      <span className="text-slate-700 truncate">{name}</span>
      <input id={`gstin-${id}`} value={gstin} onChange={(e) => setGstin(e.target.value)} onBlur={save} className={`p-1 rounded border font-mono ${valid ? 'border-slate-300' : 'border-rose-400'}`} />
      <input id={`gststate-${id}`} value={st} onChange={(e) => setSt(e.target.value)} onBlur={save} className="p-1 rounded border border-slate-300" />
    </div>
  );
}
