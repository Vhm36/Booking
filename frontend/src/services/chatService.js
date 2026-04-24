import api from './api';

const chatService = {
  // ============================================================================
  // Conversations
  // ============================================================================

  startConversation: (subject) => {
    return api.post('/chat/conversations', { subject });
  },

  getConversation: (conversationId) => {
    return api.get(`/chat/conversations/${conversationId}`);
  },

  getMyConversations: () => {
    return api.get('/chat/conversations');
  },

  closeConversation: (conversationId) => {
    return api.put(`/chat/conversations/${conversationId}/close`);
  },

  // ============================================================================
  // Messages
  // ============================================================================

  sendMessage: (conversationId, messageText, messageType = 'text') => {
    return api.post(`/chat/conversations/${conversationId}/messages`, {
      messageText,
      messageType
    });
  },

  getMessages: (conversationId, limit = 50, offset = 0) => {
    return api.get(`/chat/conversations/${conversationId}/messages`, {
      params: { limit, offset }
    });
  },

  // ============================================================================
  // Chat with Bot
  // ============================================================================

  chatWithBot: (conversationId, messageText) => {
    return api.post(`/chat/conversations/${conversationId}/chat-bot`, {
      messageText
    });
  },

  // ============================================================================
  // Suggestions
  // ============================================================================

  getSuggestions: (category = null) => {
    const params = category ? { category } : {};
    return api.get('/chat/suggestions', { params });
  },

  // ============================================================================
  // FAQ
  // ============================================================================

  searchFAQ: (keyword) => {
    return api.get('/chat/faq/search', {
      params: { keyword }
    });
  },

  getFAQByCategory: (category) => {
    return api.get(`/chat/faq/category/${category}`);
  }
};

export default chatService;
