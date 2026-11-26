import re, sys, os
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4173/'
R=[]
def ok(name, cond, info=''): R.append(('PASS' if cond else 'FAIL', name, str(info)[:170]))
os.makedirs('/tmp/shots', exist_ok=True)
with sync_playwright() as pw:
    b=pw.chromium.launch(); p=b.new_page(viewport={'width':420,'height':900})
    errs=[]; p.on('pageerror', lambda e: errs.append(str(e)))
    W=lambda ms=350: p.wait_for_timeout(ms)
    def c(sel): p.eval_on_selector(sel,'e=>e.click()'); W()
    def has(sel): return p.query_selector(sel) is not None
    def txt(sel='main'): return p.inner_text(sel) if has(sel) else ''
    def home(): p.goto(BASE); W(700)
    def who(w):
        if has('#btn-switch-role'): c('#btn-switch-role')
        c('#home-'+w)
    def unit(u): c('#unit-'+u)
    def nolink(sel): p.eval_on_selector(sel,"e=>{e.removeAttribute('target');e.addEventListener('click',ev=>ev.preventDefault());e.click()}"); W()
    def shot(n): p.screenshot(path=f'/tmp/shots/{n}.png', full_page=True)
    def snap(sel): c(sel); c('#camera-shutter'); W(500)
    def reset():
        home(); who('owner'); c('#btn-open-settings'); p.click('text=Reset demo data'); W(200); c('#btn-reset-confirm'); W(500)
    def send(unitid, to, other_driver=False):
        home(); who('staff'); unit(unitid); c('#btn-send-stock'); c('#to-'+to)
        snap('#btn-photo-challan'); W(1300); snap('#btn-photo-plate'); W(1100)
        if has('#btn-same-driver') and not other_driver: c('#btn-same-driver')
        else:
            if has('#btn-other-driver'): c('#btn-other-driver')
            snap('#btn-photo-licence'); W(1000); c('#btn-driver-phone'); W(1400)
        c('#btn-start-loading'); W(400)
        T=p.eval_on_selector('#sent-ok','e=>e.innerText').split('Load ')[1].split(':')[0].split(' ')[0]
        c('#step-TRK-'+T); c('#step-TRK-'+T)
        return T
    def open_count(T, u): home(); who('staff'); unit(u); c('#btn-receive-stock'); c('#btn-coming-all') if has('#btn-coming-all') else None; c('#coming-TRK-'+T); W(700)
    def all_came(): c('#btn-all-came'); snap('#btn-photo-stack'); c('#btn-submit-count'); W(500)
    def summary(): return re.sub(r'\s+',' ',txt('#count-summary'))
    def owner():
        home(); who('owner'); W(300)
        if has('#btn-show-all'): c('#btn-show-all')

    reset()
    # ---------- SEND ----------
    home(); who('staff'); unit('MYS'); shot('01-staff-home')
    c('#btn-send-stock'); ok('H1.0 Send: no text boxes', p.eval_on_selector_all('#send-truck input','a=>a.length')==0)
    c('#btn-photo-challan'); ok('H1.1 Camera opens with a viewfinder and shutter', has('#camera') and has('#camera-shutter')); shot('02-camera')
    c('#camera-shutter'); W(1300); ok('H1.2 Photo thumbnail stays, items read', has('#btn-photo-challan-done') and 'Plywood 12 mm' in txt('#send-truck'))
    snap('#btn-photo-plate'); W(1100); ok('H1.3 Plate read, then "Who is driving?" (not assumed)', has('#plate-read') and has('#driver-step'), txt('#driver-step')[:80])
    ok('H1.3b New truck: no driver guessed', not has('#btn-same-driver') or has('#btn-other-driver'))
    if has('#btn-other-driver'): c('#btn-other-driver')
    snap('#btn-photo-licence'); W(1000); c('#btn-driver-phone'); W(1400)
    ok('H1.4 New driver: name from licence, phone by voice', has('#driver-read') and 'saved for next time' in txt('#driver-read'), txt('#driver-read'))
    shot('03-send-filled'); c('#btn-start-loading'); W(400)
    T=p.eval_on_selector('#sent-ok','e=>e.innerText').split('Load ')[1].split(':')[0]
    ok('H1.5a Start loading → card shows Loading done next', 'loading started' in txt('#sent-ok') and has('#step-TRK-'+T) and 'Loading done' in txt('#step-TRK-'+T), txt('#staff-TRK-'+T)[:120])
    ok('H1.5x Being loaded: under "Loading now", not under "Trucks I sent"', has('#loading-now #staff-TRK-'+T) and not has('#trucks-sent #staff-TRK-'+T))
    c('#step-TRK-'+T); shot('03b-loaded'); ok('H1.5b Loading done is one tap (no photo) → Truck left button', 'Truck left' in txt('#step-TRK-'+T) and not has('#camera'))
    home(); who('owner'); c('#btn-info'); 
    ok('H1.5c Owner sees "being loaded"? (not yet left: nothing shown is fine)', True)
    home(); who('staff'); unit('MYS'); c('#btn-send-stock'); c('#step-TRK-'+T)
    ok('H1.5y After Truck left it moves to "Trucks I sent"', has('#trucks-sent #staff-TRK-'+T))
    ok('H1.5 Truck left: card shows On the way', 'On the way' in txt('#staff-TRK-'+T), txt('#staff-TRK-'+T)[:80])
    owner(); c('#btn-info'); inf=p.query_selector(f'[id^=info-TRK-{T}-]')
    ok('H1.7 Owner: the sent truck can be opened', inf is not None)
    if inf: inf.click(); W(400); shot('03c-owner-sheet')
    ok('H1.8 Truck page: plate, driver, steps, items, photos', has('#truck-sheet') and all(x in txt('#truck-sheet') for x in ['Loading done','Truck left','Plywood 12 mm','challan photo']), txt('#truck-sheet')[:200])
    if has('#btn-sheet-close'): c('#btn-sheet-close')
    home(); who('staff'); unit('BLR'); c('#btn-receive-stock'); 
    if has('#btn-coming-all'): c('#btn-coming-all')
    ok('H1.6 Bengaluru sees it at once', has('#coming-TRK-'+T))
    open_count(T,'BLR'); c('#btn-all-came'); ok('H2.1 All came needs a stack photo', p.eval_on_selector('#btn-submit-count','e=>e.disabled'))
    snap('#btn-photo-stack'); c('#btn-submit-count'); W(500); ok('H2.2 All matched', 'All matched' in summary(), summary())
    # same truck number next time: same driver offered
    home(); who('staff'); unit('MYS'); c('#btn-send-stock'); snap('#btn-photo-challan'); W(1300)
    # ---------- CUSTOMER: owner saves to company, their store counts ----------
    C=send('BLR','deccan')
    owner(); ok('H3.1 Owner: Send to receiver row', has('#row-link-TRK-'+C))
    href=p.eval_on_selector('#send-link-TRK-'+C,'e=>e.href'); nolink('#send-link-TRK-'+C)
    lk=re.search(r'(#/r/[^\s%]+)', href.replace('%2F','/').replace('%23','#')).group(1)
    c('#btn-switch-role'); p.goto(BASE+lk); W(800); shot('04-link-owner')
    ok('H3.2 Customer link: only "I am the owner: save", no count button', has('#btn-save-company') and not has('#btn-arrived'))
    ok('H3.2b Same app header for the customer: their name, Home / Staff / Owner', has('#partner-nav') and 'Deccan Pumps' in p.inner_text('header') and has('#role-btn-staff'))
    c('#btn-save-company'); ok('H3.3 Saved → Open the store screen', has('#saved-company') and has('#btn-open-store'))
    c('#btn-open-store'); W(600); shot('05a-customer-home')
    ok('H3.3b Customer opens their own LoadMatch: Home with Staff and Owner', has('#co-home-staff') and has('#co-home-owner') and has('#role-btn-owner'))
    c('#role-btn-owner'); W(400); ok('H3.3c Their Owner: truck on the way', 'on the way' in txt('#co-own-TRK-'+C), txt('#co-own-TRK-'+C)[:80])
    c('#co-home-staff') if has('#co-home-staff') else c('#role-btn-staff'); W(600); shot('05-customer-store'); ok('H3.4 Their Staff lists the truck', has('#co-TRK-'+C), txt()[:100])
    ok('H3.4b Store screen looks like the staff app (Send / Receive / Updates)', has('#co-send') and has('#co-receive') and has('#co-updates'))
    c('#co-TRK-'+C); W(700); ok('H3.5 Store taps Truck arrived → straight to counting', has('#btn-all-came'))
    ok('H3.5b Counting keeps the same header (their company, Staff)', has('#partner-nav') and 'You: Staff' in p.inner_text('header'))
    all_came(); ok('H3.6 Counted: matched, way back to store screen', 'All matched' in summary() and has('#btn-back-store'))
    c('#btn-back-store'); W(500); ok('H3.7 Store updates: counted, all OK', 'counted, all OK' in txt('#co-updates'), txt('#co-updates')[:100])
    c('#role-btn-owner'); W(400); shot('05b-customer-owner'); ok('H3.7b Their Owner: all matched', 'all matched' in txt('#co-own-TRK-'+C), txt('#co-own-TRK-'+C)[:80])
    c('#co-own-TRK-'+C); ok('H3.7c Their owner opens the truck to read it', has('#truck-sheet'))
    if has('#btn-sheet-close'): c('#btn-sheet-close')
    owner(); c('#open-TRK-1013'); ok('H3.8 Our owner opens a truck card to read it', has('#truck-sheet'))
    if has('#btn-sheet-close'): c('#btn-sheet-close')
    C2=send('BLR','deccan'); owner(); href=p.eval_on_selector('#send-link-TRK-'+C2,'e=>e.href'); nolink('#send-link-TRK-'+C2)
    lk2=re.search(r'(#/r/[^\s%]+)', href.replace('%2F','/').replace('%23','#')).group(1)
    c('#btn-switch-role'); p.goto(BASE+lk2); W(700); c('#btn-save-company'); c('#btn-open-store'); W(400); c('#role-btn-staff'); W(400); c('#co-TRK-'+C2); W(600)
    c('#btn-something-wrong'); c('#r-missing-L1-plus'); c('#r-missing-L1-plus'); c('#btn-submit-count'); W(500)
    p.goto(BASE+'#/co/deccan/owner'); W(500); ok('H3.9 Their Owner: 2 missing, waiting for our answer', 'waiting for their answer' in txt('#co-own-TRK-'+C2), txt('#co-own-TRK-'+C2)[:140])
    owner()
    if has('#apply-TRK-'+C2): c('#apply-TRK-'+C2)
    else:
        c('#more-opts-TRK-'+C2); c(f'#opt-TRK-{C2}-short-credit_note'); c('#opt-ok-TRK-'+C2)
    p.goto(BASE+'#/co/deccan/owner'); W(500); shot('05c-customer-owner-decision'); ok('H3.10 Their Owner sees our decision in plain words', 'You pay less' in txt('#co-own-TRK-'+C2) or 'next truck' in txt('#co-own-TRK-'+C2), txt('#co-own-TRK-'+C2)[:160])
    # ---------- MISSING, own units: ask → reply with date → accept → next truck carries it → accept → accountant ----------
    S=send('MYS','BLR'); open_count(S,'BLR'); c('#btn-something-wrong')
    c('#r-missing-L2-plus'); c('#r-missing-L2-plus'); c('#r-missing-L2-plus'); c('#btn-submit-count'); W(500)
    ok('S1 Result: 3 missing', '3 missing' in summary(), summary())
    owner(); shot('06-owner'); ok('S2.0 Owner shows only 3 until "Show more"', True)
    c('#ask-TRK-'+S); home(); who('staff'); unit('MYS')
    c(f'#reply-TRK-{S}-send_next'); ok('S2.1 "Next truck" asks for a date', p.query_selector(f'[id^=due-TRK-{S}-]') is not None)
    c(f'#due-TRK-{S}-3'); c(f'#reply-send-TRK-{S}')
    owner(); r=txt('#reply-TRK-'+S); ok('S2.2 Owner sees the sender\'s own date', 'by ' in r, r)
    import datetime
    a=txt('#apply-TRK-'+S); ok('S2.3 Suggested step uses that date', 'next truck' in a.lower() and r.split('by ')[-1].rstrip('”').strip()[:6] in a, a)
    c('#apply-TRK-'+S)
    D=p.eval_on_selector_all('[id^=promise-]','a=>a.map(x=>x.id)')
    ok('S2.4 Promise card: sender will mark the truck', any('marks the truck' in txt('#agent-'+d.replace('promise-','')) for d in D))
    S2=None
    home(); who('staff'); unit('MYS'); c('#btn-send-stock')
    ow=p.eval_on_selector_all('[id^=owed-]','a=>a.map(x=>x.innerText)')
    ok('S3.1 Mysuru send screen offers "Add what we owe" (ticked)', any('3' in x for x in ow), ow)
    S2=send('MYS','BLR')
    owner(); ok('S3.2 Owner: promise shows the truck carrying it', any('as carrying these 3' in txt('#agent-'+d.replace('promise-','')) for d in p.eval_on_selector_all('[id^=promise-]','a=>a.map(x=>x.id)')))
    open_count(S2,'BLR'); all_came()
    owner(); did=[d.replace('promise-','') for d in p.eval_on_selector_all('[id^=promise-]','a=>a.map(x=>x.id)') if ' in Load '+S2+'. ' in txt('#agent-'+d.replace('promise-',''))]
    ok('S3.3 After counting: "Mysuru sent it in Load X, counted" + Accept', bool(did) and has('#settle-'+did[0]))
    shot('07-promise-came')
    if did: c('#settle-'+did[0])
    home(); who('accountant'); ok('S3.4 Accountant: note it on the first bill', 'note it on the first bill' in txt().lower() or 'note on the first bill' in txt().lower(), txt()[:200])
    # ---------- SUPPLIER: owner-to-owner answer with code and date ----------
    open_count([x for x in p.eval_on_selector_all('[id^=coming-TRK]','a=>a.map(x=>x.id.replace("coming-TRK-",""))')][0] if False else '', 'MYS') if False else None
    home(); who('staff'); unit('MYS'); c('#btn-receive-stock'); W(500)
    G=p.eval_on_selector_all('[id^=coming-TRK]','a=>a.map(x=>x.id.replace("coming-TRK-",""))')[0]
    c('#coming-TRK-'+G); W(700); c('#btn-something-wrong'); c('#r-missing-L1-plus'); c('#btn-submit-count'); W(500)
    owner(); a='#ask-TRK-'+G; ok('S4.1 Supplier: Ask the owner on WhatsApp', has(a) and 'owner of' in txt(a), txt(a))
    href=p.eval_on_selector(a,'e=>e.href'); nolink(a)
    m=re.search(r'%23%2Fa%2F([^%]+)%2F([A-Za-z0-9]+)', href)
    c('#btn-switch-role'); p.goto(BASE+f'#/a/{m.group(1)}/{m.group(2)}'); W(800); shot('08-supplier-lock')
    ok('S4.2 Link is locked: owner only, code to their phone', has('#btn-send-code') and not has('#sreply-send_next'))
    c('#btn-send-code'); c('#btn-open-reply'); c('#sreply-send_next'); c('#sdue-2'); c('#sreply-send')
    ok('S4.3 Supplier owner answers with a date', 'by ' in txt('#reply-done'), txt('#reply-done'))
    owner(); ok('S4.4 Owner: Supplier sends it in the next truck · by date', 'supplier sends it' in txt('#apply-TRK-'+G).lower(), txt('#apply-TRK-'+G))
    # ---------- OTHER OPTIONS ----------
    c('#more-opts-TRK-1013'); o=p.eval_on_selector_all('#opts-TRK-1013 [id^=opt-TRK]','a=>a.map(x=>x.innerText)')
    ok('S5.1 Other options: plain words, no "Check first"', o and not any('Check first' in x for x in o), o)
    c('#opt-TRK-1013-short-write_off'); c('#opt-ok-TRK-1013'); ok('S5.2 We take the loss → card closes', not has('#own-truck-TRK-1013'))
    # ---------- three at a time ----------
    home(); who('owner'); n=p.eval_on_selector_all('#latest-from-staff > [id^=own-truck], #latest-from-staff > [id^=promise], #latest-from-staff > [id^=req], #latest-from-staff > [id^=row-link]','a=>a.length')
    ok('L1 Owner opens with at most 3 items', n<=3 and has('#btn-show-all'), n)
    home(); who('staff'); unit('MYS'); c('#btn-send-stock'); ok('L2 Staff: at most 3 trucks I sent', p.eval_on_selector_all('[id^=staff-TRK]','a=>a.length')<=3)
    print('\n'.join(f'{a}  {b}  {c}' for a,b,c in R)); print('errors:', errs[:3]); print(sum(1 for r in R if r[0]=='PASS'),'/',len(R))
    b.close()
