/**
 * Language Detector for WhatsApp AI Platform
 * Detects English, Urdu (Arabic script), Roman Urdu, Malay/Bahasa, Arabic, and mixed styles.
 */
export const detectLanguage = (text = '') => {
  if (!text || typeof text !== 'string') return { code: 'en', name: 'English', confidence: 0.5 };

  const clean = text.trim().toLowerCase();

  // 1. Urdu / Arabic script detection
  const urduArabicRegex = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
  if (urduArabicRegex.test(clean)) {
    // Check for Urdu-specific letters: ٹ, ڈ, ڑ, ں, ے, ھ, ۂ, ۃ
    const urduSpecific = /[ٹڈڑںےھۂۃپچژ]/;
    if (urduSpecific.test(clean)) {
      return { code: 'ur', name: 'Urdu', confidence: 0.95 };
    }
    return { code: 'ar', name: 'Arabic', confidence: 0.9 };
  }

  // 2. Roman Urdu keywords
  const romanUrduKeywords = [
    'kya', 'hai', 'hain', 'kitna', 'kitne', 'ka', 'ki', 'ke', 'mujhe', 'aap', 'ap', 
    'chahiye', 'karna', 'karo', 'karwana', 'kab', 'aana', 'aaoge', 'shukriya', 'bhai', 
    'sir', 'batao', 'bataen', 'kahan', 'kharab', 'thik', 'theek', 'kitney', 'hoga', 
    'hogi', 'karwa', 'raha', 'rahi', 'mera', 'meri', 'mere', 'paas', 'bohot', 'boht'
  ];

  // 3. Malay / Bahasa keywords
  const malayKeywords = [
    'berapa', 'harga', 'bila', 'boleh', 'servis', 'nak', 'saya', 'kat', 
    'mana', 'terima', 'kasih', 'tolong', 'datang', 'esok', 'ada', 'tak', 'pukul', 
    'bila-bila', 'lokasi', 'alamat', 'kawasan', 'rosak', 'sejuk', 'pasang', 'cuci', 'kos',
    'bocor', 'menitis', 'air bocor', 'paip bocor', 'tak sejuk', 'kurang sejuk'
  ];

  // 4. English keywords
  const englishKeywords = [
    'how', 'much', 'is', 'the', 'what', 'are', 'your', 'need', 'want', 'please', 
    'can', 'you', 'service', 'cleaning', 'repair', 'when', 'where', 'hello', 'good',
    'water', 'leak', 'leaking', 'install', 'installation', 'chemical', 'wash', 'price',
    'rates', 'booking', 'aircond', 'units', 'ac'
  ];

  const words = clean.split(/\s+/);
  let romanUrduMatches = 0;
  let malayMatches = 0;
  let englishMatches = 0;

  for (const word of words) {
    if (romanUrduKeywords.includes(word)) romanUrduMatches++;
    if (malayKeywords.includes(word)) malayMatches++;
    if (englishKeywords.includes(word)) englishMatches++;
  }

  if (romanUrduMatches >= 1 && romanUrduMatches >= malayMatches && romanUrduMatches >= englishMatches) {
    return { code: 'ur_roman', name: 'Roman Urdu', confidence: Math.min(0.6 + romanUrduMatches * 0.15, 0.98) };
  }

  if (malayMatches >= 1 && malayMatches > englishMatches) {
    return { code: 'ms', name: 'Malay', confidence: Math.min(0.6 + malayMatches * 0.15, 0.98) };
  }

  return { code: 'en', name: 'English', confidence: 0.85 };
};

export default { detectLanguage };
