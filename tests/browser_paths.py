import re, sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4173/'
R=[]
def ok(name, cond, info=''): R.append(('PASS' if cond else 'FAIL', name, str(info)[:160]))
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
    def reset():
        home(); who('owner'); c('#btn-open-settings'); p.click('text=Reset demo data'); W(200); c('#btn-reset-confirm'); W(500)
    def send(unitid, to):
        home(); who('staff'); unit(unitid); c('#btn-send-stock'); c('#to-'+to)
        c('#btn-photo-challan'); W(1300); c('#btn-photo-plate'); W(1100)
        c('#btn-truck-left'); W(400)
        return p.eval_on_selector('#sent-ok','e=>e.innerText').split('Load ')[1].split(' ')[0]
    def open_count(T, u): home(); who('staff'); unit(u); c('#coming-TRK-'+T); W(700)
    def all_came(): c('#btn-all-came'); c('#btn-photo-stack'); W(900); c('#btn-submit-count'); W(500)
    def summary(): return re.sub(r'\s+',' ',txt('#count-summary'))
    def owner(): home(); who('owner'); W(300)

    import os; os.makedirs('/tmp/shots', exist_ok=True)
    reset()
    # ---------- HAPPY ----------
    home(); who('staff'); unit('MYS'); shot('01-staff-home')
    c('#btn-send-stock'); ok('H1.0 Send screen has no text boxes to type in', p.eval_on_selector_all('#send-truck input','a=>a.length')==0)
    c('#btn-photo-challan'); W(1300); ok('H1.1 Challan photo fills items', has('#challan-read') and 'Plywood 12 mm' in txt('#send-truck'))
    c('#btn-photo-plate'); W(1100); ok('H1.2 Plate photo fills truck no. and remembered driver', has('#plate-read') and 'Manju' in txt('#plate-read') or 'Prakash' in txt('#plate-read') or 'Manjunath' in txt('#plate-read'), txt('#plate-read'))
    shot('02-send-filled'); c('#btn-truck-left'); W(400)
    T=p.eval_on_selector('#sent-ok','e=>e.innerText').split('Load ')[1].split(' ')[0]
    ok('H1.3 Truck left → confirmation, owner told', 'owner is told' in txt('#sent-ok'), txt('#sent-ok'))
    home(); who('staff'); unit('BLR'); ok('H1.4 Bengaluru sees it at once (no owner step for own units)', has('#coming-TRK-'+T))
    owner(); ok('H1.5 Owner: nothing to do for it', not has('#row-link-TRK-'+T) and not has('#own-truck-TRK-'+T))
    c('#btn-info'); ok('H1.6 Owner: shown under "Also today" as info', f'Load {T} left Mysuru' in txt('#info-list'))
    open_count(T,'BLR'); shot('03-count'); ok('H2.1 Count page: two big choices', has('#btn-all-came') and has('#btn-something-wrong'))
    c('#btn-all-came'); ok('H2.2 All came needs a stack photo first', p.eval_on_selector('#btn-submit-count','e=>e.disabled'))
    c('#btn-photo-stack'); W(900); c('#btn-submit-count'); W(500); shot('04-result-ok')
    ok('H2.3 Result: one line, all matched', 'All matched' in summary(), summary())
    home(); who('staff'); unit('MYS'); ok('H2.4 Mysuru update: counted, all OK', f'Load {T} counted, all OK' in txt('#updates'))
    open_count('1020','MYS'); all_came(); ok('H3 Supplier delivery at Mysuru: all came → matched', 'All matched' in summary())
    C=send('BLR','deccan')
    owner(); ok('H4.1 Customer truck: owner gets one row to send them the link', has('#row-link-TRK-'+C))
    href=p.eval_on_selector('#send-link-TRK-'+C,'e=>e.href'); nolink('#send-link-TRK-'+C)
    ok('H4.2 After sending, row leaves the need-you list', not has('#row-link-TRK-'+C))
    link=re.search(r'(#/r/[^\s%]+)', href.replace('%2F','/').replace('%23','#'))
    lk=link.group(1) if link else ''
    c('#btn-switch-role'); p.goto(BASE+lk); W(800); shot('05-link-gate')
    ok('H4.3 Customer link: "save to my company" for the owner, Truck arrived for the store', has('#btn-save-company') and has('#btn-arrived'), lk[:40])
    c('#btn-save-company'); ok('H4.4 Saved to company message', has('#saved-company'))
    c('#btn-arrived'); all_came(); ok('H4.5 Customer counts: matched', 'All matched' in summary())

    # ---------- SAD ----------
    S=send('MYS','BLR'); open_count(S,'BLR'); c('#btn-something-wrong')
    ok('S1.1 Nothing marked → cannot send', p.eval_on_selector('#btn-submit-count','e=>e.disabled') and has('#r-missing'))
    c('#r-missing-L1-plus'); c('#r-missing-L1-plus'); c('#btn-speak'); W(1400)
    ok('S1.2 Voice (simulated) fills "2 damaged" and says what it heard', has('#r-heard') and txt('#r-damaged-L1')=='2', txt('#r-heard'))
    c('#btn-photo-damage'); W(900); shot('06-count-wrong'); c('#btn-submit-count'); W(500); shot('07-result-diff')
    ok('S1.3 Result: sent to owner, 2 missing, 2 damaged', '2 missing' in summary() and '2 damaged' in summary(), summary())
    owner(); shot('08-owner'); card='#own-truck-TRK-'+S
    ok('S2.1 Owner: one card for the truck with one button: Ask Mysuru unit', has(card) and has('#ask-TRK-'+S) and 'Ask Mysuru unit' in txt('#ask-TRK-'+S))
    ok('S2.2 No decision buttons on the card until Other options', p.eval_on_selector_all(card+' [id^=opt-]','a=>a.length')==0)
    c('#ask-TRK-'+S); ok('S2.3 Asked: assistant will remind', has('#asked-TRK-'+S) and 'Assistant reminds' in txt('#asked-TRK-'+S))
    home(); who('staff'); unit('MYS'); shot('09-staff-ask')
    ok('S3.1 Mysuru staff: owner asks what happened, 3 one-tap answers', has('#ask-TRK-'+S) and p.eval_on_selector_all('#ask-TRK-'+S+' button','a=>a.length')==3)
    c(f'#reply-TRK-{S}-send_next'); ok('S3.2 Answer sent, card gone, shown in updates', not has('#ask-TRK-'+S) and 'You replied' in txt('#updates'))
    owner(); ok('S3.3 Owner sees the reply and ONE suggested step', has('#reply-TRK-'+S) and 'sending unit sends it' in txt('#own-truck-TRK-'+S).lower(), txt('#apply-TRK-'+S))
    shot('10-owner-reply'); c('#apply-TRK-'+S)
    ok('S3.4 Applied: truck card gone, promise card with assistant', not has(card) and p.eval_on_selector_all('[id^=agent-]','a=>a.some(x=>x.innerText.includes("watches the next trucks from Mysuru"))'))
    ok('S4 Seeded reply (Load 1022) already shows a suggestion', has('#apply-TRK-1022'))
    ok('S5 Late promise (Load 1014): assistant says it reminded the supplier', 'reminded Sri Lakshmi Timbers' in txt('#agent-DIF-0003'), txt('#agent-DIF-0003'))
    ok('S6 Customer extra (Load 1015): suggestion straight away, no question needed', has('#apply-TRK-1015') and not has('#ask-TRK-1015'))
    c('#more-opts-TRK-1013'); ok('S7 Other options shows every choice per item', p.eval_on_selector_all('#own-truck-TRK-1013 [id^=opt-]','a=>a.length')>=3)
    # supplier: count wrong, ask on WhatsApp, supplier answers from the link
    home(); who('staff'); unit('MYS'); W(600)
    G=p.eval_on_selector_all('[id^=coming-TRK]','a=>a.map(x=>x.id.replace("coming-TRK-",""))')[0]
    c('#coming-TRK-'+G); W(700); c('#btn-something-wrong'); c('#r-missing-L1-plus'); c('#btn-submit-count'); W(500)
    owner(); a='#ask-TRK-'+G
    ok('S8.1 Supplier truck: Ask on WhatsApp', has(a) and 'WhatsApp' in txt(a), txt(a))
    href=p.eval_on_selector(a,'e=>e.href'); nolink(a)
    m=re.search(r'(%23|#)%2Fa%2F([^%]+)%2F([A-Za-z0-9]+)', href) or re.search(r'#/a/([^/]+)/([A-Za-z0-9]+)', href)
    ok('S8.2 Message carries a one-tap answer link', bool(m), href[-80:])
    if m:
        g=m.groups(); path=f'#/a/{g[-2]}/{g[-1]}'
        c('#btn-switch-role'); p.goto(BASE+path); W(800); shot('11-supplier-reply')
        ok('S8.3 Supplier page: 3 answers', p.eval_on_selector_all('[id^=sreply-]','a=>a.length')==3)
        c('#sreply-transporter'); ok('S8.4 Supplier answered', has('#reply-done'))
        owner(); ok('S8.5 Owner: suggestion Supplier pays', 'supplier pays' in txt('#apply-TRK-'+G).lower(), txt('#apply-TRK-'+G))
        c('#apply-TRK-'+G); home(); who('accountant'); ok('S8.6 Accountant gets the debit note to-do', 'debit note' in txt().lower())
    owner(); n=txt('#latest-from-staff').split('\n')[0]; ok('O1 Headline counts what needs the owner', 'need' in n, n)
    print('\n'.join(f'{a}  {b}  {c}' for a,b,c in R)); print('errors:', errs[:3]); print(sum(1 for r in R if r[0]=='PASS'),'/',len(R))
    b.close()
