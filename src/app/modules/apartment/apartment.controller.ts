import { Request, RequestHandler, Response } from 'express';

import {
  TCreateApartmentPayload,
  TUpdateApartmentElectricityConfigPayload,
  TUpdateApartmentPayload,
} from './apartment.interface';
import { ApartmentServices } from './apartment.service';
import type { TPropertyActor } from '../property/property.service';

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

const sendApartmentError = (
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
      message: 'This apartment number already exists under the property.',
    });
  }

  if (
    databaseError.name === 'ValidationError' ||
    databaseError.name === 'CastError'
  ) {
    return res.status(400).json({
      success: false,
      message: 'Apartment information is invalid.',
    });
  }

  if (error instanceof Error) {
    const message = error.message;
    const normalizedMessage = message.toLowerCase();

    if (
      normalizedMessage.includes('not authorized') ||
      normalizedMessage.includes('access was denied')
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
      normalizedMessage.includes('invalid') ||
      normalizedMessage.includes('required') ||
      normalizedMessage.includes('cannot delete') ||
      normalizedMessage.includes('cannot be empty') ||
      normalizedMessage.includes('no valid')
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

const createApartment: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const { propertyId } = req.params;

    if (!propertyId) {
      res.status(400).json({
        success: false,
        message: 'Property ID is required.',
      });
      return;
    }

    const payload = (req.body?.apartment ??
      req.body) as TCreateApartmentPayload;

    const result = await ApartmentServices.createApartmentIntoDB(
      propertyId,
      payload,
      actor,
    );

    res.status(201).json({
      success: true,
      message: 'Apartment created successfully.',
      data: result,
    });
  } catch (error) {
    sendApartmentError(res, error, 'Failed to create apartment.');
  }
};

const getApartmentsByProperty: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const { propertyId } = req.params;

    if (!propertyId) {
      res.status(400).json({
        success: false,
        message: 'Property ID is required.',
      });
      return;
    }

    const result = await ApartmentServices.getApartmentsByPropertyFromDB(
      propertyId,
      actor,
    );

    res.status(200).json({
      success: true,
      message: 'Apartments fetched successfully.',
      data: result,
    });
  } catch (error) {
    sendApartmentError(res, error, 'Failed to fetch apartments.');
  }
};

const getSingleApartment: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const { apartmentId } = req.params;

    if (!apartmentId) {
      res.status(400).json({
        success: false,
        message: 'Apartment ID is required.',
      });
      return;
    }

    const result = await ApartmentServices.getSingleApartmentFromDB(
      apartmentId,
      actor,
    );

    if (!result) {
      res.status(404).json({
        success: false,
        message: 'Apartment not found.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Apartment fetched successfully.',
      data: result,
    });
  } catch (error) {
    sendApartmentError(res, error, 'Failed to fetch apartment.');
  }
};

const updateApartment: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const { apartmentId } = req.params;

    if (!apartmentId) {
      res.status(400).json({
        success: false,
        message: 'Apartment ID is required.',
      });
      return;
    }

    const payload = (req.body?.apartment ??
      req.body) as TUpdateApartmentPayload;

    const result = await ApartmentServices.updateApartmentInDB(
      apartmentId,
      payload,
      actor,
    );

    if (!result) {
      res.status(404).json({
        success: false,
        message: 'Apartment not found.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Apartment updated successfully.',
      data: result,
    });
  } catch (error) {
    sendApartmentError(res, error, 'Failed to update apartment.');
  }
};

const deleteApartment: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const { apartmentId } = req.params;

    if (!apartmentId) {
      res.status(400).json({
        success: false,
        message: 'Apartment ID is required.',
      });
      return;
    }

    const result = await ApartmentServices.deleteApartmentFromDB(
      apartmentId,
      actor,
    );

    if (!result) {
      res.status(404).json({
        success: false,
        message: 'Apartment not found.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message:
        result.deletionType === 'soft'
          ? 'Apartment archived because tenancy history is connected.'
          : 'Apartment permanently deleted.',
      data: result,
    });
  } catch (error) {
    sendApartmentError(res, error, 'Failed to delete apartment.');
  }
};

const updateApartmentElectricityConfig: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const { apartmentId } = req.params;

    if (!apartmentId) {
      res.status(400).json({
        success: false,
        message: 'Apartment ID is required.',
      });
      return;
    }

    const payload = (req.body?.electricityConfig ??
      req.body) as TUpdateApartmentElectricityConfigPayload;
    const result = await ApartmentServices.updateApartmentElectricityConfigInDB(
      apartmentId,
      payload,
      actor,
    );

    if (!result) {
      res.status(404).json({
        success: false,
        message: 'Apartment not found.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Apartment electricity configuration updated successfully.',
      data: result,
    });
  } catch (error) {
    sendApartmentError(
      res,
      error,
      'Failed to update apartment electricity configuration.',
    );
  }
};

export const ApartmentController = {
  createApartment,
  getApartmentsByProperty,
  getSingleApartment,
  updateApartment,
  updateApartmentElectricityConfig,
  deleteApartment,
};
