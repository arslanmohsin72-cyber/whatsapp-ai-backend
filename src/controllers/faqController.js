import { FAQ } from '../models/FAQ.js';
import { sendSuccess, sendError } from '../utils/responseHelper.js';

export const getFAQs = async (req, res, next) => {
  try {
    const faqs = await FAQ.find({ businessId: req.businessId }).sort({ category: 1, createdAt: -1 });
    return sendSuccess(res, faqs);
  } catch (error) {
    next(error);
  }
};

export const createFAQ = async (req, res, next) => {
  try {
    const faq = await FAQ.create({
      ...req.body,
      businessId: req.businessId
    });
    return sendSuccess(res, faq, 'FAQ created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateFAQ = async (req, res, next) => {
  try {
    const { id } = req.params;
    const faq = await FAQ.findOneAndUpdate(
      { _id: id, businessId: req.businessId },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!faq) return sendError(res, 'FAQ not found', 404);
    return sendSuccess(res, faq, 'FAQ updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteFAQ = async (req, res, next) => {
  try {
    const { id } = req.params;
    const faq = await FAQ.findOneAndDelete({ _id: id, businessId: req.businessId });
    if (!faq) return sendError(res, 'FAQ not found', 404);
    return sendSuccess(res, null, 'FAQ deleted successfully');
  } catch (error) {
    next(error);
  }
};

export default { getFAQs, createFAQ, updateFAQ, deleteFAQ };
