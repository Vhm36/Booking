import React, { useEffect, useRef, useState } from 'react';
import chatService from '../../services/chatService';
import authService from '../../services/authService';
import './ChatBot.css';

const ChatbotRobotIcon = ({ className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    aria-hidden="true"
    focusable="false"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 4v3" />
    <path d="M9.5 4h5" />
    <rect x="4.75" y="7.5" width="14.5" height="11.5" rx="4.5" />
    <circle cx="9.25" cy="12.5" r="0.75" fill="currentColor" />
    <circle cx="14.75" cy="12.5" r="0.75" fill="currentColor" />
    <path d="M9 16h6" />
    <path d="M4.75 11h-1.5" />
    <path d="M20.75 11h-1.5" />
  </svg>
);

const suggestionIconMap = {
  scissors: '✂',
  palette: '🎨',
  calendar: '📅',
  headset: '🎧',
  clock: '🕒',
  gift: '🎁',
  sparkles: '✨',
  hand: '💆'
};

const suggestionLabelFallbacks = {
  'gap nhan vien tu van': 'Gặp hỗ trợ viên',
  'g?p nh?n vi?n t? v?n': 'Gặp hỗ trợ viên',
  'dat lich nhanh': 'Đặt lịch nhanh',
  'cat toc nam': 'Cắt tóc nam',
  'nhuom toc': 'Nhuộm tóc',
  'massage thu gian': 'Massage thư giãn',
  'cham soc da cap am': 'Chăm sóc da cấp ẩm'
};

const normalizeSuggestionKey = (value = '') =>
  String(value)
    .replace(/\u0110/g, 'D')
    .replace(/\u0111/g, 'd')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const sanitizeSuggestionTitle = (suggestion) => {
  const rawTitle = String(suggestion?.title || '').trim();
  const normalizedKey = normalizeSuggestionKey(rawTitle);

  if (suggestionLabelFallbacks[normalizedKey]) {
    return suggestionLabelFallbacks[normalizedKey];
  }

  if (rawTitle.includes('?')) {
    if (suggestion?.icon === 'headset' || suggestion?.action_type === 'contact') {
      return 'Gặp hỗ trợ viên';
    }

    if (suggestion?.icon === 'calendar' || suggestion?.action_type === 'booking') {
      return 'Đặt lịch nhanh';
    }
  }

  return rawTitle;
};

function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [faqResults, setFaqResults] = useState([]);
  const [unreadCount] = useState(0);
  const messagesEndRef = useRef(null);
  const isAuthenticated = authService.getToken();

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const initializeChat = async () => {
      setIsInitializing(true);
      setConversationId(null);
      setFaqResults([]);

      try {
        const response = await chatService.startConversation('Hỗ trợ khách hàng');
        setConversationId(response.data.conversationId);

        const suggestionsResponse = await chatService.getSuggestions();
        setSuggestions(suggestionsResponse.data.data || []);

        setMessages([
          {
            id: 0,
            sender_type: 'bot',
            message_text:
              'Xin chào! Mình là trợ lý ảo của salon. Mình có thể giúp bạn về dịch vụ, giá, lịch hẹn hoặc khuyến mãi.',
            created_at: new Date().toISOString()
          }
        ]);
      } catch (err) {
        console.error('[INIT_CHAT_ERROR]', err);
        setMessages([
          {
            id: 0,
            sender_type: 'system',
            message_text: 'Không thể kết nối chatbot lúc này. Vui lòng thử lại sau.',
            created_at: new Date().toISOString()
          }
        ]);
      } finally {
        setIsInitializing(false);
      }
    };

    if (isOpen) {
      initializeChat();
    }
  }, [isOpen, isAuthenticated]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendChatMessage = async (rawMessage) => {
    const userMessage = String(rawMessage || '').trim();

    if (!userMessage || !conversationId || loading) {
      return;
    }

    setInputValue('');
    setLoading(true);

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        sender_type: 'customer',
        message_text: userMessage,
        created_at: new Date().toISOString()
      }
    ]);

    try {
      const response = await chatService.chatWithBot(conversationId, userMessage);

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender_type: 'bot',
          message_text: response.data.botResponse.text,
          created_at: new Date().toISOString()
        }
      ]);

      if (response.data.botResponse.escalated) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 2,
            sender_type: 'system',
            message_text:
              'Cuộc trò chuyện của bạn đã được chuyển đến nhân viên hỗ trợ. Vui lòng chờ trong giây lát.',
            created_at: new Date().toISOString()
          }
        ]);
      }
    } catch (err) {
      console.error('[SEND_MESSAGE_ERROR]', err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender_type: 'bot',
          message_text: 'Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại sau.',
          created_at: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    await sendChatMessage(inputValue);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    handleSendMessage();
  };

  const handleSuggestionClick = async (suggestion) => {
    setInputValue('');

    if (suggestion.action_type === 'faq') {
      try {
        const response = await chatService.getFAQByCategory(suggestion.title);
        setFaqResults(response.data.data || []);

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            sender_type: 'bot',
            message_text: `Dưới đây là các câu hỏi thường gặp về "${suggestion.title}":`,
            created_at: new Date().toISOString()
          }
        ]);
      } catch (err) {
        console.error('[GET_FAQ_ERROR]', err);
      }
      return;
    }

    await sendChatMessage(sanitizeSuggestionTitle(suggestion));
  };

  const handleFAQClick = (faq) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        sender_type: 'customer',
        message_text: faq.question,
        created_at: new Date().toISOString()
      },
      {
        id: Date.now() + 1,
        sender_type: 'bot',
        message_text: faq.answer,
        created_at: new Date().toISOString()
      }
    ]);
    setFaqResults([]);
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const renderSuggestionIcon = (iconKey) => {
    const icon = suggestionIconMap[String(iconKey || '').trim().toLowerCase()];
    if (!icon) {
      return null;
    }

    return (
      <span className="chatbot-suggestion-icon" aria-hidden="true">
        {icon}
      </span>
    );
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          className="chatbot-toggle-btn"
          onClick={() => setIsOpen(true)}
          aria-label="Mở hỗ trợ khách hàng"
          title="Hỗ trợ khách hàng"
        >
          <ChatbotRobotIcon className="chatbot-toggle-icon" />
          <span className="chatbot-sr-only">Hỗ trợ khách hàng</span>
          {unreadCount > 0 && <span className="chatbot-badge">{unreadCount}</span>}
        </button>
      )}

      {isOpen && (
        <div className="chatbot-container">
          <div className="chatbot-header">
            <div className="chatbot-header-title">
              <span className="chatbot-header-avatar">
                <ChatbotRobotIcon className="chatbot-header-icon" />
              </span>
              <div>
                <h3>Hỗ trợ khách hàng</h3>
                <small>Trực tuyến</small>
              </div>
            </div>
            <button
              type="button"
              className="chatbot-header-close"
              onClick={() => setIsOpen(false)}
              aria-label="Đóng hộp hỗ trợ"
            >
              Đóng
            </button>
          </div>

          <div className="chatbot-messages">
            {messages.map((message) => (
              <div key={message.id} className={`chatbot-message ${message.sender_type}`}>
                <div>
                  <div className="chatbot-message-bubble">{message.message_text}</div>
                  <div className="chatbot-message-time">{formatTime(message.created_at)}</div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="chatbot-message bot">
                <div className="chatbot-message-bubble">
                  <div className="chatbot-loading">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}

            {faqResults.length > 0 && (
              <div className="chatbot-message bot">
                <div className="chatbot-faq-section">
                  <div className="chatbot-faq-title">Câu hỏi thường gặp</div>
                  <div className="chatbot-faq-items">
                    {faqResults.map((faq) => (
                      <button
                        key={faq.id}
                        className="chatbot-faq-item"
                        onClick={() => handleFAQClick(faq)}
                      >
                        {faq.question}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.length === 1 && suggestions.length > 0 && (
              <div className="chatbot-message bot">
                <div className="chatbot-suggestions">
                  {suggestions.slice(0, 4).map((suggestion) => (
                    <button
                      key={suggestion.id}
                      className="chatbot-suggestion-btn"
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      {renderSuggestionIcon(suggestion.icon)}
                      {sanitizeSuggestionTitle(suggestion)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form className="chatbot-input-area" onSubmit={handleSubmit}>
            <input
              type="text"
              className="chatbot-input"
              placeholder="Nhập tin nhắn..."
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              disabled={loading || isInitializing || !conversationId}
            />
            <button
              type="submit"
              className="chatbot-send-btn"
              disabled={loading || isInitializing || !conversationId || !inputValue.trim()}
            >
              Gửi
            </button>
          </form>
        </div>
      )}
    </>
  );
}

export default ChatBot;
