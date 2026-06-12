import React from 'react';
import './CustomerInsightBadge.css';

const normalizeTone = (status) =>
  String(status || 'unknown')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');

const formatPercent = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }

  return `${Math.round(number)}%`;
};

function CustomerInsightBadge({ insight }) {
  const clusterNumber = Number(insight?.customer_dec_cluster_number || 0);

  if (!clusterNumber) {
    return <span className="customer-insight-empty">Chưa đủ dữ liệu cụm</span>;
  }

  const tone = normalizeTone(insight.customer_potential_status);
  const completedRate = formatPercent(insight.customer_completion_rate);
  const cancellationRate = formatPercent(insight.customer_cancellation_rate);
  const metricParts = [
    `${Number(insight.customer_total_bookings || 0)} lịch`,
    completedRate ? `HT ${completedRate}` : null,
    cancellationRate ? `Hủy ${cancellationRate}` : null
  ].filter(Boolean);

  return (
    <div
      className={`customer-insight-badge customer-insight-${tone}`}
      title={insight.customer_staff_hint || insight.customer_potential_reason || ''}
    >
      <div className="customer-insight-pill-row">
        <span className="customer-potential-pill">
          {insight.customer_potential_label || 'Chưa phân loại'}
        </span>
        <span className="customer-cluster-pill">Cụm {clusterNumber}</span>
      </div>
      <small className="customer-cluster-label">
        {insight.customer_dec_cluster_short_label || insight.customer_dec_cluster_label || '-'}
      </small>
      <small className="customer-insight-metrics">{metricParts.join(' · ')}</small>
    </div>
  );
}

export default CustomerInsightBadge;
