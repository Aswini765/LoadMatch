# LoadMatch database: what it holds and how the flow runs

Two scripts, run in this order in Supabase (SQL Editor → New query → paste → Run):

| File | What it is | When |
|---|---|---|
| `migrations/20261118_loadmatch_events.sql` | Stage 0: one shared table so today's app works across phones (demo data only, no login) | Now, if you want the current app live on several phones |
| `migrations/20261119_loadmatch_core.sql` | Stage 1: real companies, people, connections, loads, counts, decisions, photos, history (23 tables) | Before any real company's data goes in |

Stage 1 is built and tested on Postgres 16 with three companies:
- Sri Plywoods sends a load to Deccan Furniture. The two companies are connected, and Ravi at Deccan counts it.
- A small shop that is not on LoadMatch counts through a WhatsApp link.
- Other Traders, a third company, must see nothing.

**The app does not use stage 1 yet.** Connecting the screens to it is the next build step. No app code was changed for this.

---

## The flow, start to finish

```
1. SET UP (once)      Owner logs in with phone OTP → creates the company → adds units → adds people
                      by phone → adds items → sets rules
2. CONNECT (once      Owner searches the other company by exact GSTIN or phone → sends a request
   per partner)       → their owner accepts → each side adds the other as supplier / customer / job worker
                      → (optional) match their item codes to ours
3. SEND               Dispatch makes a load (items, quantities, truck, driver, papers) → loads the truck
                      → taps Send. The list is frozen, today's rates are copied, and everyone who counts at
                      the receiving side is told. Partners not on LoadMatch get a WhatsApp link.
4. RECEIVE            The first person there to count submits → the count is locked. The SERVER works out
                      short / extra / damaged and their value. Both companies see the result.
5. DECIDE             Each company decides its own side (debit note, take the loss, adjust in next bill,
                      replacement, check CCTV ...). Entries go to the accountant as a pack (Tally file).
```

Who is told when a load is sent:
- **To our other unit:** the owner, managers and receivers of *our* company assigned to that unit.
- **To a connected company:** the owner, managers and receivers of *that* company (and of their unit, if chosen).
- **To a company not on LoadMatch:** a WhatsApp link, which lets them count without logging in.

---

## Granular data, step by step

### 1. Set up — `companies`, `units`, `members`, `company_settings`, `items`
| Data | Required? | Why |
|---|---|---|
| Legal name, trade name | Legal name required | Name on papers; the trade name is shown in the app |
| GSTIN | Needed to be found by others | Format is checked. One GSTIN = one company; a unit in another state carries its own GSTIN |
| PAN, state code, address, city, PIN, office phone, email | Optional at start | Challan / letterhead; phone is the second way to be found |
| Logo, letterhead | Optional | Printed on the challan / dispatch slip |
| "Can others find us?" | Default yes | Exact-match search only: nobody can browse a list of companies |
| **Units:** code, name, kind (factory / branch / godown / shop), GSTIN, address, docks, Tally godown name | Code + name | "To our other unit"; docks are used for the loading time window (CCTV) |
| **People:** name, phone (+91…), role, units they work at, language | Name, phone, role | The owner adds them; there is no sign-up form. At first OTP login on that phone they are linked automatically |
| Roles | — | `owner` (everything), `manager`, `dispatch` (make and send loads), `receiver` (count), `accountant` (entries and packs only) |
| **Items:** code, name, unit (pcs / kg …), HSN, GST %, rate, allowed loss, Tally name | Code, name, unit | The rate gives the ₹ value of a difference; allowed loss covers e.g. weight loss on the way |
| **Rules:** hours before a count is late, blind count, who sees differences, job work days (365, the GST limit for inputs), e-way bill threshold (₹50,000), photo required on difference | Defaults set | Same as Settings in the app today |

### 2. Connect — `connections`, `parties`, `item_links`
- **Find:** a request is made by GSTIN or office phone, exact match only. A partial name returns nothing (tested).
- **Request:** only the owner or a manager can send it, with an optional message. The other company's owner or manager accepts or declines.
- **Parties:** each company keeps its own list of suppliers, customers, job workers and transporters. A party is either:
  - a connected company (`linked_company`), or
  - just a name plus a contact phone, for someone not on LoadMatch.
- **Transporter fields:** GSTIN or TRANSIN, the 15-digit ID that unregistered transporters get on the e-way bill portal.
- **Item matching (optional):** "their code X = our code Y", with a factor (1 box = 10 pcs). The receiver sees their own names, and each side's Tally gets its own items.

### 3. Send — `loads`, `load_lines`, `load_links`, `load_recipients`
| Data | Notes |
|---|---|
| Load number | Automatic per company: 1001, 1002 … |
| Type | to our other unit / from a supplier / to a customer / sent for job work / back from job work |
| Money | "No money" or "With invoice and GST" (between own units this is the sender's choice) |
| From / to | Units, the party, and the receiving company if it's connected |
| Papers | Type (tax invoice / delivery challan / bill of supply / supplier bill), number (required), date, value |
| Truck | Number (required), driver name and phone, transporter, LR/bilty number and date |
| E-way bill | 12-digit number and valid-until date (validity starts when the vehicle number is entered) |
| "Made from" | Link to an earlier load (job work return, next step) |
| Loading | Dock, start and end time (the CCTV window) |
| Lines | Item, quantity, unit. Rate, HSN and GST % are copied at send time so later price changes don't alter old results |

After Send, the sender **cannot change the load** (tested). Mistakes are fixed by cancel / "truck came back" with a reason.

### 4. Receive — `receipts`, `receipt_lines`, `differences`
- **Who can submit:** a logged-in receiver, manager or owner of the receiving side, **or** anyone holding a valid link.
- **The link:**
  - Only a scrambled copy of the link is stored.
  - It expires after 30 days and can be withdrawn.
  - It shows the load with quantities hidden when blind count is on (tested), and nothing else.
- **Count per line:** counted and damaged (damaged can't be more than counted), the counter's name and a note.
- **Locking:** once submitted the count is locked. A second submit is refused (tested).
- **Differences:** short, extra and damaged are worked out on the server, with ₹ value, so a phone cannot fake them (tested: 38 counted + 1 damaged of 40 at ₹1,450 → 2 short ₹2,900, 1 damaged ₹1,450).
- **Recount:** owner only, needs a reason, and only before anyone decided anything (tested). The old count is kept as history.

### 5. Decide and records — `decisions`, `documents`, `cctv_refs`, `accounting_entries`, `accountant_packs`, `activity_log`
- **Decisions:**
  - Each company has its own (tested: Deccan's debit note is invisible to Sri Plywoods, and a Deccan receiver cannot decide for Sri Plywoods).
  - Promises (replacement, next bill) have a due date and close when a later load fulfils them.
  - "Undo" marks a decision undone rather than deleting it.
- **Photos and papers:**
  - Kinds: invoice, challan, e-way bill, bilty, order, damage, unloading, loading.
  - Files go in the private storage folder `load-files/<company>/<load>/`, at most 5 MB each.
  - Photos are shrunk on the phone to about 100–200 KB first.
- **CCTV:** only the time window, dock, camera and a link to the clip. Never the video.
- **Accountant:** the pending entries and the packs that were sent, with the Tally file kept in storage.
- **History (`activity_log`):** every important step, who did it and when. It cannot be edited or deleted (tested).

---

## Who can see what (checked by the database itself, not the app)

- **A company that isn't connected:** sees **nothing** (tested: 0 loads, 0 differences, 0 items).
- **Connected companies:** see each other's name, GSTIN, address, units and item names (needed for papers), plus the loads between them. They do **not** see each other's staff, decisions, prices on other loads or accounting entries.
- **Inside a company:** everyone reads the setup. Only the owner changes people and rules; owner and managers change units, items and connections.
- **People not logged in (link users):** can only open their one load and submit its count (tested: reading any table directly is refused).

---

## Facts from research that shaped this

- **Supabase free plan:** 500 MB database, 1 GB file storage, up to 2 projects, and the project pauses after 7 days without use.
  - At 100 trucks a month, the records are a few MB and photos about 45 MB a month, so the free plan fits a pilot.
  - **The 7-day pause matters for a real customer.** Pro is US$25/month and removes it.
- **Login by phone OTP in India:** SMS needs TRAI DLT registration (entity, sender ID, template), which typically takes 2–4 weeks.
  - Supabase's own docs flag India's DLT rules.
  - Indian providers (MSG91 and others) cost about ₹0.15–0.20 per OTP.
  - WhatsApp OTP is an alternative channel.
  - **Until DLT is done:** use Supabase's test phone numbers for the pilot, or an email magic link for owners only. Link users never need a login.
- **E-way bill:** Part A holds the GSTINs, delivery PIN, document number and date, value and HSN; Part B holds the vehicle number or transporter ID. Validity starts when Part B is first entered. This is why the load stores the document number and date, value, HSN per line, vehicle, transporter ID and the e-way number with its validity.

---

## What is NOT built yet (next, in order)

1. **Supabase project:** pick which existing project to pause (2 free projects maximum), create "LoadMatch", run both scripts, and add the URL and anon key to Render.
2. **Login screen:** phone OTP with `claim_membership`, and the company setup screens: company, units, people, items, rules, Excel import.
3. **Connections screen:** search by GSTIN, request, accept, add as party, match items.
4. **Switch the app screens** from the local demo data to these tables and actions (`send_load`, `load_for_link`, `submit_receipt`, `reopen_count`), and upload photos to storage.
5. **Notifications** to the people in `load_recipients`, by WhatsApp link at first and app notifications later.
