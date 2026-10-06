import { Request, RequestHandler, Response } from 'express';

import type { TPropertyActor } from '../property/property.service';
import {
  TCreateTenancyPayload,
  TEndTenancyPayload,
  TTenancyListQuery,
  TTenancyStatus,
} from './tenancy.interface';
import { TenancyServices } from './tenancy.service';

const getActor = (req: Request, res: Response): TPropertyActor | null => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'You must be logged in.',
    });
    return null;
  }

  return {
    id: req.user.id,
    role: req.user.role,
  };
};

const sendTenancyError = (
  res: Response,
  error: unknown,
  fallbackMessage: string,
) => {
  console.error(error);

  const databaseError = error as {
    code?: number;
    name?: string;
  };

  if (databaseError.code === 11000) {
    return res.status(409).json({
      success: false,
      message:
        'The apartment or tenant already has another active tenancy.',
    });
  }

  if (
    databaseError.name === 'ValidationError' ||
    databaseError.name === 'CastError'
  ) {
    return res.status(400).json({
      success: false,
      message: 'Tenancy information is invalid.',
    });
  }

  if (error instanceof Error) {
    const message = error.message;
    const normalizedMessage = message.toLowerCase();

    if (
      normalizedMessage.includes('not authorized') ||
      normalizedMessage.includes('access was denied') ||
      normalizedMessage.includes('only a tenant')
    ) {
      return res.status(403).json({
        success: false,
        message,
      });
    }

    if (normalizedMessage.includes('not found')) {
      return res.status(404).json({
        success: false,
        message,
      });
    }

    if (
      normalizedMessage.includes('already') ||
      normalizedMessage.includes('overlap')
    ) {
      return res.status(409).json({
        success: false,
        message,
      });
    }

    if (
      normalizedMessage.includes('invalid') ||
      normalizedMessage.includes('required') ||
      normalizedMessage.includes('cannot')
    ) {
      return res.status(400).json({
        success: false,
        message,
      });
    }
  }

  return res.status(500).json({
    success: false,
    message: fallbackMessage,
  });
};

const parsePositiveInteger = (
  value: unknown,
  fieldName: string,
): number | undefined => {
  if (value === undefined) return undefined;

  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error(`${fieldName} is invalid.`);
  }

  const parsedValue = Number(value);

  if (parsedValue < 1) {
    throw new Error(`${fieldName} is invalid.`);
  }

  return parsedValue;
};

const createTenancy: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const payload = (req.body?.tenancy ?? req.body) as TCreateTenancyPayload;
    const result = await TenancyServices.createTenancyIntoDB(payload, actor);

    res.status(201).json({
      success: true,
      message: 'Tenant assigned to the apartment successfully.',
      data: result,
    });
  } catch (error) {
    sendTenancyError(res, error, 'Failed to assign tenant to apartment.');
  }
};

const getAllTenancies: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const status =
      typeof req.query.status === 'string' ? req.query.status : undefined;

    if (status && !['active', 'ended'].includes(status)) {
      throw new Error('Tenancy status is invalid.');
    }

    const query: TTenancyListQuery = {
      ownerId:
        typeof req.query.ownerId === 'string'
          ? req.query.ownerId
          : undefined,
      propertyId:
        typeof req.query.propertyId === 'string'
          ? req.query.propertyId
          : undefined,
      apartmentId:
        typeof req.query.apartmentId === 'string'
          ? req.query.apartmentId
          : undefined,
      tenantId:
        typeof req.query.tenantId === 'string'
          ? req.query.tenantId
          : undefined,
      status: status as TTenancyStatus | undefined,
      page: parsePositiveInteger(req.query.page, 'Page'),
      limit: parsePositiveInteger(req.query.limit, 'Limit'),
    };

    const result = await TenancyServices.getAllTenanciesFromDB(actor, query);

    res.status(200).json({
      success: true,
      message: 'Tenancies fetched successfully.',
      data: result,
    });
  } catch (error) {
    sendTenancyError(res, error, 'Failed to fetch tenancies.');
  }
};

const getSingleTenancy: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const { tenancyId } = req.params;

    if (!tenancyId) {
      res.status(400).json({
        success: false,
        message: 'Tenancy ID is required.',
      });
      return;
    }

    const result = await TenancyServices.getSingleTenancyFromDB(
      tenancyId,
      actor,
    );

    if (!result) {
      res.status(404).json({
        success: false,
        message: 'Tenancy not found.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Tenancy fetched successfully.',
      data: result,
    });
  } catch (error) {
    sendTenancyError(res, error, 'Failed to fetch tenancy.');
  }
};

const getMyCurrentTenancy: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const result = await TenancyServices.getMyCurrentTenancyFromDB(actor);

    res.status(200).json({
      success: true,
      message: result
        ? 'Current tenancy fetched successfully.'
        : 'No active tenancy was found.',
      data: result,
    });
  } catch (error) {
    sendTenancyError(res, error, 'Failed to fetch current tenancy.');
  }
};

const endTenancy: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const { tenancyId } = req.params;

    if (!tenancyId) {
      res.status(400).json({
        success: false,
        message: 'Tenancy ID is required.',
      });
      return;
    }

    const payload = (req.body?.tenancy ?? req.body) as TEndTenancyPayload;
    const result = await TenancyServices.endTenancyInDB(
      tenancyId,
      payload,
      actor,
    );

    if (!result) {
      res.status(404).json({
        success: false,
        message: 'Tenancy not found.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Tenant move-out completed successfully.',
      data: result,
    });
  } catch (error) {
    sendTenancyError(res, error, 'Failed to complete tenant move-out.');
  }
};

export const TenancyController = {
  createTenancy,
  getAllTenancies,
  getSingleTenancy,
  getMyCurrentTenancy,
  endTenancy,
};
