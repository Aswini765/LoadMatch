import React, { useState } from 'react';

// Prototype camera: opens a viewfinder with a sample picture, the shutter "takes" it, and a thumbnail stays on the page.
// In a real build this is the phone camera, then a photo-reading model or plate reader.
export type Shot = 'challan' | 'plate' | 'licence' | 'stack' | 'damage' | 'loading';

export function Sample({ kind, big = false, text = '' }: { kind: Shot; big?: boolean; text?: string }) {
  const sz = big ? 'w-64 h-44' : 'w-16 h-11';
  const f = big ? 'text-[11px]' : 'text-[4px]';
  if (kind === 'plate') return <div className={`${sz} rounded bg-slate-600 flex items-center justify-center`}><div className={`bg-amber-300 border-2 border-black rounded px-1 font-mono font-bold text-black ${big ? 'text-2xl px-3 py-1' : 'text-[6px]'}`}>{text || 'KA 09 B 6138'}</div></div>;
  if (kind === 'loading') return <div className={`${sz} rounded bg-sky-200 flex items-end justify-center pb-1 ${big ? 'text-7xl' : 'text-xl'}`}>🚛</div>;
  if (kind === 'challan') return (
    <div className={`${sz} rounded bg-white p-1.5 ${f} text-slate-700 leading-tight overflow-hidden border border-slate-300`}>
      <div className="font-bold text-center">DELIVERY CHALLAN</div>
      <div>No. {text || 'DC-742'} · Kaveri Wood Products</div>
      <div className="mt-0.5 border-t border-slate-300">Plywood 12 mm ........ 80</div>
      <div>Plywood 18 mm ........ 45</div>
      <div className="mt-0.5 text-right italic">Sign ____</div>
    </div>
  );
  if (kind === 'licence') return <div className={`${sz} rounded bg-sky-100 border border-sky-400 p-1.5 ${f} text-sky-950 leading-tight`}><div className="font-bold">DRIVING LICENCE · KA</div><div className="flex gap-1 mt-0.5"><div className={`${big ? 'w-10 h-12' : 'w-3 h-4'} bg-sky-300 rounded-sm`} /><div>{text || 'Name: Suresh K'}<br />DL KA09 2015 00••••</div></div></div>;
  if (kind === 'damage') return <div className={`${sz} rounded bg-amber-900 flex items-center justify-center ${big ? 'text-5xl' : 'text-lg'}`}>💔</div>;
  return <div className={`${sz} rounded bg-amber-800 p-1 grid grid-cols-4 gap-0.5`}>{Array.from({ length: 8 }).map((_, i) => <div key={i} className="bg-amber-600 rounded-sm" />)}</div>;
}

export function CameraButton({ id, kind, label, done, onShot, text, busyText }: { id: string; kind: Shot; label: string; done: boolean; onShot: () => void; text?: string; busyText?: string }) {
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState(false);
  const shoot = () => { setFlash(true); setTimeout(() => { setFlash(false); setOpen(false); onShot(); }, 350); };
  if (done) return <div id={`${id}-done`} className="flex items-center gap-2 text-xs font-bold text-emerald-800"><Sample kind={kind} text={text} /><span>✓ {busyText || 'Photo taken'}</span></div>;
  return (
    <>
      <button id={id} onClick={() => setOpen(true)} className="w-full min-h-[56px] rounded-2xl bg-slate-900 text-white text-base font-bold flex items-center justify-center gap-2 cursor-pointer">📷 {label}</button>
      {open && (
        <div id="camera" className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-between py-8">
          <div className="text-white text-sm font-bold">{label}</div>
          <div className={`relative p-6 rounded-xl border-2 border-dashed border-white/60 ${flash ? 'bg-white' : ''}`}><Sample kind={kind} big text={text} /></div>
          <div className="flex items-center gap-10">
            <button id="camera-cancel" onClick={() => setOpen(false)} className="text-white text-sm cursor-pointer">Cancel</button>
            <button id="camera-shutter" aria-label="Take photo" onClick={shoot} className="w-16 h-16 rounded-full bg-white border-4 border-slate-400 cursor-pointer" />
            <span className="w-12" />
          </div>
        </div>
      )}
    </>
  );
}

// A date without typing: tap a day
export const dayFrom = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(18, 0, 0, 0); return d.getTime(); };
export const dayLabel = (ms: number) => new Date(ms).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
export function DateChips({ id, value, onPick, words = ['Tomorrow', 'In 2 days', 'In 3 days', 'In a week'] }: { id: string; value: number | null; onPick: (ms: number) => void; words?: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[1, 2, 3, 7].map((n, i) => { const ms = dayFrom(n); return <button key={n} id={`${id}-${n}`} onClick={() => onPick(ms)} className={`min-h-[44px] rounded-xl border-2 text-sm font-bold cursor-pointer ${value === ms ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-800 border-slate-300'}`}>📅 {words[i]}<span className="block text-[10px] font-normal opacity-80">{dayLabel(ms)}</span></button>; })}
    </div>
  );
}
