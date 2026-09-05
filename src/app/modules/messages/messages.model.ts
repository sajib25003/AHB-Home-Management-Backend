import { model, Schema } from 'mongoose';
import { IMessage } from './messages.interface';

const MessageSchema = new Schema<IMessage>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    location: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true, strict: true },
);

export const MessageModel = model<IMessage>('Message', MessageSchema);
