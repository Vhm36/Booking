const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const { getToolsForOpenAI, executeTool } = require('../toolRegistry');

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
    .slice(-8)
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

// =============================================================================
// Enhanced System Prompt — MCP Pattern
// =============================================================================

const SYSTEM_PROMPT = `Bạn là trợ lý chat AI thông minh của salon làm đẹp BeautyBook — được tích hợp với hệ thống đặt lịch qua Function Calling.

NGUYÊN TẮC HOẠT ĐỘNG (MCP Pattern):
1. Phân tích câu hỏi của khách hàng
2. Chọn tool phù hợp trong danh sách có sẵn
3. Gọi tool với tham số chính xác
4. Phân tích kết quả trả về và trả lời bằng tiếng Việt có dấu

CÁC TOOL CÓ SẴN:
- check_availability: Kiểm tra lịch trống vào ngày/giờ cụ thể
- get_service_details: Tìm thông tin dịch vụ (giá, thời gian, mô tả)
- create_booking: Tạo lịch hẹn mới (CHỈ khi khách đã xác nhận đủ thông tin)
- get_my_appointments: Xem lịch hẹn sắp tới của khách
- cancel_booking: Gửi yêu cầu hủy lịch hẹn
- get_promotions: Xem voucher/khuyến mãi đang có
- get_staff_info: Thông tin nhân viên dịch vụ
- get_business_hours: Giờ làm việc của salon

QUY TẮC BẢO MẬT:
- LUÔN sử dụng tools được cung cấp, KHÔNG tự tạo dữ liệu
- KHÔNG bịa giá, dịch vụ, khuyến mãi không có trong dữ liệu
- Với create_booking: BẮT BUỘC hỏi xác nhận trước khi gọi
- Với cancel_booking: Hỏi rõ mã lịch hẹn và xác nhận

QUY TẮC TRẢ LỜI:
- Trả lời bằng tiếng Việt có dấu, ngắn gọn, thân thiện
- Nếu khách nhắn không dấu, vẫn trả lời có dấu
- Ưu tiên dữ liệu từ salon, không bịa chính sách

QUY TẮC ĐỊNH DẠNG (CỰC KỲ QUAN TRỌNG):
⚠️ BẮT BUỘC: Sử dụng Markdown để format. Mỗi dòng bảng phải xuống hàng riêng!

✅ Khi hiển thị danh sách dịch vụ, dùng bảng:
| Dịch vụ | Giá | Thời gian |
|---------|-----|-----------|
| Cắt tóc | 100.000 VNĐ | 30 phút |

✅ Khi hiển thị lịch hẹn, dùng bảng:
| Mã | Dịch vụ | Ngày | Giờ | Trạng thái |
|----|---------|------|-----|------------|
| #1 | Cắt tóc | 2025-01-01 | 10:00 | Chờ xác nhận |

✅ Khi tạo booking thành công:
📅 **Đặt lịch thành công!**
- **Mã lịch hẹn:** #ID
- **Dịch vụ:** Tên
- **Thời gian:** Ngày + Giờ
- **Nhân viên:** Tên
- **Tạm tính:** Giá

✅ Format chung:
- Dùng **bold** cho thông tin quan trọng
- Dùng emoji phù hợp: 📅 lịch hẹn, 💰 giá, ⏱ thời gian, ✨ dịch vụ, 🎁 khuyến mãi
- Kết thúc bằng gợi ý hành động tiếp theo khi phù hợp

QUAN TRỌNG: Trong mỗi phản hồi, bạn PHẢI thêm một dòng cuối cùng với format:
[SENTIMENT: positive|neutral|negative|complaint]
Dựa trên cảm xúc/thái độ của khách hàng trong tin nhắn.`;

// =============================================================================
// Main AI Reply — MCP Pattern with Function Calling + Sentiment
// =============================================================================

const generateSalonAIReply = async ({
  messageText,
  recentMessages = [],
  services = [],
  faqs = [],
  suggestions = [],
  userId = null,
  toolExecutor = null
}) => {
  if (!isOpenAIEnabled()) {
    return null;
  }

  const contextMessage = [
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

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: contextMessage }
  ];

  // Get tools from registry
  const tools = getToolsForOpenAI();
  const useTools = toolExecutor && tools.length > 0;

  try {
    let response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        tools: useTools ? tools : undefined,
        tool_choice: useTools ? 'auto' : undefined,
        temperature: 0.7,
        max_tokens: 800
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
    }

    let data = await response.json();
    let choice = data.choices?.[0];
    let toolsUsed = [];

    // Handle tool calls (Function Calling — MCP Pattern)
    if (choice?.finish_reason === 'tool_calls' && choice.message?.tool_calls && toolExecutor) {
      const toolCalls = choice.message.tool_calls;
      const toolMessages = [choice.message]; // assistant message with tool_calls

      for (const toolCall of toolCalls) {
        const fnName = toolCall.function.name;
        let fnArgs = {};
        try {
          fnArgs = JSON.parse(toolCall.function.arguments);
        } catch (e) {
          fnArgs = {};
        }

        console.log(`[AI Agent] 🔧 Calling function: ${fnName}`, fnArgs);

        let fnResult;
        try {
          fnResult = await toolExecutor(fnName, fnArgs, userId);
        } catch (fnErr) {
          fnResult = { error: fnErr.message };
        }

        toolsUsed.push({
          name: fnName,
          args: fnArgs,
          success: !fnResult?.error
        });

        toolMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(fnResult)
        });
      }

      // Second call with tool results
      const secondResponse = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [...messages, ...toolMessages],
          temperature: 0.7,
          max_tokens: 800
        })
      });

      if (secondResponse.ok) {
        data = await secondResponse.json();
        choice = data.choices?.[0];
      }
    }

    const rawText = choice?.message?.content || '';

    // Extract sentiment from response
    const sentimentMatch = rawText.match(/\[SENTIMENT:\s*(positive|neutral|negative|complaint)\]/i);
    const sentiment = sentimentMatch ? sentimentMatch[1].toLowerCase() : 'neutral';

    // Clean text (remove sentiment tag)
    const cleanText = rawText.replace(/\[SENTIMENT:\s*(positive|neutral|negative|complaint)\]/gi, '').trim();

    return {
      text: cleanText || null,
      sentiment,
      escalated: sentiment === 'complaint',
      functionCalled: toolsUsed.length > 0,
      toolsUsed
    };
  } catch (err) {
    console.error('[OpenAI Error]', err.message);
    throw err;
  }
};

module.exports = {
  isOpenAIEnabled,
  generateSalonAIReply,
  TOOLS: getToolsForOpenAI()
};
