import { Router } from 'express';

import authMiddleware from '../../middleware/authMiddleware';
import authorizeRoles from '../../middleware/authorizeRoles';
import { PropertyLedgerController } from './property-ledger.controller';

const propertyLedgerRouter = Router();

propertyLedgerRouter.use(authMiddleware, authorizeRoles('superAdmin', 'owner'));

propertyLedgerRouter.get('/categories', PropertyLedgerController.getCategories);
propertyLedgerRouter.post(
  '/categories',
  PropertyLedgerController.createCategory,
);
propertyLedgerRouter.patch(
  '/categories/:categoryId',
  PropertyLedgerController.updateCategory,
);

propertyLedgerRouter.get('/templates', PropertyLedgerController.getTemplates);
propertyLedgerRouter.post(
  '/templates',
  PropertyLedgerController.createTemplate,
);
propertyLedgerRouter.patch(
  '/templates/:templateId',
  PropertyLedgerController.updateTemplate,
);
propertyLedgerRouter.delete(
  '/templates/:templateId',
  PropertyLedgerController.deleteTemplate,
);

propertyLedgerRouter.post(
  '/prepare-month',
  PropertyLedgerController.prepareMonth,
);
propertyLedgerRouter.get('/overview', PropertyLedgerController.getOverview);

propertyLedgerRouter.post('/expenses', PropertyLedgerController.createExpense);
propertyLedgerRouter.patch(
  '/expenses/:expenseId',
  PropertyLedgerController.updateExpense,
);
propertyLedgerRouter.delete(
  '/expenses/:expenseId',
  PropertyLedgerController.deleteExpense,
);

propertyLedgerRouter.post('/incomes', PropertyLedgerController.createIncome);
propertyLedgerRouter.patch(
  '/incomes/:incomeId',
  PropertyLedgerController.updateIncome,
);
propertyLedgerRouter.delete(
  '/incomes/:incomeId',
  PropertyLedgerController.deleteIncome,
);

propertyLedgerRouter.get('/report', PropertyLedgerController.getReport);

export default propertyLedgerRouter;
