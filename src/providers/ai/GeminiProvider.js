import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIService } from './AIService.js';
import { detectLanguage } from '../../services/languageDetector.js';
import { classifyIntent } from '../../services/intentClassifier.js';
import { extractBookingSlots, getNextMissingFieldPrompt } from '../../services/bookingIntentService.js';
import { buildSystemPrompt } from '../../services/businessContextService.js';
import logger from '../../utils/logger.js';

export class GeminiProvider extends AIService {
  constructor(apiKey = null) {
    super();
    this.apiKey = apiKey || process.env.GEMINI_API_KEY;
  }

  /**
   * Generates grounded AI response adhering strictly to guardrails and memory context
   */
  async generateResponse({
    businessContext,
    customerMessage,
    conversationDraft = {},
    messageHistory = [],
    customerMemoryContext = '',
    customerProfile = {},
    timeSinceLastContactStr = '',
    customApiKey = null
  }) {
    const startTime = Date.now();
    const apiKey = customApiKey || this.apiKey || process.env.GEMINI_API_KEY;

    // 1. Detect language and intent
    const langResult = detectLanguage(customerMessage);
    const intentResult = classifyIntent(customerMessage, businessContext);

    // 2. Strict Out-of-Scope rejection guardrail
    if (intentResult.intent === 'out_of_scope') {
      const rejectionText = langResult.code === 'ur_roman' 
        ? 'Sorry 😊 Main sirf Smart Aircond ki services, prices aur bookings ke baray mein madad kar sakta hoon. Aapko kya service chahiye?'
        : langResult.code === 'ms'
        ? 'Maaf 😊 Saya hanya boleh bantu dengan servis aircond, harga dan tempahan Smart Aircond. Ada apa-apa servis aircond yang anda perlukan?'
        : 'Sorry 😊 I can only help with Smart Aircond services, pricing and bookings. How can I help you with your aircond today?';

      return {
        text: rejectionText,
        intent: 'out_of_scope',
        language: langResult.name,
        confidence: intentResult.confidence,
        latencyMs: Date.now() - startTime,
        isRejection: true
      };
    }

    // 3. Human Handover / Contact Inquiry (#13)
    if (intentResult.intent === 'contact_support' || intentResult.intent === 'human_handover') {
      const contactText = `📞 **Smart Aircond**
WhatsApp: **+601137359420**
Our team will assist you with your aircon service or booking.`;

      return {
        text: contactText,
        intent: 'contact_support',
        language: langResult.name,
        confidence: intentResult.confidence,
        latencyMs: Date.now() - startTime,
        triggerHandover: true
      };
    }

    // 4. Booking Flow - Missing Slot Collection if in conversational booking mode
    let updatedBookingDraft = extractBookingSlots(customerMessage, conversationDraft);
    if (intentResult.intent === 'booking_flow' || (updatedBookingDraft && updatedBookingDraft.isComplete)) {
      if (updatedBookingDraft.missingFields && updatedBookingDraft.missingFields.length > 0) {
        const promptText = getNextMissingFieldPrompt(updatedBookingDraft.missingFields, langResult.code);
        return {
          text: promptText,
          intent: 'booking_flow',
          language: langResult.name,
          confidence: intentResult.confidence,
          latencyMs: Date.now() - startTime,
          bookingDraft: updatedBookingDraft
        };
      }
    }

    // 5. Build dynamic system prompt with memory context
    const systemInstruction = buildSystemPrompt(businessContext, {}, langResult.name, customerMemoryContext);

    // 5.1 Format recent conversation history with timestamps if available
    let historyContext = '';
    if (Array.isArray(messageHistory) && messageHistory.length > 0) {
      historyContext = messageHistory
        .slice(-14)
        .map((m) => `${m.role === 'user' ? 'Customer' : 'Assistant'}: "${m.text}"`)
        .join('\n');
    }

    // 6. Invoke Gemini API with Multi-Model Fallback Chain
    if (apiKey && apiKey.startsWith('AIzaSy') && apiKey !== 'your_gemini_api_key_here') {
      const candidateModels = [
        'gemini-1.5-flash',
        'gemini-2.0-flash',
        'gemini-2.5-flash',
        'gemini-1.5-pro'
      ];

      for (const modelCandidate of candidateModels) {
        try {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({
            model: modelCandidate,
            systemInstruction: {
              parts: [{ text: systemInstruction }]
            },
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 350
            }
          });

          const prompt = `${customerMemoryContext ? `[Customer Long-Term Memory Profile & Timeline]\n${customerMemoryContext}\n\n` : ''}${historyContext ? `[Recent Conversation History]\n${historyContext}\n\n` : ''}Customer's Current Message: "${customerMessage}"\nCustomer Language: ${langResult.name}`;
          
          const generatePromise = model.generateContent(prompt);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('AI generation timeout (5500ms)')), 5500)
          );

          const result = await Promise.race([generatePromise, timeoutPromise]);
          const responseText = result.response.text().trim();

          if (responseText) {
            return {
              text: responseText,
              intent: intentResult.intent,
              language: langResult.name,
              confidence: intentResult.confidence,
              latencyMs: Date.now() - startTime,
              bookingDraft: updatedBookingDraft
            };
          }
        } catch (geminiError) {
          const errMsg = geminiError.message || '';
          logger.warn(`Gemini model ${modelCandidate} failed (${errMsg.slice(0, 80)}...).`);
          if (errMsg.includes('API key not valid') || errMsg.includes('API_KEY_INVALID') || errMsg.includes('400')) {
            break; // Don't loop all models for an invalid key
          }
        }
      }
    }

    // 7. Deterministic Grounded Receptionist Engine (Implements 100% of the 14 Official Smart Aircond Rules + Context Memory)
    const fallbackText = this._generateGroundedFallback(
      businessContext,
      customerMessage,
      intentResult.intent,
      langResult.code,
      messageHistory,
      conversationDraft,
      customerProfile
    );

    return {
      text: fallbackText,
      intent: intentResult.intent,
      language: langResult.name,
      confidence: intentResult.confidence,
      latencyMs: Date.now() - startTime,
      bookingDraft: updatedBookingDraft
    };
  }

  /**
   * Deterministic Grounded Receptionist Engine
   * Implements exact 14 Smart Aircond rules with memory-awareness
   */
  _generateGroundedFallback(context, message, intent, langCode, messageHistory = [], conversationDraft = {}, customerProfile = {}) {
    const clean = message.toLowerCase().trim();

    // 1. Service Area (#1)
    if (intent === 'area_inquiry' || clean.includes('cover') || clean.includes('area') || clean.includes('location') || clean.includes('kawasan') || clean.includes('johor') || clean.includes('melaka') || clean.includes('malacca') || clean.includes('negeri sembilan') || clean.includes('seremban') || clean.includes('jb') || clean.includes('kl') || clean.includes('selangor')) {
      return `📍 **Smart Aircond Service Area**
We provide service in **Johor Bahru, Negeri Sembilan & Melaka**.
Please send your **location/area name** and we’ll check the service coverage. 😊`;
    }

    // 2. Affirmation / Customer says "Yes" / "Ok" / "Proceed"
    if (intent === 'affirmation') {
      const activeService = conversationDraft?.service || customerProfile?.preferredServices?.[0] || 'Aircond Service';
      const hasUnit = conversationDraft?.unitType || (customerProfile?.airconUnits?.[0]?.hp ? `${customerProfile.airconUnits[0].hp}` : null);

      if (hasUnit) {
        return langCode === 'ms'
          ? `Bagus 👍 Jom kita arrange untuk **${activeService} (${hasUnit})**.\n\nBoleh kongsikan tarikh, masa dan lokasi anda?`
          : langCode === 'ur_roman'
          ? `Perfect 👍 Chalein **${activeService} (${hasUnit})** ke liye arrange kar lete hain.\n\nAap konsi date, time aur location prefer karein ge?`
          : `Perfect 👍 Let's arrange your **${activeService} (${hasUnit})**.\n\nWhat date, time, and location would you prefer?`;
      }

      return langCode === 'ms'
        ? "Bagus 👍 Jom kita arrange.\n\nBoleh kongsikan tarikh dan masa yang anda prefer?"
        : langCode === 'ur_roman'
        ? "Perfect 👍 Chalein arrange kar lete hain.\n\nAap konsi date aur time prefer karein ge?"
        : "Perfect 👍 Let's arrange it.\n\nWhat date and time would you prefer?";
    }

    // 3. Negation / Customer says "No" / "Cancel"
    if (intent === 'negation') {
      return langCode === 'ms'
        ? "Tiada masalah boss 👍 Boleh hubungi kami bila-bila masa anda perlukan servis aircond. Semoga hari anda menyenangkan! 😊"
        : langCode === 'ur_roman'
        ? "Koi masla nahi boss 👍 Jab bhi aircond service chahiye ho rabta karein. Have a great day! 😊"
        : "No problem boss 👍 Feel free to reach out anytime you need aircond service. Have a great day! 😊";
    }

    // 4. Uncertainty / "I don't know" / "Tak pasti" / "Not sure"
    if (intent === 'uncertainty') {
      return langCode === 'ms'
        ? "Tiada masalah 👍 Boleh beritahu apa masalah aircond anda (cth: leaking, tak sejuk, atau nak pasang baru) supaya saya boleh cadangkan servis yang paling sesuai."
        : langCode === 'ur_roman'
        ? "Koi masla nahi 👍 Aap bata dein aircond mein kya issue aa raha hai (pani tapak raha hai, thanda nahi kar raha, ya naya lagwana hai) taake main sahi service recommend kar sakoon."
        : "No problem 👍 Tell me what problem you're experiencing with your aircond (e.g. water leaking, not cold, or need installation) and I can suggest the best service for you.";
    }

    // 5. Gas Inquiry (#7 - "Do you provide gas?")
    if (intent === 'gas_inquiry' || clean.includes('gas') || clean.includes('psi') || clean.includes('isi gas')) {
      return `❄️ Yes. **FREE 20 PSI gas** is included with our service.
For installation, **5ft copper pipe + 5ft wire are FREE**.`;
    }

    // 6. Photo Inquiry (#10 - "Can I send a photo?")
    if (intent === 'photo_inquiry' || clean.includes('photo') || clean.includes('picture') || clean.includes('pic') || clean.includes('image') || clean.includes('gambar')) {
      return `Yes 👍 Please send a **photo of your aircon** and, if possible, the area around the unit.
Our team can check the requirements from there.`;
    }

    // 7. Schedule Availability / "When can you come?" (#9)
    if (intent === 'schedule_inquiry' || clean.includes('when can you come') || clean.includes('when you come') || clean.includes('bila boleh datang') || clean.includes('kab aa sakte')) {
      return `📅 Please send your **location, preferred date and preferred time**.
Our team will check the schedule and confirm the available appointment.`;
    }

    // 8. "My aircon is not cold" (#11)
    if (intent === 'not_cold_inquiry' || clean.includes('not cold') || clean.includes('tak sejuk') || clean.includes('kurang sejuk') || clean.includes('thanda nahi')) {
      return `❄️ No problem. Please send your **aircon HP, location and a short description of the problem**.
You can also send a photo/video if available.`;
    }

    // 9. Warranty (#12)
    if (intent === 'warranty_inquiry' || clean.includes('warranty') || clean.includes('waranti') || clean.includes('guarantee') || clean.includes('jaminan')) {
      return `🛡️ **Smart Aircond provides a 30-day workmanship warranty.**
Our team will assist if there is a workmanship-related issue within the warranty period.`;
    }

    // 10. Contact / Human Support (#13)
    if (intent === 'contact_support' || clean.includes('contact') || clean.includes('whatsapp') || clean.includes('phone') || clean.includes('human') || clean.includes('agent')) {
      return `📞 **Smart Aircond**
WhatsApp: **+601137359420**
Our team will assist you with your aircon service or booking.`;
    }

    // 11. Water Leaking Service (#6)
    if (intent === 'water_leaking_inquiry' || clean.includes('water leak') || clean.includes('water leaking') || clean.includes('leaking') || clean.includes('bocor') || clean.includes('tapak air')) {
      return `💧 **Water Leaking Service – RM30 Fixed**
Applicable for **all HP sizes**.
🚗 No transportation charges.`;
    }

    // 12. Cassette Aircon Installation (#8 - "How much for cassette installation?")
    if (intent === 'cassette_inquiry' || clean.includes('cassette') || clean.includes('casettee') || clean.includes('casette') || clean.includes('kaset')) {
      return `❄️ **Cassette Aircon Installation**
💰 Starting from **RM269**.
Please send the aircon HP/model and location so we can confirm the requirements and price.`;
    }

    // 13. HP Size, Unit Quantity, Option Number Selections & Combinations
    // 13.1 Multi-unit or Multi-HP Combination (e.g. "1 and 2", "1 & 2", "1, 2", "1.0 and 2.0", "1hp and 2hp")
    if (/^\s*1\s*(?:and|&|\+|\,)\s*2\s*$/i.test(clean) || /1\s*hp\s*(?:and|&|\+|\,)\s*2\s*hp/i.test(clean) || /1\.0\s*(?:and|&|\+|\,)\s*2\.0/i.test(clean) || clean.includes('1hp and 2hp') || clean.includes('1 and 2 units') || clean.includes('1 unit and 2 units')) {
      return `For **1.0HP & 2.0HP Chemical Service**:
• 1x 1.0HP — **RM90**
• 1x 2.0HP — **RM135**
💰 **Total: RM225**
🎁 FREE 20 PSI gas top-up for both units!

What date and location would you like to arrange the service? 😊`;
    }

    // 13.2 Specific Multi-unit / HP with unit count & typo tolerance (e.g. "1 HP and 2 unuts", "1hp 2 units", "2 units 1.5hp")
    if ((clean.includes('1.0') || clean.includes('1hp') || clean.includes('1 hp') || /^1\s*(?:hp|horse\s*power)?\s*(?:and|&|\+|\,)?\s*2/i.test(clean)) &&
        (clean.includes('2 unit') || clean.includes('2unit') || clean.includes('2 unuts') || clean.includes('2unuts') || clean.includes('2 unite') || clean.includes('2 biji') || clean.includes('2 buah') || clean.includes('2 ac') || clean.includes('2 nos') || /1\s*hp\s*(?:and|&|\+)\s*2/i.test(clean))) {
      return `For **2 units of 1.0HP Chemical Service**:
• 2x 1.0HP (RM90 each) — **RM180**
🎁 FREE 20 PSI gas top-up for each unit!

What date and location would you like to book? 😊`;
    }

    if ((clean.includes('1.5') || clean.includes('1.5hp') || clean.includes('1.5 hp')) &&
        (clean.includes('2 unit') || clean.includes('2unit') || clean.includes('2 unuts') || clean.includes('2unuts') || clean.includes('2 biji') || clean.includes('2 buah') || clean.includes('2 ac') || clean.includes('2 nos'))) {
      return `For **2 units of 1.5HP Chemical Service**:
• 2x 1.5HP (RM110 each) — **RM220**
🎁 FREE 20 PSI gas top-up for each unit!

What date and location would you like to book? 😊`;
    }

    if ((clean.includes('2.0') || clean.includes('2hp') || clean.includes('2 hp')) &&
        (clean.includes('2 unit') || clean.includes('2unit') || clean.includes('2 unuts') || clean.includes('2unuts') || clean.includes('2 biji') || clean.includes('2 buah') || clean.includes('2 ac') || clean.includes('2 nos'))) {
      return `For **2 units of 2.0HP Chemical Service**:
• 2x 2.0HP (RM135 each) — **RM270**
🎁 FREE 20 PSI gas top-up for each unit!

What date and location would you like to book? 😊`;
    }

    // 13.3 Standalone Quantity (e.g. "2 units", "1 unit", "3 units")
    const standaloneQty = clean.match(/^(\d+)\s*(?:units?|unuts?|unite|untis?|unt|biji|buah|nos?|ac|aircond)?$/i);
    if (standaloneQty && !clean.includes('hp') && parseInt(standaloneQty[1], 10) > 5) {
      const qty = standaloneQty[1];
      return `Got it, ${qty} unit(s) 👍 Which HP size (e.g. 1.0HP, 1.5HP, 2.0HP) and service (Chemical service, Leaking repair, or Installation) do you need?`;
    }

    // 14. Wall-Mounted Installation Price (#3)
    if (intent === 'installation_price_inquiry' || clean.includes('installation') || clean.includes('install') || clean.includes('pasang') || clean === '2' || clean === '2️⃣' || clean === 'option 2') {
      return `🔧 **Smart Aircond – Wall-Mounted Installation**
1️⃣ 1.0HP — RM200
2️⃣ 1.5HP — RM220
3️⃣ 2.0HP — RM260
4️⃣ 2.5HP — RM299
5️⃣ 3.0HP — RM350

🎁 **FREE 5ft copper pipe + 5ft wire**
🛡️ 30-day workmanship warranty.`;
    }

    // 15. Booking Request (#5)
    if (intent === 'booking_inquiry' || clean === 'booking' || clean === 'booking form' || clean === 'can i make booking' || clean === 'nak booking' || clean === 'nak book' || clean === 'tempahan' || clean === '5' || clean === '5️⃣' || clean === 'option 5') {
      return `📋 **Smart Aircond – Booking Request**
🔧 Service:
❄️ Aircon HP:
📍 Location:
📅 Preferred Date:
⏰ Preferred Time:
👤 Name:
📱 Phone/WhatsApp:
📝 Problem/Details:`;
    }

    // 16. What services do you provide? (#4)
    if (intent === 'services_list_inquiry' || clean.includes('what service') || clean.includes('which service') || clean.includes('services you provide') || clean.includes('service you provide') || clean.includes('servis apa') || clean.includes('kya services') || clean === 'services' || clean === 'servis' || clean === 'service') {
      return `❄️ **Smart Aircond Services**
1️⃣ Chemical Wall-Mounted Service
2️⃣ Wall-Mounted Installation
3️⃣ Cassette Installation
4️⃣ Water Leaking Service

📍 Johor Bahru • Negeri Sembilan • Melaka`;
    }

    // 17. Chemical Wall-Mounted Service Price (#2 - "How much is aircon service?")
    if (intent === 'service_price_inquiry' || clean.includes('chemical') || clean.includes('cuci') || clean.includes('wash') || clean.includes('aircon service') || clean.includes('how much is aircon service') || clean === '1' || clean === '1️⃣' || clean === 'option 1') {
      return `❄️ **Smart Aircond – Chemical Wall-Mounted Service**
1️⃣ 1.0HP — RM90
2️⃣ 1.5HP — RM110
3️⃣ 2.0HP — RM135
4️⃣ 2.5HP — RM140
5️⃣ 3.0HP — RM170

🎁 **FREE 20 PSI gas**
No transportation charges.`;
    }

    // 18. Full Pricing Catalog / Price Inquiry (#2 / Generic Price)
    if (intent === 'catalog_inquiry' || clean.includes('price') || clean.includes('harga') || clean.includes('rate') || clean.includes('berapa') || clean === '4' || clean === '4️⃣' || clean === 'option 4' || clean === 'price inquiry') {
      return `❄️ **Smart Aircond – Chemical Wall-Mounted Service**
1️⃣ 1.0HP — RM90
2️⃣ 1.5HP — RM110
3️⃣ 2.0HP — RM135
4️⃣ 2.5HP — RM140
5️⃣ 3.0HP — RM170

🎁 **FREE 20 PSI gas**
No transportation charges.`;
    }

    // 19. Pure Greeting (#14 - Customer says "Hi/Hello")
    if (intent === 'greeting') {
      return `Hi 👋 Welcome to **Smart Aircond!** ❄️
How can we help you today?
1️⃣ Aircon Service
2️⃣ Installation
3️⃣ Water Leaking
4️⃣ Price Inquiry
5️⃣ Booking`;
    }

    // 20. Default Fallback
    return `Hi 👋 Welcome to **Smart Aircond!** ❄️
How can we help you today?
1️⃣ Aircon Service
2️⃣ Installation
3️⃣ Water Leaking
4️⃣ Price Inquiry
5️⃣ Booking`;
  }
}

export default GeminiProvider;


