import React, { useState, useEffect } from 'react';
import dashboardService from '../../services/dashboardService';
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

  return (
    <div className="analytics">
      <h1>Phân tích dữ liệu</h1>

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
          {appointmentStatus.map((status) => (
            <div key={status.status} className="status-item">
              <span className="status-label">{status.status}</span>
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
          ))}
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
                <th>Số lần đặt</th>
                <th>Tổng chi tiêu</th>
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
