import type { RequestHandler } from 'express';
import { SubmeterServices } from './submeter.service';

const handler =
  (action: 'context' | 'preview' | 'save' | 'history'): RequestHandler =>
  async (req, res) => {
    if (!req.user) {
      res
        .status(401)
        .json({ success: false, message: 'You must be logged in.' });
      return;
    }
    const actor = { id: req.user.id, role: req.user.role };
    try {
      const result =
        action === 'history'
          ? await SubmeterServices.history(
              String(req.query.apartmentId ?? ''),
              Number(req.query.year),
              actor,
            )
          : action === 'context'
            ? await SubmeterServices.getContext(
                String(req.query.apartmentId ?? ''),
                String(req.query.billingPeriod ?? ''),
                actor,
              )
            : action === 'preview'
              ? await SubmeterServices.preview(
                  req.body?.reading ?? req.body,
                  actor,
                )
              : await SubmeterServices.save(
                  req.body?.reading ?? req.body,
                  actor,
                );
      res
        .status(action === 'save' ? 201 : 200)
        .json({ success: true, data: result });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to process submeter reading.';
      const duplicate = (error as { code?: number }).code === 11000;
      const status =
        duplicate ||
        message.includes('already exists') ||
        message.includes('has changed')
          ? 409
          : message.includes('not authorized') ||
              message.includes('access was denied')
            ? 403
            : message.includes('not found')
              ? 404
              : 400;
      res.status(status).json({
        success: false,
        message: duplicate
          ? 'A submeter reading already exists for this apartment and month.'
          : message,
      });
    }
  };
export const SubmeterController = {
  context: handler('context'),
  history: handler('history'),
  preview: handler('preview'),
  save: handler('save'),
};
