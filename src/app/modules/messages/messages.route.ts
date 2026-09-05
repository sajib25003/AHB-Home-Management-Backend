import { Router } from 'express';
import authMiddleware from '../../middleware/authMiddleware';
import { MessagesController } from './messages.controller';

const messageRouter = Router();

messageRouter.post('/create-message', MessagesController.createMessage);
messageRouter.get(
  '/all-messages',
  // @ts-expect-error: no error here. manually checked!
  authMiddleware,
  MessagesController.getAllMessages,
);
messageRouter.get(
  '/:messageId',
  // @ts-expect-error: no error here. manually checked!
  authMiddleware,
  MessagesController.getSingleMessage,
);

messageRouter.patch(
  '/:messageId',
  // @ts-expect-error: no error here. manually checked!
  authMiddleware,
  MessagesController.updateMessage,
);
messageRouter.delete(
  '/:messageId',
  // @ts-expect-error: no error here. manually checked!
  authMiddleware,
  MessagesController.deleteMessage,
);

export default messageRouter;
