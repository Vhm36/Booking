const db = require('../../config/db');
const { normalizeText } = require('../../utils/chatResponseEngine');

// ============================================================================
// Chat Conversations
// ============================================================================

const createConversation = (userId, subject, callback) => {
  const query = `
    INSERT INTO chat_conversations (user_id, subject, status)
    VALUES (?, ?, 'open')
  `;
  db.query(query, [userId, subject || null], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

const getConversationById = (conversationId, callback) => {
  const query = `
    SELECT 
      cc.*,
      u.name AS customer_name,
      u.email AS customer_email,
      st.name AS staff_name
    FROM chat_conversations cc
    JOIN users u ON cc.user_id = u.id
    LEFT JOIN users st ON cc.assigned_staff_id = st.id
    WHERE cc.id = ?
  `;
  db.query(query, [conversationId], (err, results) => {
    if (err) return callback(err);
    callback(null, results[0] || null);
  });
};

const getConversationsByUserId = (userId, callback) => {
  const query = `
    SELECT 
      cc.*,
      u.name AS customer_name,
      st.name AS staff_name,
      (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = cc.id AND is_read = 0) AS unread_count
    FROM chat_conversations cc
    JOIN users u ON cc.user_id = u.id
    LEFT JOIN users st ON cc.assigned_staff_id = st.id
    WHERE cc.user_id = ?
    ORDER BY cc.updated_at DESC
  `;
  db.query(query, [userId], (err, results) => {
    if (err) return callback(err);
    callback(null, results || []);
  });
};

const updateConversationStatus = (conversationId, status, assignedStaffId, callback) => {
  const query = `
    UPDATE chat_conversations
    SET status = ?, assigned_staff_id = ?, updated_at = NOW()
    WHERE id = ?
  `;
  db.query(query, [status, assignedStaffId || null, conversationId], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

const closeConversation = (conversationId, callback) => {
  const query = `
    UPDATE chat_conversations
    SET status = 'closed', closed_at = NOW(), updated_at = NOW()
    WHERE id = ?
  `;
  db.query(query, [conversationId], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

// ============================================================================
// Chat Messages
// ============================================================================

const createMessage = (conversationId, senderType, senderId, messageText, messageType, metadata, callback) => {
  const query = `
    INSERT INTO chat_messages (conversation_id, sender_type, sender_id, message_text, message_type, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  const metadataJson = metadata ? JSON.stringify(metadata) : null;
  db.query(query, [conversationId, senderType, senderId || null, messageText, messageType, metadataJson], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

const getMessagesByConversationId = (conversationId, limit = 50, offset = 0, callback) => {
  const query = `
    SELECT 
      cm.*,
      u.name AS sender_name,
      u.email AS sender_email
    FROM chat_messages cm
    LEFT JOIN users u ON cm.sender_id = u.id
    WHERE cm.conversation_id = ?
    ORDER BY cm.created_at DESC
    LIMIT ? OFFSET ?
  `;
  db.query(query, [conversationId, limit, offset], (err, results) => {
    if (err) return callback(err);
    callback(null, results || []);
  });
};

const markMessagesAsRead = (conversationId, callback) => {
  const query = `
    UPDATE chat_messages
    SET is_read = 1
    WHERE conversation_id = ? AND is_read = 0
  `;
  db.query(query, [conversationId], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

// ============================================================================
// Chat Suggestions
// ============================================================================

const getSuggestions = (category = null, callback) => {
  let query = `
    SELECT *
    FROM chat_suggestions
    WHERE is_active = 1
  `;
  const params = [];

  if (category) {
    query += ` AND category = ?`;
    params.push(category);
  }

  query += ` ORDER BY priority DESC, id ASC LIMIT 10`;

  db.query(query, params, (err, results) => {
    if (err) return callback(err);
    callback(null, results || []);
  });
};

const getAllSuggestions = (callback) => {
  const query = `
    SELECT *
    FROM chat_suggestions
    WHERE is_active = 1
    ORDER BY category ASC, priority DESC
  `;
  db.query(query, (err, results) => {
    if (err) return callback(err);
    callback(null, results || []);
  });
};

// ============================================================================
// Chat FAQ
// ============================================================================

const getFAQByCategory = (category, callback) => {
  const query = `
    SELECT *
    FROM chat_faq
    WHERE category = ? AND is_active = 1
    ORDER BY view_count DESC
  `;
  db.query(query, [category], (err, results) => {
    if (err) return callback(err);
    callback(null, results || []);
  });
};

const getAllFAQ = (callback) => {
  const query = `
    SELECT *
    FROM chat_faq
    WHERE is_active = 1
    ORDER BY view_count DESC, id ASC
  `;

  db.query(query, (err, results) => {
    if (err) return callback(err);
    callback(null, results || []);
  });
};

const scoreFaqSearch = (faq, normalizedKeyword) => {
  const question = normalizeText(faq.question);
  const answer = normalizeText(faq.answer);
  const keywords = normalizeText(faq.keywords || '');
  const category = normalizeText(faq.category || '');
  const keywordTokens = normalizedKeyword.split(' ').filter(Boolean);
  const haystack = `${question} ${answer} ${keywords} ${category}`.trim();

  if (!haystack || keywordTokens.length === 0) {
    return 0;
  }

  let score = 0;

  if (question.includes(normalizedKeyword)) {
    score += 5;
  }

  if (keywords.includes(normalizedKeyword)) {
    score += 4;
  }

  if (category.includes(normalizedKeyword)) {
    score += 3;
  }

  if (answer.includes(normalizedKeyword)) {
    score += 2;
  }

  keywordTokens.forEach((token) => {
    if (question.includes(token)) {
      score += 1.4;
    } else if (keywords.includes(token)) {
      score += 1.2;
    } else if (category.includes(token)) {
      score += 1;
    } else if (answer.includes(token)) {
      score += 0.4;
    }
  });

  return score;
};

const searchFAQ = (keyword, callback) => {
  const query = `
    SELECT *
    FROM chat_faq
    WHERE is_active = 1
    ORDER BY view_count DESC, id ASC
  `;
  const normalizedKeyword = normalizeText(keyword);

  db.query(query, (err, results) => {
    if (err) return callback(err);

    const rankedResults = (results || [])
      .map((faq) => ({
        faq,
        score: scoreFaqSearch(faq, normalizedKeyword)
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        if ((b.faq.view_count || 0) !== (a.faq.view_count || 0)) {
          return (b.faq.view_count || 0) - (a.faq.view_count || 0);
        }

        return (a.faq.id || 0) - (b.faq.id || 0);
      })
      .slice(0, 10)
      .map((item) => item.faq);

    callback(null, rankedResults);
  });
};

const getActiveServicesForChat = (callback) => {
  const query = `
    SELECT id, name, description, price, duration, category, status
    FROM services
    WHERE status = 'active' OR status IS NULL
    ORDER BY category ASC, name ASC
  `;

  db.query(query, (err, results) => {
    if (err) return callback(err);
    callback(null, results || []);
  });
};

const incrementFAQViewCount = (faqId, callback) => {
  const query = `
    UPDATE chat_faq
    SET view_count = view_count + 1
    WHERE id = ?
  `;
  db.query(query, [faqId], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

// ============================================================================
// Chat Bot Responses
// ============================================================================

const getBotResponse = (keyword, callback) => {
  const query = `
    SELECT *
    FROM chat_bot_responses
    WHERE is_active = 1
      AND (
        FIND_IN_SET(?, REPLACE(trigger_keyword, '|', ',')) > 0
        OR trigger_keyword LIKE ?
      )
    ORDER BY confidence_score DESC
    LIMIT 1
  `;
  const likeKeyword = `%${keyword}%`;
  db.query(query, [keyword, likeKeyword], (err, results) => {
    if (err) return callback(err);
    callback(null, results[0] || null);
  });
};

const getAllBotResponses = (callback) => {
  const query = `
    SELECT *
    FROM chat_bot_responses
    WHERE is_active = 1
    ORDER BY confidence_score DESC
  `;
  db.query(query, (err, results) => {
    if (err) return callback(err);
    callback(null, results || []);
  });
};

module.exports = {
  // Conversations
  createConversation,
  getConversationById,
  getConversationsByUserId,
  updateConversationStatus,
  closeConversation,
  
  // Messages
  createMessage,
  getMessagesByConversationId,
  markMessagesAsRead,
  
  // Suggestions
  getSuggestions,
  getAllSuggestions,
  
  // FAQ
  getFAQByCategory,
  getAllFAQ,
  searchFAQ,
  incrementFAQViewCount,
  getActiveServicesForChat,
  
  // Bot Responses
  getBotResponse,
  getAllBotResponses
};
