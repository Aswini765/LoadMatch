import React, { useEffect, useState } from 'react';
import { Menu, MapPin, Settings2, BookOpen, X } from 'lucide-react';
import { COMPANY } from './data/seed.ts';
import Home from './views/Home.tsx';
import Dispatch from './views/Dispatch.tsx';
import Receive, { ReceiveTab, CountBack } from './views/Receive.tsx';
import Owner, { EvidenceView } from './views/Owner.tsx';
import { useStore, receiptOverdue, countedByUs, atGate } from './store.tsx';
import Reports from './views/Reports.tsx';
import SopModal from './views/SopModal.tsx';
import SettingsModal from './views/SettingsModal.tsx';
import type { Go } from './views/ui.tsx';

const ROLES = [
  ['home', 'Home'],
  ['dispatch', 'Dispatch'],
  ['receive', 'Receive'],
  ['owner', 'Owner'],
  ['reports', 'Reports'],
];

function SyncChip() {
  const { sync } = useStore();
  const label = !sync.shared ? 'This device only' : !sync.online ? `Offline • ${sync.pending} waiting` : sync.pending ? `Syncing ${sync.pending}` : 'Shared • live';
  const dot = !sync.shared ? 'bg-slate-400' : !sync.online ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <span id="sync-chip" title={sync.shared ? 'Dispatch, receivers and the owner see the same data' : 'Data is saved in this browser only. Connect Supabase to share across phones.'}
      className="hidden md:inline-flex items-center space-x-1.5 text-slate-600 bg-slate-50 border border-slate-200/80 px-2 py-1 rounded-md">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`}></span><span>{label}</span>
    </span>
  );
}

// What is waiting for each role, shown on the nav so nobody has to go looking
function useBadges() {
  const { state } = useStore();
  const now = Date.now();
  const owner = state.diffs.filter((d: any) => d.status === 'open' || d.status === 'investigating').length + (state.requests || []).filter((r: any) => r.status === 'pending').length;
  const late = state.shipments.filter((s: any) => receiptOverdue(state, s, now)).length;
  const loading = state.shipments.filter((s: any) => !s.sentAt && !s.cancelledAt && !atGate(s.flow)).length;
  const toCount = state.shipments.filter((s: any) => !s.receipt && !s.cancelledAt && countedByUs(s) && (s.flow !== 'transfer' || s.sentAt)).length;
  return {
    dispatch: late ? { n: late, cls: 'bg-rose-600' } : loading ? { n: loading, cls: 'bg-slate-400' } : null,
    receive: toCount ? { n: toCount, cls: 'bg-sky-600' } : null,
    owner: owner ? { n: owner, cls: 'bg-amber-500' } : null,
  } as Record<string, { n: number; cls: string } | null>;
}

// Links shared on WhatsApp open one screen directly: #/r/<truck>/<token>/<load> (receiver), #/c/<truck>/<token>/<count> (count back to sender), #/e/<diff>/<token> (evidence)
function useHashRoute() {
  const read = () => { const m = window.location.hash.match(/^#\/(r|e|c)\/([^/]+)\/([^/?#]+)(?:\/([^/?#]+))?/); return m ? { kind: m[1], id: decodeURIComponent(m[2]), token: m[3], payload: m[4] || '' } : null; };
  const [r, setR] = useState(read);
  useEffect(() => { const on = () => setR(read()); window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on); }, []);
  return r;
}

export default function App() {
  const [view, setView] = useState('home');
  const [openId, setOpenId] = useState<string | null>(null);
  const link = useHashRoute();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sopOpen, setSopOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nav, setNav] = useState(0); // a nav click always reopens the role's main screen
  const badges = useBadges();

  const go: Go = (v, opts = {}) => {
    setView(v);
    setOpenId(opts.id ?? null);
    if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    setNav((n) => n + 1);
    setMobileOpen(false);
  };

  return (
    <div className="flex h-screen w-full max-w-full overflow-hidden bg-slate-50 text-slate-900 font-sans antialiased">
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto overflow-x-hidden">
        <header id="main-topbar" className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 z-30 shadow-2xs sticky top-0">
          <div className="flex items-center space-x-3 shrink-0">
            {!link && <button id="btn-toggle-mobile-menu" onClick={() => setMobileOpen((o) => !o)} className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 sm:hidden cursor-pointer" aria-label="Open Navigation Menu">
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>}
            <div className={`flex items-center space-x-2.5 select-none ${link ? '' : 'cursor-pointer'}`} onClick={() => !link && go('home')}>
              <div className="w-7 h-7 rounded-md bg-slate-900 text-white font-bold text-xs flex items-center justify-center tracking-tight">LM</div>
              <div className="flex flex-col">
                <span className="font-bold text-sm tracking-tight text-slate-950 leading-tight">LoadMatch</span>
                <span className="text-[11px] font-medium text-slate-500 leading-none">Sent vs received, for every truck</span>
              </div>
            </div>
          </div>
          {!link && <nav id="role-switcher-nav" className="hidden sm:flex items-center space-x-1" aria-label="Application Role Switcher">
            {ROLES.map(([id, label]) => (
              <button key={id} id={`role-btn-${id}`} onClick={() => go(id)}
                className={`inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${!link && view === id ? 'text-slate-950 bg-slate-100 font-bold' : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'}`}>
                {label}
                {badges[id] && <span className={`ml-1.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] font-bold text-white ${badges[id]!.cls}`}>{badges[id]!.n}</span>}
              </button>
            ))}
          </nav>}
          {!link && <div className="flex items-center space-x-3 shrink-0 text-xs">
            <div className="hidden lg:flex items-center space-x-1.5 text-slate-600 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-md">
              <MapPin className="w-3 h-3 text-slate-400" />
              <span className="font-medium text-slate-800">{COMPANY.name}, {COMPANY.city}</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500 font-normal">Demo Environment</span>
            </div>
            <SyncChip />
            {!['dispatch', 'receive'].includes(view) && <button id="btn-open-settings" onClick={() => setSettingsOpen(true)} className="text-slate-600 hover:text-slate-950 font-medium px-2 py-1 rounded hover:bg-slate-100 transition-colors cursor-pointer hidden sm:inline-flex items-center space-x-1">
              <Settings2 className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden md:inline">Settings</span>
            </button>}
            <button id="btn-open-sop-guidance" onClick={() => setSopOpen(true)} className="text-slate-700 hover:text-slate-950 font-medium bg-slate-100 hover:bg-slate-200/80 border border-slate-200 px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center space-x-1.5" title="How LoadMatch is used">
              <BookOpen className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">How it works</span>
            </button>
          </div>}
        </header>

        {mobileOpen && !link && (
          <div className="sm:hidden bg-white border-b border-slate-200 px-4 py-2 space-y-1 shadow-xs z-20">
            {ROLES.map(([id, label]) => (
              <button key={id} id={`m-role-${id}`} onClick={() => go(id)} className={`block w-full text-left px-3 py-2 text-xs font-semibold rounded-md cursor-pointer ${view === id ? 'text-slate-950 bg-slate-100 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>{label}{badges[id] && <span className={`ml-1.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] font-bold text-white ${badges[id]!.cls}`}>{badges[id]!.n}</span>}</button>
            ))}
            <button id="m-settings" onClick={() => { setSettingsOpen(true); setMobileOpen(false); }} className="block w-full text-left px-3 py-2 text-xs font-semibold rounded-md text-slate-600 hover:bg-slate-50 cursor-pointer border-t border-slate-100 mt-1 pt-2">Settings (owner)</button>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-full overflow-x-hidden">
          {link?.kind === 'r' && <Receive id={link.id} token={link.token} payload={link.payload} key={`${link.id}-${link.token}`} />}
          {link?.kind === 'c' && <CountBack id={link.id} token={link.token} payload={link.payload} onOpen={(id) => go('dispatch', { id })} />}
          {link?.kind === 'e' && <EvidenceView id={link.id} token={link.token} />}
          {!link && <>
            {view === 'home' && <Home go={go} />}
            {view === 'dispatch' && <Dispatch go={go} initialId={openId} key={nav} />}
            {view === 'owner' && <Owner go={go} initialId={openId} key={`${openId || 'list'}-${nav}`} />}
            {view === 'receive' && <ReceiveTab key={nav} />}
            {view === 'reports' && <Reports go={go} />}
          </>}
        </main>
      </div>
      {sopOpen && <SopModal onClose={() => setSopOpen(false)} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
