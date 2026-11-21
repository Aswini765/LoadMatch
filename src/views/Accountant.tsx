import React from 'react';
import { AccountantPanel } from './Owner.tsx';
import { PageHeader } from './ui.tsx';

// The accountant does the paperwork for the owner's decisions: debit notes, credit notes, bills, and the stock entries.
export default function Accountant() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader title="Accountant" sub="The owner decides what happened; you do the paperwork. Tick each item when it is done in Tally, or send the whole file." />
      <AccountantPanel mode="accountant" />
    </div>
  );
}
