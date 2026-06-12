import React, { useEffect, useRef, useState, useMemo } from 'react';
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
  'gặp nhân viên tư vấn': 'Gặp hỗ trợ viên',
  'dat lich nhanh': 'Đặt lịch nhanh',
  'cat toc nam': 'Cắt tóc nam',
  'nhuom toc': 'Nhuộm tóc',
  'massage thu gian': 'Massage thư giãn',
  'cham soc da cap am': 'Chăm sóc da cấp ẩm'
};

const TOOL_LABELS = {
  check_availability: { icon: '📅', label: 'Đang kiểm tra lịch trống...' },
  get_service_details: { icon: '✨', label: 'Đang tìm thông tin dịch vụ...' },
  create_booking: { icon: '📝', label: 'Đang tạo lịch hẹn...' },
  get_my_appointments: { icon: '📋', label: 'Đang tải lịch hẹn...' },
  cancel_booking: { icon: '❌', label: 'Đang xử lý yêu cầu hủy...' },
  get_promotions: { icon: '🎁', label: 'Đang tìm khuyến mãi...' },
  get_staff_info: { icon: '👩‍💼', label: 'Đang tìm thông tin nhân viên...' },
  get_business_hours: { icon: '🕒', label: 'Đang tải giờ làm việc...' }
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

// =============================================================================
// Lightweight Markdown Renderer (no external dependencies)
// =============================================================================

const renderMarkdown = (text) => {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check for table start
    if (line.includes('|') && i + 1 < lines.length && lines[i + 1]?.match(/^\s*\|[\s-:|]+\|/)) {
      const tableLines = [line];
      let j = i + 1;
      while (j < lines.length && lines[j].includes('|')) {
        tableLines.push(lines[j]);
        j++;
      }

      if (tableLines.length >= 3) {
        const headerCells = tableLines[0].split('|').map(c => c.trim()).filter(Boolean);
        const bodyRows = tableLines.slice(2).map(row =>
          row.split('|').map(c => c.trim()).filter(Boolean)
        );

        elements.push(
          <div className="chatbot-md-table-wrap" key={`tbl-${i}`}>
            <table className="chatbot-md-table">
              <thead>
                <tr>
                  {headerCells.map((cell, ci) => (
                    <th key={ci}>{renderInline(cell)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci}>{renderInline(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        i = j;
        continue;
      }
    }

    // Unordered list
    if (line.match(/^\s*[-*]\s+/)) {
      const listItems = [];
      let j = i;
      while (j < lines.length && lines[j].match(/^\s*[-*]\s+/)) {
        listItems.push(lines[j].replace(/^\s*[-*]\s+/, ''));
        j++;
      }
      elements.push(
        <ul className="chatbot-md-list" key={`ul-${i}`}>
          {listItems.map((item, li) => (
            <li key={li}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      i = j;
      continue;
    }

    // Empty line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Normal paragraph
    elements.push(
      <p className="chatbot-md-p" key={`p-${i}`}>
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return elements;
};

const renderInline = (text) => {
  if (!text) return null;

  // Process inline markdown: **bold**, *italic*, `code`, emoji
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, boldMatch.index)}</span>);
      }
      parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      continue;
    }

    // Inline code: `text`
    const codeMatch = remaining.match(/`(.+?)`/);
    if (codeMatch && codeMatch.index !== undefined) {
      if (codeMatch.index > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, codeMatch.index)}</span>);
      }
      parts.push(<code className="chatbot-md-code" key={key++}>{codeMatch[1]}</code>);
      remaining = remaining.slice(codeMatch.index + codeMatch[0].length);
      continue;
    }

    // No more markdown — emit rest
    parts.push(<span key={key++}>{remaining}</span>);
    break;
  }

  return parts;
};

// =============================================================================
// Tool Execution Indicator
// =============================================================================

const ToolIndicator = ({ toolName }) => {
  const info = TOOL_LABELS[toolName] || { icon: '🔧', label: 'Đang xử lý...' };
  return (
    <div className="chatbot-tool-indicator">
      <span className="chatbot-tool-icon">{info.icon}</span>
      <span className="chatbot-tool-label">{info.label}</span>
      <span className="chatbot-tool-dots">
        <span></span><span></span><span></span>
      </span>
    </div>
  );
};

// =============================================================================
// Quick Action Buttons (after bot response)
// =============================================================================

const QuickActions = ({ toolsUsed, onAction }) => {
  const actions = useMemo(() => {
    if (!toolsUsed || toolsUsed.length === 0) return [];

    const result = [];
    for (const tool of toolsUsed) {
      if (tool.name === 'get_service_details' && tool.success) {
        result.push({ label: '📅 Đặt lịch ngay', message: 'Mình muốn đặt lịch' });
        result.push({ label: '💰 Xem khuyến mãi', message: 'Có khuyến mãi gì không?' });
      }
      if (tool.name === 'check_availability' && tool.success) {
        result.push({ label: '📝 Đặt lịch ngay', message: 'Mình muốn đặt lịch' });
      }
      if (tool.name === 'get_my_appointments' && tool.success) {
        result.push({ label: '❌ Hủy lịch', message: 'Mình muốn hủy lịch' });
      }
      if (tool.name === 'create_booking' && tool.success) {
        result.push({ label: '📋 Xem lịch hẹn', message: 'Xem lịch hẹn của mình' });
      }
    }

    // Deduplicate
    const seen = new Set();
    return result.filter(a => {
      if (seen.has(a.label)) return false;
      seen.add(a.label);
      return true;
    }).slice(0, 3);
  }, [toolsUsed]);

  if (actions.length === 0) return null;

  return (
    <div className="chatbot-quick-actions">
      {actions.map((action, idx) => (
        <button
          key={idx}
          className="chatbot-quick-action-btn"
          onClick={() => onAction(action.message)}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
};

// =============================================================================
// Main ChatBot Component
// =============================================================================

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
  const [activeToolName, setActiveToolName] = useState(null);
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
              'Xin chào! 👋 Mình là trợ lý AI của **BeautyBook Salon**.\n\nMình có thể giúp bạn:\n- ✨ Tìm dịch vụ & xem giá\n- 📅 Kiểm tra lịch trống & đặt lịch\n- 📋 Xem/hủy lịch hẹn\n- 🎁 Xem khuyến mãi\n- 🕒 Giờ làm việc\n\nBạn cần hỗ trợ gì?',
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
  }, [messages, activeToolName]);

  const sendChatMessage = async (rawMessage) => {
    const userMessage = String(rawMessage || '').trim();

    if (!userMessage || !conversationId || loading) {
      return;
    }

    setInputValue('');
    setLoading(true);
    setActiveToolName(null);

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
      const botResponse = response.data.botResponse;

      setActiveToolName(null);

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender_type: 'bot',
          message_text: botResponse.text,
          bookingData: botResponse.bookingData || null,
          toolsUsed: botResponse.toolsUsed || [],
          source: botResponse.source || 'rule',
          created_at: new Date().toISOString()
        }
      ]);

      if (botResponse.escalated) {
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
      setActiveToolName(null);
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
            message_text: `Dưới đây là các câu hỏi thường gặp về "**${suggestion.title}**":`,
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

  const handleQuickAction = (message) => {
    sendChatMessage(message);
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatCurrency = (value) =>
    Number(value || 0).toLocaleString('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    });

  const renderBookingCard = (bookingData) => {
    if (!bookingData) {
      return null;
    }

    return (
      <div className="chatbot-booking-card">
        <div className="chatbot-booking-card-head">
          <strong>Booking #{bookingData.appointment_id}</strong>
          <span>{bookingData.deposit_required ? 'Cần cọc' : 'Chờ xác nhận'}</span>
        </div>
        <dl>
          <div>
            <dt>Dịch vụ</dt>
            <dd>{bookingData.service}</dd>
          </div>
          <div>
            <dt>Thời gian</dt>
            <dd>{bookingData.date} {bookingData.time}</dd>
          </div>
          <div>
            <dt>Nhân viên</dt>
            <dd>{bookingData.staff || 'Tự động'}</dd>
          </div>
          <div>
            <dt>Tạm tính</dt>
            <dd>{formatCurrency(bookingData.price)}</dd>
          </div>
        </dl>
        {bookingData.deposit_required && (
          <p>AI yêu cầu cọc {formatCurrency(bookingData.deposit_amount)} để giữ chỗ.</p>
        )}
      </div>
    );
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

  const renderSourceBadge = (source) => {
    if (!source || source === 'rule' || source === 'fallback') return null;
    const badges = {
      'ai-agent': { label: 'AI Agent', cls: 'agent' },
      'ai': { label: 'AI', cls: 'ai' },
      'faq': { label: 'FAQ', cls: 'faq' }
    };
    const badge = badges[source];
    if (!badge) return null;
    return <span className={`chatbot-source-badge chatbot-source-${badge.cls}`}>{badge.label}</span>;
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
                <h3>AI Trợ lý BeautyBook</h3>
                <small>🟢 Trực tuyến — MCP AI Agent</small>
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
                  <div className="chatbot-message-bubble">
                    {message.sender_type === 'bot'
                      ? renderMarkdown(message.message_text)
                      : message.message_text
                    }
                  </div>
                  {renderBookingCard(message.bookingData)}
                  {message.sender_type === 'bot' && message.toolsUsed && message.toolsUsed.length > 0 && (
                    <QuickActions toolsUsed={message.toolsUsed} onAction={handleQuickAction} />
                  )}
                  <div className="chatbot-message-meta">
                    <span className="chatbot-message-time">{formatTime(message.created_at)}</span>
                    {message.sender_type === 'bot' && renderSourceBadge(message.source)}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="chatbot-message bot">
                <div className="chatbot-message-bubble">
                  {activeToolName ? (
                    <ToolIndicator toolName={activeToolName} />
                  ) : (
                    <div className="chatbot-loading">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  )}
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
              placeholder="Nhập tin nhắn... (VD: giá cắt tóc, đặt lịch)"
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
