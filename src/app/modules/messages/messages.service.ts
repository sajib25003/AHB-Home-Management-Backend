import { IMessage, QueryOptions } from './messages.interface';
import { MessageModel } from './messages.model';
import { FilterQuery } from 'mongoose';

const createMessageIntoDB = async (message: IMessage): Promise<IMessage> => {
  const result = await MessageModel.create(message);
  return result;
};

const getAllMessagesFromDB = async (options: QueryOptions) => {
  const { page = 1, limit = 10 } = options;

  const skip = (page - 1) * limit;

  const query: FilterQuery<IMessage> = {};
  const result = await MessageModel.find(query)
    .sort({ createdAt: -1 }) // last one will come first
    .skip(skip)
    .limit(limit);

  const totalItems = await MessageModel.countDocuments(query);
  const totalPages = Math.ceil(totalItems / limit);

  return {
    meta: {
      page,
      itemsPerPage: limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    data: result,
  };
};

const getSingleMessageFromDB = async (id: string) => {
  const result = await MessageModel.findById(id);
  return result;
};

const updateMessageInDB = async (id: string, payload: Partial<IMessage>) => {
  const result = await MessageModel.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });

  return result;
};

const deleteMessageFromDB = async (id: string) => {
  const result = await MessageModel.findByIdAndDelete(id);
  return result;
};

export const MessagesServices = {
  createMessageIntoDB,
  getAllMessagesFromDB,
  getSingleMessageFromDB,
  updateMessageInDB,
  deleteMessageFromDB,
};
