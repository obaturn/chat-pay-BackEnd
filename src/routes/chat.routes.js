const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.middleware');
const Chat = require('../models/Chat');
const Message = require('../models/Message');

/**
 * @route GET /api/chats
 * @desc Get user's chats
 * @access Private
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const { limit = 20, skip = 0 } = req.query;

    // Get user's chats with populated data
    const chats = await Chat.findUserChats(userId, { limit: parseInt(limit), skip: parseInt(skip) });

    // Add unread count and correct display name for each chat
    const chatsWithUnreadCount = await Promise.all(
      chats.map(async (chat) => {
        const unreadCount = await Message.getUnreadCount(chat._id, userId);

        // For direct chats, find the other participant to use as the name
        let chatName = chat.name;
        if (chat.type === 'direct') {
          const otherParticipant = chat.participants.find(
            p => p._id.toString() !== userId.toString()
          );
          chatName = otherParticipant ? (otherParticipant.displayName || otherParticipant.username) : 'Unknown User';
        }

        return {
          id: chat._id,
          name: chatName,
          participants: chat.participants.map(p => ({
            id: p._id,
            username: p.username,
            displayName: p.displayName,
            profilePicture: p.profilePicture,
            isOnline: p.isOnline
          })),
          lastMessage: chat.lastMessage ? {
            id: chat.lastMessage._id,
            content: chat.lastMessage.content,
            type: chat.lastMessage.type,
            timestamp: chat.lastMessage.createdAt,
            senderId: chat.lastMessage.senderId
          } : null,
          unreadCount,
          type: chat.type,
          lastActivity: chat.lastActivity
        };
      })
    );

    res.json({
      success: true,
      chats: chatsWithUnreadCount
    });
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({
      error: 'Failed to get chats',
      message: error.message
    });
  }
});

/**
 * @route POST /api/chats
 * @desc Create new chat
 * @access Private
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { participants, type = 'direct', name } = req.body;
    const creatorId = req.user._id;

    // Validate participants
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({
        error: 'Participants array is required'
      });
    }

    // Add creator to participants if not already included
    const allParticipants = [...new Set([...participants, creatorId.toString()])];

    // Validate participant count
    if (type === 'direct' && allParticipants.length !== 2) {
      return res.status(400).json({
        error: 'Direct chats must have exactly 2 participants'
      });
    }

    if (type === 'group' && allParticipants.length < 3) {
      return res.status(400).json({
        error: 'Group chats must have at least 3 participants'
      });
    }

    let chat;

    if (type === 'direct') {
      // Check if direct chat already exists
      const existingChat = await Chat.findDirectChat(allParticipants[0], allParticipants[1]);
      if (existingChat) {
        // Get the other participant's display name
        const otherParticipant = existingChat.participants.find(
          p => p.toString() !== creatorId.toString()
        );
        
        // Fetch participant details
        const User = require('../models/User');
        const otherUser = await User.findById(otherParticipant);
        const chatName = otherUser ? (otherUser.displayName || otherUser.username) : 'Direct Chat';
        
        return res.status(200).json({
          success: true,
          chat: {
            id: existingChat._id,
            name: chatName,
            participants: existingChat.participants.map(p => ({ id: p })),
            type: existingChat.type,
            lastActivity: existingChat.lastActivity
          },
          message: 'Chat already exists'
        });
      }

      // Create new direct chat
      chat = await Chat.createDirectChat(allParticipants[0], allParticipants[1]);
    } else {
      // Create group chat
      if (!name) {
        return res.status(400).json({
          error: 'Group name is required for group chats'
        });
      }

      chat = await Chat.createGroupChat(name, allParticipants, creatorId);
    }

    // Populate the created chat
    await chat.populate('participants', 'username displayName profilePicture isOnline');

    res.status(201).json({
      success: true,
      chat: {
        id: chat._id,
        name: type === 'direct'
          ? (chat.participants.find(p => p._id.toString() !== creatorId.toString())?.displayName || 'Direct Chat')
          : (chat.name || name),
        participants: chat.participants.map(p => ({
          id: p._id,
          username: p.username,
          displayName: p.displayName,
          profilePicture: p.profilePicture,
          isOnline: p.isOnline
        })),
        type: chat.type,
        lastActivity: chat.lastActivity
      }
    });
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({
      error: 'Failed to create chat',
      message: error.message
    });
  }
});

/**
 * @route GET /api/chats/:id
 * @desc Get chat details
 * @access Private
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // TODO: Implement get chat details
    res.json({
      success: true,
      chat: null,
      message: 'Get chat details not yet implemented'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get chat',
      message: error.message
    });
  }
});

/**
 * @route PUT /api/chats/:id
 * @desc Update chat
 * @access Private
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user._id;

    // TODO: Implement chat update
    res.json({
      success: true,
      message: 'Chat update not yet implemented'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update chat',
      message: error.message
    });
  }
});

/**
 * @route GET /api/chats/:id/messages
 * @desc Get chat messages
 * @access Private
 */
router.get('/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const { limit = 50, skip = 0, before, after } = req.query;

    // Verify user is participant in chat
    const chat = await Chat.findById(id);
    if (!chat) {
      return res.status(404).json({
        error: 'Chat not found'
      });
    }

    if (!chat.isParticipant(userId)) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // Get messages
    const messages = await Message.findChatMessages(id, {
      limit: parseInt(limit),
      skip: parseInt(skip),
      before: before ? new Date(before) : undefined,
      after: after ? new Date(after) : undefined
    });

    // Format messages for frontend
    const formattedMessages = messages.reverse().map(msg => ({
      id: msg._id,
      chatId: msg.chatId,
      senderId: msg.senderId._id,
      content: msg.content,
      type: msg.type,
      timestamp: msg.createdAt,
      payment: msg.paymentData && (msg.paymentData.amount || msg.paymentData.transactionHash || msg.paymentData.recipientAddress) ? {
        id: msg.paymentData.transactionHash || msg._id,
        type: msg.type.includes('request') ? 'request' : 'manual',
        amount: msg.paymentData.amount,
        receiverWallet: msg.paymentData.recipientAddress,
        status: msg.paymentData.status === 'completed' ? 'verified' : 'unverified',
        txHash: msg.paymentData.transactionHash
      } : undefined,
      attachments: msg.attachments,
      readBy: msg.readBy.map(read => ({
        userId: read.userId._id,
        readAt: read.readAt
      })),
      reactions: msg.reactions.map(reaction => ({
        emoji: reaction.emoji,
        userId: reaction.userId._id,
        createdAt: reaction.createdAt
      }))
    }));

    res.json({
      success: true,
      messages: formattedMessages
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      error: 'Failed to get messages',
      message: error.message
    });
  }
});

/**
 * @route POST /api/chats/:id/messages
 * @desc Send message
 * @access Private
 */
router.post('/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, type = 'text', paymentData } = req.body;
    const senderId = req.user._id;

    // Validate input
    if (!content && !paymentData) {
      return res.status(400).json({
        error: 'Message content or payment data is required'
      });
    }

    // Verify user is participant in chat
    const chat = await Chat.findById(id);
    if (!chat) {
      return res.status(404).json({
        error: 'Chat not found'
      });
    }

    if (!chat.isParticipant(senderId)) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // Create message
    const messageData = {
      chatId: id,
      senderId,
      type,
      content: content || '',
      paymentData: paymentData ? {
        amount: paymentData.amount,
        currency: paymentData.currency || 'SUI',
        status: paymentData.status || 'pending',
        recipientAddress: paymentData.recipientAddress,
        description: paymentData.description,
        transactionHash: paymentData.transactionHash
      } : undefined
    };

    const message = new Message(messageData);
    await message.save();

    // Populate sender info
    await message.populate('senderId', 'username displayName profilePicture');

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      // Send to all participants except sender
      chat.participants.forEach(participantId => {
        if (participantId.toString() !== senderId.toString()) {
          io.to(participantId.toString()).emit('new-message', {
            id: message._id,
            chatId: message.chatId,
            senderId: message.senderId._id,
            content: message.content,
            type: message.type,
            timestamp: message.createdAt,
            payment: message.paymentData && (message.paymentData.amount || message.paymentData.transactionHash || message.paymentData.recipientAddress) ? {
              id: message.paymentData.transactionHash || message._id,
              type: message.type.includes('request') ? 'request' : 'manual',
              amount: message.paymentData.amount,
              receiverWallet: message.paymentData.recipientAddress,
              status: message.paymentData.status === 'completed' ? 'verified' : 'unverified',
              txHash: message.paymentData.transactionHash
            } : undefined
          });
        }
      });
    }

    res.status(201).json({
      success: true,
      message: {
        id: message._id,
        chatId: message.chatId,
        senderId: message.senderId._id,
        content: message.content,
        type: message.type,
        timestamp: message.createdAt,
        payment: message.paymentData ? {
          id: message.paymentData.transactionHash || message._id,
          type: message.type.includes('request') ? 'request' : 'manual',
          amount: message.paymentData.amount,
          receiverWallet: message.paymentData.recipientAddress,
          status: message.paymentData.status === 'completed' ? 'verified' : 'unverified',
          txHash: message.paymentData.transactionHash
        } : undefined
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      error: 'Failed to send message',
      message: error.message
    });
  }
});

module.exports = router;