import React from 'react';
import { STATUS_META, useStore } from '../store.tsx';
import { LANGS } from '../i18n.ts';

export type Go = (v: string, opts?: { id?: string | null }) => void;

export function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border whitespace-nowrap ${m.cls}`}>{m.label.toUpperCase()}</span>;
}

export function Panel({ eyebrow, title, right, children, className = '' }: { eyebrow: string; title: string; right?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-4 ${className}`}>
      <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">{eyebrow}</span>
          <h2 className="text-sm font-bold text-slate-900 mt-0.5">{title}</h2>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div>
      <span className="text-slate-400 block text-[11px]">{label}</span>
      <span className="font-semibold text-slate-900">{children}</span>
    </div>
  );
}

export function PageHeader({ title, sub, right }: { title: string; sub: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">{title}</h1>
        <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
      </div>
      {right}
    </div>
  );
}

export function AuditTrail({ audit }: { audit: any[] }) {
  return (
    <div className="space-y-1.5 text-[11px] font-mono">
      {audit.map((a, i) => (
        <div key={i} className="p-1.5 rounded bg-slate-50 border border-slate-100 text-slate-600 space-y-0.5">
          <div className="flex justify-between font-bold text-slate-800">
            <span>{a.type}</span>
            <span className="text-[10px] text-slate-400">{new Date(a.at).toLocaleTimeString('en-IN', { hour12: false })}</span>
          </div>
          <div className="text-[10px] text-slate-500"><span className="font-semibold text-slate-600">{a.actor}:</span> {a.detail}</div>
        </div>
      ))}
    </div>
  );
}

// ---------- phone screens (dispatch staff, receiver) ----------

export const savedLang = () => { try { return localStorage.getItem('loadmatch-lang') || 'en'; } catch { return 'en'; } };
export const saveLang = (l: string) => { try { localStorage.setItem('loadmatch-lang', l); } catch { /* ignore */ } };

export function PhoneFrame({ title, sub, lang, setLang, children }: { title: string; sub: string; lang: string; setLang: (l: string) => void; children?: React.ReactNode }) {
  const { state } = useStore();
  const langs = Object.keys(LANGS).filter((l) => l === 'en' || state.settings.languages[l] !== false);
  return (
    <div className="w-full flex flex-col items-center justify-start pb-12 px-2 sm:px-4">
      <div className="w-full max-w-[440px] bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden flex flex-col min-h-[560px]">
        <div className="bg-emerald-800 text-white px-4 py-3 flex items-center space-x-2.5 shadow-xs">
          <div className="w-9 h-9 rounded-full bg-emerald-600 border border-emerald-400/40 flex items-center justify-center font-bold text-xs text-white">LM</div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white tracking-wide truncate">{title}</div>
            <div className="text-[11px] text-emerald-200 truncate">{sub}</div>
          </div>
        </div>
        <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex items-center justify-end">
          <div className="inline-flex rounded-lg bg-white border border-slate-200 p-0.5 shadow-2xs">
            {langs.map((l) => (
              <button key={l} id={`lang-${l}`} onClick={() => setLang(l)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${lang === l ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}>{LANGS[l].label}</button>
            ))}
          </div>
        </div>
        <div className="p-4 sm:p-5 space-y-4 bg-white flex-1 flex flex-col">{children}</div>
      </div>
    </div>
  );
}

export function Note({ tone = 'info', children }: { tone?: string; children?: React.ReactNode }) {
  const cls = tone === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-950' : tone === 'stop' ? 'bg-rose-50 border-rose-200 text-rose-950' : tone === 'go' ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-slate-50 border-slate-200 text-slate-800';
  return <div className={`rounded-xl p-3 text-xs font-semibold leading-relaxed border shadow-2xs ${cls}`}>{children}</div>;
}

export const shareWhatsApp = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
export const appLink = (path: string) => `${window.location.origin}${window.location.pathname}${path}`;
export const newToken = () => { const a = new Uint8Array(9); crypto.getRandomValues(a); return Array.from(a, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 14); };
