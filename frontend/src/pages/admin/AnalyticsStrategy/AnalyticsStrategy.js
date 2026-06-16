import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import dashboardService from '../../../services/dashboardService';
import { exportToExcel } from '../../../utils/exportExcel';
import './AnalyticsStrategy.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const DEC_LIMIT_PER_CLUSTER = 100;
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);
const CURRENT_DATE = new Date();
const CURRENT_YEAR = CURRENT_DATE.getFullYear();
const YEAR_OPTIONS = Array.from({ length: 3 }, (_, index) => CURRENT_YEAR - index);

const VIEW_META = {
  table: {
    kicker: 'Ưu tiên vận hành',
    title: 'Khuyến nghị chiến lược thịnh hành',
    description:
      'Xếp hạng các chiến lược nên ưu tiên theo quy mô và đặc trưng hành vi của từng cụm trong kỳ.'
  },
  customers: {
    kicker: 'Kiểm tra phân cụm',
    title: 'Danh sách khách hàng',
    description:
      'Tra cứu khách hàng thuộc C0-C6, đối chiếu lịch hẹn, tỷ lệ hoàn thành, tỷ lệ hủy và mức chi tiêu.'
  },
  'clusters-detail': {
    kicker: 'Phân tích cụm',
    title: 'Đặc trưng chi tiết từng cụm',
    description:
      'Đọc nhanh quy mô, chi tiêu, tỷ lệ hủy, tần suất và đặc điểm hành vi nổi bật của từng cụm khách hàng.'
  },
  'clusters-profile': {
    kicker: 'Phân tích cụm',
    title: 'Hồ sơ trung bình theo cụm',
    description:
      'So sánh các đặc điểm trung bình của từng cụm để nhìn ra nhóm nào chi tiêu cao, hủy nhiều hoặc quay lại thường xuyên.'
  },
  'clusters-strategy': {
    kicker: 'Phân tích cụm',
    title: 'Chiến lược theo cụm',
    description: 'Hành động ưu tiên dành cho từng nhóm hành vi C0-C6.'
  }
};

const formatDate = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('vi-VN');
};

const slugifyPeriod = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

const CLUSTER_ACTION_META = {
  frequent_single_service: {
    action: 'Gói dịch vụ định kỳ',
    rationale: 'Khách trung thành với một dịch vụ và có chu kỳ quay lại rõ.',
    impact: 'Giữ chân khách ổn định và mở cơ hội bán thêm dịch vụ bổ trợ.'
  },
  frequent_cancel_no_show: {
    action: 'Nhắc lịch + đặt cọc',
    rationale: 'Tỷ lệ hủy hoặc không đến, hoặc Cancellation Score đã vượt ngưỡng an toàn.',
    impact: 'Giảm hủy sát giờ và bảo vệ công suất của nhân viên.'
  },
  many_bookings_low_arrival: {
    action: 'Giới hạn giữ chỗ',
    rationale: 'Khách tạo nhiều lịch nhưng tỷ lệ đến thực tế cực thấp.',
    impact: 'Ngăn đặt lịch ảo và giải phóng sớm các khung giờ có giá trị.'
  },
  low_usage_premium: {
    action: 'Chăm sóc cao cấp',
    rationale: 'Mỗi lần dùng có giá trị cao, cần cá nhân hóa để tăng tần suất quay lại.',
    impact: 'Tăng doanh thu trên khách hàng và khả năng quay lại 5%-15%.'
  },
  high_usage_budget: {
    action: 'Gói tiết kiệm',
    rationale: 'Nhóm dùng thường xuyên nhưng giá trị trung bình còn thấp.',
    impact: 'Tăng doanh thu lặp lại và mở đường nâng cấp dịch vụ.'
  },
  one_time_then_left: {
    action: 'Voucher quay lại',
    rationale: 'Nhóm mới dùng một lần cần lý do rõ ràng để đặt lịch lần hai.',
    impact: 'Tăng tỷ lệ quay lại sau lần đầu và giảm thất thoát khách mới.'
  },
  low_monthly_usage: {
    action: 'Nhắc lịch tháng',
    rationale: 'Nhóm có nhịp sử dụng thưa, phù hợp chăm sóc định kỳ.',
    impact: 'Tăng tần suất đặt lịch và giữ tương tác ổn định theo tháng.'
  }
};

const toNumber = (value) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const round = (value, digits = 1) => {
  const numberValue = toNumber(value);
  return Number(numberValue.toFixed(digits));
};

const formatDecimal = (value, digits = 1) =>
  round(value, digits).toLocaleString('vi-VN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });

const formatCurrencyCompact = (value) => {
  const numberValue = toNumber(value);
  if (numberValue <= 0) return '0 đ';
  if (numberValue >= 1000000) return `${formatDecimal(numberValue / 1000000, 1)} triệu`;
  if (numberValue >= 1000) return `${Math.round(numberValue / 1000).toLocaleString('vi-VN')} nghìn`;
  return `${Math.round(numberValue).toLocaleString('vi-VN')} đ`;
};

const averageFromCustomers = (customers = [], key) => {
  const values = customers
    .map((customer) => toNumber(customer[key]))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const buildClusterProfiles = (clusters = []) =>
  clusters.map((cluster, index) => {
    const averages = cluster.averages || {};
    const customers = cluster.customers || [];
    const avgServices = averageFromCustomers(customers, 'distinct_services');
    const avgRecency = averageFromCustomers(customers, 'recency_days');

    return {
      ...cluster,
      code: cluster.code || `C${index}`,
      display: cluster.code || `C${index}`,
      index,
      count: toNumber(cluster.count),
      percent: toNumber(cluster.percent),
      avgSpend: toNumber(averages.avg_completed_amount),
      avgSpendK: Math.round(toNumber(averages.avg_completed_amount) / 1000),
      totalBookings: toNumber(averages.total_bookings),
      monthlyRate: toNumber(averages.monthly_booking_rate),
      completionRate: toNumber(averages.completion_rate),
      cancellationRate: toNumber(averages.cancellation_rate),
      avgServices,
      avgRecency,
      actionMeta: CLUSTER_ACTION_META[cluster.key] || {
        action: cluster.short_label || 'Theo dõi',
        rationale: cluster.description || 'Cần quan sát thêm hành vi.',
        impact: 'Cải thiện chăm sóc và giữ chân khách hàng.'
      }
    };
  });

function AnalyticsStrategy({ view = 'table' }) {
  const activeView = VIEW_META[view] ? view : 'table';
  const viewMeta = VIEW_META[activeView];
  const [strategyYear, setStrategyYear] = useState(CURRENT_YEAR);
  const [strategyMonth, setStrategyMonth] = useState(CURRENT_DATE.getMonth() + 1);
  const [decReport, setDecReport] = useState(null);
  const [decLoading, setDecLoading] = useState(true);
  const [decError, setDecError] = useState('');
  const [clusterFilter, setClusterFilter] = useState('all');
  const [strategyFilter, setStrategyFilter] = useState('all');
  const [customerSearch, setCustomerSearch] = useState('');

  useEffect(() => {
    fetchStrategyData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategyYear, strategyMonth]);

  const decClusters = useMemo(() => decReport?.clusters || [], [decReport]);
  const clusterProfiles = useMemo(() => buildClusterProfiles(decClusters), [decClusters]);

  useEffect(() => {
    if (clusterFilter === 'all') {
      return;
    }

    const hasSelectedCluster = decClusters.some((cluster) => cluster.key === clusterFilter);
    if (!hasSelectedCluster) {
      setClusterFilter('all');
    }
  }, [clusterFilter, decClusters]);

  useEffect(() => {
    if (strategyFilter === 'all') {
      return;
    }

    const hasSelectedStrategy = decClusters.some((cluster) => cluster.key === strategyFilter);
    if (!hasSelectedStrategy) {
      setStrategyFilter('all');
    }
  }, [strategyFilter, decClusters]);

  const clusterOptions = useMemo(
    () =>
      decClusters.map((cluster, index) => ({
        key: cluster.key,
        label: `${cluster.code || `C${index}`} - ${cluster.short_label}`,
        count: Number(cluster.count || 0),
        cluster_number: index
      })),
    [decClusters]
  );

  const strategyRows = useMemo(() => {
    const rows = [];
    decClusters.forEach((cluster, index) => {
      const clusterCode = cluster.code || `C${index}`;
      (cluster.customers || []).forEach((customer) => {
        rows.push({
          ...customer,
          cluster_key: cluster.key,
          cluster_number: index,
          cluster_display: clusterCode,
          cluster_label: cluster.label,
          cluster_short_label: cluster.short_label,
          strategy: cluster.strategy
        });
      });
    });

    return rows.sort(
      (a, b) =>
        new Date(b.last_booking_date || 0).getTime() - new Date(a.last_booking_date || 0).getTime() ||
        Number(b.total_bookings || 0) - Number(a.total_bookings || 0)
    );
  }, [decClusters]);

  const filteredStrategyRows = useMemo(
    () => {
      const normalizedSearch = customerSearch.trim().toLocaleLowerCase('vi-VN');
      return strategyRows.filter((customer) => {
        const matchesCluster = clusterFilter === 'all' || customer.cluster_key === clusterFilter;
        const matchesSearch = !normalizedSearch ||
          String(customer.name || '').toLocaleLowerCase('vi-VN').includes(normalizedSearch) ||
          String(customer.email || '').toLocaleLowerCase('vi-VN').includes(normalizedSearch);
        return matchesCluster && matchesSearch;
      });
    },
    [clusterFilter, customerSearch, strategyRows]
  );

  const trendingStrategyRows = useMemo(
    () => [...clusterProfiles].sort((a, b) => b.count - a.count || a.index - b.index),
    [clusterProfiles]
  );

  const filteredTrendingStrategyRows = useMemo(
    () =>
      strategyFilter === 'all'
        ? trendingStrategyRows
        : trendingStrategyRows.filter((cluster) => cluster.key === strategyFilter),
    [strategyFilter, trendingStrategyRows]
  );

  const activeClusterOption = useMemo(
    () => clusterOptions.find((option) => option.key === clusterFilter) || null,
    [clusterFilter, clusterOptions]
  );

  const periodLabel = useMemo(
    () => decReport?.period?.label || `Tháng ${strategyMonth}/${strategyYear}`,
    [decReport, strategyMonth, strategyYear]
  );

  const topStrategyCluster = useMemo(
    () => [...decClusters].sort((a, b) => Number(b.count || 0) - Number(a.count || 0))[0] || null,
    [decClusters]
  );

  const profileChartData = useMemo(
    () => ({
      labels: clusterProfiles.map((cluster) => cluster.code),
      datasets: [
        {
          label: 'Chi tiêu TB (nghìn đ)',
          data: clusterProfiles.map((cluster) => cluster.avgSpendK),
          backgroundColor: '#2563eb',
          borderRadius: 5,
          maxBarThickness: 18
        },
        {
          label: 'Tỷ lệ hủy (%)',
          data: clusterProfiles.map((cluster) => cluster.cancellationRate),
          backgroundColor: '#f97316',
          borderRadius: 5,
          maxBarThickness: 18
        },
        {
          label: 'Hoàn thành (%)',
          data: clusterProfiles.map((cluster) => cluster.completionRate),
          backgroundColor: '#16a34a',
          borderRadius: 5,
          maxBarThickness: 18
        },
        {
          label: 'Tần suất/tháng',
          data: clusterProfiles.map((cluster) => cluster.monthlyRate),
          backgroundColor: '#e11d48',
          borderRadius: 5,
          maxBarThickness: 18
        },
        {
          label: 'Dịch vụ TB',
          data: clusterProfiles.map((cluster) => round(cluster.avgServices, 1)),
          backgroundColor: '#7c3aed',
          borderRadius: 5,
          maxBarThickness: 18
        },
        {
          label: 'Gần nhất (ngày)',
          data: clusterProfiles.map((cluster) => round(cluster.avgRecency, 1)),
          backgroundColor: '#64748b',
          borderRadius: 5,
          maxBarThickness: 18
        }
      ]
    }),
    [clusterProfiles]
  );

  const profileChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            color: '#334155',
            font: {
              size: 11,
              weight: 700
            }
          }
        },
        tooltip: {
          callbacks: {
            title: (items) => {
              const item = items[0];
              const cluster = clusterProfiles[item.dataIndex];
              return cluster ? `${cluster.display} - ${cluster.short_label}` : item.label;
            },
            label: (item) => `${item.dataset.label}: ${item.formattedValue}`
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Cụm'
          },
          grid: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            color: '#64748b',
            font: {
              size: 11
            }
          },
          title: {
            display: true,
            text: 'Giá trị trung bình'
          }
        }
      }
    }),
    [clusterProfiles]
  );

  const fetchStrategyData = async () => {
    try {
      setDecLoading(true);
      setDecError('');
      const response = await dashboardService.getDecClustering({
        year: strategyYear,
        month: strategyMonth,
        limit: DEC_LIMIT_PER_CLUSTER
      });
      setDecReport(response.data?.data || null);
    } catch (err) {
      setDecError(err.response?.data?.message || 'Không thể tải khuyến nghị chiến lược.');
    } finally {
      setDecLoading(false);
    }
  };

  const handleExportStrategies = () => {
    if (filteredTrendingStrategyRows.length === 0) {
      window.alert('Không có dữ liệu chiến lược để xuất.');
      return;
    }

    const periodSuffix = slugifyPeriod(periodLabel) || `thang-${strategyMonth}-${strategyYear}`;

    exportToExcel({
      fileName: `chien-luoc-thinh-hanh_${periodSuffix}`,
      sheets: [
        {
          name: 'Khuyến nghị',
          columns: [
            { key: 'strategy', header: 'Chiến lược', width: 52 },
            { key: 'action', header: 'Hành động chính', width: 28 },
            { key: 'count', header: 'Số khách', width: 14 },
            { key: 'code', header: 'Cụm', width: 10 },
            { key: 'label', header: 'Tên cụm', width: 30 }
          ],
          rows: filteredTrendingStrategyRows.map((cluster) => ({
            ...cluster,
            action: cluster.actionMeta.action
          }))
        }
      ]
    });
  };

  const handleExportCustomers = () => {
    if (filteredStrategyRows.length === 0) {
      window.alert('Không có khách hàng để xuất.');
      return;
    }

    const clusterSuffix = activeClusterOption ? `cum-${activeClusterOption.cluster_number}` : 'tat-ca-cum';
    const periodSuffix = slugifyPeriod(periodLabel) || `thang-${strategyMonth}-${strategyYear}`;

    exportToExcel({
      fileName: `danh-sach-khach-hang_${periodSuffix}_${clusterSuffix}`,
      sheets: [
        {
          name: 'Khách hàng',
          columns: [
            { key: 'name', header: 'Khách hàng', width: 24 },
            { key: 'email', header: 'Email', width: 30 },
            { key: 'cluster_display', header: 'Cụm', width: 10 },
            { key: 'cluster_label', header: 'Nhóm hành vi', width: 30 },
            { key: 'total_bookings', header: 'Tổng lịch', width: 12 },
            { key: 'completion_rate', header: 'Hoàn thành (%)', width: 16 },
            { key: 'cancellation_rate', header: 'Hủy (%)', width: 14 },
            { key: 'completed_revenue', header: 'Tổng chi tiêu', width: 20 },
            { key: 'last_booking_date', header: 'Lịch gần nhất', width: 16, transform: formatDate }
          ],
          rows: filteredStrategyRows
        }
      ]
    });
  };

  return (
    <div className={`dec-report dec-report-${activeView}`}>
      <div className="dec-report-header">
        <div className="dec-report-title">
          <p>{viewMeta.kicker}</p>
          <h1>{viewMeta.title}</h1>
          <span>{viewMeta.description}</span>
        </div>

        <div className="dec-report-actions">
          <div className="dec-period-controls">
            <label>
              <span>Năm</span>
              <select value={strategyYear} onChange={(event) => setStrategyYear(Number(event.target.value))}>
                {YEAR_OPTIONS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Tháng</span>
              <select value={strategyMonth} onChange={(event) => setStrategyMonth(Number(event.target.value))}>
                {MONTH_OPTIONS.map((month) => (
                  <option key={month} value={month}>
                    Tháng {month}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="dec-action-buttons">
            <Link to="/admin/analytics" className="dec-secondary-link">
              Tổng quan
            </Link>
            <NavLink
              to="/admin/analytics/strategy/table"
              className={({ isActive }) =>
                `dec-strategy-link ${isActive || activeView === 'table' ? 'is-active' : ''}`
              }
            >
              Khuyến nghị thịnh hành
            </NavLink>
            <NavLink
              to="/admin/analytics/strategy/customers"
              className={() =>
                `dec-strategy-link ${activeView === 'customers' ? 'is-active' : ''}`
              }
            >
              Danh sách khách hàng
            </NavLink>
            <NavLink
              to="/admin/analytics/strategy/clusters"
              className={() =>
                `dec-strategy-link ${activeView === 'clusters-detail' ? 'is-active' : ''}`
              }
            >
              Đặc trưng cụm
            </NavLink>
            <NavLink
              to="/admin/analytics/strategy/clusters/profile"
              className={() =>
                `dec-strategy-link ${activeView === 'clusters-profile' ? 'is-active' : ''}`
              }
            >
              Hồ sơ trung bình
            </NavLink>
            <NavLink
              to="/admin/analytics/strategy/clusters/strategy"
              className={() =>
                `dec-strategy-link ${activeView === 'clusters-strategy' ? 'is-active' : ''}`
              }
            >
              Chiến lược C0-C6
            </NavLink>
          </div>
        </div>
      </div>

      {decError && <div className="dec-alert dec-alert-danger">{decError}</div>}

      {decLoading ? (
        <div className="dec-loading">Đang tải khuyến nghị chiến lược...</div>
      ) : (
        <>
          {decReport && !decReport.summary?.is_enough_data && (
            <div className="dec-alert dec-alert-warning">
              Dữ liệu hiện có {decReport.summary?.total_customers || 0} khách trong tháng. DEC nên có tối thiểu{' '}
              {decReport.method?.min_recommended_customers || 100} khách để cụm ổn định hơn.
            </div>
          )}

          <div className="dec-summary-row">
            <div>
              <span>Khách trong tháng</span>
              <strong>{decReport?.summary?.total_customers || 0}</strong>
            </div>
            <div>
              <span>Đã vào cụm</span>
              <strong>{decReport?.summary?.clustered_customers || 0}</strong>
            </div>
            <div>
              <span>Cụm nổi bật</span>
              <strong>{topStrategyCluster?.short_label || '-'}</strong>
            </div>
          </div>

          {activeView === 'table' && (
            <section className="dec-table-card dec-page-card">
              <div className="dec-section-head dec-trending-head">
                <div>
                  <h2>Khuyến nghị chiến lược thịnh hành</h2>
                  <span>Xếp theo số khách cần ưu tiên trong từng cụm</span>
                </div>
                <div className="dec-trending-filters">
                  <label>
                    <span>Thời gian</span>
                    <strong className="dec-period-badge">{periodLabel}</strong>
                  </label>
                  <label htmlFor="dec-strategy-filter">
                    <span>Chiến lược</span>
                    <select
                      id="dec-strategy-filter"
                      value={strategyFilter}
                      onChange={(event) => setStrategyFilter(event.target.value)}
                    >
                      <option value="all">Tất cả chiến lược</option>
                      {clusterProfiles.map((cluster) => (
                        <option key={cluster.key} value={cluster.key}>
                          {cluster.code} - {cluster.actionMeta.action}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="dec-table-wrap">
                <table className="dec-table dec-trending-table">
                  <thead>
                    <tr>
                      <th>Khuyến nghị thịnh hành</th>
                      <th>Hành động chính</th>
                      <th>Quy mô</th>
                      <th>Cụm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrendingStrategyRows.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="dec-empty">Chưa có dữ liệu để tạo khuyến nghị.</td>
                      </tr>
                    ) : (
                      filteredTrendingStrategyRows.map((cluster) => (
                          <tr key={cluster.key}>
                            <td>
                              {cluster.strategy}
                              <small className="dec-table-note">{cluster.label}</small>
                            </td>
                            <td className="dec-action-cell">{cluster.actionMeta.action}</td>
                            <td>
                              <strong>{cluster.count.toLocaleString('vi-VN')} khách</strong>
                              <small className="dec-table-note">{formatDecimal(cluster.percent, 1)}% số khách đã phân cụm</small>
                            </td>
                            <td className="dec-trending-cluster-cell">
                              <span className="dec-cluster-pill">{cluster.code}</span>
                              <small className="dec-table-note">{cluster.short_label}</small>
                            </td>
                          </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="dec-export-row">
                <span>Xuất {filteredTrendingStrategyRows.length} chiến lược theo bộ lọc hiện tại</span>
                <button type="button" className="btn-export-excel" onClick={handleExportStrategies}>
                  Xuất file
                </button>
              </div>
            </section>
          )}

          {activeView === 'customers' && (
            <section className="dec-table-card dec-page-card dec-customer-list-card">
              <div className="dec-section-head dec-customer-list-head">
                <div>
                  <h2>Danh sách khách hàng</h2>
                  <span>
                    {periodLabel} · {filteredStrategyRows.length}
                    {clusterFilter !== 'all' || customerSearch ? `/${strategyRows.length}` : ''} khách
                  </span>
                </div>
                <div className="dec-customer-filters">
                  <label>
                    <span>Tìm khách hàng</span>
                    <input
                      type="search"
                      value={customerSearch}
                      onChange={(event) => setCustomerSearch(event.target.value)}
                      placeholder="Tên hoặc email"
                    />
                  </label>
                  <label className="dec-cluster-filter" htmlFor="dec-customer-cluster-filter">
                    <span>Cụm</span>
                    <select
                      id="dec-customer-cluster-filter"
                      value={clusterFilter}
                      onChange={(event) => setClusterFilter(event.target.value)}
                    >
                      <option value="all">Tất cả cụm</option>
                      {clusterOptions.map((cluster) => (
                        <option key={cluster.key} value={cluster.key}>
                          {cluster.label} ({cluster.count})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="dec-table-wrap">
                <table className="dec-table dec-customer-table">
                  <thead>
                    <tr>
                      <th>Khách hàng</th>
                      <th>Cụm</th>
                      <th>Tổng lịch</th>
                      <th>Hoàn thành</th>
                      <th>Hủy</th>
                      <th>Chi tiêu</th>
                      <th>Gần nhất</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStrategyRows.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="dec-empty">Không tìm thấy khách hàng phù hợp.</td>
                      </tr>
                    ) : (
                      filteredStrategyRows.map((customer) => (
                        <tr key={`${customer.cluster_key}-${customer.id}`}>
                          <td>
                            <div className="dec-user-cell">
                              <strong>{customer.name}</strong>
                              <span>{customer.email || '-'}</span>
                            </div>
                          </td>
                          <td>
                            <span className="dec-cluster-pill">
                              {customer.cluster_display} · {customer.cluster_short_label}
                            </span>
                          </td>
                          <td>{Number(customer.total_bookings || 0).toLocaleString('vi-VN')}</td>
                          <td>{formatDecimal(customer.completion_rate, 1)}%</td>
                          <td>
                            {formatDecimal(customer.cancellation_rate, 1)}%
                          </td>
                          <td>{formatCurrencyCompact(customer.completed_revenue)}</td>
                          <td>{formatDate(customer.last_booking_date)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="dec-export-row">
                <span>Xuất danh sách khách hàng đang hiển thị</span>
                <button type="button" className="btn-export-excel" onClick={handleExportCustomers}>
                  Xuất file
                </button>
              </div>
            </section>
          )}

          {activeView === 'clusters-detail' && (
            <section className="dec-cluster-screen dec-cluster-detail-screen">
              <div className="dec-cluster-screen-head">
                <div>
                  <h2>Đặc trưng chi tiết của 7 cụm hành vi</h2>
                  <span>{periodLabel} · {clusterProfiles.length} cụm hành vi</span>
                </div>
                <span className="dec-paper-chip">DEC / XAI</span>
              </div>

              <div className="dec-character-table">
                {clusterProfiles.length === 0 ? (
                  <div className="dec-empty">Chưa có dữ liệu cụm trong kỳ đang chọn.</div>
                ) : (
                  clusterProfiles.map((cluster) => (
                    <article className="dec-character-row" key={cluster.key}>
                      <div className="dec-character-cluster">
                        <strong>{cluster.display}</strong>
                        <span>
                          {cluster.count.toLocaleString('vi-VN')} khách · {formatDecimal(cluster.percent, 1)}%
                        </span>
                      </div>
                      <ul>
                        <li>
                          <strong>Chi tiêu TB:</strong> {formatCurrencyCompact(cluster.avgSpend)} mỗi lịch hoàn thành.
                        </li>
                        <li>
                          <strong>Tỷ lệ hủy:</strong> {formatDecimal(cluster.cancellationRate, 1)}% · hoàn thành {formatDecimal(cluster.completionRate, 1)}%.
                        </li>
                        <li>
                          <strong>Tần suất:</strong> {formatDecimal(cluster.monthlyRate, 2)} lịch/tháng · tổng lịch TB {formatDecimal(cluster.totalBookings, 1)}.
                        </li>
                        <li>
                          <strong>Dịch vụ:</strong> trung bình {formatDecimal(cluster.avgServices, 1)} nhóm dịch vụ · gần nhất {formatDecimal(cluster.avgRecency, 0)} ngày.
                        </li>
                        <li>
                          <strong>Đặc trưng chính:</strong> {cluster.description}
                        </li>
                      </ul>
                    </article>
                  ))
                )}
              </div>
            </section>
          )}

          {activeView === 'clusters-profile' && (
            <section className="dec-cluster-screen dec-cluster-profile-screen">
              <div className="dec-cluster-screen-head">
                <div>
                  <h2>Hồ sơ trung bình của các cụm</h2>
                  <span>So sánh các chỉ số trung bình chính theo từng cụm.</span>
                </div>
                <span className="dec-paper-chip">Biểu đồ</span>
              </div>

              <div className="dec-profile-chart-wrap">
                <Bar data={profileChartData} options={profileChartOptions} />
              </div>

              <div className="dec-profile-footnote">
                <span>Chi tiêu TB được quy đổi theo nghìn đồng để đặt cùng trục với tỷ lệ và tần suất.</span>
              </div>
            </section>
          )}

          {activeView === 'clusters-strategy' && (
            <section className="dec-cluster-screen dec-cluster-strategy-screen">
              <div className="dec-cluster-screen-head">
                <div>
                  <h2>Chiến lược khuyến nghị theo cụm C0-C6</h2>
                </div>
                <span className="dec-paper-chip">Kế hoạch</span>
              </div>

              <div className="dec-cluster-strategy-wrap">
                <table className="dec-cluster-strategy-table">
                  <thead>
                    <tr>
                      <th>Cụm</th>
                      <th>Đặc trưng hành vi</th>
                      <th>Hành động đề xuất</th>
                      <th>Lý do</th>
                      <th>Tác động kỳ vọng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clusterProfiles.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="dec-empty">Chưa có dữ liệu cụm trong kỳ đang chọn.</td>
                      </tr>
                    ) : (
                      clusterProfiles.map((cluster) => (
                        <tr key={cluster.key}>
                          <td>
                            <strong>{cluster.code}</strong>
                            <span>{cluster.short_label}</span>
                          </td>
                          <td>
                            {cluster.description}
                            <small>
                              Chi tiêu {formatCurrencyCompact(cluster.avgSpend)} · hủy {formatDecimal(cluster.cancellationRate, 1)}%
                            </small>
                          </td>
                          <td>{cluster.actionMeta.action}</td>
                          <td>{cluster.actionMeta.rationale}</td>
                          <td>{cluster.actionMeta.impact}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default AnalyticsStrategy;
