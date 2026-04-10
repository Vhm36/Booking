import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import dashboardService from '../../services/dashboardService';
import './Dashboard.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [bookingsByMonth, setBookingsByMonth] = useState(null);
  const [topServices, setTopServices] = useState(null);
  const [revenueByMonth, setRevenueByMonth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [summaryRes, bookingsRes, servicesRes, revenueRes] = await Promise.all([
        dashboardService.getSummary(),
        dashboardService.getBookingsByMonth(),
        dashboardService.getTopServices(),
        dashboardService.getRevenueByMonth()
      ]);

      setSummary(summaryRes.data.data);
      setBookingsByMonth(bookingsRes.data.data);
      setTopServices(servicesRes.data.data);
      setRevenueByMonth(revenueRes.data.data);
      setError('');
    } catch (err) {
      setError('Không thể tải dữ liệu dashboard.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Đang tải dashboard...</div>;
  }

  const bookingsChartData = {
    labels: bookingsByMonth?.map((b) => `${b.month}/${b.year}`) || [],
    datasets: [
      {
        label: 'Số lượng booking',
        data: bookingsByMonth?.map((b) => b.total) || [],
        borderColor: '#e91e63',
        backgroundColor: 'rgba(233, 30, 99, 0.1)',
        tension: 0.4
      }
    ]
  };

  const revenueChartData = {
    labels: revenueByMonth?.map((r) => `${r.month}/${r.year}`) || [],
    datasets: [
      {
        label: 'Doanh thu (VNĐ)',
        data: revenueByMonth?.map((r) => r.revenue) || [],
        backgroundColor: '#2196f3'
      }
    ]
  };

  const servicesChartData = {
    labels: topServices?.map((s) => s.name) || [],
    datasets: [
      {
        label: 'Số lượng booking',
        data: topServices?.map((s) => s.booking_count) || [],
        backgroundColor: ['#e91e63', '#2196f3', '#4caf50', '#ff9800', '#9c27b0']
      }
    ]
  };

  return (
    <div className="dashboard">
      <h1>Dashboard Quản Lý</h1>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon">📊</div>
          <div className="kpi-content">
            <h3>Tổng Booking</h3>
            <p className="kpi-value">{summary?.total_bookings || 0}</p>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon">💰</div>
          <div className="kpi-content">
            <h3>Tổng Doanh Thu</h3>
            <p className="kpi-value">{(summary?.total_revenue || 0).toLocaleString('vi-VN')} VNĐ</p>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon">👥</div>
          <div className="kpi-content">
            <h3>Tổng Khách Hàng</h3>
            <p className="kpi-value">{summary?.total_customers || 0}</p>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon">⭐</div>
          <div className="kpi-content">
            <h3>Dịch Vụ Phổ Biến</h3>
            <p className="kpi-value">{summary?.top_service || 'N/A'}</p>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Booking theo tháng</h3>
          <Line data={bookingsChartData} options={{ responsive: true, maintainAspectRatio: true }} />
        </div>

        <div className="chart-card">
          <h3>Doanh thu theo tháng</h3>
          <Bar data={revenueChartData} options={{ responsive: true, maintainAspectRatio: true }} />
        </div>

        <div className="chart-card">
          <h3>Dịch vụ phổ biến</h3>
          <Bar data={servicesChartData} options={{ responsive: true, maintainAspectRatio: true }} />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
