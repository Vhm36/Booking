import React, { useState, useEffect } from 'react';
import dashboardService from '../../../services/dashboardService';
import { exportToExcel } from '../../../utils/exportExcel';
import './Analytics.css';

function Analytics() {
  const [customerFrequency, setCustomerFrequency] = useState([]);
  const [appointmentStatus, setAppointmentStatus] = useState([]);
  const [cancellationRate, setCancellationRate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState('');

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const [frequencyRes, statusRes, cancellationRes] = await Promise.all([
        dashboardService.getCustomerFrequency(),
        dashboardService.getAppointmentStatus(),
        dashboardService.getCancellationRate()
      ]);

      setCustomerFrequency(frequencyRes.data.data);
      setAppointmentStatus(statusRes.data.data);
      setCancellationRate(cancellationRes.data.data);
      setError('');
    } catch (err) {
      setError('Không thể tải dữ liệu phân tích.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Đang tải dữ liệu phân tích...</div>;
  }

  const handleExportAnalytics = () => {
    const today = new Date().toISOString().slice(0, 10);
    const sheets = [];

    // Sheet 1: Customer frequency
    if (customerFrequency.length > 0) {
      sheets.push({
        name: 'Tần suất KH',
        columns: [
          { key: 'id', header: 'ID', width: 8 },
          { key: 'name', header: 'Khách hàng', width: 22 },
          { key: 'email', header: 'Email', width: 28 },
          { key: 'booking_count', header: 'Số lần đặt', width: 14, transform: (v) => Number(v || 0) },
          { key: 'total_spent', header: 'Tổng chi tiêu (VNĐ)', width: 20, transform: (v) => Number(v || 0) }
        ],
        rows: customerFrequency
      });
    }

    // Sheet 2: Appointment status distribution
    if (appointmentStatus.length > 0) {
      const statusTranslations = {
        pending: 'Chờ xác nhận',
        confirmed: 'Đã xác nhận',
        completed: 'Đã hoàn thành',
        cancelled: 'Đã hủy',
        in_progress: 'Đang thực hiện',
        no_show: 'Không đến'
      };
      
      sheets.push({
        name: 'Trạng thái lịch',
        columns: [
          { key: 'status', header: 'Trạng thái', width: 20 },
          { key: 'count', header: 'Số lượng', width: 14, transform: (v) => Number(v || 0) }
        ],
        rows: appointmentStatus.map(s => ({
          ...s,
          status: statusTranslations[s.status] || s.status
        }))
      });
    }

    // Sheet 3: Cancellation rate summary
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

    if (sheets.length === 0) {
      window.alert('Không có dữ liệu để xuất.');
      return;
    }

    exportToExcel({ fileName: `phan-tich_${today}`, sheets });
  };

  return (
    <div className="analytics">
      <div className="analytics-header">
        <h1>Phân tích dữ liệu</h1>
        <button className="btn-export-excel" onClick={handleExportAnalytics}>
          📥 Xuất Excel
        </button>
      </div>

      {cancellationRate && (
        <div className="analytics-card">
          <h3>Tỷ lệ hủy lịch</h3>
          <div className="cancellation-stats">
            <div className="stat-item">
              <span className="label">Tổng lịch hẹn:</span>
              <span className="value">{cancellationRate.total_appointments}</span>
            </div>
            <div className="stat-item">
              <span className="label">Số lịch bị hủy:</span>
              <span className="value">{cancellationRate.cancelled_count}</span>
            </div>
            <div className="stat-item">
              <span className="label">Tỷ lệ hủy:</span>
              <span className="value">{cancellationRate.cancellation_rate}%</span>
            </div>
          </div>
        </div>
      )}

      <div className="analytics-card">
        <h3>Phân bố trạng thái lịch hẹn</h3>
        <div className="status-distribution">
          {appointmentStatus.map((status) => {
            const statusTranslations = {
              pending: 'Chờ xác nhận',
              confirmed: 'Đã xác nhận',
              completed: 'Đã hoàn thành',
              cancelled: 'Đã hủy',
              in_progress: 'Đang thực hiện',
              no_show: 'Không đến'
            };
            const displayStatus = statusTranslations[status.status] || status.status;
            
            return (
              <div key={status.status} className="status-item">
                <span className="status-label">{displayStatus}</span>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${(status.count / appointmentStatus.reduce((sum, s) => sum + s.count, 0)) * 100}%`
                    }}
                  />
                </div>
                <span className="status-count">{status.count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="analytics-card">
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
              {customerFrequency.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.name}</td>
                  <td>{customer.email}</td>
                  <td className="center">{customer.booking_count}</td>
                  <td className="right">{customer.total_spent.toLocaleString('vi-VN')} VNĐ</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Analytics;
