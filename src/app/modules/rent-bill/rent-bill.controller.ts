import { Request, RequestHandler, Response } from 'express';

import type { TPropertyActor } from '../property/property.service';
import {
  RENT_BILL_STATUSES,
  TCreateRentBillPayload,
  TRentBillListQuery,
  TRentBillStatus,
  TUpdateRentBillPayload,
  TUpdateRentBillStatusPayload,
} from './rent-bill.interface';
import { RentBillServices } from './rent-bill.service';

const getActor = (req: Request, res: Response): TPropertyActor | null => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'You must be logged in.',
    });
    return null;
  }

  return { id: req.user.id, role: req.user.role };
};

const sendRentBillError = (
  res: Response,
  error: unknown,
  fallbackMessage: string,
) => {
  console.error(error);

  const databaseError = error as { code?: number; name?: string };

  if (databaseError.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'A rent bill already exists for this tenancy and month.',
    });
  }

  if (
    databaseError.name === 'ValidationError' ||
    databaseError.name === 'CastError'
  ) {
    return res.status(400).json({
      success: false,
      message: 'Rent bill information is invalid.',
    });
  }

  if (error instanceof Error) {
    const message = error.message;
    const normalized = message.toLowerCase();

    if (
      normalized.includes('not authorized') ||
      normalized.includes('access was denied')
    ) {
      return res.status(403).json({ success: false, message });
    }

    if (
      normalized.includes('not found') ||
      normalized.includes('missing or archived')
    ) {
      return res.status(404).json({ success: false, message });
    }

    if (
      normalized.includes('already') ||
      normalized.includes('only a due') ||
      normalized.includes('cannot be changed') ||
      normalized.includes('has changed')
    ) {
      return res.status(409).json({ success: false, message });
    }

    if (
      normalized.includes('invalid') ||
      normalized.includes('required') ||
      normalized.includes('must') ||
      normalized.includes('cannot') ||
      normalized.includes('does not cover') ||
      normalized.includes('not configured') ||
      normalized.includes('too long')
    ) {
      return res.status(400).json({ success: false, message });
    }
  }

  return res.status(500).json({ success: false, message: fallbackMessage });
};

const parsePositiveInteger = (
  value: unknown,
  fieldName: string,
): number | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error(`${fieldName} is invalid.`);
  }

  const parsed = Number(value);
  if (parsed < 1) throw new Error(`${fieldName} is invalid.`);
  return parsed;
};

const getGenerationContext: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const tenantAssignmentId =
      typeof req.query.tenantAssignmentId === 'string'
        ? req.query.tenantAssignmentId
        : '';
    const billingPeriod =
      typeof req.query.billingPeriod === 'string'
        ? req.query.billingPeriod
        : '';

    const result = await RentBillServices.getGenerationContextFromDB(
      tenantAssignmentId,
      billingPeriod,
      actor,
    );

    res.status(200).json({
      success: true,
      message: 'Rent bill generation context fetched successfully.',
      data: result,
    });
  } catch (error) {
    sendRentBillError(res, error, 'Failed to prepare the rent bill.');
  }
};

const createRentBill: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const payload = (req.body?.bill ?? req.body) as TCreateRentBillPayload;
    const result = await RentBillServices.createRentBillIntoDB(payload, actor);

    res.status(201).json({
      success: true,
      message: 'Monthly rent bill generated successfully.',
      data: result,
    });
  } catch (error) {
    sendRentBillError(res, error, 'Failed to generate the rent bill.');
  }
};

const getAllRentBills: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const rawStatus =
      typeof req.query.status === 'string' ? req.query.status : undefined;

    if (
      rawStatus &&
      !RENT_BILL_STATUSES.includes(rawStatus as TRentBillStatus)
    ) {
      throw new Error('Rent bill status is invalid.');
    }

    const query: TRentBillListQuery = {
      year: parsePositiveInteger(req.query.year, 'Billing year'),
      month: parsePositiveInteger(req.query.month, 'Billing month'),
      ownerId:
        typeof req.query.ownerId === 'string' ? req.query.ownerId : undefined,
      propertyId:
        typeof req.query.propertyId === 'string'
          ? req.query.propertyId
          : undefined,
      apartmentId:
        typeof req.query.apartmentId === 'string'
          ? req.query.apartmentId
          : undefined,
      tenantId:
        typeof req.query.tenantId === 'string' ? req.query.tenantId : undefined,
      status: rawStatus as TRentBillStatus | undefined,
      page: parsePositiveInteger(req.query.page, 'Page'),
      limit: parsePositiveInteger(req.query.limit, 'Limit'),
    };

    const result = await RentBillServices.getAllRentBillsFromDB(actor, query);

    res.status(200).json({
      success: true,
      message: 'Rent bills fetched successfully.',
      data: result,
    });
  } catch (error) {
    sendRentBillError(res, error, 'Failed to fetch rent bills.');
  }
};

const getSingleRentBill: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const { billId } = req.params;
    if (!billId) throw new Error('Rent bill ID is required.');

    const result = await RentBillServices.getSingleRentBillFromDB(
      billId,
      actor,
    );

    if (!result) {
      res.status(404).json({ success: false, message: 'Rent bill not found.' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Rent bill fetched successfully.',
      data: result,
    });
  } catch (error) {
    sendRentBillError(res, error, 'Failed to fetch the rent bill.');
  }
};

const updateRentBill: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const { billId } = req.params;
    if (!billId) throw new Error('Rent bill ID is required.');

    const payload = (req.body?.bill ?? req.body) as TUpdateRentBillPayload;
    const result = await RentBillServices.updateRentBillInDB(
      billId,
      payload,
      actor,
    );

    if (!result) {
      res.status(404).json({ success: false, message: 'Rent bill not found.' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Rent bill updated successfully.',
      data: result,
    });
  } catch (error) {
    sendRentBillError(res, error, 'Failed to update the rent bill.');
  }
};

const updateRentBillStatus: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const { billId } = req.params;
    if (!billId) throw new Error('Rent bill ID is required.');

    const payload = (req.body?.statusUpdate ??
      req.body) as TUpdateRentBillStatusPayload;
    const result = await RentBillServices.updateRentBillStatusInDB(
      billId,
      payload,
      actor,
    );

    if (!result) {
      res.status(404).json({ success: false, message: 'Rent bill not found.' });
      return;
    }

    res.status(200).json({
      success: true,
      message: `Rent bill marked as ${result.status}.`,
      data: result,
    });
  } catch (error) {
    sendRentBillError(res, error, 'Failed to update rent bill status.');
  }
};

const deleteRentBill: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;
    const result = await RentBillServices.deleteRentBillFromDB(
      req.params.billId,
      actor,
    );
    if (!result) {
      res.status(404).json({ success: false, message: 'Rent bill not found.' });
      return;
    }
    res
      .status(200)
      .json({
        success: true,
        message: 'Receipt permanently deleted.',
        data: result,
      });
  } catch (error) {
    sendRentBillError(res, error, 'Failed to delete the receipt.');
  }
};

export const RentBillController = {
  deleteRentBill,
  getGenerationContext,
  createRentBill,
  getAllRentBills,
  getSingleRentBill,
  updateRentBill,
  updateRentBillStatus,
};
