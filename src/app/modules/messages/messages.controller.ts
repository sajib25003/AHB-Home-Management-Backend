import { Request, Response } from 'express';
import { MessagesServices } from './messages.service';

const createMessage = async (req: Request, res: Response) => {
  try {
    const { message: messageData } = req.body;

    const result = await MessagesServices.createMessageIntoDB(messageData);
    res.status(200).json({
      success: true,
      message: 'Message created successfully!',
      data: result,
    });
  } catch (error: unknown) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: (error as Error).message || 'Something went wrong',
      error,
    });
  }
};

const getAllMessages = async (req: Request, res: Response) => {
  try {
    const { page, limit } = req.query;

    const result = await MessagesServices.getAllMessagesFromDB({
      page: Number(page) || 1,
      limit: Number(limit) || 10,
    });

    res.status(200).json({
      success: true,
      message: 'Messages fetched successfully!',
      meta: result.meta,
      data: result.data,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
    });
  }
};

const getSingleMessage = async (req: Request, res: Response) => {
  try {
    const id = req.params.messageId;
    const result = await MessagesServices.getSingleMessageFromDB(id);

    res.send({
      status: true,
      message: 'Message fetched successfully',
      data: result,
    });
  } catch (error: unknown) {
    res.json({
      status: false,
      message: 'Failed to fetch message',
      error,
    });
  }
};

const updateMessage = async (req: Request, res: Response) => {
  try {
    const id = req.params.messageId;
    const data = req.body;

    const result = await MessagesServices.updateMessageInDB(id, data);

    res.status(200).json({
      success: true,
      message: 'Message updated successfully',
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update message',
      error,
    });
  }
};

const deleteMessage = async (req: Request, res: Response) => {
  try {
    const id = req.params.messageId;
    await MessagesServices.deleteMessageFromDB(id);

    res.send({
      status: true,
      message: 'Message deleted successfully',
      data: {},
    });
  } catch (error: unknown) {
    res.json({
      status: false,
      message: 'Failed to delete message',
      error,
    });
  }
};

export const MessagesController = {
  createMessage,
  getAllMessages,
  getSingleMessage,
  updateMessage,
  deleteMessage,
};
