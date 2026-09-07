import { Router } from 'express';
import authMiddleware from '../../middleware/authMiddleware';
import { MessagesController } from './messages.controller';

const messageRouter = Router();

messageRouter.post('/create-message', MessagesController.createMessage);
messageRouter.get(
  '/all-messages',
  authMiddleware,
  MessagesController.getAllMessages,
);
messageRouter.get(
  '/:messageId',
  authMiddleware,
  MessagesController.getSingleMessage,
);

messageRouter.patch(
  '/:messageId',
  authMiddleware,
  MessagesController.updateMessage,
);
messageRouter.delete(
  '/:messageId',
  authMiddleware,
  MessagesController.deleteMessage,
);

export default messageRouter;
