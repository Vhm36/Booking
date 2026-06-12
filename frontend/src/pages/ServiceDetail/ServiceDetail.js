import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import authService from '../../services/authService';
import serviceService from '../../services/serviceService';
import { formatDurationLabel, formatVnd } from '../../utils/formatters';
import { resolveServiceImageUrl } from '../../utils/serviceImage';
import './ServiceDetail.css';

const FALLBACK_SERVICE_IMAGE =
  'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1200&q=80';

function ServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const user = authService.getUser();

  useEffect(() => {
    let cancelled = false;

    const fetchService = async () => {
      try {
        setLoading(true);
        const response = await serviceService.getServiceById(id);

        if (!cancelled) {
          setService(response.data.data);
          setError('');
        }

        serviceService
          .getRecommendations(id, 3)
          .then((recommendationResponse) => {
            if (!cancelled) {
              setRecommendations(recommendationResponse.data?.data?.recommendations || []);
            }
          })
          .catch(() => {
            if (!cancelled) {
              setRecommendations([]);
            }
          });
      } catch (err) {
        if (!cancelled) {
          setError('Không thể tải thông tin dịch vụ.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchService();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleBooking = () => {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(`/booking/${id}`)}`);
      return;
    }

    if (user.role !== 'customer') {
      window.alert('Chỉ tài khoản khách hàng mới có thể đặt lịch dịch vụ.');
      return;
    }

    navigate(`/booking/${id}`);
  };

  if (loading) {
    return <div className="loading">Đang tải chi tiết dịch vụ...</div>;
  }

  if (error || !service) {
    return <div className="alert alert-error">{error || 'Không tìm thấy dịch vụ.'}</div>;
  }

  const price = Number(service.price) || 0;
  const duration = Number(service.duration) || 0;
  const isActive = service.status === 'active';
  const serviceImage = resolveServiceImageUrl(service.image_url, FALLBACK_SERVICE_IMAGE);

  return (
    <div className="service-detail-page">
      <section className="service-main">
        <div className="service-detail-image-wrap">
          <img
            src={serviceImage}
            alt={service.name}
            className="service-detail-image"
            loading="lazy"
            onError={(event) => {
              if (event.currentTarget.src !== FALLBACK_SERVICE_IMAGE) {
                event.currentTarget.src = FALLBACK_SERVICE_IMAGE;
              }
            }}
          />
        </div>

        <div className="service-title-row">
          <span className="badge">CHI TIẾT DỊCH VỤ</span>
          <h1>{service.name}</h1>
          <p>{service.description || 'Thông tin mô tả cho dịch vụ này đang được cập nhật.'}</p>
        </div>

        <div className="service-trust-grid">
          <article>
            <h3>Uy tín</h3>
            <p>Dịch vụ được hiển thị từ hệ thống quản lý salon và cập nhật theo thời gian thực.</p>
          </article>
          <article>
            <h3>Linh hoạt</h3>
            <p>Bạn có thể chuyển sang bước đặt lịch ngay khi tìm thấy dịch vụ phù hợp.</p>
          </article>
          <article>
            <h3>An toàn</h3>
            <p>Thông tin lịch hẹn được lưu theo tài khoản để bạn dễ theo dõi và kiểm tra lại.</p>
          </article>
        </div>

        {recommendations.length > 0 && (
          <section className="service-recommendations" aria-label="Gợi ý dịch vụ đi kèm">
            <div className="recommendation-head">
              <span>Gợi ý thêm</span>
              <h2>Dịch vụ khách thường đặt liên quan</h2>
              <p>Tham khảo thêm những lựa chọn phù hợp để hoàn thiện lịch làm đẹp của bạn.</p>
            </div>

            <div className="recommendation-grid">
              {recommendations.map((item) => (
                <article key={item.id} className="recommendation-card">
                  <div>
                    <small>{item.category || 'Dịch vụ làm đẹp'}</small>
                    <h3>{item.name}</h3>
                    <p>{item.reason}</p>
                  </div>
                  <button type="button" className="btn-secondary" onClick={() => navigate(`/services/${item.id}`)}>
                    Xem dịch vụ
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}
      </section>

      <aside className="service-sidebar">
        <div className="summary-card">
          <h2>Tổng quan đặt lịch</h2>

          <div className="summary-item">
            <span>Giá dịch vụ</span>
            <strong>{formatVnd(price)}</strong>
          </div>

          <div className="summary-item">
            <span>Thời lượng</span>
            <strong>{formatDurationLabel(duration)}</strong>
          </div>

          <div className="summary-item">
            <span>Trạng thái</span>
            <strong>{isActive ? 'Đang mở đặt lịch' : 'Tạm dừng'}</strong>
          </div>

          <div className="summary-item">
            <span>Danh mục</span>
            <strong>{service.category || 'Dịch vụ làm đẹp'}</strong>
          </div>

          <button onClick={handleBooking} className="btn-primary" disabled={!isActive}>
            {!isActive
              ? 'Dịch vụ đang tạm dừng'
              : !user
              ? 'Đặt lịch ngay'
              : user.role === 'customer'
              ? 'Đặt lịch ngay'
              : 'Tài khoản này không thể đặt lịch'}
          </button>

          <small>
            Bạn có thể xem lại lịch đã đặt trong mục tài khoản sau khi xác nhận thành công.
          </small>
        </div>
      </aside>
    </div>
  );
}

export default ServiceDetail;
