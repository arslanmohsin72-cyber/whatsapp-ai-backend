/**
 * Fast Rule & Keyword Intent Classifier for Guardrails & Message Routing
 * Covers the 14 Standard Aircon Business Inquiry Formats
 */
export const classifyIntent = (text = '', businessContext = {}) => {
  if (!text || typeof text !== 'string') return { intent: 'greeting', confidence: 0.5 };

  const clean = text.trim().toLowerCase();

  // 1. Contact / Human Support / Handover (Inquiry #13)
  const contactKeywords = [
    'human', 'agent', 'operator', 'talk to person', 'speak to human', 
    'real person', 'complaint', 'scam', 'police', 'cheat', 'staff',
    'contact', 'phone number', 'call', 'whatsapp number', 'call me', 'customer service', 'admin',
    'bhai kisi bande se baat karwao', 'insan se baat', 'agent chahiye', 'cakap dengan orang', 'nombor telefon', 'hubungi'
  ];
  if (contactKeywords.some((kw) => clean.includes(kw))) {
    return { intent: 'contact_support', confidence: 0.95 };
  }

  // 2. Out of Scope Rejections (Strict Business-Only Guardrail)
  const outOfScopeKeywords = [
    'weather', 'coding', 'write code', 'c++', 'javascript', 'python', 'java', 
    'html', 'react', 'poem', 'joke', 'story', 'homework', 'math', 'calculate', 
    'formula', 'politics', 'election', 'minister', 'president', 'movie', 'song',
    'cricket score', 'football score', 'recipe', 'cook', 'capital of', 'who is',
    'write an essay', 'solve this', 'binary tree', 'tell me about history'
  ];
  if (outOfScopeKeywords.some((kw) => clean.includes(kw))) {
    return { intent: 'out_of_scope', confidence: 0.98 };
  }

  // 3. Affirmation / Customer says "Yes" / "Ok" / "Proceed"
  const affirmationKeywords = ['yes', 'ya', 'yea', 'yup', 'ok', 'okay', 'boleh', 'haan', 'sahi', 'sure', 'proceed', 'setuju', 'nak book', 'jadi'];
  const isAffirmation = affirmationKeywords.some((kw) => clean === kw || clean.startsWith(kw + ' ') || clean.endsWith(' ' + kw) || clean === `${kw} please` || clean === `${kw} proceed` || clean === `${kw} proceed please`) ||
    clean.includes('yes proceed') || clean.includes('ok proceed') || clean.includes('proceed please');
  if (isAffirmation && !clean.includes('no') && !clean.includes('not')) {
    return { intent: 'affirmation', confidence: 0.95 };
  }

  // 4. Negation / Customer says "No" / "Cancel" / "Not now"
  const negationKeywords = ['no', 'tak', 'taknak', 'tak nak', 'nahi', 'nah', 'cancel', 'not now', 'later', 'tak jadi'];
  if (negationKeywords.includes(clean) || clean === 'no thanks' || clean === 'takpe') {
    return { intent: 'negation', confidence: 0.95 };
  }

  // 5. Uncertainty / "I don't know" / "Not sure"
  const uncertaintyKeywords = ["i don't know", 'dont know', 'tak tahu', 'tak pasti', 'pata nahi', 'not sure', 'confused', 'tak sure', 'kurang pasti'];
  if (uncertaintyKeywords.some((kw) => clean.includes(kw))) {
    return { intent: 'uncertainty', confidence: 0.92 };
  }

  // 6. Gas Inquiry (Inquiry #7 - "Do you provide gas?")
  if (clean.includes('gas') || clean.includes('psi') || clean.includes('isi gas') || clean.includes('top up gas') || clean.includes('topup gas') || clean.includes('refill gas')) {
    return { intent: 'gas_inquiry', confidence: 0.95 };
  }

  // 7. Photo Inquiry (Inquiry #10 - "Can I send a photo?")
  if (clean.includes('photo') || clean.includes('picture') || clean.includes('pic') || clean.includes('image') || clean.includes('gambar') || clean.includes('hantar gambar') || clean.includes('send a photo') || clean.includes('send photo') || clean.includes('send pic')) {
    return { intent: 'photo_inquiry', confidence: 0.95 };
  }

  // 8. Schedule / Arrival Availability (Inquiry #9 - "When can you come?")
  if (clean.includes('when can you come') || clean.includes('when you come') || clean.includes('when can come') || clean.includes('what time can come') || clean.includes('bila boleh datang') || clean.includes('kab aa sakte') || clean.includes('bila boleh sampai') || clean.includes('available slot') || clean.includes('arrival time') || clean.includes('when can technician come')) {
    return { intent: 'schedule_inquiry', confidence: 0.95 };
  }

  // 9. "My aircon is not cold" (Inquiry #11)
  if (clean.includes('not cold') || clean.includes('tak sejuk') || clean.includes('kurang sejuk') || clean.includes('thanda nahi') || clean.includes('not cooling') || clean.includes('no cold') || clean.includes('tak dingin') || clean.includes('no cooling')) {
    return { intent: 'not_cold_inquiry', confidence: 0.95 };
  }

  // 10. Warranty Inquiry (Inquiry #12)
  if (clean.includes('warranty') || clean.includes('waranti') || clean.includes('guarantee') || clean.includes('jaminan') || clean.includes('workmanship warranty')) {
    return { intent: 'warranty_inquiry', confidence: 0.95 };
  }

  // 11. Water Leaking (Inquiry #6)
  if (clean.includes('water leak') || clean.includes('water leaking') || clean.includes('leaking') || clean.includes('leak') || clean.includes('bocor') || clean.includes('menitis') || clean.includes('tapak air') || clean.includes('paani tapak')) {
    return { intent: 'water_leaking_inquiry', confidence: 0.95 };
  }

  // 12. Cassette Installation (Inquiry #8 - "How much for cassette installation?")
  if (clean.includes('cassette') || clean.includes('casettee') || clean.includes('casette') || clean.includes('kaset') || clean.includes('ceiling cassette') || clean.includes('ceiling aircond')) {
    return { intent: 'cassette_inquiry', confidence: 0.95 };
  }

  // 13. Wall-Mounted Installation Price (Inquiry #3 - "Installation Price")
  if ((clean.includes('install') || clean.includes('pasang') || clean.includes('lagana') || clean.includes('pemasangan')) && !clean.includes('cassette')) {
    return { intent: 'installation_price_inquiry', confidence: 0.95 };
  }

  // 14. Chemical Service Price (Inquiry #2 - "How much is aircon service?" / Chemical)
  if (clean.includes('chemical') || clean.includes('wash') || clean.includes('cuci') || clean.includes('overhaul') || clean.includes('aircon service') || clean.includes('aircond service') || clean.includes('how much is aircon service') || clean.includes('service price') || clean.includes('harga servis')) {
    return { intent: 'service_price_inquiry', confidence: 0.95 };
  }

  // 15. What services do you provide? (Inquiry #4)
  const serviceListKeywords = [
    'what service', 'what services', 'which service', 'which services', 
    'services do you', 'service do you', 'services you provide', 'service you provide',
    'services provide', 'service provide', 'services offered', 'service offer',
    'what can you do', 'ada servis apa', 'servis apa ada', 'servis apa yang ada',
    'servis disediakan', 'servis yang disediakan', 'kya services hain', 'service list',
    'apa servis', 'available service', 'available services', 'all service', 'all services', 'list servis'
  ];
  if (serviceListKeywords.some((kw) => clean.includes(kw)) || clean === 'services' || clean === 'servis' || clean === 'service' || clean === '1' || clean === '1️⃣' || clean === 'aircon service' || clean === 'price inquiry' || clean === '4' || clean === '4️⃣') {
    if (clean === '4' || clean === '4️⃣' || clean === 'price inquiry') {
      return { intent: 'catalog_inquiry', confidence: 0.95 };
    }
    return { intent: 'services_list_inquiry', confidence: 0.95 };
  }

  // 16. Service Area Inquiry (Inquiry #1 - "Do you cover my area?")
  const areaKeywords = [
    'cover', 'coverage', 'area', 'location', 'serve', 'deliver', 'city', 'postcode',
    'kahan', 'area konsa', 'idhar aate ho', 'kuching', 'kl', 'selangor', 'pj', 'johor', 'melaka', 'malacca', 'negeri sembilan', 'seremban', 'jb',
    'kawasan', 'lokasi', 'tempat', 'do you cover my area', 'cover area'
  ];
  if (areaKeywords.some((kw) => clean.includes(kw))) {
    return { intent: 'area_inquiry', confidence: 0.92 };
  }

  // 17. Booking Inquiry (Inquiry #5 - "Booking Inquiry")
  const bookingKeywords = [
    'book', 'booking', 'booking form', 'schedule', 'appointment', 'reserve', 'slot',
    'come tomorrow', 'come today', 'need service tomorrow', 'send technician',
    'send someone', 'fix my', 'repair my',
    'kal aa sakte', 'book karna hai', 'service chahiye', 'banda bhejo',
    'nak book', 'nak servis esok', 'hantar orang', 'temujanji', 'tempah', 'tempahan', 'can i make booking', '5', '5️⃣'
  ];
  if (bookingKeywords.some((kw) => clean.includes(kw))) {
    return { intent: 'booking_inquiry', confidence: 0.92 };
  }

  // 18. HP Size, Unit Quantity, Option Number Selections & Typos (e.g. "1 and 2", "1 HP and 2 unuts", "1.5hp 2 units")
  const hpQuantityPatterns = [
    /^\s*1\s*(?:and|&|\+|\,)\s*2\s*$/i,
    /^\s*(?:1|2|3|4|5)\s*$/,
    /^\s*(?:option|no\.?|nombor|pilihan|servis|service)\s*[1-5]\s*$/i,
    /\b\d+(?:\.\d+)?\s*hp\b/i,
    /\b\d+\s*(?:units?|unuts?|unite|untis?|unt|biji|buah|nos?|ac|aircond|set)\b/i,
    /^(?:1\.0|1\.5|2\.0|2\.5|3\.0)$/
  ];
  if (hpQuantityPatterns.some(pattern => pattern.test(clean))) {
    return { intent: 'hp_quantity_response', confidence: 0.95 };
  }

  // 19. Full Pricing Catalog Inquiry
  const catalogKeywords = ['all price', 'price list', 'all prices', 'senarai harga', 'full price', 'catalog', 'semua harga', 'tamam rates', 'rates list', 'list harga', 'tell me the prices', 'all rates', 'price', 'rates', 'charges', 'harga', 'cost', 'how much'];
  if (catalogKeywords.some((kw) => clean.includes(kw))) {
    return { intent: 'catalog_inquiry', confidence: 0.95 };
  }

  // 20. Pure Greetings (Inquiry #14 - Customer says "Hi/Hello")
  const greetingKeywords = [
    'hi', 'hello', 'hy', 'hey', 'hlo', 'helo', 'hiya', 'holla', 'greetings',
    'salam', 'assalam', 'assalamualaikum', 'aoa', 'selamat', 'morning', 'evening', 
    'hai', 'halo', 'good morning', 'good afternoon', 'good evening', 'selamat pagi', 'selamat petang'
  ];
  if (greetingKeywords.includes(clean) || clean === 'hi boss' || clean === 'hello boss' || clean === 'hai boss' || clean === 'hy boss') {
    return { intent: 'greeting', confidence: 0.95 };
  }

  return { intent: 'general_inquiry', confidence: 0.7 };
};

export default { classifyIntent };

