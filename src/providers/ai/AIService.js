/**
 * Abstract AIService Interface / Base Class
 */
export class AIService {
  /**
   * Generate response from the AI provider
   * @param {Object} params
   * @param {string} params.prompt - Structured prompt including business context and guardrails
   * @param {string} params.customerMessage - The raw message from the customer
   * @param {Object} params.settings - AISettings configuration
   * @param {Array} [params.history] - Recent message history
   * @returns {Promise<{ text: string, intent: string, language: string, latencyMs: number, bookingDraft?: Object }>}
   */
  async generateResponse(params) {
    throw new Error('generateResponse() must be implemented by provider');
  }

  /**
   * Classify intent and extract booking slots
   * @param {string} message 
   * @param {Object} businessContext 
   */
  async analyzeIntentAndSlots(message, businessContext) {
    throw new Error('analyzeIntentAndSlots() must be implemented by provider');
  }
}

export default AIService;
