export const DEC_LIMIT_PER_CLUSTER = 100;
export const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);

const CURRENT_DATE = new Date();

export const CURRENT_YEAR = CURRENT_DATE.getFullYear();
export const CURRENT_MONTH = CURRENT_DATE.getMonth() + 1;
export const YEAR_OPTIONS = Array.from({ length: 3 }, (_, index) => CURRENT_YEAR - index);

export const VIEW_META = {
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

const round = (value, digits = 1) => Number(toNumber(value).toFixed(digits));

export const formatDecimal = (value, digits = 1) =>
  round(value, digits).toLocaleString('vi-VN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });

export const formatCurrencyCompact = (value) => {
  const numberValue = toNumber(value);
  if (numberValue <= 0) return '0 đ';
  if (numberValue >= 1000000) return `${formatDecimal(numberValue / 1000000, 1)} triệu`;
  if (numberValue >= 1000) return `${Math.round(numberValue / 1000).toLocaleString('vi-VN')} nghìn`;
  return `${Math.round(numberValue).toLocaleString('vi-VN')} đ`;
};

export const formatDate = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('vi-VN');
};

export const slugifyPeriod = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

const averageFromCustomers = (customers = [], key) => {
  const values = customers
    .map((customer) => toNumber(customer[key]))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const buildClusterProfiles = (clusters = []) =>
  clusters.map((cluster, index) => {
    const averages = cluster.averages || {};
    const customers = cluster.customers || [];

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
      avgServices: averageFromCustomers(customers, 'distinct_services'),
      avgRecency: averageFromCustomers(customers, 'recency_days'),
      actionMeta: CLUSTER_ACTION_META[cluster.key] || {
        action: cluster.short_label || 'Theo dõi',
        rationale: cluster.description || 'Cần quan sát thêm hành vi.',
        impact: 'Cải thiện chăm sóc và giữ chân khách hàng.'
      }
    };
  });

export const buildClusterOptions = (clusters = []) =>
  clusters.map((cluster, index) => ({
    key: cluster.key,
    label: `${cluster.code || `C${index}`} - ${cluster.short_label}`,
    count: toNumber(cluster.count),
    cluster_number: index
  }));

export const buildStrategyRows = (clusters = []) => {
  const rows = [];

  clusters.forEach((cluster, index) => {
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
      toNumber(b.total_bookings) - toNumber(a.total_bookings)
  );
};

export const filterCustomerRows = (rows, clusterFilter, customerSearch) => {
  const normalizedSearch = customerSearch.trim().toLocaleLowerCase('vi-VN');

  return rows.filter((customer) => {
    const matchesCluster = clusterFilter === 'all' || customer.cluster_key === clusterFilter;
    const matchesSearch =
      !normalizedSearch ||
      String(customer.name || '').toLocaleLowerCase('vi-VN').includes(normalizedSearch) ||
      String(customer.email || '').toLocaleLowerCase('vi-VN').includes(normalizedSearch);
    return matchesCluster && matchesSearch;
  });
};

export const sortTrendingStrategies = (profiles) =>
  [...profiles].sort((a, b) => b.count - a.count || a.index - b.index);

export const filterTrendingStrategies = (rows, strategyFilter) =>
  strategyFilter === 'all' ? rows : rows.filter((cluster) => cluster.key === strategyFilter);

export const getTopStrategyCluster = (clusters = []) =>
  [...clusters].sort((a, b) => toNumber(b.count) - toNumber(a.count))[0] || null;

export const createProfileChartData = (clusterProfiles) => ({
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
});

export const createProfileChartOptions = (clusterProfiles) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right',
      labels: {
        boxWidth: 10,
        boxHeight: 10,
        color: '#334155',
        font: { size: 11, weight: 700 }
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
      title: { display: true, text: 'Cụm' },
      grid: { display: false }
    },
    y: {
      beginAtZero: true,
      ticks: {
        precision: 0,
        color: '#64748b',
        font: { size: 11 }
      },
      title: { display: true, text: 'Giá trị trung bình' }
    }
  }
});

export const STRATEGY_EXPORT_COLUMNS = [
  { key: 'strategy', header: 'Chiến lược', width: 52 },
  { key: 'action', header: 'Hành động chính', width: 28 },
  { key: 'count', header: 'Số khách', width: 14 },
  { key: 'code', header: 'Cụm', width: 10 },
  { key: 'label', header: 'Tên cụm', width: 30 }
];

export const CUSTOMER_EXPORT_COLUMNS = [
  { key: 'name', header: 'Khách hàng', width: 24 },
  { key: 'email', header: 'Email', width: 30 },
  { key: 'cluster_display', header: 'Cụm', width: 10 },
  { key: 'cluster_label', header: 'Nhóm hành vi', width: 30 },
  { key: 'total_bookings', header: 'Tổng lịch', width: 12 },
  { key: 'completion_rate', header: 'Hoàn thành (%)', width: 16 },
  { key: 'cancellation_rate', header: 'Hủy (%)', width: 14 },
  { key: 'completed_revenue', header: 'Tổng chi tiêu', width: 20 },
  { key: 'last_booking_date', header: 'Lịch gần nhất', width: 16, transform: formatDate }
];
