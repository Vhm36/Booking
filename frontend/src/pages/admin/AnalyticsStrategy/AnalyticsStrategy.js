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

const DEC_LIMIT_PER_CLUSTER = 80;
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);
const CURRENT_DATE = new Date();
const CURRENT_YEAR = CURRENT_DATE.getFullYear();
const YEAR_OPTIONS = Array.from({ length: 3 }, (_, index) => CURRENT_YEAR - index);

const VIEW_META = {
  table: {
    kicker: 'Bảng chiến lược',
    title: 'Danh sách khách hàng theo chiến lược',
    description:
      'Theo dõi từng khách hàng, ngày đặt gần nhất, cụm hành vi và chiến lược chăm sóc phù hợp trong tháng.'
  },
  'clusters-detail': {
    kicker: 'Phân tích cụm',
    title: 'Đặc trưng chi tiết từng cụm',
    description:
      'Đọc nhanh quy mô, chi tiêu, tỷ lệ hủy, tần suất và đặc điểm hành vi nổi bật của từng cụm khách hàng.'
  },
  'clusters-profile': {
    kicker: 'Phân tích cụm',
    title: 'Biểu đồ so sánh profile cụm',
    description:
      'So sánh các đặc điểm trung bình của từng cụm để nhìn ra nhóm nào chi tiêu cao, hủy nhiều hoặc quay lại thường xuyên.'
  },
  'clusters-strategy': {
    kicker: 'Phân tích cụm',
    title: 'Gợi ý chiến lược theo cụm',
    description:
      'Liên kết đặc trưng hành vi với hành động vận hành, lý do triển khai và tác động kỳ vọng cho từng cụm.'
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
    action: 'Combo bổ trợ',
    rationale: 'Khách quay lại đều nhưng còn tập trung vào một dịch vụ chính.',
    impact: 'Tăng bán chéo và giữ chân nhóm ổn định thêm 5%-15%.'
  },
  many_bookings_low_arrival: {
    action: 'Xác nhận/cọc nhẹ',
    rationale: 'Nhóm đặt nhiều nhưng tỷ lệ hoàn thành thấp làm giảm độ tin cậy lịch.',
    impact: 'Giảm lịch rỗng, cải thiện độ chắc chắn đặt hẹn 5%-15%.'
  },
  frequent_cancel_no_show: {
    action: 'Nhắc lịch 24h',
    rationale: 'Nhóm có rủi ro hủy hoặc không đến cao cần xác nhận nhiều bước.',
    impact: 'Giảm tỷ lệ hủy và bảo vệ các khung giờ cao điểm.'
  },
  low_usage_premium: {
    action: 'Chăm sóc VIP',
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
      code: `C${index}`,
      display: `C${index}`,
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

  const clusterLookup = useMemo(() => {
    const lookup = new Map();
    decClusters.forEach((cluster, index) => {
      lookup.set(cluster.key, {
        ...cluster,
        cluster_number: index,
        cluster_display: `C${index}`
      });
    });
    return lookup;
  }, [decClusters]);

  const clusterOptions = useMemo(
    () =>
      decClusters.map((cluster, index) => ({
        key: cluster.key,
        label: `C${index} - ${cluster.short_label}`,
        count: Number(cluster.count || 0),
        cluster_number: index
      })),
    [decClusters]
  );

  const strategyRows = useMemo(() => {
    const rows = [];
    decClusters.forEach((cluster, index) => {
      (cluster.customers || []).forEach((customer) => {
        rows.push({
          ...customer,
          cluster_key: cluster.key,
          cluster_number: index,
          cluster_display: `C${index}`,
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
    () =>
      clusterFilter === 'all'
        ? strategyRows
        : strategyRows.filter((customer) => customer.cluster_key === clusterFilter),
    [clusterFilter, strategyRows]
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
    if (filteredStrategyRows.length === 0) {
      window.alert('Không có dữ liệu chiến lược để xuất.');
      return;
    }

    const clusterSuffix = activeClusterOption ? `cum-${activeClusterOption.cluster_number}` : 'tat-ca-cum';
    const periodSuffix = slugifyPeriod(periodLabel) || `thang-${strategyMonth}-${strategyYear}`;

    exportToExcel({
      fileName: `chien-luoc-thinh-hanh_${periodSuffix}_${clusterSuffix}`,
      sheets: [
        {
          name: 'Chiến lược',
          columns: [
            { key: 'name', header: 'Tên người dùng', width: 24 },
            { key: 'email', header: 'Email', width: 30 },
            { key: 'last_booking_date', header: 'Ngày', width: 14, transform: (value) => formatDate(value) },
            { key: 'strategy', header: 'Chiến lược', width: 52 },
            { key: 'cluster_label', header: 'Cụm', width: 28 }
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
              Bảng chiến lược
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
              Biểu đồ cụm
            </NavLink>
            <NavLink
              to="/admin/analytics/strategy/clusters/strategy"
              className={() =>
                `dec-strategy-link ${activeView === 'clusters-strategy' ? 'is-active' : ''}`
              }
            >
              Chiến lược cụm
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
              <div className="dec-section-head">
                <div>
                  <h2>Bảng chiến lược</h2>
                  <span>
                    {periodLabel} · {filteredStrategyRows.length}
                    {clusterFilter !== 'all' ? `/${strategyRows.length}` : ''} dòng
                  </span>
                </div>
                <label className="dec-cluster-filter" htmlFor="dec-cluster-filter">
                  <span>Cụm</span>
                  <select
                    id="dec-cluster-filter"
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

              <div className="dec-table-wrap">
                <table className="dec-table">
                  <thead>
                    <tr>
                      <th>Tên người dùng</th>
                      <th>Ngày</th>
                      <th>Chiến lược</th>
                      <th>Cụm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStrategyRows.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="dec-empty">
                          {clusterFilter === 'all'
                            ? 'Chưa có khách hàng nào trong tháng này để tạo khuyến nghị.'
                            : 'Cụm này chưa có khách hàng trong tháng đang chọn.'}
                        </td>
                      </tr>
                    ) : (
                      filteredStrategyRows.map((customer) => {
                        const cluster = clusterLookup.get(customer.cluster_key);
                        return (
                          <tr key={`${customer.cluster_key}-${customer.id}`}>
                            <td>
                              <div className="dec-user-cell">
                                <strong>{customer.name}</strong>
                                <span>{customer.email || '-'}</span>
                              </div>
                            </td>
                            <td>{formatDate(customer.last_booking_date)}</td>
                            <td>{customer.strategy}</td>
                            <td>
                              <span className="dec-cluster-pill">
                                {cluster?.cluster_display || customer.cluster_display} ·{' '}
                                {customer.cluster_short_label || cluster?.short_label || customer.cluster_label}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="dec-export-row">
                <span>
                  Xuất dữ liệu chiến lược theo {periodLabel}
                  {activeClusterOption ? ` · ${activeClusterOption.label}` : ''}
                </span>
                <button type="button" className="btn-export-excel" onClick={handleExportStrategies}>
                  Xuất file
                </button>
              </div>
            </section>
          )}

          {activeView === 'clusters-detail' && (
            <section className="dec-cluster-screen dec-cluster-detail-screen">
              <div className="dec-cluster-screen-head">
                <div>
                  <h2>Table 7 · Đặc trưng chi tiết từng cụm</h2>
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
                  <h2>Figure 4 · Average profile of clusters</h2>
                  <span>So sánh các chỉ số trung bình chính theo từng cụm.</span>
                </div>
                <span className="dec-paper-chip">Chart</span>
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
                  <h2>Table 8 · Chiến lược khuyến nghị theo cụm</h2>
                  <span>Liên kết đặc trưng hành vi với hành động quản trị cụ thể.</span>
                </div>
                <span className="dec-paper-chip">Action plan</span>
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
