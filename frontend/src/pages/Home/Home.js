import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import authService from '../../services/authService';
import serviceService from '../../services/serviceService';
import { formatVnd } from '../../utils/formatters';
import { resolveServiceImageUrl } from '../../utils/serviceImage';
import './Home.css';

const COUNTER_STORAGE_KEY = 'home_fake_appointments_counter';
const COUNTER_TICK_MS = 2500;
const REVIEW_ROTATE_MS = 3200;
const REVIEW_TRANSITION_MS = 520;
const REVIEWS_VISIBLE_COUNT = 3;

const getReviewsPerView = () => {
  if (typeof window === 'undefined') return REVIEWS_VISIBLE_COUNT;
  if (window.innerWidth <= 760) return 1;
  if (window.innerWidth <= 1080) return 2;
  return REVIEWS_VISIBLE_COUNT;
};
const FALLBACK_SERVICE_IMAGE =
  'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1200&q=80';

const customerReviews = [
  {
    id: 1,
    name: 'Minh Anh',
    service: 'Nối mi và uốn mi',
    rating: 5,
    time: '2 ngày trước',
    comment: 'Đặt lịch rất nhanh, nhân viên tư vấn kỹ và làm đúng kiểu mình mong muốn.'
  },
  {
    id: 2,
    name: 'Thu Hà',
    service: 'Chăm sóc da cấp ẩm',
    rating: 5,
    time: '3 ngày trước',
    comment: 'Không gian sạch, nhẹ nhàng và dịch vụ làm mình thấy thư giãn thật sự.'
  },
  {
    id: 3,
    name: 'Ngọc Trâm',
    service: 'Sơn gel chăm sóc móng',
    rating: 4,
    time: '5 ngày trước',
    comment: 'Màu sơn đẹp, giữ được lâu và có thể theo dõi lịch hẹn rất tiện trong tài khoản.'
  },
  {
    id: 4,
    name: 'Khánh Linh',
    service: 'Nhuộm tóc cao cấp',
    rating: 5,
    time: '1 tuần trước',
    comment: 'Màu tóc lên chuẩn, stylist hiểu ý và gợi ý thêm cách chăm tóc sau khi làm.'
  },
  {
    id: 5,
    name: 'Bảo Châu',
    service: 'Định hình lông mày',
    rating: 5,
    time: '1 tuần trước',
    comment: 'Form mày tự nhiên, hợp mặt và mình nhận được hướng dẫn chăm sóc rất rõ.'
  },
  {
    id: 6,
    name: 'Thanh Vy',
    service: 'Gội sấy tạo kiểu nhanh',
    rating: 4,
    time: '8 ngày trước',
    comment: 'Phù hợp đi sự kiện gấp, làm nhanh nhưng vẫn gọn gàng và chỉn chu.'
  },
  {
    id: 7,
    name: 'Lan Phương',
    service: 'Massage mô sâu',
    rating: 5,
    time: '9 ngày trước',
    comment: 'Đỡ căng vai gáy rõ rệt sau buổi đầu tiên, mình sẽ quay lại tiếp.'
  },
  {
    id: 8,
    name: 'Mỹ Duyên',
    service: 'Thải độc da đầu',
    rating: 5,
    time: '10 ngày trước',
    comment: 'Da đầu sạch và nhẹ hơn hẳn, cảm giác rất thư giãn.'
  },
  {
    id: 9,
    name: 'Gia Hân',
    service: 'Cắt tóc và tạo kiểu',
    rating: 4,
    time: '11 ngày trước',
    comment: 'Cắt đúng kiểu đã trao đổi, chăm khách kỹ và rất đúng giờ.'
  },
  {
    id: 10,
    name: 'Tuyết Nhi',
    service: 'Trang điểm tiệc cưới',
    rating: 5,
    time: '12 ngày trước',
    comment: 'Makeup lên ảnh đẹp, tone hợp concept và giữ được lâu suốt buổi.'
  }
];

const normalizeText = (value = '') =>
  String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const getLocalDateKey = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const createSeedCount = () => 24 + Math.floor(Math.random() * 21);

const readStoredCounter = () => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(COUNTER_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed.date !== 'string' ||
      !Number.isFinite(parsed.count) ||
      parsed.count < 0
    ) {
      return null;
    }

    return {
      date: parsed.date,
      count: Math.floor(parsed.count)
    };
  } catch (error) {
    return null;
  }
};

const saveCounter = (counter) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(COUNTER_STORAGE_KEY, JSON.stringify(counter));
  } catch (error) {
    // Ignore storage errors.
  }
};

const getInitialCounter = () => {
  const todayKey = getLocalDateKey();
  const stored = readStoredCounter();

  if (stored && stored.date === todayKey) {
    return stored;
  }

  const freshCounter = { date: todayKey, count: createSeedCount() };
  saveCounter(freshCounter);
  return freshCounter;
};

const getServiceImage = (service) =>
  resolveServiceImageUrl(service?.image_url, FALLBACK_SERVICE_IMAGE);

const toTimestamp = (value) => {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const toVietnameseCategoryLabel = (category) => {
  const key = normalizeText(category);

  if (key.includes('hair') || key.includes('toc')) {
    return 'Tóc';
  }

  if (key.includes('nail') || key.includes('mong')) {
    return 'Nail';
  }

  if (key.includes('massage')) {
    return 'Massage';
  }

  if (key.includes('facial') || key.includes('skin') || key.includes('da')) {
    return 'Chăm sóc da';
  }

  if (key.includes('brow') || key.includes('lash') || key.includes('mi') || key.includes('may')) {
    return 'Mi & mày';
  }

  if (key.includes('makeup') || key.includes('trang diem')) {
    return 'Trang điểm';
  }

  return category || 'Làm đẹp';
};

function Home({ userLocation = null }) {
  const navigate = useNavigate();
  const user = authService.getUser();
  const [keyword, setKeyword] = useState('');
  const [date, setDate] = useState(() => getLocalDateKey());
  const [services, setServices] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);
  const [trendingData, setTrendingData] = useState(null);
  const [loadingServices, setLoadingServices] = useState(true);
  const [serviceError, setServiceError] = useState('');
  const [liveCounter, setLiveCounter] = useState(() => getInitialCounter());
  const [reviewsPerView, setReviewsPerView] = useState(() => getReviewsPerView());
  const [reviewPage, setReviewPage] = useState(0);
  const [reviewPreviousPage, setReviewPreviousPage] = useState(0);
  const [reviewDirection, setReviewDirection] = useState('next');
  const [isReviewTransitioning, setIsReviewTransitioning] = useState(false);
  const [activeTrendingCategory, setActiveTrendingCategory] = useState(null);

  const today = useMemo(() => getLocalDateKey(), []);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoadingServices(true);

        const [servicesResult, categoriesResult, trendingResult] = await Promise.allSettled([
          serviceService.getAllServices(),
          serviceService.getAllCategories(),
          serviceService.getTrendingServices()
        ]);

        if (servicesResult.status === 'rejected') {
          throw servicesResult.reason;
        }

        if (!cancelled) {
          setServices(servicesResult.value.data.data || []);
          setDbCategories(
            categoriesResult.status === 'fulfilled'
              ? categoriesResult.value.data.data || []
              : []
          );
          setTrendingData(
            trendingResult.status === 'fulfilled'
              ? trendingResult.value.data.data || null
              : null
          );
          setServiceError('');
        }
      } catch (error) {
        if (!cancelled) {
          setServices([]);
          setDbCategories([]);
          setTrendingData(null);
          setServiceError('Không thể tải dữ liệu dịch vụ tại thời điểm này.');
        }
      } finally {
        if (!cancelled) {
          setLoadingServices(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setLiveCounter((currentCounter) => {
        const todayKey = getLocalDateKey();

        if (currentCounter.date !== todayKey) {
          const resetCounter = {
            date: todayKey,
            count: createSeedCount()
          };
          saveCounter(resetCounter);
          return resetCounter;
        }

        const increment = Math.random() < 0.75 ? 1 : 2;
        const nextCounter = {
          date: currentCounter.date,
          count: currentCounter.count + increment
        };
        saveCounter(nextCounter);
        return nextCounter;
      });
    }, COUNTER_TICK_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setReviewsPerView(getReviewsPerView());
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const reviewPages = useMemo(() => {
    const totalPages = Math.ceil(customerReviews.length / reviewsPerView);

    return Array.from({ length: totalPages }, (_, pageIndex) =>
      Array.from({ length: reviewsPerView }, (_, offset) => {
        const reviewIndex = (pageIndex * reviewsPerView + offset) % customerReviews.length;
        return customerReviews[reviewIndex];
      })
    );
  }, [reviewsPerView]);

  useEffect(() => {
    setReviewPage((current) => {
      if (reviewPages.length === 0) {
        return 0;
      }

      return current >= reviewPages.length ? 0 : current;
    });
    setReviewPreviousPage((current) => (current >= reviewPages.length ? 0 : current));
    setIsReviewTransitioning(false);
  }, [reviewPages.length]);

  useEffect(() => {
    if (!isReviewTransitioning) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setIsReviewTransitioning(false);
      setReviewPreviousPage(reviewPage);
    }, REVIEW_TRANSITION_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isReviewTransitioning, reviewPage]);

  const changeReviewPage = (nextPage) => {
    if (reviewPages.length === 0 || isReviewTransitioning) {
      return;
    }

    const normalizedNextPage = ((nextPage % reviewPages.length) + reviewPages.length) % reviewPages.length;
    if (normalizedNextPage === reviewPage) {
      return;
    }

    const isWrapForward = reviewPage === reviewPages.length - 1 && normalizedNextPage === 0;
    const isWrapBackward = reviewPage === 0 && normalizedNextPage === reviewPages.length - 1;
    const nextDirection = isWrapForward ? 'next' : isWrapBackward ? 'prev' : normalizedNextPage > reviewPage ? 'next' : 'prev';

    setReviewPreviousPage(reviewPage);
    setReviewDirection(nextDirection);
    setReviewPage(normalizedNextPage);
    setIsReviewTransitioning(true);
  };

  useEffect(() => {
    if (reviewPages.length <= 1) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      const nextPage = (reviewPage + 1) % reviewPages.length;
      setReviewPreviousPage(reviewPage);
      setReviewDirection('next');
      setReviewPage(nextPage);
      setIsReviewTransitioning(true);
    }, REVIEW_ROTATE_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [reviewPage, reviewPages.length]);

  const normalizedServices = useMemo(
    () =>
      services.map((service) => ({
        ...service,
        price: Number(service.price) || 0,
        duration: Number(service.duration) || 0
      })),
    [services]
  );

  const categorizedServices = useMemo(() => {
    const sortedByNewest = [...normalizedServices].sort((a, b) => {
      const timeDiff = toTimestamp(b.created_at) - toTimestamp(a.created_at);
      if (timeDiff !== 0) return timeDiff;
      return Number(b.id || 0) - Number(a.id || 0);
    });

    const averagePrice =
      normalizedServices.length > 0
        ? normalizedServices.reduce((sum, service) => sum + service.price, 0) / normalizedServices.length
        : 0;

    const sortedByRecommended = [...normalizedServices].sort((a, b) => {
      const scoreA = Math.abs(a.price - averagePrice) + a.duration * 4500;
      const scoreB = Math.abs(b.price - averagePrice) + b.duration * 4500;
      return scoreA - scoreB;
    });

    const usedIds = new Set();
    const pickUnique = (source, limit) => {
      const picked = [];
      for (const service of source) {
        if (picked.length >= limit) break;
        if (usedIds.has(service.id)) continue;
        usedIds.add(service.id);
        picked.push(service);
      }
      return picked;
    };

    const recommended = pickUnique(sortedByRecommended, 4);
    const newest = pickUnique(sortedByNewest, 4);

    return { recommended, newest };
  }, [normalizedServices]);

  // Trending categories from API
  const trendingCategories = useMemo(() => {
    if (!trendingData?.categories) return [];
    return trendingData.categories.filter((category) => Number(category.total_bookings || 0) > 0);
  }, [trendingData]);

  // Services for the currently selected trending category
  const activeTrendingServices = useMemo(() => {
    if (!trendingCategories.length) return [];
    
    if (activeTrendingCategory === null) {
      // Show top services across all categories (max 4)
      const allServices = (trendingData?.all_services || []).filter(
        (service) => Number(service.booking_count || 0) > 0
      );
      return allServices.slice(0, 4);
    }
    
    const category = trendingCategories.find(c => c.category === activeTrendingCategory);
    return category
      ? category.services.filter((service) => Number(service.booking_count || 0) > 0).slice(0, 4)
      : [];
  }, [trendingCategories, activeTrendingCategory, trendingData]);

  const categoryChips = useMemo(() => {
    // Use database categories if available, otherwise fallback to hardcoded categories
    if (dbCategories && dbCategories.length > 0) {
      return dbCategories.slice(0, 8).map((category) => ({
        value: normalizeText(category.category_name),
        label: category.category_name
      }));
    }

    const serviceCategories = [
      ...new Set(
        normalizedServices
          .map((service) => service.category)
          .filter((category) => typeof category === 'string' && category.trim() !== '')
      )
    ];

    if (serviceCategories.length > 0) {
      return serviceCategories.slice(0, 8).map((category) => ({
        value: category,
        label: toVietnameseCategoryLabel(category)
      }));
    }

    return [
      { value: 'noi mi', label: 'Nối mi' },
      { value: 'cat toc', label: 'Cắt tóc' },
      { value: 'nail', label: 'Nail' },
      { value: 'massage', label: 'Massage' },
      { value: 'cham soc da', label: 'Chăm sóc da' }
    ];
  }, [normalizedServices, dbCategories]);

  const averageDuration = useMemo(() => {
    if (normalizedServices.length === 0) {
      return 0;
    }

    const totalDuration = normalizedServices.reduce((sum, service) => sum + service.duration, 0);
    return Math.round(totalDuration / normalizedServices.length);
  }, [normalizedServices]);

  const liveCounterDateLabel = useMemo(() => {
    const [year, month, day] = liveCounter.date.split('-');
    if (!year || !month || !day) return '';
    return `${day}/${month}/${year}`;
  }, [liveCounter.date]);

  const locationLabel = useMemo(() => {
    if (!userLocation) {
      return null;
    }

    const latitude = Number(userLocation.latitude);
    const longitude = Number(userLocation.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }, [userLocation]);

  const locationCapturedLabel = useMemo(() => {
    if (!userLocation?.capturedAt) {
      return '';
    }

    const parsed = new Date(userLocation.capturedAt);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }

    return parsed.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }, [userLocation]);

  const visibleReviews = useMemo(() => {
    if (reviewPages.length === 0) {
      return customerReviews.slice(0, reviewsPerView);
    }

    return reviewPages[reviewPage] || reviewPages[0];
  }, [reviewPage, reviewPages, reviewsPerView]);

  const previousVisibleReviews = useMemo(() => {
    if (reviewPages.length === 0) {
      return customerReviews.slice(0, reviewsPerView);
    }

    return reviewPages[reviewPreviousPage] || reviewPages[0];
  }, [reviewPages, reviewPreviousPage, reviewsPerView]);

  const renderReviewCards = (reviews, pageKey) =>
    reviews.map((review, index) => (
      <article className="review-card" key={`${pageKey}-${review.id}-${index}`}>
        <div className="review-top">
          <strong>{review.name}</strong>
          <span>{review.time}</span>
        </div>
        <div className="review-rating">
          {'\u2605'.repeat(review.rating)}
          {'\u2606'.repeat(5 - review.rating)}
        </div>
        <p className="review-text">{review.comment}</p>
        <small className="review-service">{review.service}</small>
      </article>
    ));

  const buildServiceUrl = (searchKeyword, searchDate, category) => {
    const params = new URLSearchParams();

    if (searchKeyword) {
      params.set('q', searchKeyword.trim());
    }

    if (category) {
      params.set('category', category);
    }

    if (searchDate) {
      params.set('date', searchDate);
    }

    const queryString = params.toString();
    return queryString ? `/services?${queryString}` : '/services';
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    navigate(buildServiceUrl(keyword, date));
  };

  const handleCategoryClick = (category) => {
    navigate(buildServiceUrl('', date, category));
  };

  const todayFormatted = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, []);

  return (
    <div className="home-fresha">
      <section className="fresha-hero">
        <div className="fresha-hero-content">
          <h1>Đặt lịch làm đẹp nhanh, đúng dịch vụ và đúng thời gian bạn muốn</h1>
          <p>
            Tra cứu dịch vụ theo giá, thời lượng và danh mục nổi bật. Bạn có thể chọn ngày phù hợp rồi
            chuyển ngay sang trang dịch vụ để xem chi tiết và đặt lịch chỉ với vài thao tác.
          </p>

          <form className="fresha-search" onSubmit={handleSearchSubmit}>
            <div className="search-field">
              <label>Dịch vụ</label>
              <input
                type="text"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="Nối mi, cắt tóc, massage, chăm sóc da..."
              />
            </div>

            <div className="search-field">
              <label>Hôm nay, {todayFormatted}</label>
              <input
                type="date"
                lang="vi"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                min={today}
              />
            </div>

            <button type="submit" className="btn-primary">
              Tìm lịch trống
            </button>
          </form>

          <div className="quick-categories">
            {categoryChips.map((category) => (
              <button
                type="button"
                key={`${category.value}-${category.label}`}
                className="category-pill"
                onClick={() => handleCategoryClick(category.value)}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>

        <aside className="fresha-hero-side">
          <article className="live-counter-card">
            <span>Số lượt đặt lịch được ghi nhận hôm nay</span>
            <strong>{liveCounter.count.toLocaleString('vi-VN')}</strong>
            <small>
              <i className="live-dot" />
              Đang cập nhật liên tục, reset lúc 00:00 ({liveCounterDateLabel})
            </small>
          </article>

          <article>
            <span>Dịch vụ đang mở</span>
            <strong>{normalizedServices.length}</strong>
          </article>
          <article>
            <span>Thời lượng trung bình</span>
            <strong>{averageDuration > 0 ? `${averageDuration} phút` : '--'}</strong>
          </article>
          <article>
            <span>Vị trí truy cập</span>
            <strong>{locationLabel || 'Chưa cấp quyền'}</strong>
            {locationLabel && (
              <small className="location-note">
                {userLocation?.accuracy
                  ? `Sai số khoảng ${Math.round(userLocation.accuracy)}m`
                  : 'Vị trí hiện tại'}
                {locationCapturedLabel ? ` - cập nhật ${locationCapturedLabel}` : ''}
              </small>
            )}
          </article>
          <Link to="/services" className="hero-side-cta">
            Xem toàn bộ dịch vụ
          </Link>
        </aside>
      </section>

      <section className="fresha-listing">
        <div className="listing-head">
          <h2>Dịch vụ được yêu thích</h2>
          <Link to="/services">Xem tất cả</Link>
        </div>

        {loadingServices && <p className="listing-empty">Đang tải danh sách dịch vụ...</p>}
        {!loadingServices && serviceError && <div className="alert alert-error">{serviceError}</div>}

        {!loadingServices && !serviceError && (
          <div className="listing-groups">
            {/* ===== TRENDING SECTION - Category-based ===== */}
            {trendingCategories.length > 0 && (
              <div className="listing-group trending-section">
                <div className="trending-header">
                  <h3>Được đặt nhiều</h3>
                </div>

                <>
                  <div className="trending-category-tabs">
                    <button
                      type="button"
                      className={`trending-tab ${activeTrendingCategory === null ? 'active' : ''}`}
                      onClick={() => setActiveTrendingCategory(null)}
                    >
                      <span className="trending-tab-label">Tất cả</span>
                    </button>
                    {trendingCategories.map((cat) => (
                      <button
                        type="button"
                        key={cat.category}
                        className={`trending-tab ${activeTrendingCategory === cat.category ? 'active' : ''}`}
                        onClick={() => setActiveTrendingCategory(cat.category)}
                      >
                        <span className="trending-tab-label">{cat.category}</span>
                      </button>
                    ))}
                  </div>

                  <div className="service-market-grid">
                    {activeTrendingServices.map((service, index) => (
                      <article className="service-market-card trending-card" key={`trending-${service.id}`}>
                        {index < 3 && (
                          <div className={`trending-rank rank-${index + 1}`}>
                            #{index + 1}
                          </div>
                        )}
                        <div className="service-market-image-wrap">
                          <img
                            src={getServiceImage(service)}
                            alt={service.name}
                            className="service-market-image"
                            loading="lazy"
                            onError={(event) => {
                              if (event.currentTarget.src !== FALLBACK_SERVICE_IMAGE) {
                                event.currentTarget.src = FALLBACK_SERVICE_IMAGE;
                              }
                            }}
                          />
                          {Number(service.booking_count) > 0 && (
                            <div className="trending-booking-badge">
                              Hot
                            </div>
                          )}
                        </div>

                        <div className="service-market-top">
                          <span>{toVietnameseCategoryLabel(service.category)}</span>
                          <small>
                            {Number(service.avg_rating) > 0
                              ? `${Number(service.avg_rating).toFixed(1)}/5`
                              : '4.9/5'}
                          </small>
                        </div>

                        <h3>{service.name}</h3>
                        <p>
                          {service.description ||
                            'Mô tả đang được cập nhật cho dịch vụ này.'}
                        </p>

                        <div className="service-market-meta">
                          <strong>{formatVnd(service.price)}</strong>
                          <span>{service.duration} phút</span>
                        </div>

                        <div className="service-market-actions">
                          <Link to={`/services/${service.id}`} className="btn-outline">
                            Chi tiết
                          </Link>
                          {(!user || user.role === 'customer') && (
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => {
                                if (!user) {
                                  navigate(`/login?redirect=${encodeURIComponent(`/booking/${service.id}`)}`);
                                } else {
                                  navigate(`/booking/${service.id}`);
                                }
                              }}
                            >
                              Đặt lịch
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>

                </>
              </div>
            )}

            {/* ===== RECOMMENDED & NEWEST ===== */}
            {[
              { title: 'Đề xuất', data: categorizedServices.recommended },
              { title: 'Mới cập nhật', data: categorizedServices.newest }
            ].map((group) => (
              <div className="listing-group" key={group.title}>
                <h3>{group.title}</h3>
                {group.data.length === 0 ? (
                  <p className="listing-empty">Chưa có dịch vụ phù hợp cho mục này.</p>
                ) : (
                  <div className="service-market-grid">
                    {group.data.map((service) => (
                      <article className="service-market-card" key={`${group.title}-${service.id}`}>
                        <div className="service-market-image-wrap">
                          <img
                            src={getServiceImage(service)}
                            alt={service.name}
                            className="service-market-image"
                            loading="lazy"
                            onError={(event) => {
                              if (event.currentTarget.src !== FALLBACK_SERVICE_IMAGE) {
                                event.currentTarget.src = FALLBACK_SERVICE_IMAGE;
                              }
                            }}
                          />
                        </div>

                        <div className="service-market-top">
                          <span>{toVietnameseCategoryLabel(service.category)}</span>
                          <small>4.9/5</small>
                        </div>

                        <h3>{service.name}</h3>
                        <p>
                          {service.description ||
                            'Mô tả đang được cập nhật cho dịch vụ này.'}
                        </p>

                        <div className="service-market-meta">
                          <strong>{formatVnd(service.price)}</strong>
                          <span>{service.duration} phút</span>
                        </div>

                        <div className="service-market-actions">
                          <Link to={`/services/${service.id}`} className="btn-outline">
                            Chi tiết
                          </Link>
                          {(!user || user.role === 'customer') && (
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => {
                                if (!user) {
                                  navigate(`/login?redirect=${encodeURIComponent(`/booking/${service.id}`)}`);
                                } else {
                                  navigate(`/booking/${service.id}`);
                                }
                              }}
                            >
                              Đặt lịch
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="fresha-reviews">
        <div className="fresha-reviews-head">
          <h2>Đánh giá trải nghiệm khách hàng</h2>
          <p>
            Phản hồi gần đây từ khách đã sử dụng dịch vụ tại salon. Bạn có thể xem nhanh để tham khảo
            trước khi chọn lịch phù hợp.
          </p>
        </div>

        <div className="reviews-stage">
          {isReviewTransitioning && (
            <div className={`reviews-grid reviews-grid-leaving ${reviewDirection}`}>
              {renderReviewCards(previousVisibleReviews, `review-leaving-${reviewPreviousPage}`)}
            </div>
          )}

          <div
            className={`reviews-grid ${
              isReviewTransitioning ? `reviews-grid-entering ${reviewDirection}` : 'reviews-grid-active'
            }`}
          >
            {renderReviewCards(visibleReviews, `review-active-${reviewPage}`)}
          </div>
        </div>

        {reviewPages.length > 1 && (
          <div className="reviews-dots">
            {reviewPages.map((_, index) => (
              <button
                key={`review-page-dot-${index}`}
                type="button"
                className={index === reviewPage ? 'reviews-dot active' : 'reviews-dot'}
                onClick={() => changeReviewPage(index)}
                aria-label={`Xem nhom danh gia ${index + 1}`}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Home;
