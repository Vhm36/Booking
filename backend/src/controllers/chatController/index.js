const { promisify } = require('util');
const chatModel = require('../../models/chatModel');
const { buildSmartRuleResponse } = require('../../utils/chatResponseEngine');
const { generateSalonAIReply, isGeminiEnabled } = require('../../utils/geminiChat');
const { executeTool } = require('../../utils/toolRegistry');

const getConversationByIdAsync = promisify(chatModel.getConversationById);
const createMessageAsync = promisify(chatModel.createMessage);
const updateConversationStatusAsync = promisify(chatModel.updateConversationStatus);
const getAllBotResponsesAsync = promisify(chatModel.getAllBotResponses);
const getAllFAQAsync = promisify(chatModel.getAllFAQ);
const getActiveServicesForChatAsync = promisify(chatModel.getActiveServicesForChat);
const getSuggestionsAsync = promisify(chatModel.getSuggestions);
const getMessagesByConversationIdAsync = promisify(chatModel.getMessagesByConversationId);

// ============================================================================
// Chat Conversations
// ============================================================================

exports.startConversation = (req, res) => {
  const userId = req.user.id;
  const { subject } = req.body;

  chatModel.createConversation(userId, subject, (err, result) => {
    if (err) {
      console.error('[START_CONVERSATION_ERROR]', err);
      return res.status(500).json({
        success: false,
        message: 'Không thể bắt đầu cuộc trò chuyện'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Cuộc trò chuyện đã được tạo',
      conversationId: result.insertId
    });
  });
};

exports.getConversation = (req, res) => {
  const { conversationId } = req.params;

  chatModel.getConversationById(conversationId, (err, conversation) => {
    if (err) {
      console.error('[GET_CONVERSATION_ERROR]', err);
      return res.status(500).json({
        success: false,
        message: 'Không thể tải cuộc trò chuyện'
      });
    }

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Cuộc trò chuyện không tồn tại'
      });
    }

    if (Number(conversation.user_id) !== Number(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem cuộc trò chuyện này'
      });
    }

    return res.status(200).json({
      success: true,
      data: conversation
    });
  });
};

exports.getMyConversations = (req, res) => {
  const userId = req.user.id;

  chatModel.getConversationsByUserId(userId, (err, conversations) => {
    if (err) {
      console.error('[GET_CONVERSATIONS_ERROR]', err);
      return res.status(500).json({
        success: false,
        message: 'Không thể tải danh sách cuộc trò chuyện'
      });
    }

    return res.status(200).json({
      success: true,
      data: conversations
    });
  });
};

exports.closeConversation = (req, res) => {
  const { conversationId } = req.params;

  chatModel.getConversationById(conversationId, (err, conversation) => {
    if (err) {
      console.error('[GET_CONVERSATION_ERROR]', err);
      return res.status(500).json({
        success: false,
        message: 'Không thể tải cuộc trò chuyện'
      });
    }

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Cuộc trò chuyện không tồn tại'
      });
    }

    if (Number(conversation.user_id) !== Number(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền đóng cuộc trò chuyện này'
      });
    }

    chatModel.closeConversation(conversationId, (closeErr) => {
      if (closeErr) {
        console.error('[CLOSE_CONVERSATION_ERROR]', closeErr);
        return res.status(500).json({
          success: false,
          message: 'Không thể đóng cuộc trò chuyện'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Cuộc trò chuyện đã được đóng'
      });
    });
  });
};

// ============================================================================
// Chat Messages
// ============================================================================

exports.sendMessage = (req, res) => {
  const { conversationId } = req.params;
  const { messageText, messageType = 'text' } = req.body;
  const userId = req.user.id;
  const normalizedMessage = (messageText || '').trim();

  if (!normalizedMessage) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng nhập nội dung tin nhắn'
    });
  }

  chatModel.getConversationById(conversationId, (err, conversation) => {
    if (err) {
      console.error('[GET_CONVERSATION_ERROR]', err);
      return res.status(500).json({
        success: false,
        message: 'Không thể tải cuộc trò chuyện'
      });
    }

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Cuộc trò chuyện không tồn tại'
      });
    }

    if (Number(conversation.user_id) !== Number(userId) && req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền gửi tin nhắn trong cuộc trò chuyện này'
      });
    }

    chatModel.createMessage(conversationId, 'customer', userId, normalizedMessage, messageType, null, (createErr, result) => {
      if (createErr) {
        console.error('[CREATE_MESSAGE_ERROR]', createErr);
        return res.status(500).json({
          success: false,
          message: 'Không thể gửi tin nhắn'
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Tin nhắn đã được gửi',
        messageId: result.insertId
      });
    });
  });
};

exports.getMessages = (req, res) => {
  const { conversationId } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  chatModel.getConversationById(conversationId, (err, conversation) => {
    if (err) {
      console.error('[GET_CONVERSATION_ERROR]', err);
      return res.status(500).json({
        success: false,
        message: 'Không thể tải cuộc trò chuyện'
      });
    }

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Cuộc trò chuyện không tồn tại'
      });
    }

    if (Number(conversation.user_id) !== Number(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem tin nhắn trong cuộc trò chuyện này'
      });
    }

    chatModel.getMessagesByConversationId(conversationId, Number(limit), Number(offset), (getErr, messages) => {
      if (getErr) {
        console.error('[GET_MESSAGES_ERROR]', getErr);
        return res.status(500).json({
          success: false,
          message: 'Không thể tải tin nhắn'
        });
      }

      chatModel.markMessagesAsRead(conversationId, (markErr) => {
        if (markErr) {
          console.error('[MARK_READ_ERROR]', markErr);
        }
      });

      return res.status(200).json({
        success: true,
        data: messages.reverse()
      });
    });
  });
};

// ============================================================================
// Chat Suggestions
// ============================================================================

exports.getSuggestions = (req, res) => {
  const { category } = req.query;

  chatModel.getSuggestions(category || null, (err, suggestions) => {
    if (err) {
      console.error('[GET_SUGGESTIONS_ERROR]', err);
      return res.status(500).json({
        success: false,
        message: 'Không thể tải gợi ý'
      });
    }

    return res.status(200).json({
      success: true,
      data: suggestions
    });
  });
};

// ============================================================================
// Chat FAQ
// ============================================================================

exports.searchFAQ = (req, res) => {
  const { keyword } = req.query;
  const normalizedKeyword = (keyword || '').trim();

  if (!normalizedKeyword) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng nhập từ khóa tìm kiếm'
    });
  }

  chatModel.searchFAQ(normalizedKeyword, (err, results) => {
    if (err) {
      console.error('[SEARCH_FAQ_ERROR]', err);
      return res.status(500).json({
        success: false,
        message: 'Không thể tìm kiếm câu hỏi'
      });
    }

    return res.status(200).json({
      success: true,
      data: results
    });
  });
};

exports.getFAQByCategory = (req, res) => {
  const { category } = req.params;

  chatModel.getFAQByCategory(category, (err, results) => {
    if (err) {
      console.error('[GET_FAQ_ERROR]', err);
      return res.status(500).json({
        success: false,
        message: 'Không thể tải câu hỏi'
      });
    }

    return res.status(200).json({
      success: true,
      data: results
    });
  });
};

// ============================================================================
// Chat Bot — AI Agent with MCP Pattern (Function Calling + Sentiment)
// ============================================================================

exports.chatWithBot = async (req, res) => {
  const { conversationId } = req.params;
  const { messageText } = req.body;
  const userId = req.user.id;
  const normalizedMessage = (messageText || '').trim();

  if (!normalizedMessage) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng nhập nội dung tin nhắn'
    });
  }

  try {
    const conversation = await getConversationByIdAsync(conversationId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Cuộc trò chuyện không tồn tại'
      });
    }

    if (Number(conversation.user_id) !== Number(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền trò chuyện trong cuộc hội thoại này'
      });
    }

    await createMessageAsync(conversationId, 'customer', userId, normalizedMessage, 'text', null);

    const [botResponses, faqs, services, suggestions, recentMessages] = await Promise.all([
      getAllBotResponsesAsync(),
      getAllFAQAsync(),
      getActiveServicesForChatAsync(),
      getSuggestionsAsync(null),
      getMessagesByConversationIdAsync(conversationId, 8, 0)
    ]);

    let finalReply = buildSmartRuleResponse({
      messageText: normalizedMessage,
      botResponses,
      faqs,
      services,
      suggestions
    });

    let sentiment = 'neutral';

    const shouldUseAI =
      isGeminiEnabled() &&
      (!finalReply || finalReply.source === 'fallback' || Number(finalReply.confidence || 0) < 1.2);

    if (shouldUseAI) {
      try {
        const aiResult = await generateSalonAIReply({
          messageText: normalizedMessage,
          recentMessages: Array.isArray(recentMessages) ? [...recentMessages].reverse() : [],
          services,
          faqs,
          suggestions,
          userId,
          toolExecutor: executeTool
        });

        if (aiResult && aiResult.text) {
          finalReply = {
            text: aiResult.text,
            type: 'text',
            source: aiResult.functionCalled ? 'ai-agent' : 'ai',
            escalated: aiResult.escalated || false,
            confidence: 2,
            toolsUsed: aiResult.toolsUsed || []
          };
          sentiment = aiResult.sentiment || 'neutral';
        }
      } catch (aiErr) {
        if (aiErr.isQuotaExceeded || aiErr.status === 429) {
          console.error('[GEMINI_QUOTA_EXCEEDED] Gemini quota/rate limit reached. Falling back to local chat rules.');
        } else {
          console.error('[GEMINI_CHAT_ERROR]', aiErr);
        }
      }
    }

    if (!finalReply) {
      finalReply = {
        text: 'Xin lỗi, mình chưa hiểu rõ yêu cầu này. Bạn có thể nhắn rõ hơn hoặc yêu cầu gặp nhân viên hỗ trợ.',
        type: 'text',
        source: 'fallback',
        escalated: false,
        confidence: 0
      };
    }

    await createMessageAsync(
      conversationId,
      'bot',
      null,
      finalReply.text,
      finalReply.type || 'text',
      finalReply.source ? { source: finalReply.source, sentiment } : null
    );

    if (finalReply.escalated || sentiment === 'complaint') {
      try {
        await updateConversationStatusAsync(conversationId, 'escalated', null);
      } catch (updateErr) {
        console.error('[UPDATE_CONVERSATION_ERROR]', updateErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Tin nhắn đã được xử lý',
      botResponse: {
        text: finalReply.text,
        type: finalReply.type || 'text',
        escalated: !!finalReply.escalated,
        source: finalReply.source || 'rule',
        sentiment,
        toolsUsed: finalReply.toolsUsed || []
      }
    });
  } catch (err) {
    console.error('[CHAT_WITH_BOT_ERROR]', err);
    return res.status(500).json({
      success: false,
      message: 'Không thể xử lý tin nhắn lúc này'
    });
  }
};
