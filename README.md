# LoadMatch — dispatch and receipt matching for small businesses

LoadMatch checks what was loaded onto a truck against what arrived at the other end. It covers trucks between a business's own units, deliveries to customers and deliveries from suppliers. Everyone uses a phone and WhatsApp links. Only the differences reach the owner, and the accountant gets Tally entries ready to approve.

It came out of a factory visit: two units with the same GSTIN, a handwritten dispatch list, counting done by hand at the other end, the owner chasing differences on the phone and CCTV checked only after an argument.

## How it works

| Who | Where | What they do |
|---|---|---|
| Dispatch (sender) | Phone | Lists what is going: typed, spoken or pasted from Excel, with a photo of the dispatch list, challan or order. Between own units, chooses **No money (stock transfer)** or **With invoice and GST** (suggested from the units' GSTINs, the sender decides), and can print a delivery challan for no-money moves. Records loading start and end with the dock or gate, then sends the receiver a WhatsApp link. Sees the result when the count comes back. |
| Receive (floor staff) | WhatsApp link or the Receive tab, no login | Counts one line at a time by voice ("48, 2 damaged") in English, हिंदी, ಕನ್ನಡ or తెలుగు, sees what was heard, and fixes it with + and − if needed. The sent quantity is hidden until they submit (a setting); the count is saved on the phone as they go. After submitting, the count locks, they see sent vs counted, and they can tell the sender on WhatsApp. Supplier deliveries are entered and counted here, with a photo of the bill. |
| Owner | Phone or laptop | Sees only short, extra or damaged lines, already compared, with the papers and photos. Decides each one with options that fit the move, asks the sender to explain with one tap, attaches the CCTV clip and shares an evidence pack. |
| Accountant | No login | Gets the owner's pack: a printable report and one Tally file, in import order. Until it is sent, the owner can undo a decision. |

**Job work and load chains.** Goods sent to another company for processing ("Send for job work") move on a delivery challan, no sale. When they come back ("Back from job work" in Receive), the app fills in what is still with the job worker and counts it like any load. The owner sees, per job worker, what is still out and how many days are left of the one-year limit for inputs, with a reminder button. Any outgoing load can be marked "made from" an earlier one, so the owner can follow supplier → unit → unit → customer.

**Plain language.** Screens use everyday words (short, extra, damaged; "we take the loss", "pay the supplier less") and familiar trade terms (challan, bill, GST, e-way bill, bilty). Accounting names appear only in the accountant's report and Tally file. Loads carry the driver's name and phone (the receiver can call), the e-way bill number (with a reminder above ₹50,000), and after a difference the receiver is prompted to note it on the driver's lorry receipt and photograph it, as transport claims require.

Settings: whether the receiver counts blind, who sees the details of a difference (owner and sender, or owner only), each unit's GSTIN, the loss limit, how many hours a count may take, and the phone languages.

### Owner options by flow

| | Short | Damaged | Excess |
|---|---|---|---|
| **Between own units** | Write off as transit loss · Investigate | Write off · Investigate | Loading list was wrong: record as sent · Investigate |
| **From a supplier** | Replacement (due date) · Debit note · Accept · Investigate | same | Keep and get billed · Return (due date) · Investigate |
| **To a customer** | Send the rest (due date) · Credit note · Investigate | Send replacements (due date) · Credit note · Investigate | Bill the extra · Customer returns (due date) · Investigate |

### Tally entries prepared

- **Between units, no money:** a Stock Journal from the sending unit to *Goods in Transit* when the truck leaves. On receipt, good units go from *Goods in Transit* to the receiving unit, and damaged units go to *Damaged Goods*. A write-off moves them to *Transit Loss*.
- **Job work:** a stock journal from the unit to an "At job worker" godown when it leaves, and back to the unit (or Damaged Goods) when it returns.
- **Between units, with invoice** (usually units with different GSTINs): a branch transfer invoice with GST when the truck leaves, a receipt note for the good units at the receiving unit, and a credit note for anything written off.
- **From a supplier:** a Receipt Note for the good units counted, plus a Debit Note if the owner chooses one.
- **To a customer:** a Credit Note or a Sales invoice for the extra, with GST split CGST+SGST or IGST by the customer's state.
- No voucher numbers are set, because Tally numbers vouchers itself. Ledger and godown names must match the company's own Tally masters, so import into a test company first.

## Set up for your company (planned)

LoadMatch will have a web setup page. A company uploads its own Excel (or a Tally export) with items and units, its branches or units, customers, suppliers and staff phone numbers, matching its own column names to LoadMatch's once. It then chooses its rules on the page: blind count on or off, who hears about differences (owner only, or owner and sender), the loss limit, languages and the accounting software. The app is set up for that company, and the staff use it on their mobile phones. The demo runs with sample data from a plywood business.

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
