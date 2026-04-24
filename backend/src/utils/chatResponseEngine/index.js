const normalizeText = (value = '') =>
  String(value)
    .replace(/\u0110/g, 'D')
    .replace(/\u0111/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (value = '') => normalizeText(value).split(' ').filter(Boolean);

const formatCurrency = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(Number(value || 0));

const priceIntentWords = ['gia', 'bao nhieu', 'chi phi', 'price', 'gia tien', 'bang gia'];
const durationIntentWords = ['bao lau', 'thoi gian', 'duration', 'mat bao nhieu phut', 'mat bao lau'];
const bookingIntentWords = ['dat lich', 'booking', 'hen lich', 'lich hen', 'book', 'giu cho'];
const serviceIntentWords = ['dich vu', 'cat toc', 'nhuom', 'massage', 'cham soc da', 'nang mi', 'son gel'];
const consultationIntentWords = ['tu van', 'goi y', 'nen chon', 'phu hop', 'de xuat', 'so sanh'];
const humanIntentWords = ['nhan vien', 'nguoi that', 'ho tro truc tiep', 'goi lai', 'lien he'];
const greetingWords = ['xin chao', 'chao', 'hello', 'hi', 'helo'];

const containsAnyPhrase = (normalizedMessage, phrases = []) =>
  phrases.some((phrase) => normalizedMessage.includes(normalizeText(phrase)));

const scoreKeywordExpression = (normalizedMessage, keywordExpression = '') => {
  const terms = String(keywordExpression)
    .split('|')
    .map((part) => normalizeText(part))
    .filter(Boolean);

  if (terms.length === 0) {
    return 0;
  }

  return terms.reduce((score, term) => {
    if (!normalizedMessage.includes(term)) {
      return score;
    }

    return score + (term.includes(' ') ? 2 : 1);
  }, 0);
};

const buildServiceLine = (service) =>
  `- ${service.name}: ${formatCurrency(service.price)} / ${Number(service.duration || 0)} phút`;

const findMatchingServices = (normalizedMessage, services = []) => {
  return services
    .map((service) => {
      const serviceText = normalizeText(`${service.name} ${service.category || ''} ${service.description || ''}`);
      const serviceTokens = new Set(tokenize(serviceText));
      const messageTokens = tokenize(normalizedMessage);
      let score = 0;

      if (normalizedMessage.includes(normalizeText(service.name))) {
        score += 4;
      }

      if (service.category && normalizedMessage.includes(normalizeText(service.category))) {
        score += 2;
      }

      messageTokens.forEach((token) => {
        if (serviceTokens.has(token)) {
          score += 0.35;
        }
      });

      return { service, score };
    })
    .filter((item) => item.score >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.service);
};

const findBestFAQ = (normalizedMessage, faqs = []) => {
  return faqs
    .map((faq) => {
      const question = normalizeText(faq.question);
      const keywords = normalizeText(faq.keywords || '');
      const category = normalizeText(faq.category || '');
      const messageTokens = tokenize(normalizedMessage);
      const knowledgeTokens = new Set(tokenize(`${question} ${keywords} ${category}`));
      let score = 0;

      if (normalizedMessage.includes(question)) {
        score += 4;
      }

      if (category && normalizedMessage.includes(category)) {
        score += 1.2;
      }

      messageTokens.forEach((token) => {
        if (knowledgeTokens.has(token)) {
          score += 0.45;
        }
      });

      return { faq, score };
    })
    .sort((a, b) => b.score - a.score)[0];
};

const buildBookingResponse = (services = []) => {
  const highlightedServices = services.slice(0, 3).map(buildServiceLine).join('\n');

  return {
    text: [
      'Bạn có thể đặt lịch ngay trên hệ thống sau khi chọn dịch vụ, nhân viên và khung giờ phù hợp.',
      highlightedServices ? `Một vài dịch vụ đang được quan tâm:\n${highlightedServices}` : '',
      'Nếu bạn muốn, hãy nhắn tên dịch vụ để mình hỗ trợ nhanh hơn.'
    ]
      .filter(Boolean)
      .join('\n\n'),
    type: 'suggestion',
    source: 'booking',
    escalated: false,
    confidence: 1.6
  };
};

const buildServiceResponse = (matchedServices, services, normalizedMessage) => {
  const targetServices = matchedServices.length > 0 ? matchedServices : services.slice(0, 4);
  const lines = targetServices.map(buildServiceLine).join('\n');

  if (containsAnyPhrase(normalizedMessage, priceIntentWords)) {
    return {
      text: `Mức giá tham khảo cho các dịch vụ phù hợp:\n${lines}`,
      type: 'text',
      source: 'service',
      escalated: false,
      confidence: 1.55
    };
  }

  if (containsAnyPhrase(normalizedMessage, durationIntentWords)) {
    return {
      text: `Thời gian dự kiến cho các dịch vụ phù hợp:\n${lines}`,
      type: 'text',
      source: 'service',
      escalated: false,
      confidence: 1.5
    };
  }

  return {
    text: `Đây là một số dịch vụ phù hợp để bạn tham khảo:\n${lines}`,
    type: 'suggestion',
    source: 'service',
    escalated: false,
    confidence: 1.45
  };
};

const buildConsultationResponse = (matchedServices, services = []) => {
  const targetServices = matchedServices.length > 0 ? matchedServices : services.slice(0, 3);
  const lines = targetServices.map(buildServiceLine).join('\n');

  return {
    text: [
      'Mình gợi ý bạn tham khảo những lựa chọn này:',
      lines,
      'Nếu bạn chia sẻ rõ hơn nhu cầu như thư giãn, làm đẹp nhanh, chăm sóc chuyên sâu hoặc ngân sách mong muốn, mình sẽ gợi ý sát hơn.'
    ]
      .filter(Boolean)
      .join('\n\n'),
    type: 'suggestion',
    source: 'consultation',
    escalated: false,
    confidence: 1.5
  };
};

const buildHumanSupportResponse = () => ({
  text: 'Mình đã ghi nhận yêu cầu gặp hỗ trợ viên. Bạn có thể để lại nhu cầu cụ thể, hoặc tiếp tục nhắn tin để nhân viên hỗ trợ sớm hơn.',
  type: 'system',
  source: 'handoff',
  escalated: true,
  confidence: 2
});

const buildPromotionResponse = (suggestions = []) => {
  const promotionItems = suggestions
    .filter((item) => normalizeText(item.category) === 'promotion' || normalizeText(item.action_type) === 'promotion')
    .slice(0, 2);

  if (promotionItems.length === 0) {
    return null;
  }

  return {
    text: `Hiện nay có các gợi ý ưu đãi:\n${promotionItems.map((item) => `- ${item.title}`).join('\n')}`,
    type: 'suggestion',
    source: 'promotion',
    escalated: false,
    confidence: 1.4
  };
};

const buildFallbackResponse = () => ({
  text: 'Mình chưa hiểu rõ yêu cầu này. Bạn có thể nhắn ngắn gọn hơn như "giá cắt tóc", "đặt lịch nhuộm tóc", "khuyến mãi hôm nay" hoặc "gặp nhân viên".',
  type: 'text',
  source: 'fallback',
  escalated: false,
  confidence: 0
});

const buildSmartRuleResponse = ({ messageText, botResponses = [], faqs = [], services = [], suggestions = [] }) => {
  const normalizedMessage = normalizeText(messageText);

  if (!normalizedMessage) {
    return buildFallbackResponse();
  }

  if (containsAnyPhrase(normalizedMessage, humanIntentWords)) {
    return buildHumanSupportResponse();
  }

  if (containsAnyPhrase(normalizedMessage, greetingWords)) {
    return {
      text: 'Xin chào! Mình có thể giúp bạn tìm dịch vụ, xem giá, thời gian làm dịch vụ hoặc hướng dẫn đặt lịch.',
      type: 'text',
      source: 'greeting',
      escalated: false,
      confidence: 2
    };
  }

  const matchedServices = findMatchingServices(normalizedMessage, services);
  const isBookingIntent = containsAnyPhrase(normalizedMessage, bookingIntentWords);
  const isConsultationIntent = containsAnyPhrase(normalizedMessage, consultationIntentWords);
  const isServiceIntent =
    matchedServices.length > 0 ||
    containsAnyPhrase(normalizedMessage, priceIntentWords) ||
    containsAnyPhrase(normalizedMessage, durationIntentWords) ||
    containsAnyPhrase(normalizedMessage, serviceIntentWords);

  if (isBookingIntent) {
    return buildBookingResponse(matchedServices.length > 0 ? matchedServices : services);
  }

  const bestFaq = findBestFAQ(normalizedMessage, faqs);
  if (bestFaq && bestFaq.score >= 1.4) {
    return {
      text: bestFaq.faq.answer,
      type: 'text',
      source: 'faq',
      escalated: false,
      confidence: bestFaq.score
    };
  }

  if (isServiceIntent && isConsultationIntent) {
    return buildConsultationResponse(matchedServices, services);
  }

  if (isServiceIntent) {
    return buildServiceResponse(matchedServices, services, normalizedMessage);
  }

  if (containsAnyPhrase(normalizedMessage, ['khuyen mai', 'uu dai', 'giam gia', 'combo'])) {
    return buildPromotionResponse(suggestions) || buildFallbackResponse();
  }

  const bestBotResponse = botResponses
    .map((item) => ({
      item,
      score: scoreKeywordExpression(normalizedMessage, item.trigger_keyword)
    }))
    .sort((a, b) => b.score - a.score)[0];

  if (bestBotResponse && bestBotResponse.score > 0) {
    return {
      text: bestBotResponse.item.response_text,
      type: bestBotResponse.item.response_type || 'text',
      source: 'rule',
      escalated: bestBotResponse.item.response_type === 'escalate',
      confidence: bestBotResponse.score
    };
  }

  return buildFallbackResponse();
};

module.exports = {
  normalizeText,
  buildSmartRuleResponse
};
