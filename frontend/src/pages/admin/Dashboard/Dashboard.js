import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';
import dashboardService from '../../../services/dashboardService';
import connectDashboardRealtime from '../../../services/dashboardRealtimeService';
import './Dashboard.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const APPOINTMENT_STATUS_META = {
  pending: {
    label: 'Chờ xác nhận',
    color: '#c69244',
    softColor: '#f7ead7'
  },
  confirmed: {
    label: 'Đã xác nhận',
    color: '#5f8d51',
    softColor: '#e7f0df'
  },
  completed: {
    label: 'Hoàn thành',
    color: '#0f766e',
    softColor: '#dcefeb'
  },
  cancelled: {
    label: 'Đã hủy',
    color: '#b86a55',
    softColor: '#f3ded6'
  }
};

const pad2 = (value) => String(value).padStart(2, '0');

const getTodayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
};

const getStatusMeta = (status) => {
  const key = String(status || '').toLowerCase();
  return APPOINTMENT_STATUS_META[key] || {
    label: status || 'Khác',
    color: '#7c887d',
    softColor: '#eef1ec'
  };
};

const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')} VNĐ`;

const formatDate = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('vi-VN');
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const formatDelta = (delta) => {
  if (delta === null || typeof delta === 'undefined') {
    return 'Chưa đủ dữ liệu so sánh';
  }

  return `${delta >= 0 ? '+' : ''}${Number(delta).toFixed(1)}% so với kỳ trước`;
};

const getPeriodHint = (period) => {
  if (period === 'day') return 'Trend theo giờ trong ngày';
  if (period === 'year') return 'Trend theo tháng trong năm';
  return 'Trend theo ngày trong tháng';
};

function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [period, setPeriod] = useState('month');
  const [selectedDate, setSelectedDate] = useState(getTodayKey());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [realtimeStatus, setRealtimeStatus] = useState('connecting');
  const [lastRealtimeEvent, setLastRealtimeEvent] = useState(null);
  const [activePanel, setActivePanel] = useState('trend');
  const realtimeStatusRef = useRef('connecting');
  const refreshTimerRef = useRef(null);

  const overviewParams = useMemo(() => {
    const params = { period, year: selectedYear };

    if (period === 'day') {
      params.date = selectedDate;
    }

    if (period === 'month') {
      params.month = selectedMonth;
    }

    return params;
  }, [period, selectedDate, selectedMonth, selectedYear]);

  const fetchDashboardData = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent) {
          setLoading(true);
        }

        const response = await dashboardService.getOverview(overviewParams);
        setOverview(response.data.data);
        setError('');
      } catch (err) {
        setError('Không thể tải dữ liệu dashboard.');
        console.error(err);
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [overviewParams]
  );

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    let socket = null;
    let cancelled = false;

    connectDashboardRealtime({
      onStatus: (status) => {
        realtimeStatusRef.current = status;
        setRealtimeStatus(status);
      },
      onUpdate: (payload) => {
        setLastRealtimeEvent(payload);
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = window.setTimeout(() => {
          fetchDashboardData({ silent: true });
        }, 250);
      }
    })
      .then((connectedSocket) => {
        if (cancelled) {
          connectedSocket.disconnect();
          return;
        }
        socket = connectedSocket;
      })
      .catch(() => {
        if (!cancelled) {
          setRealtimeStatus('fallback');
        }
      });

    const fallbackInterval = window.setInterval(() => {
      if (realtimeStatusRef.current !== 'connected') {
        fetchDashboardData({ silent: true });
      }
    }, 30000);

    return () => {
      cancelled = true;
      window.clearTimeout(refreshTimerRef.current);
      window.clearInterval(fallbackInterval);
      socket?.disconnect();
    };
  }, [fetchDashboardData]);

  const summary = overview?.summary || {};
  const automation = overview?.automation || {};
  const voucherStats = automation?.voucher_stats || {};
  const segmentRows = automation?.segment_breakdown || [];
  const trendRows = overview?.trend || [];
  const favoriteServices = overview?.favorite_services || [];
  const recentBookings = overview?.recent_bookings || [];
  const statusRows = (overview?.status_breakdown || []).map((item) => ({
    ...item,
    count: Number(item.count || 0),
    percent: Number(item.percent || 0),
    ...getStatusMeta(item.status)
  }));
  const completedRate = statusRows.find((item) => item.status === 'completed')?.percent || 0;
  const cancelledRate = statusRows.find((item) => item.status === 'cancelled')?.percent || 0;
  const favoriteService = favoriteServices[0];
  const processedCustomers = Number(automation.processed_customers || 0);
  const systemAssignedVouchers = Number(voucherStats.system_assigned || 0);
  const comebackAssigned = Number(voucherStats.comeback_assigned || 0);
  const vipAssigned = Number(voucherStats.vip_assigned || 0);
  const systemUsedVouchers = Number(voucherStats.system_used || 0);
  const activeSystemVouchers = Number(voucherStats.active_system_vouchers || 0);
  const automationUsageRate =
    systemAssignedVouchers > 0 ? (systemUsedVouchers / systemAssignedVouchers) * 100 : 0;
  const leadingSegment = segmentRows.reduce(
    (best, row) => (Number(row.count || 0) > Number(best?.count || 0) ? row : best),
    null
  );
  const getFavoriteServiceLimit = (p) => {
    if (p === 'day') return 3;
    if (p === 'year') return 10;
    return 5;
  };
  const favoriteServiceLimit = getFavoriteServiceLimit(period);
  const visibleFavoriteServices = favoriteServices.slice(0, favoriteServiceLimit);
  const favoriteServicePeakBookings = Math.max(
    ...visibleFavoriteServices.map((service) => Number(service.booking_count || 0)),
    1
  );
  const favoriteBookingTotal = visibleFavoriteServices.reduce(
    (sum, service) => sum + Number(service.booking_count || 0),
    0
  );
  const favoriteCompletedTotal = visibleFavoriteServices.reduce(
    (sum, service) => sum + Number(service.completed_count || 0),
    0
  );
  const visibleRecentBookings = recentBookings.slice(0, 5);
  const trendBookingValues = trendRows.map((item) => Number(item.bookings || 0));
  const panelTabs = [
    {
      key: 'trend',
      label: 'Số lượt booking',
      value: `${Number(summary.active_bookings || 0).toLocaleString('vi-VN')} lịch`
    },
    {
      key: 'status',
      label: 'Trạng thái',
      value: `${completedRate.toFixed(1)}% hoàn thành`
    },
    {
      key: 'services',
      label: 'Dịch vụ yêu thích',
      value: favoriteService?.name || 'Chưa có dữ liệu'
    },
    {
      key: 'automation',
      label: 'Tự động hóa',
      value: `${systemAssignedVouchers.toLocaleString('vi-VN')} voucher`
    },
    {
      key: 'recent',
      label: 'Đơn gần đây',
      value: `${visibleRecentBookings.length} đơn`
    }
  ];

  const chartBaseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#34423c',
          font: { size: 12, weight: '700' },
          boxWidth: 10
        }
      },
      tooltip: {
        backgroundColor: '#21322d',
        titleColor: '#fdfefa',
        bodyColor: '#fdfefa',
        padding: 10
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(123, 142, 134, 0.14)' },
        ticks: { color: '#687568', maxRotation: 0, autoSkip: true }
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(123, 142, 134, 0.16)' },
        ticks: { color: '#687568', precision: 0 }
      }
    }
  };

  const trendChartData = {
    labels: trendRows.map((item) => item.label),
    datasets: [
      {
        label: 'Booking',
        data: trendBookingValues,
        borderColor: '#0f766e',
        backgroundColor: 'rgba(15, 118, 110, 0.12)',
        borderWidth: 2.5,
        pointRadius: 2.5,
        pointHoverRadius: 5,
        tension: 0.34,
        fill: true
      }
    ]
  };

  const statusChartData = {
    labels: statusRows.map((item) => item.label),
    datasets: [
      {
        data: statusRows.map((item) => item.count),
        backgroundColor: statusRows.map((item) => item.color),
        borderColor: '#fdfefa',
        borderWidth: 3,
        hoverOffset: 6
      }
    ]
  };

  const serviceChartData = {
    labels: visibleFavoriteServices.map((item) => item.name),
    datasets: [
      {
        label: 'Số lượt đặt',
        data: visibleFavoriteServices.map((item) => Number(item.booking_count || 0)),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.06)',
        borderWidth: 2.5,
        pointRadius: 6,
        pointHoverRadius: 9,
        pointBackgroundColor: '#0000FF',
        pointBorderColor: '#fdfefa',
        pointBorderWidth: 2,
        tension: 0.28,
        fill: true
      }
    ]
  };

  const serviceChartOptions = {
    ...chartBaseOptions,
    plugins: {
      ...chartBaseOptions.plugins,
      legend: { display: false },
      tooltip: {
        ...chartBaseOptions.plugins.tooltip,
        callbacks: {
          title: (items) => visibleFavoriteServices[items[0]?.dataIndex]?.name || '',
          label: (context) => {
            const service = visibleFavoriteServices[context.dataIndex];
            return `Số lượt đặt: ${Number(service?.booking_count || 0).toLocaleString('vi-VN')} lượt`;
          }
        }
      }
    },
    scales: {
      x: {
        ...chartBaseOptions.scales.x,
        grid: { display: true, color: 'rgba(123, 142, 134, 0.12)', borderDash: [5, 5] },
        title: {
          display: false,
          text: 'Tên dịch vụ',
          color: '#34423c',
          font: { size: 12, weight: '700' }
        },
        ticks: {
          ...chartBaseOptions.scales.x.ticks,
          display: false
        }
      },
      y: {
        ...chartBaseOptions.scales.y,
        grid: { display: true, color: 'rgba(123, 142, 134, 0.12)', borderDash: [5, 5] },
        title: {
          display: true,
          text: 'Số lượt đặt',
          color: '#34423c',
          font: { size: 12, weight: '700' }
        },
        beginAtZero: true
      }
    }
  };

  const statusChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '66%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#21322d',
        titleColor: '#fdfefa',
        bodyColor: '#fdfefa',
        padding: 10,
        callbacks: {
          label: (context) => {
            const row = statusRows[context.dataIndex];
            return `${row.label}: ${row.count.toLocaleString('vi-VN')} lịch (${row.percent.toFixed(1)}%)`;
          }
        }
      }
    }
  };

  if (loading) {
    return <div className="loading">Đang tải dashboard...</div>;
  }

  return (
    <div className="dashboard">
      <section className="dashboard-hero">
        <div className="dashboard-title-block">
          <p className="dashboard-kicker">Admin Center</p>
          <h1>Dashboard điều hành</h1>
          {(realtimeStatus !== 'connected' || lastRealtimeEvent?.type) && (
            <div className={`dashboard-realtime-status status-${realtimeStatus}`}>
              {realtimeStatus === 'connected' ? null : 'Đang dùng cập nhật định kỳ'}
              {lastRealtimeEvent?.type ? <small>{lastRealtimeEvent.type}</small> : null}
            </div>
          )}
        </div>

        <div className="dashboard-filter-panel" aria-label="Bộ lọc dashboard">
          <div className="dashboard-period-tabs">
            {[
              ['day', 'Ngày'],
              ['month', 'Tháng'],
              ['year', 'Năm']
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={period === key ? 'active' : ''}
                onClick={() => setPeriod(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {period === 'day' && (
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          )}

          {period === 'month' && (
            <input
              type="month"
              value={`${selectedYear}-${pad2(selectedMonth)}`}
              onChange={(event) => {
                const [yearValue, monthValue] = event.target.value.split('-').map(Number);
                setSelectedYear(yearValue);
                setSelectedMonth(monthValue);
              }}
            />
          )}

          {period === 'year' && (
            <input
              type="number"
              min="2020"
              max="2100"
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number(event.target.value) || new Date().getFullYear())}
            />
          )}
        </div>
      </section>

      {error && <div className="alert alert-error">{error}</div>}

      <section className="dashboard-overview-grid">
        <button
          type="button"
          className={`dashboard-total-card dashboard-metric-card ${activePanel === 'trend' ? 'is-active' : ''}`}
          onClick={() => setActivePanel('trend')}
        >
          <span>Tổng booking</span>
          <strong>{Number(summary.total_bookings || 0).toLocaleString('vi-VN')}</strong>
          <small>{overview?.period?.label || 'Kỳ đang xem'}</small>
          <span className={`dashboard-delta ${summary.booking_delta_percent >= 0 ? 'positive' : 'negative'}`}>
            {formatDelta(summary.booking_delta_percent)}
          </span>
        </button>

        <div className="dashboard-kpi-stack">
          <button
            type="button"
            className={`dashboard-metric-card ${activePanel === 'trend' ? 'is-active' : ''}`}
            onClick={() => setActivePanel('trend')}
          >
            <span>Doanh thu hoàn thành</span>
            <strong>{formatMoney(summary.total_revenue)}</strong>
            <small>{formatDelta(summary.revenue_delta_percent)}</small>
          </button>
          <button
            type="button"
            className={`dashboard-metric-card ${activePanel === 'status' ? 'is-active' : ''}`}
            onClick={() => setActivePanel('status')}
          >
            <span>Hoàn thành</span>
            <strong>{completedRate.toFixed(1)}%</strong>
            <small>{Number(summary.completed_bookings || 0).toLocaleString('vi-VN')} lịch</small>
          </button>
          <button
            type="button"
            className={`dashboard-metric-card ${activePanel === 'status' ? 'is-active' : ''}`}
            onClick={() => setActivePanel('status')}
          >
            <span>Đã hủy</span>
            <strong>{cancelledRate.toFixed(1)}%</strong>
            <small>{Number(summary.cancelled_bookings || 0).toLocaleString('vi-VN')} lịch</small>
          </button>
          <button
            type="button"
            className={`dashboard-metric-card dashboard-metric-card--favorite ${activePanel === 'services' ? 'is-active' : ''}`}
            onClick={() => setActivePanel('services')}
          >
            <span>Dịch vụ được yêu thích</span>
            <strong>{favoriteService?.name || 'Chưa có dữ liệu'}</strong>
            <small>
              {favoriteService ? `${favoriteService.favorite_score.toFixed(1)}/100 điểm` : 'Chờ thêm booking'}
            </small>
          </button>
          <button
            type="button"
            className={`dashboard-metric-card ${activePanel === 'automation' ? 'is-active' : ''}`}
            onClick={() => setActivePanel('automation')}
          >
            <span>Tặng voucher tự động</span>
            <strong>{systemAssignedVouchers.toLocaleString('vi-VN')}</strong>
            <small>{processedCustomers.toLocaleString('vi-VN')} khách đã phân cụm</small>
          </button>
        </div>
      </section>

      <section className="dashboard-insight-shell">
        <div className="dashboard-insight-toolbar" aria-label="Điều khiển dữ liệu dashboard">
          {panelTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`dashboard-insight-tab${activePanel === tab.key ? ' is-active' : ''}`}
              onClick={() => setActivePanel(tab.key)}
              aria-pressed={activePanel === tab.key}
              title={tab.value}
            >
              <span>{tab.label}</span>
              <small>{tab.value}</small>
            </button>
          ))}
        </div>

        <article className="chart-card dashboard-insight-card">
          {activePanel === 'trend' && (
            <>
              <div className="chart-card-head">
                <div>
                  <h3>Số lượt booking</h3>
                  <p>{getPeriodHint(period)}</p>
                </div>
              </div>
              <div className="dashboard-trend-layout">
                <div className="chart-canvas-wrap dashboard-primary-chart">
                  <Line data={trendChartData} options={chartBaseOptions} />
                </div>

                <aside className="trend-favorite-rankings">
                  <div className="trend-favorite-head">
                    <div>
                      <h4>Top {favoriteServiceLimit} dịch vụ được yêu thích</h4>
                    </div>
                  </div>

                  {visibleFavoriteServices.length > 0 ? (
                    <table className="trend-favorite-table">
                      <thead>
                        <tr>
                          <th>Top</th>
                          <th>Dịch vụ</th>
                          <th>Lượt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleFavoriteServices.map((service, index) => (
                          <tr key={service.id || service.name}>
                            <td>#{index + 1}</td>
                            <td title={service.name}>{service.name}</td>
                            <td>{Number(service.booking_count || 0).toLocaleString('vi-VN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="trend-favorite-empty">Chưa có booking dịch vụ trong kỳ này.</div>
                  )}
                </aside>
              </div>
            </>
          )}

          {activePanel === 'status' && (
            <>
              <div className="chart-card-head">
                <div>
                  <h3>Tỷ lệ trạng thái</h3>
                  <p>Hoàn thành và hủy được tính trên tổng lịch trong kỳ</p>
                </div>
              </div>

              {statusRows.length > 0 ? (
                <div className="status-chart-layout">
                  <div className="chart-canvas-wrap status-chart-wrap">
                    <Doughnut data={statusChartData} options={statusChartOptions} />
                  </div>
                  <div className="status-legend">
                    {statusRows.map((item) => (
                      <div className="status-legend-row" key={item.status || item.label}>
                        <span style={{ backgroundColor: item.color }} aria-hidden="true" />
                        <div>
                          <strong>{item.label}</strong>
                          <small>
                            {item.count.toLocaleString('vi-VN')} lịch · {item.percent.toFixed(1)}%
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="chart-empty-state">Chưa có dữ liệu trạng thái trong kỳ này.</div>
              )}
            </>
          )}

          {activePanel === 'services' && (
            <>
              <div className="chart-card-head">
                <div>
                  <h3>Dịch vụ được yêu thích</h3>
                  <p>Xếp hạng theo lượt đặt thật, lịch hoàn thành và doanh thu trong kỳ.</p>
                </div>
              </div>
              {visibleFavoriteServices.length > 0 ? (
                <>
                  <div className="service-insight-summary">
                    <div className="service-insight-summary-item is-featured">
                      <span>Dẫn đầu</span>
                      <strong>{favoriteService?.name}</strong>
                      <small>{Number(favoriteService?.booking_count || 0).toLocaleString('vi-VN')} lượt đặt thật</small>
                    </div>
                    <div className="service-insight-summary-item">
                      <span>Tổng lượt đặt</span>
                      <strong>{favoriteBookingTotal.toLocaleString('vi-VN')}</strong>
                      <small>{favoriteCompletedTotal.toLocaleString('vi-VN')} lịch hoàn thành</small>
                    </div>
                  </div>

                  <div className="service-insight-layout">
                    <div className="chart-canvas-wrap service-score-wrap">
                      <Line data={serviceChartData} options={serviceChartOptions} />
                    </div>

                    <section className="services-ranking-section">
                      <div className="services-ranking-head">
                        <h4>Bảng xếp hạng chi tiết</h4>
                        <span>{visibleFavoriteServices.length} dịch vụ</span>
                      </div>
                      <div className="services-ranking-list">
                      {visibleFavoriteServices.map((srv, index) => {
                        const bookingCount = Number(srv.booking_count || 0);
                        const completedCount = Number(srv.completed_count || 0);
                        const revenue = Number(srv.revenue || 0);
                        const completionRate = bookingCount > 0 ? (completedCount / bookingCount) * 100 : 0;
                        const score = Number(srv.favorite_score || 0);
                        const rankClass = index < 3 ? `rank-${index + 1}` : 'rank-other';
                        const meterWidth = `${Math.max(
                          6,
                          Math.min(100, (bookingCount / favoriteServicePeakBookings) * 100)
                        )}%`;

                        return (
                          <article className="service-rank-card" key={srv.id || srv.name}>
                            <div className="service-rank-head">
                              <span className={`service-rank-badge ${rankClass}`}>
                                #{index + 1}
                              </span>
                              <strong title={srv.name}>{srv.name}</strong>
                              <small title={overview?.favorite_formula}>{score.toFixed(1)}/100</small>
                            </div>

                            <div className="service-rank-meter" aria-hidden="true">
                              <i style={{ width: meterWidth }} />
                            </div>

                            <div className="service-rank-stats">
                              <span>
                                <b>{bookingCount.toLocaleString('vi-VN')}</b> lượt đặt
                              </span>
                              <span>
                                <b>{completionRate.toFixed(0)}%</b> hoàn thành
                              </span>
                              <span>
                                <b>{formatMoney(revenue)}</b>
                              </span>
                            </div>
                          </article>
                        );
                      })}
                      </div>
                    </section>
                  </div>
                </>
              ) : (
                <div className="chart-empty-state">Chưa có booking dịch vụ trong kỳ này.</div>
              )}
            </>
          )}


          {activePanel === 'automation' && (
            <>
              <div className="chart-card-head">
                <div>
                  <h3>Tự động hóa voucher</h3>
                  <p>Lần phân tích gần nhất: {formatDateTime(automation.last_analysis_at)}</p>
                </div>
                <span>{lastRealtimeEvent?.type?.startsWith('automation.') ? 'Realtime' : 'Định kỳ'}</span>
              </div>

              <div className="automation-summary-grid">
                <div className="automation-summary-item">
                  <span>Voucher hệ thống</span>
                  <strong>{systemAssignedVouchers.toLocaleString('vi-VN')}</strong>
                  <small>COMEBACK {comebackAssigned} · VIP {vipAssigned}</small>
                </div>
                <div className="automation-summary-item">
                  <span>Đã sử dụng</span>
                  <strong>{systemUsedVouchers.toLocaleString('vi-VN')}</strong>
                  <small>{automationUsageRate.toFixed(1)}% voucher đã dùng</small>
                </div>
                <div className="automation-summary-item">
                  <span>Còn hiệu lực</span>
                  <strong>{activeSystemVouchers.toLocaleString('vi-VN')}</strong>
                  <small>Mã tự động đang chạy</small>
                </div>
                <div className="automation-summary-item">
                  <span>Khách đã phân cụm</span>
                  <strong>{processedCustomers.toLocaleString('vi-VN')}</strong>
                  <small>{leadingSegment?.label || 'Chưa có phân khúc nổi bật'}</small>
                </div>
              </div>

              <div className="automation-detail-layout">
                <section className="automation-segment-panel">
                  <div className="automation-panel-head">
                    <h4>Phân khúc khách hàng</h4>
                    <span>{processedCustomers.toLocaleString('vi-VN')} khách</span>
                  </div>
                  <div className="automation-segment-list">
                    {segmentRows.map((segment) => {
                      const count = Number(segment.count || 0);
                      const percent = processedCustomers > 0 ? (count / processedCustomers) * 100 : 0;

                      return (
                        <div className="automation-segment-row" key={segment.segment || segment.label}>
                          <div className="automation-segment-copy">
                            <strong>{segment.label || 'Chưa phân loại'}</strong>
                            <small>{percent.toFixed(1)}% tổng khách</small>
                          </div>
                          <span>{count.toLocaleString('vi-VN')}</span>
                          <div className="automation-progress" aria-hidden="true">
                            <i style={{ width: `${Math.min(100, percent)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="automation-voucher-panel">
                  <div className="automation-panel-head">
                    <h4>Voucher tự động</h4>
                    <span>{automation.period_label || 'Từ 01/01/2024 đến nay'}</span>
                  </div>
                  <dl className="automation-voucher-list">
                    <div>
                      <dt>Nguy cơ rời bỏ</dt>
                      <dd>{comebackAssigned.toLocaleString('vi-VN')} voucher quay lại</dd>
                    </div>
                    <div>
                      <dt>Khách VIP</dt>
                      <dd>{vipAssigned.toLocaleString('vi-VN')} voucher VIP</dd>
                    </div>
                    <div>
                      <dt>Giảm giá đã áp dụng</dt>
                      <dd>{formatMoney(voucherStats.system_discount_total)}</dd>
                    </div>
                  </dl>
                </section>
              </div>
            </>
          )}


          {activePanel === 'recent' && (
            <>
              <div className="chart-card-head">
                <div>
                  <h3>Đơn gần đây</h3>
                  <p>Hiển thị thời gian và giá trị đơn trong kỳ đang chọn</p>
                </div>
              </div>

              {visibleRecentBookings.length > 0 ? (
                <div className="recent-booking-list">
                  {visibleRecentBookings.map((booking) => {
                    const meta = getStatusMeta(booking.status);
                    return (
                      <div className="recent-booking-row" key={booking.id}>
                        <div>
                          <strong>{booking.service_name}</strong>
                          <small>
                            {formatDate(booking.appointment_date)} · {booking.appointment_time} ·{' '}
                            {booking.customer_name || 'Khách hàng'}
                          </small>
                        </div>
                        <div className="recent-booking-value">
                          <span style={{ backgroundColor: meta.softColor, color: meta.color }}>{meta.label}</span>
                          <strong>{formatMoney(booking.total_amount)}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="chart-empty-state">Chưa có đơn nào trong kỳ đang chọn.</div>
              )}
            </>
          )}
        </article>
      </section>
    </div>
  );
}

export default Dashboard;
