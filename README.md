# LoadMatch — dispatch and receipt matching for small businesses

LoadMatch checks what was loaded onto a truck against what arrived at the other end. It covers trucks between a business's own units, deliveries to customers and deliveries from suppliers. Everyone uses a phone and WhatsApp links. Only the differences reach the owner, and the accountant gets Tally entries ready to approve.

It came out of a factory visit: two units with the same GSTIN, a handwritten dispatch list, counting done by hand at the other end, the owner chasing differences on the phone and CCTV checked only after an argument.

## How it works

| Who | Where | What they do |
|---|---|---|
| Dispatch staff | Phone | Type the list or paste it from Excel. Tap *Loading started* / *Loading finished* (with the dock or gate) and send the receiver a WhatsApp link when the truck leaves. At the gate, enter a supplier's bill and count what arrived. |
| Receiver | WhatsApp link, no login | Counts each line **without seeing the sent quantity**, marks damaged units, adds photos and submits once. The count locks. English, हिंदी, ಕನ್ನಡ, తెలుగు, with the option to speak a number. |
| Owner | Phone or laptop | Sees only short, excess or damaged lines, with their value. Decides each one from options that fit the flow, sets due dates for promises, and must tick to confirm losses above their limit. Attaches the CCTV clip (the loading time window says where to look) and shares an evidence pack on purpose. |
| Accountant | Laptop | Approves ready entries or rejects them with a reason (a rejected decision returns to the owner). Downloads one Tally XML file in import order. |

### Owner options by flow

| | Short | Damaged | Excess |
|---|---|---|---|
| **Between own units** | Write off as transit loss · Investigate | Write off · Investigate | Loading list was wrong: record as sent · Investigate |
| **From a supplier** | Replacement (due date) · Debit note · Accept · Investigate | same | Keep and get billed · Return (due date) · Investigate |
| **To a customer** | Send the rest (due date) · Credit note · Investigate | Send replacements (due date) · Credit note · Investigate | Bill the extra · Customer returns (due date) · Investigate |

### Tally entries prepared

- **Between units (same GSTIN):** a Stock Journal from the sending unit to *Goods in Transit* when the truck leaves. On receipt, good units go from *Goods in Transit* to the receiving unit, and damaged units go to *Damaged Goods*. A write-off moves them to *Transit Loss*.
- **From a supplier:** a Receipt Note for the good units counted, plus a Debit Note if the owner chooses one.
- **To a customer:** a Credit Note or a Sales invoice for the extra, with GST split CGST+SGST or IGST by the customer's state.
- No voucher numbers are set, because Tally numbers vouchers itself. Ledger and godown names must match the company's own Tally masters, so import into a test company first.

## Built on open standards

LoadMatch keeps an append-only event log (who did what, when, on which truck) in JSON. It runs in the phone's browser, shares by plain links, and exports Tally XML and CSV. That keeps it cheap and easy to connect to later (scales, barcode or RFID readers, an ERP). It does **not** claim conformance with any Industry 4.0 standard.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # rule tests
npm run build    # production build in dist/
```

Without Supabase settings, data stays in the browser on that device. To share data across phones:

1. In Supabase, run `supabase/migrations/20261118_loadmatch_events.sql` (SQL Editor → New query → Run).
2. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and optionally `VITE_LOADMATCH_WORKSPACE` in the hosting environment, then rebuild.

The demo policy lets anyone with the public key read and add events for the `demo` workspace. Before real data goes in, add sign-in and a policy for each business, and check receiver tokens on the server.

## Stack

React 19, TypeScript, Vite, Tailwind CSS 4, lucide-react, optional Supabase (Postgres + realtime), and an Express static server for Render.

## Demo data

Kaveri Wood Products, Mysuru: a plywood unit in Mysuru and a box unit in Bengaluru, two timber suppliers and two customers (one in Tamil Nadu, for IGST). The demo opens with 12 matched trucks plus:

- a transfer with 2 damaged and 5 short,
- a supplier delivery 10 short, with a replacement promised,
- a customer delivery 3 over,
- one truck in transit and one still loading.

All times are relative to the moment the demo is reset.
