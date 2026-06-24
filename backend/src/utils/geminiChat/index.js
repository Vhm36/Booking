/**
 * Gemini AI Chat — Thay thế OpenAI cho chatbot salon
 * Sử dụng Google Gemini API với Function Calling (tương đương MCP Pattern)
 *
 * API: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
 */

const { getToolsForOpenAI, executeTool } = require('../toolRegistry');

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const GEMINI_DISABLED_VALUES = new Set(['0', 'false', 'off', 'no']);

const isGeminiEnabled = () => {
  const enabledValue = String(process.env.GEMINI_ENABLED ?? 'true').trim().toLowerCase();
  return Boolean(process.env.GEMINI_API_KEY) && !GEMINI_DISABLED_VALUES.has(enabledValue);
};

// =============================================================================
// Helpers
// =============================================================================

const truncate = (value = '', maxLength = 320) => {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
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
// System Prompt (giữ nguyên từ openAiChat)
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
// Convert OpenAI tool format → Gemini Function Declarations
// =============================================================================

const convertToolsToGemini = () => {
  const openAITools = getToolsForOpenAI();

  const functionDeclarations = openAITools.map((tool) => {
    const fn = tool.function;
    const declaration = {
      name: fn.name,
      description: fn.description
    };

    // Gemini yêu cầu parameters phải có ít nhất 1 property nếu có
    if (fn.parameters && fn.parameters.properties && Object.keys(fn.parameters.properties).length > 0) {
      declaration.parameters = {
        type: 'OBJECT',
        properties: {},
        required: fn.parameters.required || []
      };

      for (const [key, value] of Object.entries(fn.parameters.properties)) {
        declaration.parameters.properties[key] = {
          type: value.type.toUpperCase(),
          description: value.description || ''
        };
      }
    }

    return declaration;
  });

  return [{ functionDeclarations }];
};

// =============================================================================
// Main AI Reply — Gemini with Function Calling + Sentiment
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
  if (!isGeminiEnabled()) {
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

  // Build Gemini request body
  const tools = convertToolsToGemini();
  const useTools = toolExecutor && tools[0].functionDeclarations.length > 0;

  const requestBody = {
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }]
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: contextMessage }]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 800
    }
  };

  if (useTools) {
    requestBody.tools = tools;
  }

  const apiUrl = `${GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`;

  try {
    let toolsUsed = [];
    let maxIterations = 3; // Tránh infinite loop

    while (maxIterations > 0) {
      maxIterations--;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`Gemini API error ${response.status}: ${errorText}`);
        error.status = response.status;
        error.responseBody = errorText;
        error.isQuotaExceeded = response.status === 429;
        throw error;
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];

      if (!candidate || !candidate.content || !candidate.content.parts) {
        throw new Error('Gemini returned empty response');
      }

      const parts = candidate.content.parts;

      // Check if Gemini wants to call functions
      const functionCalls = parts.filter((p) => p.functionCall);

      if (functionCalls.length > 0 && toolExecutor) {
        // Add assistant response to conversation history
        requestBody.contents.push({
          role: 'model',
          parts: parts
        });

        // Execute each function call and collect results
        const functionResponseParts = [];

        for (const part of functionCalls) {
          const fnName = part.functionCall.name;
          const fnArgs = part.functionCall.args || {};

          console.log(`[Gemini Agent] 🔧 Calling function: ${fnName}`, fnArgs);

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

          functionResponseParts.push({
            functionResponse: {
              name: fnName,
              response: fnResult
            }
          });
        }

        // Add function results to conversation and continue the loop
        requestBody.contents.push({
          role: 'user',
          parts: functionResponseParts
        });

        continue; // Loop to get final text response
      }

      // No function calls — extract text response
      const textParts = parts.filter((p) => p.text);
      const rawText = textParts.map((p) => p.text).join('');

      // Extract sentiment
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
    }

    // Max iterations reached — return what we have
    return {
      text: 'Xin lỗi, mình đang gặp khó khăn xử lý yêu cầu này. Bạn có thể thử lại không?',
      sentiment: 'neutral',
      escalated: false,
      functionCalled: false,
      toolsUsed: []
    };
  } catch (err) {
    console.error(err.isQuotaExceeded ? '[Gemini Quota Exceeded]' : '[Gemini Error]', err.message);
    throw err;
  }
};

module.exports = {
  isGeminiEnabled,
  generateSalonAIReply
};
