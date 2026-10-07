import { Request, RequestHandler, Response } from 'express';

import type { TPropertyActor } from '../property/property.service';
import {
  ELECTRICITY_CONSUMER_CATEGORIES,
  ELECTRICITY_TARIFF_SCOPES,
  TCalculateElectricityBillPayload,
  TCreateElectricityProviderPayload,
  TCreateElectricityTariffPayload,
  TElectricityConsumerCategory,
  TElectricityTariffScope,
  TUpdateElectricityProviderPayload,
} from './electricity.interface';
import { ElectricityServices } from './electricity.service';

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

const sendElectricityError = (
  res: Response,
  error: unknown,
  fallbackMessage: string,
) => {
  console.error(error);

  const databaseError = error as { code?: number; name?: string };

  if (databaseError.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'An electricity provider with this code already exists.',
    });
  }

  if (
    databaseError.name === 'ValidationError' ||
    databaseError.name === 'CastError'
  ) {
    return res.status(400).json({
      success: false,
      message: 'Electricity information is invalid.',
    });
  }

  if (error instanceof Error) {
    const message = error.message;
    const normalizedMessage = message.toLowerCase();

    if (
      normalizedMessage.includes('not authorized') ||
      normalizedMessage.includes('only a super administrator')
    ) {
      return res.status(403).json({ success: false, message });
    }

    if (normalizedMessage.includes('not found')) {
      return res.status(404).json({ success: false, message });
    }

    if (normalizedMessage.includes('already exists')) {
      return res.status(409).json({ success: false, message });
    }

    if (
      normalizedMessage.includes('invalid') ||
      normalizedMessage.includes('required') ||
      normalizedMessage.includes('cannot') ||
      normalizedMessage.includes('must') ||
      normalizedMessage.includes('no valid')
    ) {
      return res.status(400).json({ success: false, message });
    }
  }

  return res.status(500).json({
    success: false,
    message: fallbackMessage,
  });
};

const createProvider: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const payload = (req.body?.provider ??
      req.body) as TCreateElectricityProviderPayload;
    const result = await ElectricityServices.createProviderIntoDB(
      payload,
      actor,
    );

    res.status(201).json({
      success: true,
      message: 'Electricity provider created successfully.',
      data: result,
    });
  } catch (error) {
    sendElectricityError(res, error, 'Failed to create electricity provider.');
  }
};

const getProviders: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const includeInactive =
      req.query.includeInactive === 'true' && actor.role === 'superAdmin';
    const result = await ElectricityServices.getProvidersFromDB(
      actor,
      includeInactive,
    );

    res.status(200).json({
      success: true,
      message: 'Electricity providers fetched successfully.',
      data: result,
    });
  } catch (error) {
    sendElectricityError(res, error, 'Failed to fetch electricity providers.');
  }
};

const updateProvider: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const { providerId } = req.params;

    if (!providerId) {
      res.status(400).json({
        success: false,
        message: 'Electricity provider ID is required.',
      });
      return;
    }

    const payload = (req.body?.provider ??
      req.body) as TUpdateElectricityProviderPayload;
    const result = await ElectricityServices.updateProviderInDB(
      providerId,
      payload,
      actor,
    );

    if (!result) {
      res.status(404).json({
        success: false,
        message: 'Electricity provider not found.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Electricity provider updated successfully.',
      data: result,
    });
  } catch (error) {
    sendElectricityError(res, error, 'Failed to update electricity provider.');
  }
};

const createTariffSchedule: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const payload = (req.body?.tariff ??
      req.body) as TCreateElectricityTariffPayload;
    const result = await ElectricityServices.createTariffScheduleIntoDB(
      payload,
      actor,
    );

    res.status(201).json({
      success: true,
      message: 'Electricity tariff version created successfully.',
      data: result,
    });
  } catch (error) {
    sendElectricityError(res, error, 'Failed to create electricity tariff.');
  }
};

const getTariffSchedules: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const scope =
      typeof req.query.scope === 'string' ? req.query.scope : undefined;
    const consumerCategory =
      typeof req.query.consumerCategory === 'string'
        ? req.query.consumerCategory
        : undefined;

    if (
      scope &&
      !ELECTRICITY_TARIFF_SCOPES.includes(scope as TElectricityTariffScope)
    ) {
      throw new Error('Electricity tariff scope is invalid.');
    }

    if (
      consumerCategory &&
      !ELECTRICITY_CONSUMER_CATEGORIES.includes(
        consumerCategory as TElectricityConsumerCategory,
      )
    ) {
      throw new Error('Electricity consumer category is invalid.');
    }

    const result = await ElectricityServices.getTariffSchedulesFromDB(actor, {
      providerId:
        typeof req.query.providerId === 'string'
          ? req.query.providerId
          : undefined,
      scope: scope as TElectricityTariffScope | undefined,
      consumerCategory: consumerCategory as
        | TElectricityConsumerCategory
        | undefined,
      activeOnly: req.query.activeOnly !== 'false',
    });

    res.status(200).json({
      success: true,
      message: 'Electricity tariff schedules fetched successfully.',
      data: result,
    });
  } catch (error) {
    sendElectricityError(res, error, 'Failed to fetch electricity tariffs.');
  }
};

const getApplicableTariff: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const providerId =
      typeof req.query.providerId === 'string'
        ? req.query.providerId
        : undefined;
    const consumerCategory =
      typeof req.query.consumerCategory === 'string'
        ? req.query.consumerCategory
        : 'LT_A_RESIDENTIAL';
    const applicableDate =
      typeof req.query.date === 'string' ? req.query.date : new Date();

    if (!providerId) {
      throw new Error('Electricity provider ID is required.');
    }

    if (
      !ELECTRICITY_CONSUMER_CATEGORIES.includes(
        consumerCategory as TElectricityConsumerCategory,
      )
    ) {
      throw new Error('Electricity consumer category is invalid.');
    }

    const result = await ElectricityServices.getApplicableTariffFromDB(
      providerId,
      consumerCategory as TElectricityConsumerCategory,
      applicableDate,
      actor,
    );

    if (!result) {
      res.status(404).json({
        success: false,
        message: 'No applicable electricity tariff was found.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Applicable electricity tariff fetched successfully.',
      data: result,
    });
  } catch (error) {
    sendElectricityError(
      res,
      error,
      'Failed to fetch the applicable electricity tariff.',
    );
  }
};

const deactivateTariffSchedule: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const { tariffId } = req.params;

    if (!tariffId) {
      throw new Error('Electricity tariff ID is required.');
    }

    const result = await ElectricityServices.deactivateTariffScheduleInDB(
      tariffId,
      actor,
    );

    if (!result) {
      res.status(404).json({
        success: false,
        message: 'Electricity tariff not found.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Electricity tariff deactivated successfully.',
      data: result,
    });
  } catch (error) {
    sendElectricityError(res, error, 'Failed to deactivate tariff.');
  }
};

const calculateElectricityBill: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const payload = (req.body?.calculation ??
      req.body) as TCalculateElectricityBillPayload;
    const result = await ElectricityServices.calculateElectricityBill(
      payload,
      actor,
    );

    res.status(200).json({
      success: true,
      message: 'Electricity bill calculated successfully.',
      data: result,
    });
  } catch (error) {
    sendElectricityError(res, error, 'Failed to calculate electricity bill.');
  }
};

export const ElectricityController = {
  createProvider,
  getProviders,
  updateProvider,
  createTariffSchedule,
  getTariffSchedules,
  getApplicableTariff,
  deactivateTariffSchedule,
  calculateElectricityBill,
};
