const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

const isOpenAIEnabled = () => Boolean(process.env.OPENAI_API_KEY);

const truncate = (value = '', maxLength = 320) => {
  const text = String(value || '').trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3)}...`;
};

const buildKnowledgeSummary = ({ services = [], faqs = [], suggestions = [] }) => {
  const serviceLines = services
    .slice(0, 8)
    .map(
      (service) =>
        `- ${service.name} | ${service.category || 'Khác'} | ${Number(service.duration || 0)} phút | ${Number(
          service.price || 0
        )} VND`
    )
    .join('\n');

  const faqLines = faqs
    .slice(0, 8)
    .map((faq) => `- ${truncate(faq.question, 120)} => ${truncate(faq.answer, 160)}`)
    .join('\n');

  const suggestionLines = suggestions
    .slice(0, 6)
    .map((item) => `- ${item.title} (${item.action_type || 'text'})`)
    .join('\n');

  return [
    serviceLines ? `Dịch vụ hiện có:\n${serviceLines}` : '',
    faqLines ? `FAQ hiện có:\n${faqLines}` : '',
    suggestionLines ? `Gợi ý sẵn có:\n${suggestionLines}` : ''
  ]
    .filter(Boolean)
    .join('\n\n');
};

const buildRecentMessageSummary = (recentMessages = []) =>
  recentMessages
    .slice(-6)
    .map((message) => {
      const speaker =
        message.sender_type === 'customer'
          ? 'Khách'
          : message.sender_type === 'staff'
            ? 'Nhân viên'
            : 'Bot';

      return `${speaker}: ${truncate(message.message_text, 180)}`;
    })
    .join('\n');

const extractResponseText = (payload) => {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const outputItems = Array.isArray(payload?.output) ? payload.output : [];
  const textParts = [];

  outputItems.forEach((item) => {
    if (item?.type !== 'message' || !Array.isArray(item.content)) {
      return;
    }

    item.content.forEach((contentItem) => {
      if (contentItem?.type === 'output_text' && typeof contentItem.text === 'string') {
        textParts.push(contentItem.text.trim());
      }
    });
  });

  return textParts.join('\n').trim();
};

const generateSalonAIReply = async ({ messageText, recentMessages = [], services = [], faqs = [], suggestions = [] }) => {
  if (!isOpenAIEnabled()) {
    return null;
  }

  const instructions = [
    'Bạn là trợ lý chat của salon làm đẹp BeautyBook.',
    'Luôn trả lời bằng tiếng Việt có dấu, ngắn gọn, thân thiện và thực dụng.',
    'Nếu khách nhắn không dấu, bạn vẫn phải trả lời lại bằng tiếng Việt có dấu tự nhiên.',
    'Ưu tiên tuyệt đối thông tin trong dữ liệu salon được cung cấp.',
    'Nếu câu hỏi liên quan đến giá, thời gian, dịch vụ, lịch hẹn thì phải bám sát dữ liệu.',
    'Ưu tiên tự giải thích và hỏi làm rõ khi cần, không chuyển nhân viên quá sớm.',
    'Chỉ đề nghị gặp nhân viên khi khách yêu cầu rõ ràng, hoặc khi câu hỏi vượt quá dữ liệu hiện có và cần hỗ trợ chuyên sâu.',
    'Không được tự ý tạo ra chính sách, giá, khuyến mãi, thông tin liên hệ không có trong dữ liệu.'
  ].join(' ');

  const input = [
    'Ngữ cảnh salon:',
    buildKnowledgeSummary({ services, faqs, suggestions }),
    '',
    recentMessages.length > 0 ? `Hội thoại gần đây:\n${buildRecentMessageSummary(recentMessages)}` : '',
    '',
    `Khách vừa hỏi: ${messageText}`,
    'Hãy trả lời nhất quán với dữ liệu trên.'
  ]
    .filter(Boolean)
    .join('\n');

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      instructions,
      input
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
  }

  const payload = await response.json();
  return extractResponseText(payload) || null;
};

module.exports = {
  isOpenAIEnabled,
  generateSalonAIReply
};
