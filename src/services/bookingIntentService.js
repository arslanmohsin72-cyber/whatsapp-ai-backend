/**
 * Booking Extraction and State Machine Service
 * Extracts conversational booking parameters and identifies missing information.
 */
export const extractBookingSlots = (text = '', existingDraft = {}) => {
  const draft = {
    service: existingDraft.service || '',
    unitType: existingDraft.unitType || 'Standard',
    quantity: existingDraft.quantity || 1,
    date: existingDraft.date || '',
    time: existingDraft.time || '',
    address: existingDraft.address || '',
    city: existingDraft.city || '',
    area: existingDraft.area || '',
    notes: existingDraft.notes || '',
    ...existingDraft
  };

  const clean = text.toLowerCase();

  // 1. Date Extraction
  if (!draft.date) {
    if (clean.includes('tomorrow') || clean.includes('kal') || clean.includes('esok')) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      draft.date = tomorrow.toISOString().split('T')[0];
    } else if (clean.includes('today') || clean.includes('aaj') || clean.includes('hari ini')) {
      draft.date = new Date().toISOString().split('T')[0];
    } else {
      // Check explicit date like 2026-09-15 or 15/09 or 15 Sept
      const dateMatch = clean.match(/(\d{4}-\d{2}-\d{2})|(\d{1,2}[\/\-]\d{1,2})|(\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))/i);
      if (dateMatch) {
        draft.date = dateMatch[0];
      }
    }
  }

  // 2. Time Extraction
  if (!draft.time) {
    const timeMatch = clean.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))|(pukul\s*\d{1,2})|(\d{1,2}\s*baje)/i);
    if (timeMatch) {
      draft.time = timeMatch[0];
    } else if (clean.includes('morning') || clean.includes('subah') || clean.includes('pagi')) {
      draft.time = 'Morning (09:00 - 12:00)';
    } else if (clean.includes('afternoon') || clean.includes('dopahar') || clean.includes('petang')) {
      draft.time = 'Afternoon (14:00 - 17:00)';
    } else if (clean.includes('evening') || clean.includes('shaam') || clean.includes('malam')) {
      draft.time = 'Evening (17:00 - 20:00)';
    }
  }

  // 3. Unit Quantity Extraction
  const qtyMatch = clean.match(/(\d+)\s*(?:units?|ac|aircond|rooms?|nos?|piece)/i);
  if (qtyMatch) {
    draft.quantity = parseInt(qtyMatch[1], 10) || 1;
  }

  // 4. Address Detection
  // If text contains address keywords or street indicators and is sufficiently long
  const addressKeywords = ['jalan', 'lorong', 'taman', 'street', 'road', 'block', 'apt', 'apartment', 'house', 'no.', 'flat', 'seksyen', 'phase', 'hno', 'gali', 'mohalla'];
  if (!draft.address && addressKeywords.some((kw) => clean.includes(kw)) && text.length > 8) {
    draft.address = text.trim();
  }

  // Calculate missing required fields
  const missingFields = [];
  if (!draft.service) missingFields.push('service');
  if (!draft.date) missingFields.push('date');
  if (!draft.time) missingFields.push('time');
  if (!draft.address) missingFields.push('address');

  draft.missingFields = missingFields;
  draft.isComplete = missingFields.length === 0;

  return draft;
};

/**
 * Format completed booking confirmation according to Smart Aircond exact template
 */
export const formatBookingConfirmation = (draft = {}, customerPhone = '') => {
  const serviceName = draft.service || 'Chemical Wall-Mounted Service';
  const hpSize = draft.hp || draft.unitType || '1.0HP';
  const location = draft.address || draft.area || 'As provided';
  const date = draft.date || 'To be confirmed';
  const time = draft.time || 'To be confirmed';
  const name = draft.customerName || 'Customer';
  const phone = customerPhone ? (customerPhone.startsWith('+') ? customerPhone : `+${customerPhone}`) : (draft.phone || '-');
  const details = draft.notes || `${draft.quantity || 1} Unit(s)`;
  const price = draft.price || (serviceName.toLowerCase().includes('leak') ? '30' : (serviceName.toLowerCase().includes('install') ? '200' : '90'));

  return `**Smart Aircond – Booking Request** 📋

🔧 Service: ${serviceName}
❄️ HP: ${hpSize}
📍 Location: ${location}
📅 Date: ${date}
⏰ Preferred Time: ${time}
👤 Name: ${name}
📱 Phone/WhatsApp: ${phone}
📝 Problem/Details: ${details}

💰 Price: RM${price}

Thank you! 😊 Your booking request has been received. Our team will confirm the appointment shortly.`;
};

/**
 * Generate conversational prompt requesting ONLY the next missing field in the customer's language
 */
export const getNextMissingFieldPrompt = (missingFields = [], language = 'en') => {
  if (missingFields.length === 0) return null;

  const nextField = missingFields[0];

  const prompts = {
    en: {
      service: 'Which service would you like to book?',
      date: 'What date would you prefer for the appointment?',
      time: 'What time would be convenient for you (e.g. 10:00 AM, 3:00 PM)?',
      address: 'Please provide your full address or location so our technician can reach you.'
    },
    ur_roman: {
      service: 'Aap konsi service book karwana chahte hain?',
      date: 'Aap kis din (date) service chahte hain?',
      time: 'Aapke liye konsa time munasib rahega (e.g. 11am, 3pm)?',
      address: 'Meharbani karke apna mukammal address send kar dein taake technician pohnch sake.'
    },
    ms: {
      service: 'Servis apa yang anda ingin tempah?',
      date: 'Tarikh berapa yang anda cadangkan untuk temujanji?',
      time: 'Pukul berapa yang sesuai untuk anda (cth: 10:00 pagi atau 3:00 petang)?',
      address: 'Sila berikan alamat penuh anda untuk kami hantar juruteknik.'
    },
    ur: {
      service: 'آپ کون سی سروس بک کروانا چاہتے ہیں؟',
      date: 'آپ کس تاریخ کو سروس کروانا چاہتے ہیں؟',
      time: 'آپ کے لیے کون سا وقت مناسب رہے گا؟',
      address: 'براہ کرم اپنا مکمل پتہ بھیج دیں تاکہ ٹیکنیشن پہنچ سکے۔'
    }
  };

  const langPrompts = prompts[language] || prompts.en;
  return langPrompts[nextField] || prompts.en[nextField];
};

export default { extractBookingSlots, formatBookingConfirmation, getNextMissingFieldPrompt };
