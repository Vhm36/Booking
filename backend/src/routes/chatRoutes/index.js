const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const router = express.Router();
const chatController = require('../../controllers/chatController');
const { verifyToken } = require('../../middleware/authMiddleware');

const chatBotLimiter = rateLimit({
  windowMs: Number(process.env.CHATBOT_RATE_LIMIT_WINDOW_MS || 60 * 1000),
  max: Number(process.env.CHATBOT_RATE_LIMIT_MAX || 8),
  keyGenerator: (req) => (req.user?.id ? `user:${req.user.id}` : ipKeyGenerator(req.ip)),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Bạn gửi tin nhắn hơi nhanh, vui lòng thử lại sau ít phút.'
  }
});

// ============================================================================
// Chat Conversations
// ============================================================================

// Start a new conversation
router.post('/conversations', verifyToken, chatController.startConversation);

// Get a specific conversation
router.get('/conversations/:conversationId', verifyToken, chatController.getConversation);

// Get all conversations for current user
router.get('/conversations', verifyToken, chatController.getMyConversations);

// Close a conversation
router.put('/conversations/:conversationId/close', verifyToken, chatController.closeConversation);

// ============================================================================
// Chat Messages
// ============================================================================

// Send a message
router.post('/conversations/:conversationId/messages', verifyToken, chatController.sendMessage);

// Get messages from a conversation
router.get('/conversations/:conversationId/messages', verifyToken, chatController.getMessages);

// ============================================================================
// Chat with Bot
// ============================================================================

// Chat with bot (auto-response)
router.post('/conversations/:conversationId/chat-bot', verifyToken, chatBotLimiter, chatController.chatWithBot);

// ============================================================================
// Chat Suggestions
// ============================================================================

// Get suggestions
router.get('/suggestions', chatController.getSuggestions);

// ============================================================================
// Chat FAQ
// ============================================================================

// Search FAQ
router.get('/faq/search', chatController.searchFAQ);

// Get FAQ by category
router.get('/faq/category/:category', chatController.getFAQByCategory);

module.exports = router;
