import { RequestHandler } from 'express';

import {
  TCreateExpenseCategoryPayload,
  TCreateExpensePayload,
  TCreateExpenseTemplatePayload,
  TCreateIncomePayload,
} from './property-ledger.interface';
import {
  PropertyLedgerServices,
  TPropertyLedgerActor,
} from './property-ledger.service';

const actorFromRequest = (
  req: Parameters<RequestHandler>[0],
): TPropertyLedgerActor => {
  if (!req.user) throw new Error('You must be logged in.');
  return { id: req.user.id, role: req.user.role };
};

const sendError = (res: Parameters<RequestHandler>[1], error: unknown) => {
  console.error('Property ledger error:', error);
  const databaseError = error as { code?: number; name?: string };
  if (databaseError.code === 11000) {
    res
      .status(409)
      .json({ success: false, message: 'This ledger item already exists.' });
    return;
  }
  const message =
    error instanceof Error ? error.message : 'Property ledger request failed.';
  const normalized = message.toLowerCase();
  const status = normalized.includes('logged in')
    ? 401
    : normalized.includes('not authorized')
      ? 403
      : normalized.includes('not found')
        ? 404
        : normalized.includes('invalid') ||
            normalized.includes('required') ||
            normalized.includes('must') ||
            normalized.includes('cannot') ||
            normalized.includes('select') ||
            normalized.includes('accessible')
          ? 400
          : 500;
  res.status(status).json({ success: false, message });
};

const run = (
  // eslint-disable-next-line no-unused-vars -- parameter name describes the callback type
  handler: (req: Parameters<RequestHandler>[0]) => Promise<unknown>,
  successMessage: string,
  status = 200,
): RequestHandler => {
  return async (req, res) => {
    try {
      const data = await handler(req);
      if (data === null) {
        res
          .status(404)
          .json({ success: false, message: 'Ledger item was not found.' });
        return;
      }
      res.status(status).json({ success: true, message: successMessage, data });
    } catch (error) {
      sendError(res, error);
    }
  };
};

const getCategories = run(
  (req) =>
    PropertyLedgerServices.getCategories(
      actorFromRequest(req),
      typeof req.query.ownerId === 'string' ? req.query.ownerId : undefined,
      req.query.includeInactive === 'true',
    ),
  'Expense categories fetched successfully.',
);

const createCategory = run(
  (req) =>
    PropertyLedgerServices.createCategory(
      req.body as TCreateExpenseCategoryPayload & { ownerId?: string },
      actorFromRequest(req),
    ),
  'Expense category created successfully.',
  201,
);

const updateCategory = run(
  (req) =>
    PropertyLedgerServices.updateCategory(
      req.params.categoryId,
      req.body as { name?: string; isActive?: boolean },
      actorFromRequest(req),
    ),
  'Expense category updated successfully.',
);

const getTemplates = run(
  (req) =>
    PropertyLedgerServices.listTemplates(actorFromRequest(req), {
      ownerId:
        typeof req.query.ownerId === 'string' ? req.query.ownerId : undefined,
      propertyId:
        typeof req.query.propertyId === 'string'
          ? req.query.propertyId
          : undefined,
      includeInactive: req.query.includeInactive === 'true',
    }),
  'Expense templates fetched successfully.',
);

const createTemplate = run(
  (req) =>
    PropertyLedgerServices.createTemplate(
      req.body as TCreateExpenseTemplatePayload,
      actorFromRequest(req),
    ),
  'Expense template created successfully.',
  201,
);

const updateTemplate = run(
  (req) =>
    PropertyLedgerServices.updateTemplate(
      req.params.templateId,
      req.body as Partial<TCreateExpenseTemplatePayload>,
      actorFromRequest(req),
    ),
  'Expense template updated successfully.',
);

const deleteTemplate = run(
  (req) =>
    PropertyLedgerServices.deleteTemplate(
      req.params.templateId,
      actorFromRequest(req),
    ),
  'Expense template deleted successfully.',
);

const prepareMonth = run(
  (req) =>
    PropertyLedgerServices.prepareMonth(
      req.body as { ownerId?: string; propertyId: string; period: string },
      actorFromRequest(req),
    ),
  'Monthly ledger prepared successfully.',
);

const getOverview = run(
  (req) =>
    PropertyLedgerServices.getOverview(actorFromRequest(req), {
      ownerId:
        typeof req.query.ownerId === 'string' ? req.query.ownerId : undefined,
      propertyId: String(req.query.propertyId ?? ''),
      period: String(req.query.period ?? ''),
    }),
  'Monthly property ledger fetched successfully.',
);

const createExpense = run(
  (req) =>
    PropertyLedgerServices.createExpense(
      req.body as TCreateExpensePayload,
      actorFromRequest(req),
    ),
  'Expense created successfully.',
  201,
);
const updateExpense = run(
  (req) =>
    PropertyLedgerServices.updateExpense(
      req.params.expenseId,
      req.body as Partial<TCreateExpensePayload>,
      actorFromRequest(req),
    ),
  'Expense updated successfully.',
);
const deleteExpense = run(
  (req) =>
    PropertyLedgerServices.deleteExpense(
      req.params.expenseId,
      actorFromRequest(req),
    ),
  'Expense removed from this ledger successfully.',
);

const createIncome = run(
  (req) =>
    PropertyLedgerServices.createIncome(
      req.body as TCreateIncomePayload,
      actorFromRequest(req),
    ),
  'Other income created successfully.',
  201,
);
const updateIncome = run(
  (req) =>
    PropertyLedgerServices.updateIncome(
      req.params.incomeId,
      req.body as Partial<TCreateIncomePayload>,
      actorFromRequest(req),
    ),
  'Other income updated successfully.',
);
const deleteIncome = run(
  (req) =>
    PropertyLedgerServices.deleteIncome(
      req.params.incomeId,
      actorFromRequest(req),
    ),
  'Other income deleted successfully.',
);

const getReport = run(
  (req) =>
    PropertyLedgerServices.getReport(actorFromRequest(req), {
      ownerId:
        typeof req.query.ownerId === 'string' ? req.query.ownerId : undefined,
      propertyId:
        typeof req.query.propertyId === 'string'
          ? req.query.propertyId
          : undefined,
      startPeriod: String(req.query.startPeriod ?? ''),
      endPeriod: String(req.query.endPeriod ?? ''),
    }),
  'Property ledger report fetched successfully.',
);

export const PropertyLedgerController = {
  getCategories,
  createCategory,
  updateCategory,
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  prepareMonth,
  getOverview,
  createExpense,
  updateExpense,
  deleteExpense,
  createIncome,
  updateIncome,
  deleteIncome,
  getReport,
};
