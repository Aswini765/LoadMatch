// Company setup on the shared database: log in with an email code, create the company,
// then add units, people, items and rules. Uses the stage-1 tables (supabase/migrations/20261119_*).
import React, { useCallback, useEffect, useState } from 'react';
import { LogOut, Mail, Building2, Factory, Users, Package, SlidersHorizontal, Plus, Check, AlertTriangle } from 'lucide-react';
import { client as supa } from '../sync.ts';
import { Panel, Note } from './ui.tsx';

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const inp = 'mt-1 w-full p-2.5 rounded-lg border border-slate-300 text-sm bg-white';
const lbl = 'block text-[11px] font-bold text-slate-700';
const btn = 'px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-bold cursor-pointer';
const btn2 = 'px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold cursor-pointer';

// Database messages in plain words
function plain(e: any): string {
  const m = String(e?.message || e || '');
  if (/duplicate key.*units_company_id_code/.test(m)) return 'A unit with this code already exists.';
  if (/duplicate key.*items_company_id_code/.test(m)) return 'An item with this code already exists.';
  if (/duplicate key.*members_company/.test(m)) return 'This person is already added.';
  if (/duplicate key.*gstin/.test(m)) return 'This GSTIN is already registered on LoadMatch.';
  if (/gstin/.test(m) && /check/.test(m)) return 'GSTIN looks wrong. It has 15 characters, like 29ABCDE1234F1Z5.';
  if (/pincode/.test(m)) return 'PIN code must be 6 digits.';
  if (/phone/.test(m) && /check/.test(m)) return 'Phone must be like +919876543210.';
  if (/email/.test(m) && /check/.test(m)) return 'Email looks wrong.';
  if (/hsn/.test(m)) return 'HSN must be 4 to 8 digits.';
  if (/gst_rate/.test(m)) return 'GST % must be one of 0, 0.25, 3, 5, 12, 18, 28, 40.';
  if (/rate limit|too many/i.test(m)) return 'Too many codes sent. Wait a few minutes and try again.';
  if (/expired|invalid.*(otp|token)/i.test(m)) return 'That code is wrong or expired. Ask for a new code.';
  if (/row-level security|permission denied/.test(m)) return 'Only the owner or a manager can change this.';
  return m || 'Something went wrong. Try again.';
}

export default function Setup() {
  const [session, setSession] = useState<any>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!supa) { setReady(true); return; }
    supa.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supa.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (!supa) return <div className="max-w-xl mx-auto"><Note tone="warn">The shared database is not connected on this site yet. Add the two Supabase settings in Render and redeploy.</Note></div>;
  if (!ready) return null;
  return <div className="max-w-3xl mx-auto space-y-4">{session ? <Company session={session} /> : <Login />}</div>;
}

// ---------- 1. log in with a code sent by email (no password, no sign-up form) ----------
function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const send = async () => {
    setBusy(true); setErr('');
    const { error } = await supa!.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) setErr(plain(error)); else setSent(true);
  };
  const verify = async () => {
    setBusy(true); setErr('');
    const { error } = await supa!.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setErr(plain(error));
  };
  const okEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  return (
    <Panel eyebrow="Company setup" title="Log in">
      <p className="text-xs text-slate-600">We send a code to your email. No password needed. Staff do not need this: they count through the WhatsApp link.</p>
      {!sent ? (
        <div className="space-y-3">
          <label className={lbl}>Your email<input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={inp} /></label>
          <button id="btn-send-code" disabled={!okEmail || busy} onClick={send} className={btn}><Mail className="w-4 h-4 inline mr-1" />{busy ? 'Sending…' : 'Send code'}</button>
        </div>
      ) : (
        <div className="space-y-3">
          <Note>Code sent to <b>{email.trim()}</b>. Check your inbox (and spam).</Note>
          <label className={lbl}>Code from the email<input id="login-code" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))} className={`${inp} font-mono text-lg tracking-widest`} /></label>
          <div className="flex gap-2">
            <button id="btn-verify" disabled={code.length < 6 || busy} onClick={verify} className={btn}>{busy ? 'Checking…' : 'Log in'}</button>
            <button onClick={() => { setSent(false); setCode(''); }} className={btn2}>Change email</button>
          </div>
        </div>
      )}
      {err && <div id="login-error" className="text-xs font-bold text-rose-700"><AlertTriangle className="w-3.5 h-3.5 inline mr-1" />{err}</div>}
    </Panel>
  );
}

// ---------- 2. the company: create it, or manage it ----------
function Company({ session }: { session: any }) {
  const [me, setMe] = useState<any[] | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    setErr('');
    await supa!.rpc('claim_membership');
    const { data, error } = await supa!.from('members').select('id, role, name, company_id, companies(id, legal_name, trade_name, gstin)').eq('auth_user_id', session.user.id).eq('active', true);
    if (error) setErr(plain(error)); else setMe(data || []);
  }, [session.user.id]);
  useEffect(() => { load(); }, [load]);

  const head = (
    <div className="flex items-center justify-between text-xs text-slate-600">
      <span>Logged in as <b>{session.user.email}</b></span>
      <button id="btn-logout" onClick={() => supa!.auth.signOut()} className={btn2}><LogOut className="w-3.5 h-3.5 inline mr-1" />Log out</button>
    </div>
  );
  if (err) return <>{head}<Note tone="stop">{err}</Note></>;
  if (!me) return head;
  if (!me.length) return <>{head}<CreateCompany onDone={load} /></>;
  const m = me[0];
  return <>{head}<Manage companyId={m.company_id} role={m.role} companyName={m.companies?.trade_name || m.companies?.legal_name} /></>;
}

function CreateCompany({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ legal: '', trade: '', gstin: '', name: '', phone: '', city: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  const gstin = f.gstin.trim().toUpperCase();
  const missing = [!f.legal.trim() && 'company name', !f.name.trim() && 'your name', gstin && !GSTIN_RE.test(gstin) && 'a correct GSTIN (or leave it empty)'].filter(Boolean);
  const save = async () => {
    setBusy(true); setErr('');
    const phone = f.phone.trim() ? (f.phone.trim().startsWith('+') ? f.phone.trim() : `+91${f.phone.replace(/[^0-9]/g, '').slice(-10)}`) : null;
    const { error } = await supa!.rpc('create_company', { p_legal_name: f.legal, p_trade_name: f.trade, p_gstin: gstin, p_owner_name: f.name, p_owner_phone: phone, p_city: f.city });
    setBusy(false);
    if (error) setErr(plain(error)); else onDone();
  };
  return (
    <Panel eyebrow="Step 1 of 5" title="Create your company">
      <p className="text-xs text-slate-600">You become the owner. Next you add your units, people, items and rules.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className={lbl}>Company name (as on GST)<input id="co-legal" value={f.legal} onChange={(e) => set('legal', e.target.value)} className={inp} /></label>
        <label className={lbl}>Name on the board (optional)<input id="co-trade" value={f.trade} onChange={(e) => set('trade', e.target.value)} className={inp} /></label>
        <label className={lbl}>GSTIN (so partners can find you)<input id="co-gstin" value={f.gstin} onChange={(e) => set('gstin', e.target.value.toUpperCase())} placeholder="29ABCDE1234F1Z5" className={`${inp} font-mono`} /></label>
        <label className={lbl}>City<input id="co-city" value={f.city} onChange={(e) => set('city', e.target.value)} className={inp} /></label>
        <label className={lbl}>Your name<input id="co-owner" value={f.name} onChange={(e) => set('name', e.target.value)} className={inp} /></label>
        <label className={lbl}>Your phone (optional)<input id="co-phone" type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="98765 43210" className={inp} /></label>
      </div>
      {missing.length > 0 && <div className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2">Still needed: {missing.join(' · ')}</div>}
      {err && <div className="text-xs font-bold text-rose-700">{err}</div>}
      <button id="btn-create-company" disabled={missing.length > 0 || busy} onClick={save} className={btn}>{busy ? 'Creating…' : 'Create company'}</button>
    </Panel>
  );
}

const TABS = [
  ['company', 'Company', Building2], ['units', 'Units', Factory], ['people', 'People', Users], ['items', 'Items', Package], ['rules', 'Rules', SlidersHorizontal],
] as const;

function Manage({ companyId, role, companyName }: { companyId: string; role: string; companyName: string }) {
  const [tab, setTab] = useState('company');
  const canEdit = role === 'owner' || role === 'manager';
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">{companyName}</h1>
        <span className="text-[11px] font-bold uppercase text-slate-500">You: {role}</span>
      </div>
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map(([id, label, Icon]) => (
          <button key={id} id={`tab-${id}`} onClick={() => setTab(id)} className={`shrink-0 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer flex items-center ${tab === id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>
            <Icon className="w-3.5 h-3.5 mr-1" />{label}
          </button>
        ))}
      </div>
      {!canEdit && <Note>You can see the setup. Only the owner or a manager can change it.</Note>}
      {tab === 'company' && <CompanyTab id={companyId} canEdit={role === 'owner'} />}
      {tab === 'units' && <ListTab companyId={companyId} canEdit={canEdit} kind="units" />}
      {tab === 'people' && <ListTab companyId={companyId} canEdit={role === 'owner'} kind="members" />}
      {tab === 'items' && <ListTab companyId={companyId} canEdit={canEdit} kind="items" />}
      {tab === 'rules' && <RulesTab companyId={companyId} canEdit={role === 'owner'} />}
    </div>
  );
}

function useSaved() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const show = (error: any, okText = 'Saved') => { setMsg(error ? { ok: false, text: plain(error) } : { ok: true, text: okText }); if (!error) setTimeout(() => setMsg(null), 2500); };
  const node = msg && <div id="save-msg" className={`text-xs font-bold ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.ok ? <Check className="w-3.5 h-3.5 inline mr-1" /> : <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />}{msg.text}</div>;
  return [show, node] as const;
}

function CompanyTab({ id, canEdit }: { id: string; canEdit: boolean }) {
  const [c, setC] = useState<any>(null);
  const [show, msg] = useSaved();
  useEffect(() => { supa!.from('companies').select('*').eq('id', id).single().then(({ data }) => setC(data)); }, [id]);
  if (!c) return null;
  const f = (k: string, label: string, extra: any = {}) => (
    <label className={lbl}>{label}<input id={`c-${k}`} disabled={!canEdit} value={c[k] || ''} onChange={(e) => setC({ ...c, [k]: extra.upper ? e.target.value.toUpperCase() : e.target.value })} className={`${inp} ${extra.mono ? 'font-mono' : ''}`} placeholder={extra.ph} /></label>
  );
  const save = async () => {
    const gstin = (c.gstin || '').trim() || null;
    if (gstin && !GSTIN_RE.test(gstin)) return show('gstin check');
    const { error } = await supa!.from('companies').update({
      legal_name: c.legal_name, trade_name: c.trade_name || null, gstin, gst_state_code: gstin ? gstin.slice(0, 2) : null, pan: c.pan || null,
      address: c.address || null, city: c.city || null, pincode: c.pincode || null, phone: c.phone || null, email: c.email || null, discoverable: c.discoverable,
    }).eq('id', id);
    show(error);
  };
  return (
    <Panel eyebrow="Company" title="Details on your challans and papers">
      <div className="grid sm:grid-cols-2 gap-3">
        {f('legal_name', 'Company name (as on GST)')}{f('trade_name', 'Name on the board')}
        {f('gstin', 'GSTIN', { upper: true, mono: true, ph: '29ABCDE1234F1Z5' })}{f('pan', 'PAN', { upper: true, mono: true })}
        <div className="sm:col-span-2">{f('address', 'Address')}</div>
        {f('city', 'City')}{f('pincode', 'PIN code', { mono: true })}
        {f('phone', 'Office phone (partners can find you by it)', { ph: '+918040000000' })}{f('email', 'Office email')}
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-700"><input id="c-discoverable" type="checkbox" disabled={!canEdit} checked={!!c.discoverable} onChange={(e) => setC({ ...c, discoverable: e.target.checked })} />Other companies can find us by our exact GSTIN or phone</label>
      {canEdit && <button id="btn-save-company" onClick={save} className={btn}>Save</button>}
      {msg}
    </Panel>
  );
}

// Units, people and items share one simple list + add form
const LISTS: Record<string, { title: string; eyebrow: string; cols: [string, string][]; add: [string, string, string?][]; order: string; help: string }> = {
  units: { eyebrow: 'Units', title: 'Factories, branches and godowns', order: 'code', help: 'Goods move between these with "To our other unit". Loading points are your docks, e.g. Dock 1, Dock 2.',
    cols: [['code', 'Code'], ['name', 'Name'], ['kind', 'Type'], ['city', 'City'], ['docks', 'Loading points']],
    add: [['code', 'Short code', 'MYS'], ['name', 'Name', 'Mysuru unit'], ['kind', 'Type'], ['city', 'City'], ['docks', 'Loading points (comma separated)', 'Dock 1, Dock 2'], ['gstin', 'GSTIN if different (other state)']] },
  members: { eyebrow: 'People', title: 'Who uses LoadMatch', order: 'name', help: 'Add people by email (they log in with a code) or phone (for later). Receivers who only count can use the WhatsApp link without being added.',
    cols: [['name', 'Name'], ['role', 'Role'], ['email', 'Email'], ['phone', 'Phone'], ['auth_user_id', 'Logged in']],
    add: [['name', 'Name'], ['role', 'Role'], ['email', 'Email', 'ravi@company.com'], ['phone', 'Phone', '98765 43210'], ['language', 'Language']] },
  items: { eyebrow: 'Items', title: 'What you make, buy and send', order: 'code', help: 'Rate is the value of one unit; it gives the ₹ amount of a shortage. You can also paste rows from Excel below.',
    cols: [['code', 'Code'], ['name', 'Name'], ['uom', 'Unit'], ['hsn', 'HSN'], ['gst_rate', 'GST %'], ['rate', 'Rate ₹']],
    add: [['code', 'Code', 'BRP-1148'], ['name', 'Name', 'Plywood 12 mm'], ['uom', 'Unit', 'pcs'], ['hsn', 'HSN', '4412'], ['gst_rate', 'GST %', '18'], ['rate', 'Rate ₹', '1450']] },
};
const CHOICES: Record<string, [string, string][]> = {
  kind: [['factory', 'Factory'], ['branch', 'Branch'], ['godown', 'Godown'], ['shop', 'Shop'], ['office', 'Office']],
  role: [['receiver', 'Receiver (counts)'], ['dispatch', 'Dispatch (sends)'], ['accountant', 'Accountant'], ['manager', 'Manager'], ['owner', 'Owner']],
  language: [['en', 'English'], ['hi', 'हिंदी'], ['kn', 'ಕನ್ನಡ'], ['te', 'తెలుగు']],
};

function clean(kind: string, row: Record<string, string>) {
  const out: any = {};
  for (const [k, v] of Object.entries(row)) out[k] = String(v ?? '').trim() || null;
  if (kind === 'units') { out.code = (out.code || '').toUpperCase(); out.docks = out.docks ? out.docks.split(',').map((x: string) => x.trim()).filter(Boolean) : []; out.gstin = out.gstin ? out.gstin.toUpperCase() : null; out.kind = out.kind || 'factory'; }
  if (kind === 'members') { out.role = out.role || 'receiver'; out.language = out.language || 'en'; if (out.phone) out.phone = out.phone.startsWith('+') ? out.phone.replace(/[^0-9+]/g, '') : `+91${out.phone.replace(/[^0-9]/g, '').slice(-10)}`; if (out.email) out.email = out.email.toLowerCase(); }
  if (kind === 'items') { out.code = (out.code || '').toUpperCase(); out.uom = out.uom || 'pcs'; out.rate = Number(out.rate || 0); out.gst_rate = out.gst_rate == null ? null : Number(out.gst_rate); }
  return out;
}
function needs(kind: string, r: any) {
  if (kind === 'units') return [!r.code && 'code', !r.name && 'name'].filter(Boolean);
  if (kind === 'members') return [!r.name && 'name', !r.email && !r.phone && 'email or phone'].filter(Boolean);
  return [!r.code && 'code', !r.name && 'name'].filter(Boolean);
}

function ListTab({ companyId, canEdit, kind }: { companyId: string; canEdit: boolean; kind: 'units' | 'members' | 'items' }) {
  const L = LISTS[kind];
  const [rows, setRows] = useState<any[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [paste, setPaste] = useState('');
  const [show, msg] = useSaved();
  const load = useCallback(async () => {
    const { data } = await supa!.from(kind).select('*').eq('company_id', companyId).order(L.order);
    setRows(data || []);
  }, [companyId, kind]);
  useEffect(() => { load(); setDraft({}); }, [load]);
  const row = clean(kind, draft);
  const missing = needs(kind, row);
  const add = async () => {
    const { error } = await supa!.from(kind).insert({ ...row, company_id: companyId });
    show(error, 'Added'); if (!error) { setDraft({}); load(); }
  };
  const toggle = async (r: any) => { const { error } = await supa!.from(kind).update({ active: !r.active }).eq('id', r.id); show(error, r.active ? 'Turned off' : 'Turned on'); load(); };
  // Excel paste: one item per line, columns code, name, unit, HSN, GST %, rate (tab or comma separated)
  const pasted = paste.split('\n').map((l) => l.split(/\t|,/).map((x) => x.trim())).filter((c) => c[0] && c[1]).map((c) => clean('items', { code: c[0], name: c[1], uom: c[2] || 'pcs', hsn: c[3] || '', gst_rate: c[4] || '', rate: c[5] || '0' }));
  const addPasted = async () => {
    const { error } = await supa!.from('items').insert(pasted.map((p) => ({ ...p, company_id: companyId })));
    show(error, `${pasted.length} items added`); if (!error) { setPaste(''); load(); }
  };
  const cell = (r: any, k: string) => k === 'docks' ? (r.docks || []).join(', ') : k === 'auth_user_id' ? (r.auth_user_id ? 'Yes' : 'Not yet') : k === 'role' ? (CHOICES.role.find((c) => c[0] === r.role)?.[1] || r.role) : k === 'kind' ? (CHOICES.kind.find((c) => c[0] === r.kind)?.[1] || r.kind) : (r[k] ?? '—');
  return (
    <Panel eyebrow={L.eyebrow} title={L.title}>
      <p className="text-xs text-slate-600">{L.help}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-left text-slate-500">{L.cols.map(([k, h]) => <th key={k} className="py-1 pr-3 font-bold">{h}</th>)}<th /></tr></thead>
          <tbody>
            {!rows.length && <tr><td colSpan={L.cols.length + 1} className="py-2 text-slate-500">Nothing added yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className={`border-t border-slate-100 ${r.active === false ? 'opacity-40' : ''}`}>
                {L.cols.map(([k]) => <td key={k} className="py-1.5 pr-3">{String(cell(r, k))}</td>)}
                <td className="py-1.5 text-right">{canEdit && <button onClick={() => toggle(r)} className="text-[11px] font-bold text-slate-600 underline cursor-pointer">{r.active === false ? 'Turn on' : 'Turn off'}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
          <div className="text-xs font-bold text-slate-800">Add</div>
          <div className="grid sm:grid-cols-3 gap-2">
            {L.add.map(([k, label, ph]) => (
              <label key={k} className={lbl}>{label}
                {CHOICES[k] ? (
                  <select id={`add-${k}`} value={draft[k] || CHOICES[k][0][0]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} className={inp}>{CHOICES[k].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
                ) : (
                  <input id={`add-${k}`} value={draft[k] || ''} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} placeholder={ph} className={inp} />
                )}
              </label>
            ))}
          </div>
          {missing.length > 0 && Object.keys(draft).length > 0 && <div className="text-[11px] text-amber-900">Still needed: {missing.join(' · ')}</div>}
          <button id={`btn-add-${kind}`} disabled={missing.length > 0} onClick={add} className={btn}><Plus className="w-4 h-4 inline mr-1" />Add</button>
        </div>
      )}
      {canEdit && kind === 'items' && (
        <div className="rounded-xl border border-slate-200 p-3 space-y-2">
          <div className="text-xs font-bold text-slate-800">Paste from Excel</div>
          <div className="text-[11px] text-slate-600">Copy these columns from Excel, in this order: Code, Name, Unit, HSN, GST %, Rate.</div>
          <textarea id="items-paste" value={paste} onChange={(e) => setPaste(e.target.value)} rows={4} className={`${inp} font-mono text-xs`} placeholder={'BRP-1148\tPlywood 12 mm\tpcs\t4412\t18\t1450'} />
          {pasted.length > 0 && <button id="btn-add-pasted" onClick={addPasted} className={btn}>Add {pasted.length} items</button>}
        </div>
      )}
      {msg}
    </Panel>
  );
}

function RulesTab({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const [s, setS] = useState<any>(null);
  const [show, msg] = useSaved();
  useEffect(() => { supa!.from('company_settings').select('*').eq('company_id', companyId).single().then(({ data }) => setS(data)); }, [companyId]);
  if (!s) return null;
  const save = async () => {
    const { error } = await supa!.from('company_settings').update({
      receipt_hours: Number(s.receipt_hours), blind_count: s.blind_count, differences_to: s.differences_to, jobwork_days: Number(s.jobwork_days),
      eway_threshold: Number(s.eway_threshold), photos_required: s.photos_required, tally_company_name: s.tally_company_name || null, updated_at: new Date().toISOString(),
    }).eq('company_id', companyId);
    show(error);
  };
  const num = (k: string, label: string) => <label className={lbl}>{label}<input id={`r-${k}`} disabled={!canEdit} inputMode="numeric" value={s[k] ?? ''} onChange={(e) => setS({ ...s, [k]: e.target.value.replace(/[^0-9.]/g, '') })} className={inp} /></label>;
  const chk = (k: string, label: string) => <label className="flex items-center gap-2 text-xs text-slate-700"><input id={`r-${k}`} type="checkbox" disabled={!canEdit} checked={!!s[k]} onChange={(e) => setS({ ...s, [k]: e.target.checked })} />{label}</label>;
  return (
    <Panel eyebrow="Rules" title="How your company works">
      <div className="grid sm:grid-cols-2 gap-3">
        {num('receipt_hours', 'Count is late after (hours)')}
        {num('jobwork_days', 'Job work must come back within (days)')}
        {num('eway_threshold', 'Ask for e-way bill above (₹)')}
        <label className={lbl}>Who sees differences<select id="r-differences_to" disabled={!canEdit} value={s.differences_to} onChange={(e) => setS({ ...s, differences_to: e.target.value })} className={inp}><option value="all">Sender and receiver</option><option value="owner">Owner only</option></select></label>
        <label className={lbl}>Company name in Tally<input id="r-tally" disabled={!canEdit} value={s.tally_company_name || ''} onChange={(e) => setS({ ...s, tally_company_name: e.target.value })} className={inp} /></label>
      </div>
      {chk('blind_count', 'Receiver does not see the sent quantity while counting')}
      {chk('photos_required', 'Photo needed when there is a difference')}
      {canEdit && <button id="btn-save-rules" onClick={save} className={btn}>Save</button>}
      {msg}
    </Panel>
  );
}
