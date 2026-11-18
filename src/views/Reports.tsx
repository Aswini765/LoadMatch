import React from 'react';
import { Download } from 'lucide-react';
import { useStore, item, route, diffsOf, lossValue, shipmentStatus, ACTIONS, KIND_LABEL, FLOW_LABEL } from '../store.tsx';
import { PageHeader, Panel, type Go } from './ui.tsx';
import { inr0, dateTime } from '../lib/format.ts';
import { download } from '../lib/tally.ts';

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export default function Reports({ go }: { go: Go }) {
  const { state } = useStore();
  const hours = state.settings.receiptHours;
  const counted = state.shipments.filter((s: any) => s.receipt);
  const matched = counted.filter((s: any) => !diffsOf(state, s.id).length);
  const onTime = counted.filter((s: any) => s.receipt.at - s.sentAt <= hours * 3600000);
  const diffs = state.diffs;
  const lost = diffs.reduce((a: number, d: any) => a + lossValue(d), 0);
  const recovered = diffs.filter((d: any) => d.status === 'settled' && !lossValue(d)).reduce((a: number, d: any) => a + d.value, 0);
  const openValue = diffs.filter((d: any) => d.status !== 'settled').reduce((a: number, d: any) => a + d.value, 0);

  const group = (key: (s: any) => string) => {
    const m = new Map<string, { trucks: number; matched: number; diffs: number; value: number; lost: number }>();
    for (const s of counted) {
      const k = key(s);
      const g = m.get(k) || { trucks: 0, matched: 0, diffs: 0, value: 0, lost: 0 };
      const ds = diffsOf(state, s.id);
      g.trucks += 1; if (!ds.length) g.matched += 1;
      g.diffs += ds.length; g.value += ds.reduce((a: number, d: any) => a + d.value, 0); g.lost += ds.reduce((a: number, d: any) => a + lossValue(d), 0);
      m.set(k, g);
    }
    return [...m.entries()].sort((a, b) => b[1].value - a[1].value);
  };
  const byRoute = group(route);
  const byFlow = group((s) => FLOW_LABEL[s.flow]);

  const csv = () => {
    const head = ['difference', 'truck', 'flow', 'route', 'truck_no', 'ref', 'item', 'kind', 'qty', 'unit', 'value_inr', 'status', 'decision', 'due', 'loss_inr', 'counted_by', 'counted_at'];
    const rows = diffs.map((d: any) => {
      const s = state.shipments.find((x: any) => x.id === d.shipmentId);
      return [d.id, s.id, s.flow, route(s), s.truckNo, s.ref, item(d.item).name, d.kind, d.qty, item(d.item).unit, d.value, d.status, d.decision ? ACTIONS[d.decision.action].label : '', d.decision?.dueAt ? dateTime(d.decision.dueAt) : '', lossValue(d), s.receipt.by, dateTime(s.receipt.at)];
    });
    const q = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    download('loadmatch-differences.csv', [head, ...rows].map((r) => r.map(q).join(',')).join('\n'), 'text/csv');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader title="Reports" sub={`${counted.length} trucks counted · ${diffs.length} differences`} right={
        <button id="btn-csv" onClick={csv} className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold flex items-center cursor-pointer"><Download className="w-3.5 h-3.5 mr-1.5" />Differences CSV</button>} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="Trucks that matched" value={`${pct(matched.length, counted.length)}%`} sub={`${matched.length} of ${counted.length}`} />
        <Tile label={`Counted within ${hours}h`} value={`${pct(onTime.length, counted.length)}%`} sub={`${onTime.length} of ${counted.length}`} />
        <Tile label="Recovered" value={inr0(recovered)} sub="replaced, billed, noted or corrected" tone="text-emerald-700" />
        <Tile label="Lost" value={inr0(lost)} sub={`${inr0(openValue)} still open`} tone="text-rose-700" />
      </div>
      <Panel eyebrow="Where differences happen" title="By route">
        <Table rows={byRoute} />
      </Panel>
      <Panel eyebrow="By kind of movement" title="By flow">
        <Table rows={byFlow} />
      </Panel>
      <Panel eyebrow="All differences" title="Status">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-slate-500 border-b border-slate-200"><th className="py-1.5 pr-2">Diff</th><th className="pr-2">Item</th><th className="pr-2">Kind</th><th className="pr-2 text-right">Value</th><th className="pr-2">Decision</th><th>Status</th></tr></thead>
            <tbody>{diffs.map((d: any) => (
              <tr key={d.id} className="border-b border-slate-100">
                <td className="py-1.5 pr-2 font-mono">{d.id}</td><td className="pr-2">{d.qty} {item(d.item).name}</td><td className="pr-2">{KIND_LABEL[d.kind]}</td>
                <td className="pr-2 text-right font-mono">{inr0(d.value)}</td><td className="pr-2">{d.decision ? ACTIONS[d.decision.action].label : '—'}</td><td className="capitalize">{d.status}</td>
              </tr>))}</tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Tile({ label, value, sub, tone = 'text-slate-900' }: { label: string; value: string; sub: string; tone?: string }) {
  return <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs"><div className="text-[11px] text-slate-500">{label}</div><div className={`text-xl font-bold mt-0.5 ${tone}`}>{value}</div><div className="text-[10px] text-slate-400">{sub}</div></div>;
}

function Table({ rows }: { rows: [string, any][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr className="text-left text-slate-500 border-b border-slate-200"><th className="py-1.5 pr-2"></th><th className="pr-2 text-right">Trucks</th><th className="pr-2 text-right">Matched</th><th className="pr-2 text-right">Differences</th><th className="pr-2 text-right">Value</th><th className="text-right">Lost</th></tr></thead>
        <tbody>{rows.map(([k, g]) => (
          <tr key={k} className="border-b border-slate-100">
            <td className="py-1.5 pr-2 font-semibold">{k}</td><td className="pr-2 text-right">{g.trucks}</td><td className="pr-2 text-right">{pct(g.matched, g.trucks)}%</td>
            <td className="pr-2 text-right">{g.diffs}</td><td className="pr-2 text-right font-mono">{inr0(g.value)}</td><td className="text-right font-mono text-rose-700">{inr0(g.lost)}</td>
          </tr>))}</tbody>
      </table>
    </div>
  );
}
