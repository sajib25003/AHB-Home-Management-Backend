import { Request, RequestHandler, Response } from 'express';

import {
  TCreatePropertyPayload,
  TUpdatePropertyElectricitySettingsPayload,
  TUpdatePropertyPayload,
} from './property.interface';
import { PropertyServices } from './property.service';
import type { TPropertyActor } from './property.service';

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

const sendPropertyError = (
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
      message: 'This owner already has a property with the same name.',
    });
  }

  if (
    databaseError.name === 'ValidationError' ||
    databaseError.name === 'CastError'
  ) {
    return res.status(400).json({
      success: false,
      message: 'Property information is invalid.',
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
      normalizedMessage.includes('must be selected') ||
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

const createProperty: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const payload = (req.body?.property ?? req.body) as TCreatePropertyPayload;
    const result = await PropertyServices.createPropertyIntoDB(payload, actor);

    res.status(201).json({
      success: true,
      message: 'Property created successfully.',
      data: result,
    });
  } catch (error) {
    sendPropertyError(res, error, 'Failed to create property.');
  }
};

const getAllProperties: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const ownerId =
      typeof req.query.ownerId === 'string' ? req.query.ownerId : undefined;
    const search =
      typeof req.query.search === 'string' ? req.query.search : undefined;

    const result = await PropertyServices.getAllPropertiesFromDB(actor, {
      ownerId,
      search,
    });

    res.status(200).json({
      success: true,
      message: 'Properties fetched successfully.',
      data: result,
    });
  } catch (error) {
    sendPropertyError(res, error, 'Failed to fetch properties.');
  }
};

const getSingleProperty: RequestHandler = async (req, res) => {
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

    const result = await PropertyServices.getSinglePropertyFromDB(
      propertyId,
      actor,
    );

    if (!result) {
      res.status(404).json({
        success: false,
        message: 'Property not found.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Property fetched successfully.',
      data: result,
    });
  } catch (error) {
    sendPropertyError(res, error, 'Failed to fetch property.');
  }
};

const updateProperty: RequestHandler = async (req, res) => {
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

    const payload = (req.body?.property ?? req.body) as TUpdatePropertyPayload;
    const result = await PropertyServices.updatePropertyInDB(
      propertyId,
      payload,
      actor,
    );

    if (!result) {
      res.status(404).json({
        success: false,
        message: 'Property not found.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Property updated successfully.',
      data: result,
    });
  } catch (error) {
    sendPropertyError(res, error, 'Failed to update property.');
  }
};

const deleteProperty: RequestHandler = async (req, res) => {
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

    const result = await PropertyServices.deletePropertyFromDB(
      propertyId,
      actor,
    );

    if (!result) {
      res.status(404).json({
        success: false,
        message: 'Property not found.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message:
        result.deletionType === 'soft'
          ? 'Property archived because apartment records are connected.'
          : 'Property permanently deleted.',
      data: result,
    });
  } catch (error) {
    sendPropertyError(res, error, 'Failed to delete property.');
  }
};

const updatePropertyElectricitySettings: RequestHandler = async (req, res) => {
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

    const payload = (req.body?.electricitySettings ??
      req.body) as TUpdatePropertyElectricitySettingsPayload;
    const result = await PropertyServices.updatePropertyElectricitySettingsInDB(
      propertyId,
      payload,
      actor,
    );

    if (!result) {
      res.status(404).json({
        success: false,
        message: 'Property not found.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Property electricity settings updated successfully.',
      data: result,
    });
  } catch (error) {
    sendPropertyError(
      res,
      error,
      'Failed to update property electricity settings.',
    );
  }
};

export const PropertyController = {
  createProperty,
  getAllProperties,
  getSingleProperty,
  updateProperty,
  updatePropertyElectricitySettings,
  deleteProperty,
};
