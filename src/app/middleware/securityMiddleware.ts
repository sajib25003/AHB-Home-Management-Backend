import { randomUUID } from 'crypto';
import type { ErrorRequestHandler, RequestHandler } from 'express';

import config from '../config';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const FORBIDDEN_INPUT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

const containsDangerousKey = (value: unknown, depth = 0): boolean => {
  if (depth > 20 || value === null || typeof value !== 'object') {
    return depth > 20;
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsDangerousKey(item, depth + 1));
  }

  return Object.entries(value).some(([key, nestedValue]) => {
    return (
      key.startsWith('$') ||
      key.includes('.') ||
      FORBIDDEN_INPUT_KEYS.has(key) ||
      containsDangerousKey(nestedValue, depth + 1)
    );
  });
};

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const incomingRequestId = req.get('x-request-id');
  const requestId =
    incomingRequestId && /^[a-zA-Z0-9_-]{8,128}$/.test(incomingRequestId)
      ? incomingRequestId
      : randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
};

export const rejectDangerousInput: RequestHandler = (req, res, next) => {
  if (containsDangerousKey(req.body) || containsDangerousKey(req.query)) {
    res.status(400).json({
      success: false,
      message: 'Request contains unsupported input keys.',
    });
    return;
  }

  next();
};

export const protectStateChangingRequests: RequestHandler = (
  req,
  res,
  next,
) => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const origin = req.get('origin');
  const fetchSite = req.get('sec-fetch-site');
  const requestedWith = req.get('x-requested-with');
  const hasBearerToken = req.get('authorization')?.startsWith('Bearer ');
  const normalizedOrigin = origin?.replace(/\/$/, '');
  const isAllowedOrigin = Boolean(
    normalizedOrigin && config.client_urls.includes(normalizedOrigin),
  );

  if (fetchSite === 'cross-site' && !isAllowedOrigin) {
    res.status(403).json({
      success: false,
      message: 'Cross-site request was blocked.',
    });
    return;
  }

  // Bearer-token API clients are not vulnerable to browser cookie CSRF.
  if (hasBearerToken && !origin) {
    next();
    return;
  }

  // Browser mutation requests must come from a configured frontend and must
  // use a non-simple custom header, forcing a successful CORS preflight.
  if (origin) {
    if (!isAllowedOrigin) {
      res.status(403).json({
        success: false,
        message: 'Request origin is not allowed.',
      });
      return;
    }

    if (requestedWith !== 'XMLHttpRequest') {
      res.status(403).json({
        success: false,
        message: 'CSRF protection header is missing.',
      });
      return;
    }
  }

  next();
};

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint was not found.',
    requestId: req.requestId,
  });
};

export const globalErrorHandler: ErrorRequestHandler = (
  error,
  req,
  res,
  _next,
) => {
  const isCorsError =
    error instanceof Error && error.message === 'Not allowed by CORS';
  const requestError = error as { status?: number; type?: string };
  const isInvalidJson =
    error instanceof SyntaxError && requestError.status === 400;
  const isBodyTooLarge = requestError.type === 'entity.too.large';
  const statusCode = isCorsError
    ? 403
    : isBodyTooLarge
      ? 413
      : isInvalidJson
        ? 400
        : 500;

  console.error('Unhandled request error', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    error,
  });

  res.status(statusCode).json({
    success: false,
    message: isCorsError
      ? 'Request origin is not allowed.'
      : isBodyTooLarge
        ? 'Request body is too large.'
        : isInvalidJson
          ? 'Request body contains invalid JSON.'
          : 'An unexpected server error occurred.',
    requestId: req.requestId,
  });
};
