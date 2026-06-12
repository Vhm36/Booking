/**
 * Tool Registry — MCP-style centralized tool definitions
 * Inspired by congdinh2008/chatbot-ai-mcp-demo
 *
 * Each tool has: name, description, parameters schema, execute function.
 * Security: input validation, user scope checks, logging.
 */

const db = require('../../config/db');

const queryAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });

// =============================================================================
// Tool Definitions (8 tools)
// =============================================================================

const TOOL_REGISTRY = {
  // ── Tool 1: Kiểm tra lịch trống ──────────────────────────────────────
  check_availability: {
    name: 'check_availability',
    description: 'Kiểm tra lịch trống của salon vào ngày và giờ cụ thể. Trả về danh sách nhân viên có sẵn.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Ngày muốn kiểm tra, format YYYY-MM-DD' },
        time: { type: 'string', description: 'Giờ muốn kiểm tra, format HH:MM (24h)' }
      },
      required: ['date']
    },
    execute: async (args, userId) => {
      const { date, time } = args;
      const requestedTime = time || '09:00:00';

      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return { error: 'Ngày không hợp lệ. Vui lòng dùng format YYYY-MM-DD' };
      }

      const sql = `
        SELECT u.id, u.name, sr.role_name
        FROM users u
        LEFT JOIN staff_role sr ON u.staff_role_id = sr.id
        JOIN staff_weekly_availability swa
          ON u.id = swa.staff_id
          AND swa.day_of_week = WEEKDAY(?)
          AND TIME(?) >= swa.start_time
          AND TIME(?) <= swa.end_time
        WHERE u.role = 'staff' AND u.is_active = 1
          AND (sr.role_name IS NULL OR LOWER(sr.role_name) NOT LIKE '%thu ng%')
          AND NOT EXISTS (
            SELECT 1
            FROM staff_leave_requests slr
            WHERE slr.staff_id = u.id
              AND slr.status = 'approved'
              AND ? BETWEEN slr.start_date AND slr.end_date
          )
          AND u.id NOT IN (
            SELECT staff_id FROM appointments
            WHERE appointment_date = ? AND appointment_time = ? AND status IN ('pending','confirmed')
          )
        ORDER BY u.name
      `;
      const available = await queryAsync(sql, [date, requestedTime, requestedTime, date, date, requestedTime]);

      return {
        date,
        time: time || 'cả ngày',
        available_staff: available.map((s) => ({ id: s.id, name: s.name, role: s.role_name })),
        total: available.length,
        message: available.length > 0
          ? `Có ${available.length} nhân viên trống vào ${time || 'cả ngày'} ngày ${date}`
          : 'Không có nhân viên trống vào thời điểm này'
      };
    }
  },

  // ── Tool 2: Thông tin dịch vụ ──────────────────────────────────────────
  get_service_details: {
    name: 'get_service_details',
    description: 'Tìm thông tin chi tiết về một dịch vụ cụ thể (giá, thời gian, mô tả). Dùng khi khách hỏi về dịch vụ.',
    parameters: {
      type: 'object',
      properties: {
        service_name: { type: 'string', description: 'Tên dịch vụ muốn tìm (ví dụ: cắt tóc, nhuộm, massage)' }
      },
      required: ['service_name']
    },
    execute: async (args) => {
      const { service_name } = args;

      if (!service_name || service_name.trim().length < 2) {
        return { error: 'Tên dịch vụ quá ngắn, vui lòng nhập rõ hơn' };
      }

      const services = await queryAsync(
        `SELECT id, name, price, duration, description, category
         FROM services
         WHERE status = 'active' AND (name LIKE ? OR category LIKE ? OR description LIKE ?)
         LIMIT 5`,
        [`%${service_name}%`, `%${service_name}%`, `%${service_name}%`]
      );

      return {
        found: services.length,
        services: services.map((s) => ({
          id: s.id,
          name: s.name,
          price: `${Number(s.price).toLocaleString('vi-VN')} VNĐ`,
          price_raw: Number(s.price),
          duration: `${s.duration} phút`,
          description: s.description,
          category: s.category
        }))
      };
    }
  },

  // ── Tool 3: Tạo booking (có security guard) ───────────────────────────
  create_booking: {
    name: 'create_booking',
    description: 'Tạo lịch hẹn mới cho khách hàng. CHỈ gọi khi khách đã xác nhận rõ dịch vụ, ngày, giờ. Bắt buộc phải hỏi xác nhận trước khi gọi tool này.',
    parameters: {
      type: 'object',
      properties: {
        service_id: { type: 'number', description: 'ID của dịch vụ' },
        date: { type: 'string', description: 'Ngày hẹn, format YYYY-MM-DD' },
        time: { type: 'string', description: 'Giờ hẹn, format HH:MM' }
      },
      required: ['service_id', 'date', 'time']
    },
    execute: async (args, userId) => {
      const { service_id, date, time } = args;

      // Security: Phải có userId
      if (!userId) return { error: 'Khách chưa đăng nhập, không thể đặt lịch' };

      // Validate inputs
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return { error: 'Ngày không hợp lệ. Format: YYYY-MM-DD' };
      }
      if (!time || !/^\d{2}:\d{2}$/.test(time)) {
        return { error: 'Giờ không hợp lệ. Format: HH:MM' };
      }

      // Validate ngày không quá khứ
      const bookingDate = new Date(`${date}T${time}:00`);
      if (bookingDate < new Date()) {
        return { error: 'Không thể đặt lịch trong quá khứ' };
      }

      // Verify service
      const serviceRows = await queryAsync(
        'SELECT id, name, price, duration FROM services WHERE id = ? AND status = ?',
        [service_id, 'active']
      );
      if (serviceRows.length === 0) {
        return { error: 'Dịch vụ không tồn tại hoặc không khả dụng' };
      }

      const service = serviceRows[0];

      // Find available staff (auto-assign)
      const availableStaff = await queryAsync(
        `SELECT u.id, u.name FROM users u
         LEFT JOIN staff_role sr ON u.staff_role_id = sr.id
         WHERE u.role = 'staff' AND u.is_active = 1
           AND (sr.role_name IS NULL OR LOWER(sr.role_name) NOT LIKE '%thu ng%')
           AND u.id NOT IN (
             SELECT staff_id FROM appointments
             WHERE appointment_date = ? AND appointment_time = ? AND status IN ('pending','confirmed')
           )
         ORDER BY RAND() LIMIT 1`,
        [date, time]
      );

      if (availableStaff.length === 0) {
        return { error: 'Không có nhân viên trống vào thời điểm này. Hãy chọn thời gian khác.' };
      }

      const staff = availableStaff[0];

      // Calculate end time
      const endTimeMinutes = Number(service.duration || 60);
      const [h, m] = time.split(':').map(Number);
      const endH = Math.floor((h * 60 + m + endTimeMinutes) / 60);
      const endM = (h * 60 + m + endTimeMinutes) % 60;
      const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`;

      // Create appointment
      const result = await queryAsync(
        `INSERT INTO appointments (user_id, service_id, staff_id, appointment_date, appointment_time, end_time, total_amount, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [userId, service_id, staff.id, date, time, endTime, service.price]
      );

      // Insert appointment_services
      await queryAsync(
        `INSERT INTO appointment_services (appointment_id, service_id, sort_order, price_snapshot, duration_snapshot, service_name_snapshot)
         VALUES (?, ?, 0, ?, ?, ?)`,
        [result.insertId, service_id, service.price, service.duration, service.name]
      );

      return {
        success: true,
        appointment_id: result.insertId,
        service: service.name,
        staff: staff.name,
        date,
        time,
        end_time: endTime,
        price: `${Number(service.price).toLocaleString('vi-VN')} VNĐ`,
        message: `✅ Đã đặt lịch thành công! Mã lịch hẹn: #${result.insertId}`
      };
    }
  },

  // ── Tool 4: Xem lịch hẹn của khách ─────────────────────────────────────
  get_my_appointments: {
    name: 'get_my_appointments',
    description: 'Lấy danh sách lịch hẹn sắp tới của khách hàng đang chat. Dùng khi khách hỏi về lịch hẹn.',
    parameters: {
      type: 'object',
      properties: {}
    },
    execute: async (args, userId) => {
      if (!userId) return { error: 'Khách chưa đăng nhập' };

      const appointments = await queryAsync(
        `SELECT a.id, a.appointment_date, a.appointment_time, a.status, a.total_amount,
                s.name AS service_name, staff.name AS staff_name
         FROM appointments a
         LEFT JOIN services s ON a.service_id = s.id
         LEFT JOIN users staff ON a.staff_id = staff.id
         WHERE a.user_id = ? AND a.appointment_date >= CURDATE()
         ORDER BY a.appointment_date, a.appointment_time
         LIMIT 5`,
        [userId]
      );

      return {
        total: appointments.length,
        appointments: appointments.map((a) => ({
          id: a.id,
          date: a.appointment_date,
          time: a.appointment_time,
          service: a.service_name,
          staff: a.staff_name,
          status: a.status,
          total: `${Number(a.total_amount || 0).toLocaleString('vi-VN')} VNĐ`
        })),
        message: appointments.length > 0
          ? `Bạn có ${appointments.length} lịch hẹn sắp tới`
          : 'Bạn chưa có lịch hẹn nào sắp tới'
      };
    }
  },

  // ── Tool 5 (NEW): Yêu cầu hủy lịch ──────────────────────────────────
  cancel_booking: {
    name: 'cancel_booking',
    description: 'Yêu cầu hủy một lịch hẹn. Chỉ hủy được booking của chính khách đang chat và chỉ tạo yêu cầu hủy (không hủy trực tiếp).',
    parameters: {
      type: 'object',
      properties: {
        appointment_id: { type: 'number', description: 'Mã lịch hẹn cần hủy (VD: 5)' }
      },
      required: ['appointment_id']
    },
    execute: async (args, userId) => {
      if (!userId) return { error: 'Khách chưa đăng nhập' };

      const { appointment_id } = args;

      // Security: Verify ownership
      const rows = await queryAsync(
        `SELECT a.id, a.status, a.appointment_date, a.appointment_time, a.cancellation_requested,
                s.name AS service_name
         FROM appointments a
         LEFT JOIN services s ON a.service_id = s.id
         WHERE a.id = ? AND a.user_id = ?`,
        [appointment_id, userId]
      );

      if (rows.length === 0) {
        return { error: 'Không tìm thấy lịch hẹn hoặc bạn không có quyền hủy lịch này' };
      }

      const appointment = rows[0];

      if (appointment.status === 'cancelled') {
        return { error: 'Lịch hẹn này đã bị hủy trước đó' };
      }

      if (appointment.status === 'completed') {
        return { error: 'Không thể hủy lịch hẹn đã hoàn thành' };
      }

      if (appointment.cancellation_requested === 1) {
        return { error: 'Yêu cầu hủy đã được gửi trước đó. Vui lòng chờ xác nhận.' };
      }

      // Create cancellation request (không hủy trực tiếp — theo flow 2 bước)
      await queryAsync(
        'UPDATE appointments SET cancellation_requested = 1 WHERE id = ?',
        [appointment_id]
      );

      return {
        success: true,
        appointment_id,
        service: appointment.service_name,
        date: appointment.appointment_date,
        time: appointment.appointment_time,
        message: `📋 Đã gửi yêu cầu hủy lịch hẹn #${appointment_id}. Nhân viên sẽ xác nhận trong thời gian sớm nhất.`
      };
    }
  },

  // ── Tool 6 (NEW): Xem khuyến mãi / voucher khả dụng ────────────────
  get_promotions: {
    name: 'get_promotions',
    description: 'Xem danh sách khuyến mãi, voucher đang có hiệu lực cho khách hàng. Read-only.',
    parameters: {
      type: 'object',
      properties: {}
    },
    execute: async (args, userId) => {
      // Public vouchers (không cần đăng nhập)
      const publicVouchers = await queryAsync(
        `SELECT code, voucher_type, discount_amount, discount_percent, max_discount_amount, min_order_value, expiry_date, description
         FROM vouchers
         WHERE status = 'active'
           AND expiry_date >= NOW()
           AND (max_usage_global IS NULL OR current_usage < max_usage_global)
           AND customer_type IN ('both', 'regular')
         ORDER BY CASE WHEN voucher_type = 'percentage' THEN discount_percent ELSE discount_amount END DESC
         LIMIT 5`
      );

      // Personal vouchers (nếu đăng nhập)
      let personalVouchers = [];
      if (userId) {
        personalVouchers = await queryAsync(
          `SELECT v.code, v.voucher_type, v.discount_amount, v.discount_percent, v.max_discount_amount, v.min_order_value, v.expiry_date, v.description
           FROM voucher_assignments va
           JOIN vouchers v ON va.voucher_id = v.id
           WHERE va.customer_id = ?
             AND va.status = 'active'
             AND va.usage_count < va.max_usage_customer
             AND v.status = 'active'
             AND v.expiry_date >= NOW()
           ORDER BY v.expiry_date ASC
           LIMIT 5`,
          [userId]
        );
      }

      const formatVoucher = (v) => ({
        code: v.code,
        type:
          v.voucher_type === 'percentage'
            ? `Giảm ${Number(v.discount_percent || 0)}%`
            : `Giảm ${Number(v.discount_amount || 0).toLocaleString('vi-VN')} VND`,
        max_discount: v.max_discount_amount
          ? `Tối đa ${Number(v.max_discount_amount).toLocaleString('vi-VN')} VND`
          : null,
        min_order: `${Number(v.min_order_value || 0).toLocaleString('vi-VN')} VND`,
        valid_until: v.expiry_date,
        description: v.description
      });

      return {
        public_promotions: publicVouchers.map(formatVoucher),
        personal_vouchers: personalVouchers.map(formatVoucher),
        total: publicVouchers.length + personalVouchers.length,
        message: (publicVouchers.length + personalVouchers.length) > 0
          ? 'Dưới đây là các khuyến mãi hiện có'
          : 'Hiện tại chưa có khuyến mãi nào'
      };
    }
  },

  // ── Tool 7 (NEW): Thông tin nhân viên ──────────────────────────────────
  get_staff_info: {
    name: 'get_staff_info',
    description: 'Xem danh sách nhân viên dịch vụ (trừ thu ngân). Dùng khi khách hỏi về nhân viên.',
    parameters: {
      type: 'object',
      properties: {
        service_name: { type: 'string', description: 'Tên dịch vụ để lọc nhân viên phù hợp (tùy chọn)' }
      }
    },
    execute: async (args) => {
      const staff = await queryAsync(
        `SELECT u.id, u.name, u.email, u.phone, sr.role_name,
                COALESCE(AVG(a.review_rating), 0) AS avg_rating,
                COUNT(CASE WHEN a.review_rating IS NOT NULL THEN 1 END) AS review_count
         FROM users u
         LEFT JOIN staff_role sr ON u.staff_role_id = sr.id
         LEFT JOIN appointments a ON u.id = a.staff_id AND a.status = 'completed'
         WHERE u.role = 'staff' AND u.is_active = 1
           AND (sr.role_name IS NULL OR LOWER(sr.role_name) NOT LIKE '%thu ng%')
         GROUP BY u.id, u.name, u.email, u.phone, sr.role_name
         ORDER BY avg_rating DESC
         LIMIT 10`
      );

      return {
        total: staff.length,
        staff: staff.map((s) => ({
          id: s.id,
          name: s.name,
          role: s.role_name || 'Nhân viên dịch vụ',
          rating: s.avg_rating > 0 ? `${Number(s.avg_rating).toFixed(1)} ⭐ (${s.review_count} đánh giá)` : 'Chưa có đánh giá',
          rating_raw: Number(s.avg_rating)
        }))
      };
    }
  },

  // ── Tool 8 (NEW): Giờ làm việc ────────────────────────────────────────
  get_business_hours: {
    name: 'get_business_hours',
    description: 'Thông tin giờ làm việc, địa chỉ, liên hệ của salon. Dùng khi khách hỏi mấy giờ mở/đóng cửa.',
    parameters: {
      type: 'object',
      properties: {}
    },
    execute: async () => {
      return {
        business_name: 'BeautyBook Salon',
        hours: {
          'Thứ 2 - Thứ 6': '08:00 - 21:00',
          'Thứ 7 - Chủ nhật': '07:00 - 23:00'
        },
        note: 'Ca sáng và ca tối được quản lý theo lịch nhân viên. Ngày nghỉ xử lý bằng yêu cầu xin nghỉ đã duyệt.',
        contact: 'Liên hệ qua hotline hoặc đặt lịch trực tiếp trên website.'
      };
    }
  }
};

// =============================================================================
// Tool Registry API
// =============================================================================

/**
 * Get all tool definitions for OpenAI Function Calling format
 */
const getToolsForOpenAI = () => {
  return Object.values(TOOL_REGISTRY).map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));
};

/**
 * Execute a tool by name with security logging
 */
const executeTool = async (toolName, args, userId) => {
  const tool = TOOL_REGISTRY[toolName];

  if (!tool) {
    console.warn(`[ToolRegistry] ⚠️ Unknown tool: ${toolName}`);
    return { error: `Tool "${toolName}" không tồn tại` };
  }

  const startTime = Date.now();
  console.log(`[ToolRegistry] 🔧 Executing: ${toolName}`, JSON.stringify(args));

  try {
    const result = await tool.execute(args, userId);
    const duration = Date.now() - startTime;
    console.log(`[ToolRegistry] ✅ ${toolName} completed in ${duration}ms`);
    return result;
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`[ToolRegistry] ❌ ${toolName} failed in ${duration}ms:`, err.message);
    return { error: `Lỗi khi thực thi ${toolName}: ${err.message}` };
  }
};

/**
 * Get list of tool names
 */
const getToolNames = () => Object.keys(TOOL_REGISTRY);

module.exports = {
  TOOL_REGISTRY,
  getToolsForOpenAI,
  executeTool,
  getToolNames
};
