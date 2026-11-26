import React, { useEffect, useRef, useState } from 'react';
import { useStore, route, diffsOf, countedByUs, atGate, receiverPath, loadName, item, party, REPLIES, senderIsUs } from '../store.tsx';
import { UNITS, PARTIES } from '../data/seed.ts';
import { getUnit, setUnit, setMeName, me } from '../lib/who.ts';
import { PhoneFrame, savedLang, saveLang, newToken } from './ui.tsx';
import { when } from '../lib/format.ts';
import type { Go } from './ui.tsx';
import { CameraButton, DateChips } from './sim.tsx';

// Staff screen, made for people who read little and do not type: pictures, big buttons, photos and voice,
// one next step per truck, their language.
const uname = (id: string) => UNITS[id]?.name.split(' (')[0] || id;
const staffName = (state: any) => (state.staff || []).find((p: any) => p.unit === getUnit())?.name || 'Staff';
export const itemIcon = (code: string) => (/^PLY/.test(code) ? '🟫' : /^BOX/.test(code) ? '📦' : /^LOG/.test(code) ? '🪵' : '📜');
export const shortName = (code: string) => item(code)?.name.split(',')[0] || code;

type L = 'en' | 'hi' | 'kn' | 'te';
const W: Record<string, Record<L, string>> = {
  back: { en: 'Back', hi: 'वापस', kn: 'ಹಿಂದೆ', te: 'వెనక్కి' },
  iAmAt: { en: 'I am at', hi: 'मैं यहाँ हूँ', kn: 'ನಾನು ಇಲ್ಲಿದ್ದೇನೆ', te: 'నేను ఉన్నది' },
  updates: { en: 'Updates', hi: 'खबर', kn: 'ಸುದ್ದಿ', te: 'సమాచారం' },
  send: { en: 'Send', hi: 'भेजें', kn: 'ಕಳುಹಿಸಿ', te: 'పంపండి' },
  receive: { en: 'Receive', hi: 'माल आया', kn: 'ಸ್ವೀಕರಿಸಿ', te: 'స్వీకరించండి' },
  myTrucks: { en: 'Trucks I sent', hi: 'भेजी गई गाड़ियाँ', kn: 'ಕಳುಹಿಸಿದ ಲಾರಿಗಳು', te: 'పంపిన లారీలు' },
  truckLeft: { en: 'Truck left', hi: 'गाड़ी निकल गई', kn: 'ಲಾರಿ ಹೊರಟಿತು', te: 'లారీ బయలుదేరింది' },
  arrived: { en: 'Truck arrived', hi: 'गाड़ी पहुँच गई', kn: 'ಲಾರಿ ಬಂತು', te: 'లారీ వచ్చింది' },
  count: { en: 'Count', hi: 'गिनें', kn: 'ಎಣಿಸಿ', te: 'లెక్కించండి' },
  onTheWay: { en: 'On the way', hi: 'रास्ते में', kn: 'ದಾರಿಯಲ್ಲಿದೆ', te: 'దారిలో ఉంది' },
  reached: { en: 'Reached', hi: 'पहुँच गई', kn: 'ತಲುಪಿತು', te: 'చేరింది' },
  notLeft: { en: 'Not left yet', hi: 'अभी नहीं निकली', kn: 'ಇನ್ನೂ ಹೊರಟಿಲ್ಲ', te: 'ఇంకా బయలుదేరలేదు' },
  oldTrucks: { en: 'Old trucks', hi: 'पुरानी गाड़ियाँ', kn: 'ಹಳೆಯ ಲಾರಿಗಳು', te: 'పాత లారీలు' },
  problem: { en: 'Problem? Ask owner', hi: 'दिक्कत? मालिक से पूछें', kn: 'ಸಮಸ್ಯೆ? ಮಾಲೀಕರನ್ನು ಕೇಳಿ', te: 'సమస్యా? యజమానిని అడగండి' },
  noNews: { en: 'No news', hi: 'कोई खबर नहीं', kn: 'ಸುದ್ದಿ ಇಲ್ಲ', te: 'సమాచారం లేదు' },
  checking: { en: 'does not match. Owner is checking it', hi: 'मेल नहीं खाता, मालिक जाँच रहे हैं', kn: 'ಹೊಂದುತ್ತಿಲ್ಲ, ಮಾಲೀಕರು ಪರಿಶೀಲಿಸುತ್ತಿದ್ದಾರೆ', te: 'సరిపోలలేదు, యజమాని పరిశీలిస్తున్నారు' },
  restComing: { en: 'does not match. The rest will come in the next truck', hi: 'मेल नहीं खाता, बाकी अगली गाड़ी में आएगा', kn: 'ಹೊಂದುತ್ತಿಲ್ಲ, ಉಳಿದದ್ದು ಮುಂದಿನ ಲಾರಿಯಲ್ಲಿ ಬರುತ್ತದೆ', te: 'సరిపోలలేదు, మిగతాది తదుపరి లారీలో వస్తుంది' },
  decided: { en: 'does not match. Owner has decided', hi: 'मेल नहीं खाता, मालिक ने फैसला कर दिया', kn: 'ಹೊಂದುತ್ತಿಲ್ಲ, ಮಾಲೀಕರು ನಿರ್ಧರಿಸಿದ್ದಾರೆ', te: 'సరిపోలలేదు, యజమాని నిర్ణయించారు' },
  ownerSends: { en: 'The owner sends the count link to the customer.', hi: 'मालिक ग्राहक को गिनती का लिंक भेजेंगे।', kn: 'ಮಾಲೀಕರು ಗ್ರಾಹಕರಿಗೆ ಎಣಿಕೆ ಲಿಂಕ್ ಕಳುಹಿಸುತ್ತಾರೆ.', te: 'యజమాని కస్టమర్‌కు లెక్క లింక్ పంపుతారు.' },
  yes: { en: 'Owner said YES', hi: 'मालिक ने हाँ कहा', kn: 'ಮಾಲೀಕರು ಹೌದು ಎಂದರು', te: 'యజమాని సరే అన్నారు' },
  no: { en: 'Owner said NO', hi: 'मालिक ने ना कहा', kn: 'ಮಾಲೀಕರು ಬೇಡ ಎಂದರು', te: 'యజమాని వద్దు అన్నారు' },
  waiting: { en: 'Waiting for owner', hi: 'मालिक के जवाब का इंतज़ार', kn: 'ಮಾಲೀಕರ ಉತ್ತರಕ್ಕೆ ಕಾಯುತ್ತಿದೆ', te: 'యజమాని సమాధానం కోసం' },
  okCount: { en: 'counted, all OK', hi: 'गिनती ठीक', kn: 'ಎಣಿಕೆ ಸರಿ', te: 'లెక్క సరిగ్గా ఉంది' },
  diff: { en: 'does not match. Owner will decide', hi: 'मेल नहीं खाता, मालिक फैसला करेंगे', kn: 'ಹೊಂದುತ್ತಿಲ್ಲ, ಮಾಲೀಕರು ನಿರ್ಧರಿಸುತ್ತಾರೆ', te: 'సరిపోలలేదు, యజమాని నిర్ణయిస్తారు' },
  backAccident: { en: 'Coming back after accident', hi: 'दुर्घटना के बाद वापस', kn: 'ಅಪಘಾತದ ನಂತರ ವಾಪಸ್', te: 'ప్రమాదం తర్వాత తిరిగి' },
  expected: { en: 'Expected', hi: 'आने वाली', kn: 'ಬರಬೇಕಿದೆ', te: 'రావాల్సింది' },
  notInList: { en: 'A truck came that is not in the list? Tell owner', hi: 'सूची में नहीं है ऐसी गाड़ी आई? मालिक को बताएं', kn: 'ಪಟ್ಟಿಯಲ್ಲಿಲ್ಲದ ಲಾರಿ ಬಂತೇ? ಮಾಲೀಕರಿಗೆ ತಿಳಿಸಿ', te: 'జాబితాలో లేని లారీ వచ్చిందా? యజమానికి చెప్పండి' },
  comingToday: { en: 'Coming to you', hi: 'आपके पास आ रही हैं', kn: 'ನಿಮಗೆ ಬರುತ್ತಿವೆ', te: 'మీకు వస్తున్నవి' },
  noneComing: { en: 'No truck coming now', hi: 'अभी कोई गाड़ी नहीं आ रही', kn: 'ಈಗ ಯಾವ ಲಾರಿಯೂ ಬರುತ್ತಿಲ್ಲ', te: 'ఇప్పుడు ఏ లారీ రావడం లేదు' },
  whereTo: { en: 'Where is it going?', hi: 'कहाँ जा रही है?', kn: 'ಎಲ್ಲಿಗೆ ಹೋಗುತ್ತಿದೆ?', te: 'ఎక్కడికి వెళ్తోంది?' },
  photoChallan: { en: 'Photo of the challan or bill', hi: 'चालान या बिल की फोटो', kn: 'ಚಲನ್ ಅಥವಾ ಬಿಲ್ ಫೋಟೋ', te: 'చలాన్ లేదా బిల్ ఫోటో' },
  photoPlate: { en: 'Photo of the number plate', hi: 'नंबर प्लेट की फोटो', kn: 'ನಂಬರ್ ಪ್ಲೇಟ್ ಫೋಟೋ', te: 'నంబర్ ప్లేట్ ఫోటో' },
  reading: { en: 'Reading the photo…', hi: 'फोटो पढ़ रहे हैं…', kn: 'ಫೋಟೋ ಓದುತ್ತಿದೆ…', te: 'ఫోటో చదువుతోంది…' },
  checkNumbers: { en: 'Read from the photo. Check the numbers; fix with − +', hi: 'फोटो से पढ़ा। संख्या देखें; − + से ठीक करें', kn: 'ಫೋಟೋದಿಂದ ಓದಿದೆ. ಸಂಖ್ಯೆ ನೋಡಿ; − + ಇಂದ ಸರಿಪಡಿಸಿ', te: 'ఫోటో నుండి చదివింది. సంఖ్యలు చూడండి; − + తో సరిచేయండి' },
  driverKnown: { en: 'Driver from the last trip with this truck', hi: 'इस गाड़ी के पिछले चक्कर का ड्राइवर', kn: 'ಈ ಲಾರಿಯ ಹಿಂದಿನ ಪ್ರಯಾಣದ ಚಾಲಕ', te: 'ఈ లారీ గత ట్రిప్ డ్రైవర్' },
  sentOk: { en: 'left. The owner is told.', hi: 'निकल गई। मालिक को खबर हो गई।', kn: 'ಹೊರಟಿತು. ಮಾಲೀಕರಿಗೆ ತಿಳಿಸಲಾಗಿದೆ.', te: 'బయలుదేరింది. యజమానికి తెలిసింది.' },
  ownerAsks: { en: 'Owner asks: what happened?', hi: 'मालिक पूछ रहे हैं: क्या हुआ?', kn: 'ಮಾಲೀಕರು ಕೇಳುತ್ತಿದ್ದಾರೆ: ಏನಾಯಿತು?', te: 'యజమాని అడుగుతున్నారు: ఏమైంది?' },
  youReplied: { en: 'You replied', hi: 'आपने जवाब दिया', kn: 'ನೀವು ಉತ್ತರಿಸಿದಿರಿ', te: 'మీరు సమాధానం ఇచ్చారు' },
  send_next: { en: 'Left here. Will send in the next truck', hi: 'यहीं रह गया। अगली गाड़ी में भेजेंगे', kn: 'ಇಲ್ಲೇ ಉಳಿದಿದೆ. ಮುಂದಿನ ಲಾರಿಯಲ್ಲಿ ಕಳುಹಿಸುತ್ತೇವೆ', te: 'ఇక్కడే ఉండిపోయింది. తదుపరి లారీలో పంపుతాం' },
  sent_full: { en: 'We loaded it all (loading photo)', hi: 'हमने पूरा लोड किया (लोडिंग फोटो)', kn: 'ನಾವು ಎಲ್ಲಾ ಲೋಡ್ ಮಾಡಿದೆವು (ಫೋಟೋ)', te: 'మేము అంతా లోడ్ చేశాం (ఫోటో)' },
  transporter: { en: 'Lost or broken on the road', hi: 'रास्ते में खोया या टूटा', kn: 'ದಾರಿಯಲ್ಲಿ ಕಳೆದುಹೋಯಿತು ಅಥವಾ ಮುರಿಯಿತು', te: 'దారిలో పోయింది లేదా పగిలింది' },
  owedAdd: { en: 'Add what we owe', hi: 'बकाया माल जोड़ें', kn: 'ಬಾಕಿ ಸರಕು ಸೇರಿಸಿ', te: 'బాకీ సరుకు చేర్చండి' },
  owedWhy: { en: 'missing last time', hi: 'पिछली बार कम था', kn: 'ಹಿಂದಿನ ಬಾರಿ ಕಡಿಮೆ', te: 'గతసారి తక్కువ' },
  owedIncl: { en: 'incl. owed', hi: 'बकाया सहित', kn: 'ಬಾಕಿ ಸೇರಿ', te: 'బాకీ కలిపి' },
  whoDrives: { en: 'Who is driving?', hi: 'ड्राइवर कौन है?', kn: 'ಚಾಲಕ ಯಾರು?', te: 'డ్రైవర్ ఎవరు?' },
  sameDriver: { en: 'same as last time', hi: 'पिछली बार वाला', kn: 'ಹಿಂದಿನವರೇ', te: 'గతసారి వారే' },
  otherDriver: { en: 'Another driver', hi: 'दूसरा ड्राइवर', kn: 'ಬೇರೆ ಚಾಲಕ', te: 'వేరే డ్రైవర్' },
  photoLicence: { en: "Photo of driver's licence", hi: 'ड्राइविंग लाइसेंस की फोटो', kn: 'ಚಾಲನಾ ಪರವಾನಗಿ ಫೋಟೋ', te: 'డ్రైవింగ్ లైసెన్స్ ఫోటో' },
  licenceRead: { en: 'Name read from the licence', hi: 'लाइसेंस से नाम पढ़ा', kn: 'ಪರವಾನಗಿಯಿಂದ ಹೆಸರು ಓದಿದೆ', te: 'లైసెన్స్ నుండి పేరు చదివింది' },
  sayPhone: { en: 'Driver says his phone number', hi: 'ड्राइवर अपना नंबर बोले', kn: 'ಚಾಲಕ ತನ್ನ ನಂಬರ್ ಹೇಳಲಿ', te: 'డ్రైవర్ తన నంబర్ చెప్పాలి' },
  listening: { en: 'Listening…', hi: 'सुन रहे हैं…', kn: 'ಕೇಳುತ್ತಿದೆ…', te: 'వింటోంది…' },
  newSaved: { en: 'saved for next time', hi: 'अगली बार के लिए सेव', kn: 'ಮುಂದಿನ ಬಾರಿಗೆ ಉಳಿಸಲಾಗಿದೆ', te: 'తదుపరి కోసం సేవ్' },
  change: { en: 'Change', hi: 'बदलें', kn: 'ಬದಲಿಸಿ', te: 'మార్చండి' },
  when: { en: 'When will it go?', hi: 'कब भेजेंगे?', kn: 'ಯಾವಾಗ ಕಳುಹಿಸುತ್ತೀರಿ?', te: 'ఎప్పుడు పంపుతారు?' },
  sendReply: { en: 'Send answer', hi: 'जवाब भेजें', kn: 'ಉತ್ತರ ಕಳುಹಿಸಿ', te: 'సమాధానం పంపండి' },
  more: { en: 'more', hi: 'और', kn: 'ಇನ್ನಷ್ಟು', te: 'మరిన్ని' },
  missing: { en: 'missing', hi: 'कम', kn: 'ಕಡಿಮೆ', te: 'తక్కువ' },
  damaged: { en: 'damaged', hi: 'खराब', kn: 'ಹಾಳು', te: 'పాడైనవి' },
  extra: { en: 'extra', hi: 'ज़्यादा', kn: 'ಹೆಚ್ಚು', te: 'ఎక్కువ' },
};
const fromX = (x: string, l: L) => ({ en: `From ${x}`, hi: `${x} से`, kn: `${x}ಇಂದ`, te: `${x} నుండి` }[l]);
const toX = (x: string, l: L) => ({ en: `To ${x}`, hi: `${x} को`, kn: `${x}ಗೆ`, te: `${x}కు` }[l]);
const foundX = (x: string, what: string, load: string, l: L) => ({ en: `${x} found ${what} in ${load}`, hi: `${x} में ${load} में ${what} मिला`, kn: `${x}ನಲ್ಲಿ ${load}ನಲ್ಲಿ ${what}`, te: `${x}లో ${load}లో ${what}` }[l]);
const dayText = (ms: number) => { const d = new Date(ms).toDateString(), t = new Date(), y = new Date(Date.now() + 86400000); return d === t.toDateString() ? 'today' : d === y.toDateString() ? 'tomorrow' : new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); };
const reachedX = (x: string, l: L) => ({ en: `reached ${x}`, hi: `${x} पहुँची`, kn: `${x} ತಲುಪಿತು`, te: `${x} చేరింది` }[l]);

const big = 'w-full min-h-[56px] rounded-2xl text-base font-bold flex items-center justify-center cursor-pointer';
export const Plate = ({ no }: { no: string }) => <span className="inline-block whitespace-nowrap px-2 py-0.5 rounded-md border-2 border-slate-800 bg-amber-50 font-mono font-bold text-sm text-slate-900">{no}</span>;
const TONE: Record<string, string> = { slate: 'text-slate-900', rose: 'text-rose-700', amber: 'text-amber-700', sky: 'text-sky-700' };
// shared −/+ stepper (no typing)
export function Stepper({ id, value, onChange, min = 0, max = 9999, tone = 'slate' }: { id: string; value: number; onChange: (n: number) => void; min?: number; max?: number; tone?: string }) {
  const b = 'w-11 h-11 rounded-xl border-2 border-slate-300 bg-white text-xl font-bold text-slate-700 cursor-pointer active:bg-slate-100 disabled:opacity-30';
  return (
    <span className="inline-flex items-center gap-1.5">
      <button id={`${id}-minus`} aria-label="minus" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} className={b}>−</button>
      <span id={id} className={`w-12 text-center text-xl font-mono font-bold ${value ? TONE[tone] || 'text-slate-900' : 'text-slate-400'}`}>{value}</span>
      <button id={`${id}-plus`} aria-label="plus" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} className={b}>+</button>
    </span>
  );
}

// What each kind of difference is called for the staff, e.g. "6 missing, 2 damaged"
const whatText = (ds: any[], w: (k: string) => string) => [['short', 'missing'], ['damaged', 'damaged'], ['excess', 'extra']].map(([k, word]) => { const n = ds.filter((d: any) => d.kind === k).reduce((a: number, d: any) => a + d.qty, 0); return n ? `${n} ${w(word)}` : ''; }).filter(Boolean).join(', ');

export default function Staff({ go, initialId = null }: { go: Go; initialId?: string | null }) {
  const { state, dispatch } = useStore();
  const [lang, setLangState] = useState(savedLang);
  const setLang = (l: string) => { setLangState(l); saveLang(l); };
  const l = (['en', 'hi', 'kn', 'te'].includes(lang) ? lang : 'en') as L;
  const w = (k: string) => W[k][l];
  const [unit, setU] = useState(getUnit());
  const [open, setOpen] = useState<'' | 'send' | 'receive'>(initialId ? 'send' : '');
  const [showOld, setShowOld] = useState(false);
  const [allNews, setAllNews] = useState(false);
  const [justSent, setJustSent] = useState<string | null>(null);
  const [replyNext, setReplyNext] = useState('');
  const [replyDue, setReplyDue] = useState<number | null>(null);
  const [allComing, setAllComing] = useState(false);
  const pickUnit = (u: string) => { setUnit(u); setU(u); };
  setMeName(staffName(state));

  const live = state.shipments.filter((s: any) => !s.cancelledAt && !s.receipt);
  // trucks this unit sends, newest first
  const sending = live.filter((s: any) => s.fromUnit === unit && !s.returning && !atGate(s.flow)).sort((a: any, b: any) => (b.id === justSent ? 1 : 0) - (a.id === justSent ? 1 : 0) || b.createdAt - a.createdAt);
  // trucks coming to this unit: our other unit's trucks show as soon as they leave; supplier trucks the owner expects; goods coming back after an accident
  const receiving = live.filter((s: any) => (s.returning ? s.fromUnit === unit : s.toUnit === unit && countedByUs(s) && (s.flow !== 'transfer' || s.sentAt)));
  const old = state.shipments.filter((s: any) => (open === 'send' ? s.fromUnit === unit : open === 'receive' ? s.toUnit === unit : s.fromUnit === unit || s.toUnit === unit) && (s.receipt || s.cancelledAt))
    .sort((a: any, b: any) => (b.receipt?.at || b.cancelledAt) - (a.receipt?.at || a.cancelledAt)).slice(0, 3);
  // the owner asked this unit what happened to a truck it sent
  const asks = state.shipments.filter((s: any) => s.ask && !s.ask.reply && senderIsUs(s) && s.fromUnit === unit);

  // Demo: there is always a truck coming to you, so the receive path can be tried again and again.
  const topped = useRef<Record<string, boolean>>({});
  useEffect(() => {
    if (receiving.length || topped.current[unit]) return;
    topped.current[unit] = true;
    const id = `TRK-${1000 + state.counters.trk + 1}`;
    const plate = `KA ${unit === 'MYS' ? '19 D' : '09 B'} ${1000 + Math.floor(Math.random() * 9000)}`;
    const ref = `${unit === 'MYS' ? 'PO' : 'DC'}-${100 + Math.floor(Math.random() * 900)}`;
    // a supplier who promised the rest sends it with this demo truck, so "it came" can be shown
    const covered = (d: any) => state.shipments.some((y: any) => !y.cancelledAt && (y.fulfils || []).includes(d.id));
    const owedIn = state.diffs.find((d: any) => d.status === 'waiting' && !d.came && d.decision?.action === 'replace' && !covered(d) && state.shipments.find((x: any) => x.id === d.shipmentId)?.toUnit === 'MYS');
    if (unit === 'MYS') {
      const sup = owedIn ? state.shipments.find((x: any) => x.id === owedIn.shipmentId).party : 'coastal';
      const base = [{ item: 'OKU-AB-91', qty: 200 }, { item: 'BRP-1136', qty: 150 }];
      const lines = owedIn ? (base.some((x) => x.item === owedIn.item) ? base.map((x) => (x.item === owedIn.item ? { ...x, qty: x.qty + owedIn.qty } : x)) : [...base, { item: owedIn.item, qty: owedIn.qty }]) : base;
      dispatch({ type: 'CREATE_SHIPMENT', id, flow: 'inbound', toUnit: 'MYS', party: sup, truckNo: plate, ref, expectedOn: Date.now(), lines, fulfils: owedIn ? [owedIn.id] : [], actor: 'Owner' });
      dispatch({ type: 'SEND_TO_RECEIVER', id, token: newToken(), actor: 'Owner' });
    } else {
      dispatch({ type: 'CREATE_SHIPMENT', id, flow: 'transfer', fromUnit: 'MYS', toUnit: unit, truckNo: plate, ref, driver: 'Manju', driverPhone: '9845012345', lines: [{ item: 'PLY-12', qty: 80 }, { item: 'PLY-18', qty: 45 }], actor: 'Ramesh (staff)' });
      dispatch({ type: 'LOADING', id, point: 'Dock 1', phase: 'start', actor: 'Ramesh (staff)' });
      dispatch({ type: 'LOADING', id, phase: 'end', actor: 'Ramesh (staff)' });
      dispatch({ type: 'SEND_TO_RECEIVER', id, token: newToken(), actor: 'Ramesh (staff)' });
    }
  }, [unit, receiving.length]);

  const count = (s: any) => {
    if (s.sentAt) { window.location.hash = receiverPath(s, state.settings); return; }
    const token = newToken();
    dispatch({ type: 'SEND_TO_RECEIVER', id: s.id, token, actor: me() });
    window.location.hash = `#/r/${s.id}/${token}`;
  };
  const leave = (s: any) => {
    if (!s.loading) dispatch({ type: 'LOADING', id: s.id, point: 'Dock 1', phase: 'start', actor: me() });
    if (!s.loading?.endAt) dispatch({ type: 'LOADING', id: s.id, phase: 'end', actor: me() });
    dispatch({ type: 'SEND_TO_RECEIVER', id: s.id, token: newToken(), actor: me() });
  };

  // Updates: short lines with a picture, newest first
  const news: { at: number; icon: string; text: string; tone: string; side?: string }[] = [];
  for (const s of state.shipments) {
    const [, to] = route(s).split(' → ');
    if (s.cancelledAt) continue;
    if (s.fromUnit === unit && s.arrivedAt && !s.receipt && !s.returning) news.push({ side: 'send', at: s.arrivedAt, icon: '📍', text: `${loadName(s.id)} ${reachedX(to, l)}`, tone: 'bg-sky-50 border-sky-200' });
    if (s.fromUnit === unit && s.ask?.reply) news.push({ side: 'send', at: s.ask.reply.at, icon: REPLIES[s.ask.reply.kind].icon, text: `${w('youReplied')} · ${loadName(s.id)}: ${w(s.ask.reply.kind)}`, tone: 'bg-slate-50 border-slate-200' });
    if (s.fromUnit === unit && s.receipt && Date.now() - s.receipt.at < 48 * 3600000) {
      const dd = diffsOf(state, s.id);
      const bad = dd.length > 0;
      const state2 = !bad ? '' : dd.some((d: any) => d.status === 'open') ? w('diff') : dd.some((d: any) => d.status === 'investigating') ? w('checking') : dd.some((d: any) => d.status === 'waiting') ? w('restComing') : w('decided');
      news.push({ side: 'send', at: Math.max(s.receipt.at, ...dd.map((d: any) => d.decision?.at || 0)), icon: bad ? (dd.some((d: any) => d.status === 'open') ? '⚠️' : '🔎') : '✅', text: `${loadName(s.id)} ${bad ? state2 : w('okCount')}`, tone: bad ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200' });
    }
    if (s.toUnit === unit && s.receipt && Date.now() - s.receipt.at < 48 * 3600000) {
      const bad = diffsOf(state, s.id).length > 0;
      news.push({ side: 'receive', at: s.receipt.at, icon: bad ? '⚠️' : '✅', text: `${loadName(s.id)} ${bad ? w('diff') : w('okCount')}`, tone: bad ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200' });
    }
  }
  for (const r of state.requests || []) {
    if (!String(r.by).startsWith(staffName(state))) continue;
    const what = r.kind === 'add' ? r.name : loadName(r.shipmentId);
    const rs = r.shipmentId && state.shipments.find((x: any) => x.id === r.shipmentId);
    const side = rs ? (rs.fromUnit === unit && !rs.returning ? 'send' : 'receive') : r.what === 'delivery' ? 'receive' : r.what === 'item' ? 'send' : '';
    if (r.status === 'pending') news.push({ side, at: r.at, icon: '⏳', text: `${w('waiting')} · ${what}`, tone: 'bg-amber-50 border-amber-200' });
    else news.push({ side, at: r.decidedAt, icon: r.status === 'approved' ? '👍' : '👎', text: `${w(r.status === 'approved' ? 'yes' : 'no')} · ${what}${r.decidedNote ? ` · “${r.decidedNote}”` : ''}`, tone: r.status === 'approved' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200' });
  }
  const updates = news.filter((n) => !open || !n.side || n.side === open).sort((a, b) => b.at - a.at);

  return (
    <PhoneFrame title="LoadMatch" sub={`${staffName(state)} · ${uname(unit)}`} lang={lang} setLang={setLang}>
      <div className="space-y-4">
        {open && <button id={open === 'send' ? 'btn-send-stock' : 'btn-receive-stock'} onClick={() => { setOpen(''); setJustSent(null); }} className="-mt-1 inline-flex items-center rounded-lg border-2 border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 cursor-pointer">← {w('back')}</button>}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">{w('iAmAt')}:</span>
          {Object.keys(UNITS).map((u) => <button key={u} id={`unit-${u}`} onClick={() => pickUnit(u)} className={`px-3 py-1.5 rounded-full border font-bold cursor-pointer ${u === unit ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}>{uname(u)}</button>)}
        </div>

        {/* the owner asked this unit what happened: one tap to answer */}
        {open !== 'receive' && asks.map((s: any) => (
          <div key={s.id} id={`ask-${s.id}`} className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-3 space-y-2">
            <div className="text-base font-bold text-amber-950">❓ {w('ownerAsks')}</div>
            <div className="text-sm text-amber-950">{foundX(route(s).split(' → ')[1], whatText(diffsOf(state, s.id).filter((d: any) => d.status === 'open' || d.status === 'investigating'), w), loadName(s.id), l)}</div>
            <div className="text-xs text-slate-600">{[...new Set(diffsOf(state, s.id).filter((d: any) => d.status === 'open' || d.status === 'investigating').map((d: any) => d.item))].map((it: any) => `${itemIcon(it)} ${shortName(it)}`).join(' · ')}</div>
            {replyNext !== s.id ? Object.keys(REPLIES).map((k) => <button key={k} id={`reply-${s.id}-${k}`} onClick={() => (k === 'send_next' ? (setReplyNext(s.id), setReplyDue(null)) : dispatch({ type: 'SENDER_REPLY', id: s.id, kind: k, by: staffName(state), actor: me() }))} className="w-full min-h-[48px] rounded-xl border-2 border-amber-300 bg-white px-3 text-left text-sm font-bold text-slate-900 cursor-pointer flex items-center gap-2"><span className="text-xl">{REPLIES[k].icon}</span>{w(k)}</button>)
              : <div className="space-y-2"><div className="text-sm font-bold text-slate-900">📦 {w('send_next')} · {w('when')}</div>
                  <DateChips id={`due-${s.id}`} value={replyDue} onPick={setReplyDue} />
                  <button id={`reply-send-${s.id}`} disabled={!replyDue} onClick={() => { dispatch({ type: 'SENDER_REPLY', id: s.id, kind: 'send_next', dueAt: replyDue, by: staffName(state), actor: me() }); setReplyNext(''); }} className={`${big} bg-emerald-600 text-white disabled:opacity-40`}>📨 {w('sendReply')}</button>
                  <button onClick={() => setReplyNext('')} className="text-xs font-bold text-slate-500 underline cursor-pointer">← {w('back')}</button></div>}
          </div>
        ))}

        {!open ? (
          <div className="grid grid-cols-2 gap-3">
            <button id="btn-send-stock" onClick={() => setOpen('send')} className="min-h-[96px] rounded-2xl text-lg font-bold cursor-pointer flex flex-col items-center justify-center border-2 bg-violet-50 text-violet-900 border-violet-200"><span className="text-3xl">📤</span>{w('send')}</button>
            <button id="btn-receive-stock" onClick={() => setOpen('receive')} className="relative min-h-[96px] rounded-2xl text-lg font-bold cursor-pointer flex flex-col items-center justify-center border-2 bg-sky-50 text-sky-900 border-sky-200"><span className="text-3xl">📥</span>{w('receive')}
              {receiving.length > 0 && <span id="receive-badge" className="absolute top-2 right-2 min-w-6 h-6 px-1.5 rounded-full bg-sky-600 text-white text-sm flex items-center justify-center">{receiving.length}</span>}
            </button>
          </div>
        ) : (
          <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-white ${open === 'send' ? 'bg-violet-700' : 'bg-sky-700'}`}>
            <span className="text-2xl">{open === 'send' ? '📤' : '📥'}</span>
            <span className="text-lg font-bold">{w(open)}</span>
          </div>
        )}

        {open === 'send' && <>
          {justSent && <div id="sent-ok" className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-3 text-base font-bold text-emerald-900">✅ {loadName(justSent)} {w('sentOk')}</div>}
          <SendTruck key={justSent || 'new'} unit={unit} w={w} onSent={(id) => setJustSent(id)} />
          {sending.length > 0 && <div className="text-sm font-bold text-slate-900 pt-1">📤 {w('myTrucks')}</div>}
          {sending.slice(0, 3).map((s: any) => {
            const [, to] = route(s).split(' → ');
            return (
              <div key={s.id} id={`staff-${s.id}`} className={`rounded-2xl border-2 p-3 space-y-2 ${s.id === justSent ? 'border-emerald-400 bg-emerald-50/40' : 'border-violet-200 bg-white'}`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl leading-none">{!s.sentAt ? '📦' : s.arrivedAt ? '📍' : '🚚'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-bold text-slate-900 truncate">{toX(to, l)}</div>
                    {s.truckNo && <Plate no={s.truckNo} />}
                    <div className="text-xs text-slate-600">{!s.sentAt ? w('notLeft') : s.arrivedAt ? w('reached') : w('onTheWay')} · {loadName(s.id)}</div>
                  </div>
                </div>
                {!s.sentAt && <button id={`step-${s.id}`} onClick={() => leave(s)} className={`${big} bg-emerald-600 text-white`}>🚚 {w('truckLeft')}</button>}
                {s.sentAt && s.flow === 'outbound' && !s.linkSentAt && <div id={`owner-link-${s.id}`} className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">💬 {w('ownerSends')}</div>}
                <button id={`open-${s.id}`} onClick={() => go('dispatch', { id: s.id })} className="text-[12px] font-semibold text-slate-500 underline cursor-pointer">{w('problem')}</button>
              </div>
            );
          })}
        </>}

        {open !== 'send' && <div id="coming" className="rounded-2xl border-2 border-sky-300 bg-sky-50 p-3 space-y-2">
          <div className="text-base font-bold text-sky-950">🚚 {w('comingToday')} · {receiving.length}</div>
          {!receiving.length && <div className="text-sm text-sky-900">{w('noneComing')}</div>}
          {(allComing ? receiving : receiving.slice(0, 3)).map((s: any) => {
            const [from] = route(s).split(' → ');
            return (
              <button key={s.id} id={`coming-${s.id}`} onClick={() => { if (!s.arrivedAt && s.sentAt) dispatch({ type: 'ARRIVED', id: s.id, by: me(), actor: me() }); count(s); }} className="w-full text-left rounded-xl bg-white border-2 border-sky-200 hover:border-sky-500 p-3 space-y-2 cursor-pointer block">
                <span className="flex items-center gap-3">
                  <span className="text-3xl leading-none">{s.returning ? '⚠️' : s.flow === 'inbound' ? '🚛' : '🚚'}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-base font-bold text-slate-900">{s.returning ? w('backAccident') : fromX(from, l)}</span>
                    {s.truckNo && s.truckNo !== 'NOT KNOWN' && <Plate no={s.truckNo} />}
                    <span className="block text-xs text-slate-600">{s.arrivedAt ? `📍 ${w('reached')}` : s.expectedOn ? `${w('expected')} ${dayText(s.expectedOn)}` : `${w('onTheWay')} · ${when(s.sentAt)}`} · {loadName(s.id)}</span>
                  </span>
                </span>
                <span className="w-full min-h-[48px] rounded-xl bg-emerald-600 text-white text-base font-bold flex items-center justify-center">📍 {w('arrived')} → 🔢 {w('count')}</span>
              </button>
            );
          })}
          {receiving.length > 3 && <button id="btn-coming-all" onClick={() => setAllComing(!allComing)} className="text-xs font-bold text-sky-800 underline cursor-pointer">{allComing ? '−' : `+${receiving.length - 3} ${w('more')}`}</button>}
          {open === 'receive' && <AskAdd what="delivery" label={w('notInList')} />}
        </div>}

        <div id="updates" className="space-y-1.5">
          <div className="text-sm font-bold text-slate-900">🔔 {w('updates')}</div>
          {!updates.length && <div className="text-xs text-slate-500">{w('noNews')}</div>}
          {(allNews ? updates.slice(0, 6) : updates.slice(0, 3)).map((n, i) => <div key={i} className={`rounded-xl border px-3 py-2 text-sm flex items-start gap-2 ${n.tone}`}><span className="text-lg leading-none">{n.icon}</span><span className="flex-1">{n.text}<span className="block text-[11px] text-slate-500">{when(n.at)}</span></span></div>)}
          {updates.length > 3 && <button id="btn-news-all" onClick={() => setAllNews(!allNews)} className="text-xs font-bold text-slate-500 underline cursor-pointer">{allNews ? '−' : `+${Math.min(updates.length, 6) - 3}`}</button>}
        </div>

        <button id="btn-old" onClick={() => setShowOld(!showOld)} className="text-sm font-bold text-slate-600 underline cursor-pointer">🗂 {w('oldTrucks')} ({old.length})</button>
        {showOld && <div className="space-y-1.5">{old.map((s: any) => {
          const bad = diffsOf(state, s.id).length > 0;
          const [from, to] = route(s).split(' → ');
          return <button key={s.id} id={`old-${s.id}`} onClick={() => go('dispatch', { id: s.id })} className="w-full text-left rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm flex items-center gap-2 cursor-pointer"><span className="text-lg">{s.cancelledAt ? '✖️' : bad ? '⚠️' : '✅'}</span><span className="flex-1 truncate">{s.toUnit === unit ? fromX(from, l) : toX(to, l)} · {loadName(s.id)}</span><span className="text-[11px] text-slate-500">{when(s.receipt?.at || s.cancelledAt)}</span></button>;
        })}</div>}
      </div>
    </PhoneFrame>
  );
}

// Send a truck without typing: where to (tap), photo of the challan (items read from it), photo of the plate
// (truck number read), the driver (same as last time? or a photo of the licence + say the phone number), then Truck left.
// Goods we owe the receiver (missing last time) are offered as one tap. Prototype: photo and voice reading are simulated.
const PLATES = ['KA 09 B 6138', 'KA 40 A 2541', 'KA 19 D 7724', 'KA 05 M 8812'];
const NEW_DRIVERS = [{ name: 'Suresh K', phone: '9900112233' }, { name: 'Imran Pasha', phone: '9741556677' }, { name: 'Venkatesh', phone: '9448023456' }];
function SendTruck({ unit, w, onSent }: { unit: string; w: (k: string) => string; onSent: (id: string) => void }) {
  const { state, dispatch } = useStore();
  const others = Object.keys(UNITS).filter((u) => u !== unit);
  const customers = Object.values(PARTIES).filter((p) => p.kind === 'customer');
  const [to, setTo] = useState(others[0]);
  const flow = UNITS[to] ? 'transfer' : 'outbound';
  const [reading, setReading] = useState<'' | 'challan' | 'plate' | 'licence' | 'phone'>('');
  const [lines, setLines] = useState<{ item: string; qty: number }[] | null>(null);
  const [ref, setRef] = useState('');
  const [plate, setPlate] = useState('');
  const [driver, setDriver] = useState<{ name: string; phone: string } | null>(null);
  const [newDriver, setNewDriver] = useState<{ name: string; phone: string } | null>(null);
  const [owedOn, setOwedOn] = useState<Record<string, boolean>>({});
  const timer = useRef<any>(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const n = state.counters.trk + 1;
  // goods this unit promised to send to the place it is sending to now
  const owed = state.diffs.filter((d: any) => d.status === 'waiting' && !d.came && (() => { const x = state.shipments.find((y: any) => y.id === d.shipmentId); return x && ((d.decision.action === 'unit_sends_rest' && x.flow === 'transfer' && x.fromUnit === unit && x.toUnit === to) || (['send_rest', 'send_replacement'].includes(d.decision.action) && x.flow === 'outbound' && x.fromUnit === unit && x.party === to)); })()
    && !state.shipments.some((y: any) => !y.cancelledAt && (y.fulfils || []).includes(d.id)));
  const readChallan = () => {
    setReading('challan');
    timer.current = setTimeout(() => {
      setLines(flow === 'transfer' ? [{ item: 'PLY-12', qty: 80 }, { item: 'PLY-18', qty: 45 }] : [{ item: 'BOX-NL', qty: 150 }, { item: 'BOX-RB', qty: 60 }]);
      setRef(`${flow === 'transfer' ? 'DC' : 'INV'}-${700 + n}`);
      setReading('');
    }, 1100);
  };
  const readPlate = () => { setReading('plate'); timer.current = setTimeout(() => { setPlate(PLATES[n % PLATES.length]); setReading(''); }, 900); };
  const last = state.shipments.filter((s: any) => s.truckNo === plate && s.driver).sort((a: any, b: any) => b.createdAt - a.createdAt)[0];
  const lastDriver = last ? { name: last.driver, phone: last.driverPhone } : null;
  const readLicence = () => { setReading('licence'); timer.current = setTimeout(() => { setNewDriver({ name: NEW_DRIVERS[n % 3].name, phone: '' }); setReading(''); }, 900); };
  const hearPhone = () => { setReading('phone'); timer.current = setTimeout(() => { const d = { name: newDriver!.name, phone: NEW_DRIVERS[n % 3].phone }; setNewDriver(d); setDriver(d); setReading(''); }, 1200); };
  const pick = (x: string) => { setTo(x); setLines(null); setRef(''); setOwedOn({}); };
  const useOwed = owed.filter((d: any) => owedOn[d.id] !== false);
  const allLines = lines ? useOwed.reduce((acc: any[], d: any) => { const i = acc.findIndex((x) => x.item === d.item); return i >= 0 ? acc.map((x, j) => (j === i ? { ...x, qty: x.qty + d.qty } : x)) : [...acc, { item: d.item, qty: d.qty }]; }, lines) : null;
  const ready = allLines && allLines.every((x) => x.qty > 0) && plate && driver && !reading;
  const leave = () => {
    const id = `TRK-${1000 + n}`;
    const who = me();
    dispatch({ type: 'CREATE_SHIPMENT', id, flow, fromUnit: unit, ...(flow === 'transfer' ? { toUnit: to } : { party: to }), truckNo: plate, ref, driver: driver!.name, driverPhone: driver!.phone, lines: allLines, fulfils: useOwed.map((d: any) => d.id), actor: who });
    dispatch({ type: 'LOADING', id, point: 'Dock 1', phase: 'start', actor: who });
    dispatch({ type: 'LOADING', id, phase: 'end', actor: who });
    dispatch({ type: 'SEND_TO_RECEIVER', id, token: newToken(), actor: who });
    onSent(id);
  };
  const chip = (x: string, icon: string, label: string) => <button key={x} id={`to-${x}`} onClick={() => pick(x)} className={`rounded-xl border-2 px-3 py-2 text-sm font-bold cursor-pointer flex items-center gap-1.5 ${to === x ? 'bg-violet-700 text-white border-violet-700' : 'bg-white text-slate-800 border-slate-300'}`}><span className="text-lg">{icon}</span>{label}</button>;
  const stepCls = (done: boolean) => `rounded-2xl border-2 p-3 space-y-2 ${done ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 bg-white'}`;
  const small = 'min-h-[44px] rounded-xl border-2 text-sm font-bold cursor-pointer px-3';
  return (
    <div id="send-truck" className="space-y-3">
      <div className={stepCls(true)}>
        <div className="text-sm font-bold text-slate-900">1 · {w('whereTo')}</div>
        <div className="flex flex-wrap gap-2">{others.map((u) => chip(u, '🏭', uname(u)))}{customers.map((p) => chip(p.id, '🏪', p.name))}</div>
        {owed.map((d: any) => (
          <button key={d.id} id={`owed-${d.id}`} onClick={() => setOwedOn({ ...owedOn, [d.id]: owedOn[d.id] === false })} className={`w-full text-left rounded-xl border-2 p-2.5 text-sm cursor-pointer flex items-center gap-2 ${owedOn[d.id] !== false ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white'}`}>
            <span className="text-xl">{owedOn[d.id] !== false ? '☑️' : '⬜'}</span>
            <span className="flex-1"><b>{w('owedAdd')}</b>: {itemIcon(d.item)} {d.qty} {shortName(d.item)}<span className="block text-[11px] text-slate-600">{w('owedWhy')} · {loadName(d.shipmentId)}</span></span>
          </button>
        ))}
      </div>
      <div className={stepCls(Boolean(lines))}>
        <div className="text-sm font-bold text-slate-900">2 · {w('photoChallan')}</div>
        {reading === 'challan' ? <div className="text-sm font-bold text-slate-700">⏳ {w('reading')}</div>
          : <CameraButton id="btn-photo-challan" kind="challan" label={w('photoChallan')} done={Boolean(lines)} onShot={readChallan} text={ref || `DC-${700 + n}`} busyText={ref} />}
        {lines && <>
          <div id="challan-read" className="text-xs text-emerald-900">🤖 {w('checkNumbers')}</div>
          {allLines!.map((x) => {
            const own = lines.find((y) => y.item === x.item);
            const extra = x.qty - (own?.qty || 0);
            return (
              <div key={x.item} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
                <span className="text-2xl">{itemIcon(x.item)}</span>
                <span className="flex-1 min-w-0 text-sm font-bold text-slate-900 leading-tight">{shortName(x.item)}<span className="block text-[11px] font-normal text-slate-500">{item(x.item).unit}{extra > 0 ? ` · ${w('owedIncl')} ${extra}` : ''}</span></span>
                {own ? <Stepper id={`send-qty-${x.item}`} value={own.qty} onChange={(q) => setLines(lines.map((y) => (y.item === x.item ? { ...y, qty: q } : y)))} /> : <span className="text-xl font-mono font-bold pr-3">{x.qty}</span>}
              </div>
            );
          })}
        </>}
      </div>
      <div className={stepCls(Boolean(plate && driver))}>
        <div className="text-sm font-bold text-slate-900">3 · {w('photoPlate')}</div>
        {reading === 'plate' ? <div className="text-sm font-bold text-slate-700">⏳ {w('reading')}</div>
          : !plate ? <CameraButton id="btn-photo-plate" kind="plate" label={w('photoPlate')} done={false} onShot={readPlate} text={PLATES[n % PLATES.length]} />
          : <div id="plate-read"><Plate no={plate} /></div>}
        {plate && !driver && <div id="driver-step" className="space-y-2 pt-1">
          <div className="text-sm font-bold text-slate-900">🧑‍✈️ {w('whoDrives')}</div>
          {lastDriver && !newDriver && <div className="grid grid-cols-2 gap-2">
            <button id="btn-same-driver" onClick={() => setDriver(lastDriver)} className={`${small} bg-emerald-600 text-white border-emerald-600`}>✓ {lastDriver.name}<span className="block text-[10px] font-normal">{w('sameDriver')}</span></button>
            <button id="btn-other-driver" onClick={() => setNewDriver({ name: '', phone: '' })} className={`${small} bg-white text-slate-800 border-slate-300`}>🔄 {w('otherDriver')}</button>
          </div>}
          {(!lastDriver || newDriver) && (reading === 'licence' ? <div className="text-sm font-bold text-slate-700">⏳ {w('reading')}</div>
            : !newDriver?.name ? <CameraButton id="btn-photo-licence" kind="licence" label={w('photoLicence')} done={false} onShot={readLicence} text={`Name: ${NEW_DRIVERS[n % 3].name}`} />
            : <div className="space-y-2"><div className="text-xs text-emerald-900">🤖 {w('licenceRead')}: <b>{newDriver.name}</b></div>
                <button id="btn-driver-phone" disabled={reading === 'phone'} onClick={hearPhone} className={`w-full min-h-[52px] rounded-2xl text-white text-base font-bold cursor-pointer ${reading === 'phone' ? 'bg-rose-600 animate-pulse' : 'bg-slate-900'}`}>🎤 {reading === 'phone' ? w('listening') : w('sayPhone')}</button></div>)}
        </div>}
        {driver && <div id="driver-read" className="text-xs text-slate-700">🧑‍✈️ <b>{driver.name}</b> · 📞 {driver.phone} {driver !== lastDriver && <span className="text-emerald-800">({w('newSaved')})</span>} <button id="btn-change-driver" onClick={() => { setDriver(null); setNewDriver({ name: '', phone: '' }); }} className="underline text-slate-500 cursor-pointer ml-1">{w('change')}</button></div>}
      </div>
      <button id="btn-truck-left" disabled={!ready} onClick={leave} className={`${big} bg-emerald-600 text-white disabled:opacity-40`}>🚚 {w('truckLeft')}</button>
    </div>
  );
}

export function AskAdd({ what, partyKind, label }: { what: 'item' | 'party' | 'delivery'; partyKind?: string; label?: string }) {
  const { dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(what === 'item' ? 'Rosewood veneer 4 mm' : what === 'delivery' ? 'Sri Lakshmi Timbers' : partyKind === 'supplier' ? 'Kaveri Timber Depot' : 'Hosur Crates');
  const [sent, setSent] = useState('');
  if (sent) return <div className="text-[11px] text-emerald-800">Asked the owner about “{sent}”. The answer shows in Updates.</div>;
  if (!open) return <button id={`ask-add-${what}`} onClick={() => setOpen(true)} className="text-[12px] font-bold text-sky-800 underline cursor-pointer text-left">{label || (what === 'item' ? 'Item not in the list? Ask owner to add it' : partyKind === 'supplier' ? 'New supplier at the gate? Ask owner to add them' : `New ${partyKind || 'party'}? Ask owner to add them`)}</button>;
  return (
    <div className="flex gap-2">
      <input id={`ask-add-name-${what}`} value={name} onChange={(e) => setName(e.target.value)} placeholder={what === 'item' ? 'Item name and size' : what === 'delivery' ? 'Whose truck? e.g. Coastal Veneers' : 'Party name'} className="flex-1 p-2 rounded-lg border border-slate-300 text-xs" />
      <button id={`ask-add-send-${what}`} disabled={!name.trim()} onClick={() => { dispatch({ type: 'ASK_ADD', what, name: what === 'delivery' ? `${name.trim()} (at ${uname(getUnit())})` : name, partyKind, by: me() }); setSent(name.trim()); }} className="px-3 rounded-lg bg-slate-900 text-white text-xs font-bold disabled:opacity-40 cursor-pointer">Ask</button>
    </div>
  );
}
