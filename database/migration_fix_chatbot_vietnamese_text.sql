-- Chuẩn hóa dữ liệu chatbot sang tiếng Việt có dấu.
-- Dùng cho database đã từng chạy seed/migration cũ có chuỗi không dấu hoặc bị thay bằng dấu hỏi.

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

UPDATE chat_suggestions
SET
  title = 'Cắt tóc nam',
  description = 'Dịch vụ cắt tóc chuyên nghiệp cho nam giới'
WHERE title IN ('C?t t?c nam', 'Cắt tóc nam')
   OR description = 'D?ch v? c?t t?c chuy?n nghi?p cho nam gi?i';

UPDATE chat_faq
SET
  question = 'Làm sao để đặt lịch hẹn?',
  answer = 'Bạn có thể đặt lịch hẹn trực tiếp trên ứng dụng hoặc gọi điện thoại cho salon.',
  category = 'Đặt lịch',
  keywords = 'đặt lịch, hẹn, booking'
WHERE question IN ('L?m sao ?? ??t l?ch h?n?', 'Làm sao để đặt lịch hẹn?');

UPDATE chat_faq
SET
  question = 'Salon có nhận khách vãng lai không?',
  answer = 'Salon vẫn nhận khách vãng lai nếu còn chỗ trống, nhưng đặt lịch trước sẽ dễ chọn nhân viên và khung giờ đẹp hơn.',
  category = 'Đặt lịch',
  keywords = 'vãng lai, không hẹn trước, walk in, đặt lịch'
WHERE question IN ('Salon co nhan khach vang lai khong?', 'Salon có nhận khách vãng lai không?');

UPDATE chat_faq
SET
  question = 'Tôi có thể đổi lịch hoặc hủy lịch không?',
  answer = 'Bạn có thể vào mục lịch hẹn để đổi giờ hoặc hủy lịch. Nếu lịch đã gần đến giờ, bạn nên thao tác sớm để salon sắp xếp nhân viên tốt hơn.',
  category = 'Đặt lịch',
  keywords = 'đổi lịch, hủy lịch, đổi giờ, reschedule, cancel'
WHERE question IN ('Toi co the doi lich hoac huy lich khong?', 'Tôi có thể đổi lịch hoặc hủy lịch không?');

UPDATE chat_faq
SET
  question = 'Salon có nhận thanh toán online không?',
  answer = 'Salon hỗ trợ thanh toán online qua cổng thanh toán trên hệ thống, đồng thời bạn vẫn có thể chọn thanh toán tại salon nếu muốn.',
  category = 'Thanh toán',
  keywords = 'thanh toán online, chuyển khoản, momo, vnpay, tiền mặt'
WHERE question IN ('Salon co nhan thanh toan online khong?', 'Salon có nhận thanh toán online không?');

UPDATE chat_faq
SET
  question = 'Tôi nên đến sớm trước giờ hẹn bao lâu?',
  answer = 'Bạn nên đến sớm khoảng 5 đến 10 phút để check-in, xác nhận dịch vụ và được tư vấn nhanh nếu cần.',
  category = 'Đặt lịch',
  keywords = 'đến sớm, check in, trước giờ hẹn, bao lâu'
WHERE question IN ('Toi nen den som truoc gio hen bao lau?', 'Tôi nên đến sớm trước giờ hẹn bao lâu?');

UPDATE chat_faq
SET
  question = 'Salon có ưu đãi cho khách hàng thân thiết không?',
  answer = 'Salon có các ưu đãi theo chương trình và hạng mức khách hàng. Bạn có thể xem thông báo khuyến mãi hoặc hỏi bot để được gợi ý nhanh.',
  category = 'Khuyến mãi',
  keywords = 'vip, khách hàng thân thiết, ưu đãi, khuyến mãi, giảm giá'
WHERE question IN ('Salon co uu dai cho khach hang than thiet khong?', 'Salon có ưu đãi cho khách hàng thân thiết không?');

UPDATE chat_bot_responses
SET response_text = 'Bạn có thể vào phần lịch hẹn để đổi giờ hoặc hủy lịch. Nếu cần, mình cũng có thể chuyển yêu cầu sang nhân viên hỗ trợ.'
WHERE trigger_keyword = 'huy lich|doi lich|reschedule|cancel';

UPDATE chat_bot_responses
SET response_text = 'Mình có thể gợi ý các ưu đãi đang hiện có, hoặc nếu bạn nói rõ dịch vụ quan tâm thì mình sẽ ưu tiên gợi ý phù hợp hơn.'
WHERE trigger_keyword = 'khuyen mai|uu dai|giam gia|combo';

UPDATE chat_bot_responses
SET response_text = 'Salon hỗ trợ thanh toán online và thanh toán tại salon. Nếu bạn muốn, mình có thể hướng dẫn cách đặt lịch và thanh toán nhanh.'
WHERE trigger_keyword = 'thanh toan|momo|vnpay|chuyen khoan|tien mat';

UPDATE chat_bot_responses
SET response_text = 'Bạn chỉ cần nói nhu cầu như cắt tóc, nhuộm, chăm sóc da hay massage, mình sẽ gợi ý dịch vụ phù hợp và mức giá tham khảo.'
WHERE trigger_keyword = 'tu van|goi y|chon dich vu';

UPDATE chat_bot_responses
SET response_text = 'Mình sẽ chuyển cuộc trò chuyện sang nhân viên hỗ trợ để bạn được tư vấn chi tiết hơn.'
WHERE trigger_keyword = 'nguoi that|nhan vien that|ho tro truc tiep';

UPDATE chat_suggestions
SET
  title = 'Chăm sóc da cấp ẩm',
  description = 'Gợi ý cho khách muốn làm đẹp nhẹ nhàng và thư giãn'
WHERE title IN ('Cham soc da cap am', 'Chăm sóc da cấp ẩm');

UPDATE chat_suggestions
SET
  title = 'Massage thư giãn',
  description = 'Dịch vụ phù hợp khi bạn muốn giảm mệt mỏi sau ngày dài'
WHERE title IN ('Massage thu gian', 'Massage thư giãn');

UPDATE chat_suggestions
SET
  title = 'Gặp nhân viên tư vấn',
  description = 'Chuyển cuộc trò chuyện cho nhân viên khi bạn cần tư vấn sâu hơn'
WHERE title IN ('Gap nhan vien tu van', 'Gặp nhân viên tư vấn');
