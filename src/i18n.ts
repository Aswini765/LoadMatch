// Phone screens (dispatch staff, receiver) in English, Hindi, Kannada and Telugu.
// Item names stay as they are in Tally. Owner and accountant screens are in English.

export const LANGS: Record<string, { label: string; speech: string }> = {
  en: { label: 'English', speech: 'en-IN' },
  hi: { label: 'हिंदी', speech: 'hi-IN' },
  kn: { label: 'ಕನ್ನಡ', speech: 'kn-IN' },
  te: { label: 'తెలుగు', speech: 'te-IN' },
};

type Tr = { en: string; hi: string; kn: string; te: string };
const T: Record<string, Tr> = {
  // receiver
  rcvTitle: { en: 'Count what arrived', hi: 'जो आया उसे गिनें', kn: 'ಬಂದದ್ದನ್ನು ಎಣಿಸಿ', te: 'వచ్చినవి లెక్కించండి' },
  rcvIntro: {
    en: 'Count each line and enter what you see. The sent quantity is hidden, so count carefully.',
    hi: 'हर लाइन गिनें और जो दिखे वही लिखें। भेजी गई मात्रा छिपी है, इसलिए ध्यान से गिनें।',
    kn: 'ಪ್ರತಿ ಸಾಲನ್ನು ಎಣಿಸಿ, ಕಂಡದ್ದನ್ನು ನಮೂದಿಸಿ. ಕಳುಹಿಸಿದ ಪ್ರಮಾಣ ಮರೆಮಾಡಲಾಗಿದೆ, ಎಚ್ಚರಿಕೆಯಿಂದ ಎಣಿಸಿ.',
    te: 'ప్రతి లైన్ లెక్కించి, కనిపించినది నమోదు చేయండి. పంపిన సంఖ్య దాచబడింది, జాగ్రత్తగా లెక్కించండి.',
  },
  from: { en: 'From', hi: 'कहाँ से', kn: 'ಎಲ್ಲಿಂದ', te: 'ఎక్కడి నుండి' },
  to: { en: 'To', hi: 'कहाँ तक', kn: 'ಎಲ್ಲಿಗೆ', te: 'ఎక్కడికి' },
  truck: { en: 'Truck', hi: 'गाड़ी', kn: 'ವಾಹನ', te: 'వాహనం' },
  ref: { en: 'Ref', hi: 'संदर्भ', kn: 'ಉಲ್ಲೇಖ', te: 'రిఫరెన్స్' },
  yourName: { en: 'Your name', hi: 'आपका नाम', kn: 'ನಿಮ್ಮ ಹೆಸರು', te: 'మీ పేరు' },
  counted: { en: 'Counted', hi: 'गिने', kn: 'ಎಣಿಸಿದ್ದು', te: 'లెక్కించినవి' },
  damaged: { en: 'Damaged (of counted)', hi: 'खराब (गिने में से)', kn: 'ಹಾಳಾದವು (ಎಣಿಸಿದವುಗಳಲ್ಲಿ)', te: 'పాడైనవి (లెక్కించిన వాటిలో)' },
  addPhoto: { en: 'Add photo', hi: 'फोटो जोड़ें', kn: 'ಫೋಟೋ ಸೇರಿಸಿ', te: 'ఫోటో జోడించండి' },
  photos: { en: 'photos', hi: 'फोटो', kn: 'ಫೋಟೋಗಳು', te: 'ఫోటోలు' },
  note: { en: 'Note (optional)', hi: 'नोट (वैकल्पिक)', kn: 'ಟಿಪ್ಪಣಿ (ಐಚ್ಛಿಕ)', te: 'గమనిక (ఐచ్ఛికం)' },
  submit: { en: 'Submit count', hi: 'गिनती भेजें', kn: 'ಎಣಿಕೆ ಸಲ್ಲಿಸಿ', te: 'లెక్క పంపండి' },
  confirmSubmit: { en: 'Submit now? You cannot change the count after this.', hi: 'अभी भेजें? इसके बाद गिनती बदल नहीं सकते।', kn: 'ಈಗ ಸಲ್ಲಿಸುವುದೇ? ನಂತರ ಎಣಿಕೆ ಬದಲಿಸಲು ಆಗುವುದಿಲ್ಲ.', te: 'ఇప్పుడు పంపాలా? తర్వాత లెక్క మార్చలేరు.' },
  yesSubmit: { en: 'Yes, submit', hi: 'हाँ, भेजें', kn: 'ಹೌದು, ಸಲ್ಲಿಸಿ', te: 'అవును, పంపండి' },
  goBack: { en: 'Go back', hi: 'वापस जाएँ', kn: 'ಹಿಂದೆ ಹೋಗಿ', te: 'వెనక్కి' },
  submitted: { en: 'Submitted. The owner has your count. Thank you.', hi: 'भेज दिया। मालिक को आपकी गिनती मिल गई। धन्यवाद।', kn: 'ಸಲ್ಲಿಸಲಾಗಿದೆ. ಮಾಲೀಕರಿಗೆ ನಿಮ್ಮ ಎಣಿಕೆ ತಲುಪಿದೆ. ಧನ್ಯವಾದ.', te: 'పంపబడింది. యజమానికి మీ లెక్క చేరింది. ధన్యవాదాలు.' },
  locked: { en: 'This count is locked.', hi: 'यह गिनती लॉक है।', kn: 'ಈ ಎಣಿಕೆ ಲಾಕ್ ಆಗಿದೆ.', te: 'ఈ లెక్క లాక్ అయింది.' },
  invalidLink: { en: 'This link is not valid. Ask the sender for a new link.', hi: 'यह लिंक सही नहीं है। भेजने वाले से नया लिंक माँगें।', kn: 'ಈ ಲಿಂಕ್ ಸರಿಯಿಲ್ಲ. ಕಳುಹಿಸಿದವರಿಂದ ಹೊಸ ಲಿಂಕ್ ಕೇಳಿ.', te: 'ఈ లింక్ సరైనది కాదు. పంపినవారిని కొత్త లింక్ అడగండి.' },
  linesLeft: { en: 'lines left', hi: 'लाइन बाकी', kn: 'ಸಾಲುಗಳು ಬಾಕಿ', te: 'లైన్లు మిగిలాయి' },
  speakCount: { en: 'Speak the number', hi: 'संख्या बोलें', kn: 'ಸಂಖ್ಯೆ ಹೇಳಿ', te: 'సంఖ్య చెప్పండి' },
  // dispatch
  trucks: { en: 'Trucks', hi: 'गाड़ियाँ', kn: 'ವಾಹನಗಳು', te: 'వాహనాలు' },
  newTransfer: { en: 'To our other unit', hi: 'हमारी दूसरी यूनिट को', kn: 'ನಮ್ಮ ಇನ್ನೊಂದು ಘಟಕಕ್ಕೆ', te: 'మా మరో యూనిట్‌కు' },
  newCustomer: { en: 'To a customer', hi: 'ग्राहक को', kn: 'ಗ್ರಾಹಕರಿಗೆ', te: 'కస్టమర్‌కు' },
  supplierDelivery: { en: 'Supplier delivery at the gate', hi: 'गेट पर सप्लायर का माल', kn: 'ಗೇಟ್‌ನಲ್ಲಿ ಪೂರೈಕೆದಾರರ ಸರಕು', te: 'గేటు వద్ద సరఫరాదారు సరుకు' },
  customer: { en: 'Customer', hi: 'ग्राहक', kn: 'ಗ್ರಾಹಕ', te: 'కస్టమర్' },
  supplier: { en: 'Supplier', hi: 'सप्लायर', kn: 'ಪೂರೈಕೆದಾರ', te: 'సరఫరాదారు' },
  fromUnit: { en: 'From unit', hi: 'किस यूनिट से', kn: 'ಯಾವ ಘಟಕದಿಂದ', te: 'ఏ యూనిట్ నుండి' },
  toUnit: { en: 'To unit', hi: 'किस यूनिट को', kn: 'ಯಾವ ಘಟಕಕ್ಕೆ', te: 'ఏ యూనిట్‌కు' },
  truckNo: { en: 'Truck number', hi: 'गाड़ी नंबर', kn: 'ವಾಹನ ಸಂಖ್ಯೆ', te: 'వాహనం నంబర్' },
  challanNo: { en: 'Challan number', hi: 'चालान नंबर', kn: 'ಚಲನ್ ಸಂಖ್ಯೆ', te: 'చలాన్ నంబర్' },
  invoiceNo: { en: 'Invoice number', hi: 'बिल नंबर', kn: 'ಇನ್‌ವಾಯ್ಸ್ ಸಂಖ್ಯೆ', te: 'ఇన్వాయిస్ నంబర్' },
  billNo: { en: "Supplier's bill number", hi: 'सप्लायर बिल नंबर', kn: 'ಪೂರೈಕೆದಾರರ ಬಿಲ್ ಸಂಖ್ಯೆ', te: 'సరఫరాదారు బిల్ నంబర్' },
  item: { en: 'Item', hi: 'सामान', kn: 'ವಸ್ತು', te: 'వస్తువు' },
  qty: { en: 'Quantity', hi: 'मात्रा', kn: 'ಪ್ರಮಾಣ', te: 'సంఖ్య' },
  billedQty: { en: 'Quantity on the bill', hi: 'बिल पर मात्रा', kn: 'ಬಿಲ್‌ನಲ್ಲಿರುವ ಪ್ರಮಾಣ', te: 'బిల్లులో ఉన్న సంఖ్య' },
  addLine: { en: 'Add line', hi: 'लाइन जोड़ें', kn: 'ಸಾಲು ಸೇರಿಸಿ', te: 'లైన్ జోడించండి' },
  paste: { en: 'Paste from Excel', hi: 'Excel से पेस्ट करें', kn: 'Excel ನಿಂದ ಪೇಸ್ಟ್ ಮಾಡಿ', te: 'Excel నుండి పేస్ట్ చేయండి' },
  pasteHelp: { en: 'One line per item: code or name, then quantity', hi: 'हर सामान एक लाइन में: कोड या नाम, फिर मात्रा', kn: 'ಪ್ರತಿ ವಸ್ತು ಒಂದು ಸಾಲು: ಕೋಡ್ ಅಥವಾ ಹೆಸರು, ನಂತರ ಪ್ರಮಾಣ', te: 'ప్రతి వస్తువు ఒక లైన్: కోడ్ లేదా పేరు, తర్వాత సంఖ్య' },
  usePasted: { en: 'Use these lines', hi: 'ये लाइनें लें', kn: 'ಈ ಸಾಲುಗಳನ್ನು ಬಳಸಿ', te: 'ఈ లైన్లు వాడండి' },
  notRecognised: { en: 'Not recognised', hi: 'पहचाना नहीं', kn: 'ಗುರುತಿಸಲಿಲ್ಲ', te: 'గుర్తించలేదు' },
  saveList: { en: 'Save list', hi: 'सूची सेव करें', kn: 'ಪಟ್ಟಿ ಉಳಿಸಿ', te: 'జాబితా సేవ్ చేయండి' },
  loadingPoint: { en: 'Loading point', hi: 'लोडिंग जगह', kn: 'ಲೋಡಿಂಗ್ ಸ್ಥಳ', te: 'లోడింగ్ స్థలం' },
  startLoading: { en: 'Loading started', hi: 'लोडिंग शुरू', kn: 'ಲೋಡಿಂಗ್ ಆರಂಭ', te: 'లోడింగ్ మొదలు' },
  endLoading: { en: 'Loading finished', hi: 'लोडिंग पूरी', kn: 'ಲೋಡಿಂಗ್ ಮುಗಿಯಿತು', te: 'లోడింగ్ పూర్తి' },
  loadingFirst: { en: 'Record when loading starts and finishes. That time is used to find CCTV footage if there is a dispute.', hi: 'लोडिंग शुरू और पूरी होने का समय दर्ज करें। विवाद होने पर इसी समय से CCTV देखा जाता है।', kn: 'ಲೋಡಿಂಗ್ ಆರಂಭ ಮತ್ತು ಮುಗಿದ ಸಮಯ ದಾಖಲಿಸಿ. ವಿವಾದವಾದರೆ ಈ ಸಮಯದಿಂದ CCTV ನೋಡಲಾಗುತ್ತದೆ.', te: 'లోడింగ్ మొదలు, పూర్తి సమయం నమోదు చేయండి. వివాదం వస్తే ఈ సమయంతో CCTV చూస్తారు.' },
  sendReceiver: { en: 'Truck left: send link to receiver', hi: 'गाड़ी निकली: रिसीवर को लिंक भेजें', kn: 'ವಾಹನ ಹೊರಟಿತು: ಸ್ವೀಕರಿಸುವವರಿಗೆ ಲಿಂಕ್ ಕಳುಹಿಸಿ', te: 'వాహనం బయలుదేరింది: రిసీవర్‌కు లింక్ పంపండి' },
  shareWhatsApp: { en: 'Share on WhatsApp', hi: 'WhatsApp पर भेजें', kn: 'WhatsApp ನಲ್ಲಿ ಹಂಚಿ', te: 'WhatsApp లో పంపండి' },
  copyLink: { en: 'Copy link', hi: 'लिंक कॉपी करें', kn: 'ಲಿಂಕ್ ನಕಲಿಸಿ', te: 'లింక్ కాపీ చేయండి' },
  copied: { en: 'Copied', hi: 'कॉपी हुआ', kn: 'ನಕಲಾಯಿತು', te: 'కాపీ అయింది' },
  remind: { en: 'Remind receiver', hi: 'रिसीवर को याद दिलाएँ', kn: 'ಸ್ವೀಕರಿಸುವವರಿಗೆ ನೆನಪಿಸಿ', te: 'రిసీవర్‌కు గుర్తు చేయండి' },
  countNow: { en: 'Count now', hi: 'अभी गिनें', kn: 'ಈಗ ಎಣಿಸಿ', te: 'ఇప్పుడే లెక్కించండి' },
  cancelTruck: { en: 'Cancel this truck', hi: 'यह गाड़ी रद्द करें', kn: 'ಈ ವಾಹನ ರದ್ದು ಮಾಡಿ', te: 'ఈ వాహనం రద్దు చేయండి' },
  back: { en: 'Back', hi: 'वापस', kn: 'ಹಿಂದೆ', te: 'వెనక్కి' },
  new: { en: 'New', hi: 'नया', kn: 'ಹೊಸ', te: 'కొత్త' },
  linkMessage: { en: 'Please count this truck and submit:', hi: 'कृपया इस गाड़ी का माल गिनकर भेजें:', kn: 'ದಯವಿಟ್ಟು ಈ ವಾಹನದ ಸರಕು ಎಣಿಸಿ ಸಲ್ಲಿಸಿ:', te: 'దయచేసి ఈ వాహనం సరుకు లెక్కించి పంపండి:' },
  // statuses on the phone
  st_LOADING: { en: 'Loading', hi: 'लोडिंग', kn: 'ಲೋಡಿಂಗ್', te: 'లోడింగ్' },
  st_IN_TRANSIT: { en: 'Waiting for count', hi: 'गिनती का इंतज़ार', kn: 'ಎಣಿಕೆಗೆ ಕಾಯುತ್ತಿದೆ', te: 'లెక్క కోసం వేచి ఉంది' },
  st_MATCHED: { en: 'All matched', hi: 'सब सही', kn: 'ಎಲ್ಲಾ ಸರಿ', te: 'అన్నీ సరిపోయాయి' },
  st_TO_DECIDE: { en: 'Difference', hi: 'अंतर है', kn: 'ವ್ಯತ್ಯಾಸ ಇದೆ', te: 'తేడా ఉంది' },
  st_WAITING: { en: 'Pending promise', hi: 'वादा बाकी', kn: 'ಭರವಸೆ ಬಾಕಿ', te: 'హామీ పెండింగ్' },
  st_SETTLED: { en: 'Settled', hi: 'निपटा', kn: 'ಇತ್ಯರ್ಥ', te: 'పరిష్కారమైంది' },
  st_CANCELLED: { en: 'Cancelled', hi: 'रद्द', kn: 'ರದ್ದು', te: 'రద్దు' },
};

export const t = (key: string, lang: string) => (T[key] as any)?.[lang] || T[key]?.en || key;

const UNITS: Record<string, Tr> = {
  pcs: { en: 'pcs', hi: 'पीस', kn: 'ಪೀಸ್', te: 'పీసులు' },
  bundles: { en: 'bundles', hi: 'बंडल', kn: 'ಬಂಡಲ್', te: 'కట్టలు' },
};
export const unitWord = (unit: string, lang: string) => (UNITS[unit] as any)?.[lang] || unit;
export const fill = (str: string, vars: Record<string, any>) => str.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
