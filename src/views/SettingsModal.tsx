import React, { useState } from 'react';
import { X, Settings2, RotateCcw, Check } from 'lucide-react';
import { inr0, dateTime } from '../lib/format.ts';
import { useStore } from '../store.tsx';
import { UNITS } from '../data/seed.ts';
import { LANGS } from '../i18n.ts';

const fmt = (k: string, v: any) => (k === 'writeOffLimit' ? `loss limit ${inr0(v)}` : k === 'receiptHours' ? `count within ${v}h` : k === 'languages' ? 'phone languages' : k === 'blindCount' ? `blind count ${v ? 'on' : 'off'}` : k === 'differencesTo' ? `differences to ${v === 'owner' ? 'owner only' : 'owner and sender'}` : k === 'units' ? 'unit GSTINs' : k);
const gstinOk = (g: string) => /^[0-9]{2}[A-Z0-9]{13}$/.test(String(g).trim().toUpperCase());

// Changes stay in this form until "Save". Closing without saving keeps the old settings.
export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { state, dispatch, sync } = useStore();
  const s = state.settings;
  const [d, setD] = useState(() => ({
    limit: String(s.writeOffLimit), hours: s.receiptHours, blind: s.blindCount, diffs: s.differencesTo,
    units: JSON.parse(JSON.stringify(s.units)) as Record<string, { gstin: string; state: string }>,
    languages: { ...s.languages } as Record<string, boolean>,
  }));
  const [resetting, setResetting] = useState(false);
  const [saved, setSaved] = useState(false);
  const log = (state.settingsLog || []).slice(-4).reverse();
  const put = (patch: any) => { setD((x) => ({ ...x, ...patch })); setSaved(false); };

  const problems: string[] = [];
  if (!(Number(d.limit) >= 0) || d.limit.trim() === '') problems.push('Enter a loss limit (0 or more).');
  for (const u of Object.values(UNITS)) {
    if (!gstinOk(d.units[u.id].gstin)) problems.push(`${u.name.split(' (')[0]}: GSTIN should be 15 letters and numbers, starting with 2 digits.`);
    if (d.units[u.id].state.trim().length < 2) problems.push(`${u.name.split(' (')[0]}: enter the state.`);
  }
  const changes: any = {};
  if (Math.floor(Number(d.limit)) !== s.writeOffLimit) changes.writeOffLimit = Math.floor(Number(d.limit));
  if (d.hours !== s.receiptHours) changes.receiptHours = d.hours;
  if (d.blind !== s.blindCount) changes.blindCount = d.blind;
  if (d.diffs !== s.differencesTo) changes.differencesTo = d.diffs;
  const units = Object.fromEntries(Object.entries(d.units).map(([k, v]) => [k, { gstin: v.gstin.trim().toUpperCase(), state: v.state.trim() }]));
  if (JSON.stringify(units) !== JSON.stringify(s.units)) changes.units = units;
  if (JSON.stringify(d.languages) !== JSON.stringify(s.languages)) changes.languages = d.languages;
  const dirty = Object.keys(changes).length > 0;
  const save = () => { if (problems.length || !dirty) return; dispatch({ type: 'UPDATE_SETTINGS', settings: changes, actor: 'Owner' }); setSaved(true); };
  const close = () => { if (dirty && !window.confirm('You have changes that are not saved. Close without saving?')) return; onClose(); };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={close}>
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center space-x-2 text-sm font-bold text-slate-900"><Settings2 className="w-4 h-4 text-slate-500" /><span>Owner settings</span></div>
          <button onClick={close} className="p-1 rounded hover:bg-slate-100 cursor-pointer" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4 text-xs">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
            <div className="flex justify-between items-center text-slate-700 font-semibold"><span>Losses I confirm myself</span>
              <span className="flex items-center gap-1">above ₹<input id="setting-limit" type="number" inputMode="numeric" min="0" step="500" value={d.limit} onChange={(e) => put({ limit: e.target.value })} className="w-24 p-1 rounded border border-slate-300 font-mono text-right" /></span>
            </div>
            <div className="text-[10px] text-slate-500">Taking a loss, or charging a customer less, above this amount needs an extra tick from you.</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
            <div className="flex justify-between text-slate-700 font-semibold"><span>Receiver should count within</span><span className="font-mono font-bold text-slate-900">{d.hours} hours</span></div>
            <input id="setting-hours" type="range" min="2" max="72" step="2" value={d.hours} onChange={(e) => put({ hours: Number(e.target.value) })} className="w-full accent-slate-900 cursor-pointer" />
            <div className="text-[10px] text-slate-500">After this, the truck shows as late to you and to the sender.</div>
          </div>
          <label className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between gap-3 cursor-pointer">
            <div>
              <div className="text-slate-700 font-semibold">Receiver counts without seeing what was sent</div>
              <div className="text-[10px] text-slate-500">Recommended: people really count instead of copying. They see sent vs counted after they submit.</div>
            </div>
            <input id="setting-blind" type="checkbox" checked={d.blind} onChange={(e) => put({ blind: e.target.checked })} className="accent-slate-900 w-4 h-4" />
          </label>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
            <div className="text-slate-700 font-semibold">Who sees the details of a difference</div>
            <select id="setting-diffs" value={d.diffs} onChange={(e) => put({ diffs: e.target.value })} className="w-full p-1.5 rounded border border-slate-300 bg-white">
              <option value="owner_sender">Owner and sender (sender and receiver see which items differ)</option>
              <option value="owner">Owner only (others see just "difference found")</option>
            </select>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
            <div className="text-slate-700 font-semibold">Your units' GSTINs</div>
            <div className="text-[10px] text-slate-500">Used only to suggest the paperwork for moves between units. The sender still chooses "no money" or "with invoice" on every load.</div>
            {Object.values(UNITS).map((u) => (
              <div key={u.id} className="grid grid-cols-3 gap-1.5 items-center">
                <span className="text-slate-700 truncate">{u.name.split(' (')[0]}</span>
                <input id={`gstin-${u.id}`} value={d.units[u.id].gstin} onChange={(e) => put({ units: { ...d.units, [u.id]: { ...d.units[u.id], gstin: e.target.value } } })} className={`p-1 rounded border font-mono ${gstinOk(d.units[u.id].gstin) ? 'border-slate-300' : 'border-rose-400'}`} />
                <input id={`gststate-${u.id}`} value={d.units[u.id].state} onChange={(e) => put({ units: { ...d.units, [u.id]: { ...d.units[u.id], state: e.target.value } } })} className="p-1 rounded border border-slate-300" />
              </div>
            ))}
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
            <div className="text-slate-700 font-semibold">Languages on the phone screens</div>
            <div className="flex flex-wrap gap-3">{Object.keys(LANGS).map((l) => (
              <label key={l} className="flex items-center gap-1 cursor-pointer"><input type="checkbox" disabled={l === 'en'} checked={d.languages[l] !== false} onChange={(e) => put({ languages: { ...d.languages, [l]: e.target.checked } })} className="accent-slate-900" />{LANGS[l].label}</label>
            ))}</div>
          </div>

          {problems.length > 0 && <div id="settings-problems" className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-rose-900 space-y-0.5">{problems.map((p) => <div key={p}>• {p}</div>)}</div>}
          <div className="flex items-center gap-2">
            <button id="btn-settings-save" disabled={!dirty || problems.length > 0} onClick={save} className="px-4 py-2 rounded-lg bg-emerald-600 disabled:opacity-40 text-white font-bold cursor-pointer flex items-center"><Check className="w-3.5 h-3.5 mr-1" />Save</button>
            <span className="text-slate-500">{saved && !dirty ? 'Saved.' : dirty ? 'Not saved yet.' : 'No changes.'}</span>
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
