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
import dashboardService from '../../../services/dashboardService';
import './Dashboard.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [bookingsByMonth, setBookingsByMonth] = useState(null);
  const [topServices, setTopServices] = useState(null);
  const [revenueByMonth, setRevenueByMonth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const latestRevenue = Number(revenueByMonth?.[revenueByMonth.length - 1]?.revenue || 0);
  const latestCommission = Number(revenueByMonth?.[revenueByMonth.length - 1]?.staff_commission || 0);
  const previousRevenue = Number(
    revenueByMonth?.[Math.max((revenueByMonth?.length || 1) - 2, 0)]?.revenue || 0
  );
  const revenueDelta =
    previousRevenue > 0 ? ((latestRevenue - previousRevenue) / previousRevenue) * 100 : null;

  const latestBookings = Number(bookingsByMonth?.[bookingsByMonth.length - 1]?.total || 0);
  const previousBookings = Number(
    bookingsByMonth?.[Math.max((bookingsByMonth?.length || 1) - 2, 0)]?.total || 0
  );
  const bookingsDelta =
    previousBookings > 0 ? ((latestBookings - previousBookings) / previousBookings) * 100 : null;

  const chartBaseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#334155',
          font: { size: 12, weight: '600' }
        }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#f8fafc',
        bodyColor: '#f8fafc',
        padding: 10
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(148, 163, 184, 0.2)' },
        ticks: { color: '#64748b' }
      },
      y: {
        grid: { color: 'rgba(148, 163, 184, 0.2)' },
        ticks: { color: '#64748b' }
      }
    }
  };

  const bookingsChartData = {
    labels: bookingsByMonth?.map((b) => `${b.month}/${b.year}`) || [],
    datasets: [
      {
        label: 'Số lượng booking',
        data: bookingsByMonth?.map((b) => b.total) || [],
        borderColor: '#0f766e',
        backgroundColor: 'rgba(15, 118, 110, 0.15)',
        borderWidth: 2.5,
        pointRadius: 3,
        tension: 0.35,
        fill: true
      }
    ]
  };

  const revenueChartData = {
    labels: revenueByMonth?.map((r) => `${r.month}/${r.year}`) || [],
    datasets: [
      {
        label: 'Doanh thu (VNĐ)',
        data: revenueByMonth?.map((r) => r.revenue) || [],
        backgroundColor: 'rgba(14, 165, 163, 0.75)',
        borderRadius: 8,
        borderSkipped: false
      }
    ]
  };

  const servicesChartData = {
    labels: topServices?.map((s) => s.name) || [],
    datasets: [
      {
        label: 'Số lượng booking',
        data: topServices?.map((s) => s.booking_count) || [],
        backgroundColor: [
          'rgba(15, 118, 110, 0.88)',
          'rgba(8, 145, 178, 0.86)',
          'rgba(20, 184, 166, 0.82)',
          'rgba(56, 189, 248, 0.82)',
          'rgba(45, 212, 191, 0.8)'
        ],
        borderRadius: 8,
        borderSkipped: false
      }
    ]
  };

  return (
    <div className="dashboard">
      <section className="dashboard-hero">
        <div>
          <p className="dashboard-kicker">Admin Center</p>
          <h1>Dashboard điều hành</h1>
          <p className="dashboard-subtitle">
            Theo dõi nhanh vận hành salon theo thời gian thực, tập trung vào booking, doanh thu và
            hiệu suất dịch vụ.
          </p>
        </div>
        <div className="dashboard-hero-insights">
          <div className="insight-pill">
            <span>Booking tháng gần nhất</span>
            <strong>{latestBookings.toLocaleString('vi-VN')}</strong>
            <small className={bookingsDelta >= 0 ? 'positive' : 'negative'}>
              {bookingsDelta === null
                ? 'Chưa đủ dữ liệu so sánh'
                : `${bookingsDelta >= 0 ? '↑' : '↓'} ${Math.abs(bookingsDelta).toFixed(1)}%`}
            </small>
          </div>
          <div className="insight-pill">
            <span>Doanh thu tháng gần nhất</span>
            <strong>{latestRevenue.toLocaleString('vi-VN')} VNĐ</strong>
            <small className={revenueDelta >= 0 ? 'positive' : 'negative'}>
              {revenueDelta === null
                ? 'Chưa đủ dữ liệu so sánh'
                : `${revenueDelta >= 0 ? '↑' : '↓'} ${Math.abs(revenueDelta).toFixed(1)}%`}
            </small>
          </div>
        </div>
      </section>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-content">
            <h3>Tổng booking</h3>
            <p className="kpi-value">{summary?.total_bookings || 0}</p>
            <span>Tổng lịch đã tạo trong hệ thống</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-content">
            <h3>Tổng doanh thu</h3>
            <p className="kpi-value">{(summary?.total_revenue || 0).toLocaleString('vi-VN')} VNĐ</p>
            <span>Dòng tiền đã ghi nhận</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-content">
            <h3>Hoa hồng nhân viên (tháng gần nhất)</h3>
            <p className="kpi-value">{latestCommission.toLocaleString('vi-VN')} VNĐ</p>
            <span>10% trên lịch hoàn thành có phân công nhân viên</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-content">
            <h3>Tổng khách hàng</h3>
            <p className="kpi-value">{summary?.total_customers || 0}</p>
            <span>Số khách hàng đã phát sinh tài khoản</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-content">
            <h3>Dịch vụ phổ biến</h3>
            <p className="kpi-value">{summary?.top_service || 'N/A'}</p>
            <span>Dịch vụ có lượt đặt cao nhất</span>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-card-head">
            <h3>Xu hướng booking theo tháng</h3>
            <p>Giúp dự báo năng lực vận hành theo mùa</p>
          </div>
          <div className="chart-canvas-wrap">
            <Line data={bookingsChartData} options={chartBaseOptions} />
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-head">
            <h3>Doanh thu theo tháng (đã cộng hoa hồng)</h3>
            <p>Revenue = doanh thu dịch vụ + 10% commission nhân viên</p>
          </div>
          <div className="chart-canvas-wrap">
            <Bar data={revenueChartData} options={chartBaseOptions} />
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-head">
            <h3>Top dịch vụ phổ biến</h3>
            <p>Ưu tiên dịch vụ mang lại lượng booking tốt</p>
          </div>
          <div className="chart-canvas-wrap">
            <Bar data={servicesChartData} options={chartBaseOptions} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
