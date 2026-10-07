import { Request, RequestHandler, Response } from 'express';

import type { TPropertyActor } from '../property/property.service';
import {
  TCreateChargeCategoryPayload,
  TUpdateChargeCategoryPayload,
} from './charge-category.interface';
import { ChargeCategoryServices } from './charge-category.service';

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

const sendChargeCategoryError = (
  res: Response,
  error: unknown,
  fallbackMessage: string,
) => {
  console.error(error);

  const databaseError = error as { code?: number; name?: string };

  if (databaseError.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'This property already has a charge category with the same code.',
    });
  }

  if (
    databaseError.name === 'ValidationError' ||
    databaseError.name === 'CastError'
  ) {
    return res.status(400).json({
      success: false,
      message: 'Charge category information is invalid.',
    });
  }

  if (error instanceof Error) {
    const message = error.message;
    const normalizedMessage = message.toLowerCase();

    if (normalizedMessage.includes('not authorized')) {
      return res.status(403).json({ success: false, message });
    }

    if (normalizedMessage.includes('not found')) {
      return res.status(404).json({ success: false, message });
    }

    if (
      normalizedMessage.includes('invalid') ||
      normalizedMessage.includes('required') ||
      normalizedMessage.includes('cannot') ||
      normalizedMessage.includes('no valid')
    ) {
      return res.status(400).json({ success: false, message });
    }
  }

  return res.status(500).json({ success: false, message: fallbackMessage });
};

const getChargeCategories: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const propertyId =
      typeof req.query.propertyId === 'string'
        ? req.query.propertyId
        : undefined;
    const includeInactive = req.query.includeInactive === 'true';
    const result = await ChargeCategoryServices.getChargeCategoriesFromDB(
      actor,
      propertyId,
      includeInactive,
    );

    res.status(200).json({
      success: true,
      message: 'Charge categories fetched successfully.',
      data: result,
    });
  } catch (error) {
    sendChargeCategoryError(res, error, 'Failed to fetch charge categories.');
  }
};

const createChargeCategory: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const payload = (req.body?.category ??
      req.body) as TCreateChargeCategoryPayload;
    const result = await ChargeCategoryServices.createChargeCategoryIntoDB(
      payload,
      actor,
    );

    res.status(201).json({
      success: true,
      message: 'Charge category created successfully.',
      data: result,
    });
  } catch (error) {
    sendChargeCategoryError(res, error, 'Failed to create charge category.');
  }
};

const updateChargeCategory: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const { categoryId } = req.params;

    if (!categoryId) {
      throw new Error('Charge category ID is required.');
    }

    const payload = (req.body?.category ??
      req.body) as TUpdateChargeCategoryPayload;
    const result = await ChargeCategoryServices.updateChargeCategoryInDB(
      categoryId,
      payload,
      actor,
    );

    if (!result) {
      res.status(404).json({
        success: false,
        message: 'Charge category not found.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Charge category updated successfully.',
      data: result,
    });
  } catch (error) {
    sendChargeCategoryError(res, error, 'Failed to update charge category.');
  }
};

export const ChargeCategoryController = {
  getChargeCategories,
  createChargeCategory,
  updateChargeCategory,
};
