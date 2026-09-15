import logger from '../utils/logger.js';

/**
 * Formats time difference between now and a previous date into human/AI-readable string
 */
export const formatTimeGap = (lastDate) => {
  if (!lastDate) return 'First time reaching out (New Customer)';
  const now = Date.now();
  const past = new Date(lastDate).getTime();
  const diffMs = Math.max(0, now - past);

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'Just now (within the last minute)';
  if (diffMin < 60) return `${diffMin} minute(s) ago (same ongoing conversation)`;
  if (diffHours < 24) return `${diffHours} hour(s) ago (same day returning customer)`;
  if (diffDays === 1) return 'Yesterday (1 day ago)';
  if (diffDays < 7) return `${diffDays} days ago (returning customer)`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week(s) ago (returning customer)`;
  return `${Math.floor(diffDays / 30)} month(s) ago (returning customer)`;
};

/**
 * Extracts key preferences and entities from customer messages
 */
export const extractCustomerInsights = (text, existingProfile = {}) => {
  const clean = (text || '').toLowerCase();
  const profile = { ...existingProfile };

  if (!profile.airconUnits) profile.airconUnits = [];
  if (!profile.mentionedLocations) profile.mentionedLocations = [];
  if (!profile.preferredServices) profile.preferredServices = [];

  // 1. Detect HP sizes
  const hpMatches = clean.match(/(\d+(?:\.\d+)?)\s*(?:hp|horse\s*power)/g);
  if (hpMatches) {
    for (const hpStr of hpMatches) {
      const match = hpStr.match(/(\d+(?:\.\d+)?)/);
      if (match) {
        const hpVal = `${match[1]}HP`;
        const exists = profile.airconUnits.some((u) => u.hp === hpVal);
        if (!exists) {
          profile.airconUnits.push({ hp: hpVal, count: 1 });
        }
      }
    }
  }

  // 2. Detect Locations
  const locations = [
    'johor bahru', 'jb', 'skudai', 'tampoi', 'kulai', 'pasir gudang', 'bukit indah', 'mount austin', 'tebrau',
    'melaka', 'malacca', 'ayer keroh', 'klebang', 'alor gajah', 'batu berendam',
    'negeri sembilan', 'seremban', 'senawang', 'nilai', 'port dickson'
  ];
  for (const loc of locations) {
    if (clean.includes(loc)) {
      const formattedLoc = loc.toUpperCase();
      if (!profile.mentionedLocations.includes(formattedLoc)) {
        profile.mentionedLocations.push(formattedLoc);
      }
    }
  }

  // 3. Detect Services
  if (clean.includes('chemical') || clean.includes('cuci') || clean.includes('wash') || clean.includes('service')) {
    if (!profile.preferredServices.includes('Chemical Service')) profile.preferredServices.push('Chemical Service');
  }
  if (clean.includes('install') || clean.includes('pasang')) {
    if (!profile.preferredServices.includes('Installation')) profile.preferredServices.push('Installation');
  }
  if (clean.includes('leak') || clean.includes('bocor') || clean.includes('air menitik')) {
    if (!profile.preferredServices.includes('Water Leaking Repair')) profile.preferredServices.push('Water Leaking Repair');
  }
  if (clean.includes('gas') || clean.includes('isi gas')) {
    if (!profile.preferredServices.includes('Gas Top-up')) profile.preferredServices.push('Gas Top-up');
  }

  return profile;
};

/**
 * Builds structured customer memory context for AI prompts
 */
export const buildCustomerMemoryContext = ({ customer, conversation, timeSinceLastContactStr, messageHistory = [] }) => {
  const parts = [];

  parts.push(`- Customer WhatsApp: +${customer?.whatsappNumber || 'Unknown'}`);
  parts.push(`- Customer Name: ${customer?.name || 'Customer'}`);
  parts.push(`- Total Previous Interactions: ${customer?.totalInteractions || 1}`);
  parts.push(`- Time Since Last Contact: ${timeSinceLastContactStr}`);

  // Memory profile items
  const profile = customer?.memoryProfile || {};
  if (profile.airconUnits && profile.airconUnits.length > 0) {
    const unitsStr = profile.airconUnits.map((u) => `${u.count || 1}x ${u.hp}`).join(', ');
    parts.push(`- Known / Discussed Aircon Units: ${unitsStr}`);
  }

  if (profile.mentionedLocations && profile.mentionedLocations.length > 0) {
    parts.push(`- Mentioned Locations: ${profile.mentionedLocations.join(', ')}`);
  }

  if (profile.preferredServices && profile.preferredServices.length > 0) {
    parts.push(`- Services of Interest: ${profile.preferredServices.join(', ')}`);
  }

  if (conversation?.bookingDraft && Object.keys(conversation.bookingDraft).length > 0) {
    const draft = conversation.bookingDraft;
    const draftDetails = [];
    if (draft.service) draftDetails.push(`Service: ${draft.service}`);
    if (draft.unitType) draftDetails.push(`HP: ${draft.unitType}`);
    if (draft.quantity) draftDetails.push(`Qty: ${draft.quantity}`);
    if (draft.date) draftDetails.push(`Date: ${draft.date}`);
    if (draft.time) draftDetails.push(`Time: ${draft.time}`);
    if (draft.address) draftDetails.push(`Address: ${draft.address}`);
    if (draftDetails.length > 0) {
      parts.push(`- Active / Pending Booking Draft: [${draftDetails.join(' | ')}]`);
    }
  }

  if (conversation?.activeTopic) {
    parts.push(`- Last Active Discussion Topic: ${conversation.activeTopic}`);
  }

  return parts.join('\n');
};

export default {
  formatTimeGap,
  extractCustomerInsights,
  buildCustomerMemoryContext
};
