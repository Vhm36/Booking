import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import dashboardService from '../../../services/dashboardService';
import { exportToExcel } from '../../../utils/exportExcel';
import './Analytics.css';

const REPORT_PAGE_SIZE = 10;

const STATUS_TRANSLATIONS = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  completed: 'Đã hoàn thành',
  cancelled: 'Đã hủy',
  in_progress: 'Đang thực hiện',
  no_show: 'Không đến'
};

const formatCurrency = (value) => `${Number(value || 0).toLocaleString('vi-VN')} VNĐ`;

function Analytics() {
  const [customerFrequency, setCustomerFrequency] = useState([]);
  const [appointmentStatus, setAppointmentStatus] = useState([]);
  const [cancellationRate, setCancellationRate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [customerPage, setCustomerPage] = useState(1);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  useEffect(() => {
    document.body.classList.add('analytics-scroll-lock');
    return () => document.body.classList.remove('analytics-scroll-lock');
  }, []);

  useEffect(() => {
    setCustomerPage(1);
  }, [customerFrequency.length]);

  const totalCustomerPages = Math.max(1, Math.ceil(customerFrequency.length / REPORT_PAGE_SIZE));
  const currentCustomerPage = Math.min(customerPage, totalCustomerPages);
  const pagedCustomerFrequency = useMemo(() => {
    const start = (currentCustomerPage - 1) * REPORT_PAGE_SIZE;
    return customerFrequency.slice(start, start + REPORT_PAGE_SIZE);
  }, [customerFrequency, currentCustomerPage]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const [frequencyRes, statusRes, cancellationRes] = await Promise.all([
        dashboardService.getCustomerFrequency(),
        dashboardService.getAppointmentStatus(),
        dashboardService.getCancellationRate()
      ]);

      setCustomerFrequency(frequencyRes.data.data || []);
      setAppointmentStatus(statusRes.data.data || []);
      setCancellationRate(cancellationRes.data.data || null);
      setError('');
    } catch (err) {
      setError('Không thể tải dữ liệu phân tích.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportAnalytics = () => {
    const today = new Date().toISOString().slice(0, 10);
    const sheets = [];

    if (customerFrequency.length > 0) {
      sheets.push({
        name: 'Tần suất KH',
        columns: [
          { key: 'id', header: 'ID', width: 8 },
          { key: 'name', header: 'Khách hàng', width: 22 },
          { key: 'email', header: 'Email', width: 28 },
          { key: 'booking_count', header: 'Số lần đặt', width: 14, transform: (value) => Number(value || 0) },
          { key: 'total_spent', header: 'Tổng chi tiêu (VNĐ)', width: 20, transform: (value) => Number(value || 0) }
        ],
        rows: customerFrequency
      });
    }

    if (appointmentStatus.length > 0) {
      sheets.push({
        name: 'Trạng thái lịch',
        columns: [
          { key: 'status', header: 'Trạng thái', width: 20 },
          { key: 'count', header: 'Số lượng', width: 14, transform: (value) => Number(value || 0) }
        ],
        rows: appointmentStatus.map((status) => ({
          ...status,
          status: STATUS_TRANSLATIONS[status.status] || status.status
        }))
      });
    }

    if (cancellationRate) {
      sheets.push({
        name: 'Tỷ lệ hủy',
        columns: [
          { key: 'metric', header: 'Chỉ số', width: 30 },
          { key: 'value', header: 'Giá trị', width: 18 }
        ],
        rows: [
          { metric: 'Tổng lịch hẹn', value: cancellationRate.total_appointments },
          { metric: 'Số lịch bị hủy', value: cancellationRate.cancelled_count },
          { metric: 'Tỷ lệ hủy (%)', value: cancellationRate.cancellation_rate }
        ]
      });
    }

    exportToExcel({ fileName: `bao-cao-tong-quan_${today}`, sheets });
  };

  if (loading) {
    return <div className="loading">Đang tải dữ liệu phân tích...</div>;
  }

  const totalStatusCount = appointmentStatus.reduce((sum, status) => sum + Number(status.count || 0), 0);

  return (
    <div className="analytics">
      <div className="analytics-header">
        <div>
          <h1>Báo cáo</h1>
          <p>Phân tích lịch hẹn và tần suất khách hàng. Khuyến nghị DEC nằm trong trang chiến lược của báo cáo.</p>
        </div>
        <div className="analytics-header-actions">
          <button type="button" className="btn-export-excel" onClick={handleExportAnalytics}>
            Xuất tổng quan
          </button>
          <Link to="/admin/analytics/strategy/table" className="btn-strategy-toggle">
            Bảng chiến lược
          </Link>
        </div>
      </div>

      {error && <div className="analytics-alert analytics-alert-danger">{error}</div>}

      <div className="analytics-main-grid">
        {cancellationRate && (
          <div className="analytics-card cancellation-card">
            <h3>Tỷ lệ hủy lịch</h3>
            <div className="cancellation-stats">
              <div className="stat-item">
                <span className="label">Tổng lịch</span>
                <span className="value">{cancellationRate.total_appointments}</span>
              </div>
              <div className="stat-item">
                <span className="label">Đã hủy</span>
                <span className="value">{cancellationRate.cancelled_count}</span>
              </div>
              <div className="stat-item primary">
                <span className="label">Tỷ lệ</span>
                <span className="value">{cancellationRate.cancellation_rate}%</span>
              </div>
            </div>
          </div>
        )}

        <div className="analytics-card status-card">
          <h3>Phân bố trạng thái lịch hẹn</h3>
          <div className="status-distribution">
            {appointmentStatus.map((status) => {
              const displayStatus = STATUS_TRANSLATIONS[status.status] || status.status;
              const percent = totalStatusCount > 0 ? (Number(status.count || 0) / totalStatusCount) * 100 : 0;

              return (
                <div key={status.status} className="status-item">
                  <span className="status-label">{displayStatus}</span>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${percent}%` }} />
                  </div>
                  <span className="status-count">{status.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="analytics-card customer-frequency-card">
        <h3>Tần suất khách hàng</h3>
        <div className="customer-table">
          <table>
            <thead>
              <tr>
                <th>Khách hàng</th>
                <th>Email</th>
                <th className="center">Số lần đặt</th>
                <th className="right">Tổng chi tiêu</th>
              </tr>
            </thead>
            <tbody>
              {pagedCustomerFrequency.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.name}</td>
                  <td>{customer.email}</td>
                  <td className="center">{customer.booking_count}</td>
                  <td className="right">{formatCurrency(customer.total_spent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {customerFrequency.length > REPORT_PAGE_SIZE && (
          <div className="analytics-pagination">
            <span>
              Trang {currentCustomerPage}/{totalCustomerPages} · {customerFrequency.length} khách
            </span>
            <div className="analytics-pagination-actions">
              <button
                type="button"
                onClick={() => setCustomerPage((page) => Math.max(1, page - 1))}
                disabled={currentCustomerPage === 1}
              >
                Trước
              </button>
              <button
                type="button"
                onClick={() => setCustomerPage((page) => Math.min(totalCustomerPages, page + 1))}
                disabled={currentCustomerPage === totalCustomerPages}
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Analytics;
