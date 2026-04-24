import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import authService from '../../services/authService';
import serviceService from '../../services/serviceService';
import { formatDurationLabel, formatVnd } from '../../utils/formatters';
import { resolveServiceImageUrl } from '../../utils/serviceImage';
import './Services.css';

const FALLBACK_SERVICE_IMAGE =
  'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1200&q=80';

const normalizeText = (value = '') =>
  String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const getCategoryKey = (category) => {
  const key = normalizeText(category);

  if (key.includes('hair') || key.includes('toc')) return 'toc';
  if (key.includes('nail') || key.includes('mong')) return 'mong';
  if (key.includes('massage')) return 'massage';
  if (key.includes('facial') || key.includes('skin') || key.includes('cham soc da')) return 'da';
  if (
    key.includes('lash') ||
    key.includes('brow') ||
    key.includes('long may') ||
    key.includes('chan may') ||
    key.includes('mi & may') ||
    key.includes('mi va may') ||
    key.includes('mi')
  ) {
    return 'mi-may';
  }
  if (key.includes('makeup') || key.includes('trang diem')) return 'trang-diem';

  return key || 'khac';
};

const getCategoryLabel = (category) => {
  const key = getCategoryKey(category);

  if (key === 'toc') return 'Tóc';
  if (key === 'mong') return 'Móng';
  if (key === 'massage') return 'Massage';
  if (key === 'da') return 'Chăm sóc da';
  if (key === 'mi-may') return 'Mi & mày';
  if (key === 'trang-diem') return 'Trang điểm';

  return category || 'Dịch vụ làm đẹp';
};

const getCollectionLabel = (category) => {
  const key = getCategoryKey(category);

  if (key === 'toc') return 'Gợi ý nổi bật';
  if (key === 'mi-may') return 'Mi & mày';
  if (key === 'mong') return 'Nail';
  if (key === 'da') return 'Chăm sóc da';
  if (key === 'massage') return 'Massage phục hồi';
  if (key === 'trang-diem') return 'Trang điểm chuyên nghiệp';

  return 'Đề xuất hôm nay';
};

const getServiceImage = (service) =>
  resolveServiceImageUrl(service?.image_url, FALLBACK_SERVICE_IMAGE);

function Services() {
  const [services, setServices] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('recommended');
  const [durationFilter, setDurationFilter] = useState('all');
  const [priceRange, setPriceRange] = useState('all');
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [preferredDate, setPreferredDate] = useState(searchParams.get('date') || '');

  const user = authService.getUser();

  useEffect(() => {
    setQuery(searchParams.get('q') || '');
    setPreferredDate(searchParams.get('date') || '');
  }, [searchParams]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch both services and categories in parallel
        const [servicesResponse, categoriesResponse] = await Promise.all([
          serviceService.getAllServices(),
          serviceService.getAllCategories()
        ]);
        
        setServices(servicesResponse.data.data || []);
        setDbCategories(categoriesResponse.data.data || []);
        setError(null);
      } catch (err) {
        setError('Không thể tải danh sách dịch vụ.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const categories = useMemo(() => {
    // Use database categories if available, otherwise fallback to service-based categories
    const categoryList = dbCategories && dbCategories.length > 0 
      ? dbCategories.map(cat => ({
          key: normalizeText(cat.category_name),
          label: cat.category_name
        }))
      : services
          .map((service) => service.category)
          .filter((category) => typeof category === 'string' && category.trim() !== '')
          .map((category) => ({
            key: getCategoryKey(category),
            label: getCategoryLabel(category)
          }));

    const uniqueByKey = [];
    const seen = new Set();
    for (const category of categoryList) {
      if (seen.has(category.key)) continue;
      seen.add(category.key);
      uniqueByKey.push(category);
    }

    return [{ key: 'all', label: 'Tất cả' }, ...uniqueByKey];
  }, [services, dbCategories]);

  useEffect(() => {
    if (activeCategory === 'all') {
      return;
    }

    if (!categories.some((item) => item.key === activeCategory)) {
      setActiveCategory('all');
    }
  }, [activeCategory, categories]);

  const filteredServices = useMemo(() => {
    const normalizedQuery = normalizeText(query.trim());

    const withFilters = services.filter((service) => {
      const name = normalizeText(service.name || '');
      const description = normalizeText(service.description || '');
      const category = normalizeText(service.category || '');
      const duration = Number(service.duration) || 0;
      const price = Number(service.price) || 0;

      const matchesQuery =
        normalizedQuery === '' ||
        name.includes(normalizedQuery) ||
        description.includes(normalizedQuery) ||
        category.includes(normalizedQuery);

      const matchesCategory =
        activeCategory === 'all' || getCategoryKey(service.category) === activeCategory;

      const matchesDuration =
        durationFilter === 'all' ||
        (durationFilter === 'under-45' && duration <= 45) ||
        (durationFilter === '45-75' && duration > 45 && duration <= 75) ||
        (durationFilter === 'over-75' && duration > 75);

      const matchesPriceRange =
        priceRange === 'all' ||
        (priceRange === 'under-300' && price < 300000) ||
        (priceRange === '300-700' && price >= 300000 && price <= 700000) ||
        (priceRange === 'over-700' && price > 700000);

      return matchesQuery && matchesCategory && matchesDuration && matchesPriceRange;
    });

    const sorted = [...withFilters];

    sorted.sort((a, b) => {
      const priceA = Number(a.price) || 0;
      const priceB = Number(b.price) || 0;
      const durationA = Number(a.duration) || 0;
      const durationB = Number(b.duration) || 0;
      const idA = Number(a.id) || 0;
      const idB = Number(b.id) || 0;

      if (sortBy === 'price-asc') {
        return priceA - priceB;
      }

      if (sortBy === 'price-desc') {
        return priceB - priceA;
      }

      if (sortBy === 'duration-asc') {
        return durationA - durationB;
      }

      return idB - idA;
    });

    return sorted;
  }, [activeCategory, durationFilter, priceRange, query, services, sortBy]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();

    const params = new URLSearchParams(searchParams);

    if (query.trim()) {
      params.set('q', query.trim());
    } else {
      params.delete('q');
    }

    if (preferredDate) {
      params.set('date', preferredDate);
    } else {
      params.delete('date');
    }

    setSearchParams(params);
  };

  const clearFilters = () => {
    setQuery('');
    setPreferredDate('');
    setActiveCategory('all');
    setDurationFilter('all');
    setPriceRange('all');
    setSortBy('recommended');
    setSearchParams({});
  };

  const getBookingAction = (serviceId) => {
    if (!user) {
      return {
        target: '/login',
        label: 'Đăng nhập để đặt lịch'
      };
    }

    if (user.role === 'customer') {
      return {
        target: `/booking/${serviceId}`,
        label: 'Đặt lịch'
      };
    }

    return null;
  };

  if (loading) {
    return <div className="loading">Đang tải danh sách dịch vụ...</div>;
  }

  return (
    <div className="services-marketplace">
      <section className="marketplace-hero">
        <div>
          <span className="hero-kicker">KHÁM PHÁ DỊCH VỤ LÀM ĐẸP</span>
          <h1>Chọn dịch vụ phù hợp và lọc nhanh theo nhu cầu của bạn.</h1>
          <p>
            Tìm kiếm theo tên, danh mục, mức giá và thời lượng. Bạn có thể xem chi tiết từng dịch vụ
            trước khi chuyển sang bước đặt lịch.
          </p>
        </div>
      </section>

      <section className="marketplace-controls">
        <form className="search-form" onSubmit={handleSearchSubmit}>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm theo tên dịch vụ, mô tả hoặc danh mục..."
          />
          <input
            type="date"
            value={preferredDate}
            onChange={(event) => setPreferredDate(event.target.value)}
          />
          <button type="submit" className="btn-primary">
            Tìm dịch vụ
          </button>
        </form>

        <div className="filter-row">
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="recommended">Sắp xếp: Đề xuất</option>
            <option value="price-asc">Giá: Thấp đến cao</option>
            <option value="price-desc">Giá: Cao đến thấp</option>
            <option value="duration-asc">Thời gian: Nhanh nhất</option>
          </select>

          <select value={durationFilter} onChange={(event) => setDurationFilter(event.target.value)}>
            <option value="all">Thời lượng: Tất cả</option>
            <option value="under-45">Dưới 45 phút</option>
            <option value="45-75">45 đến 75 phút</option>
            <option value="over-75">Trên 75 phút</option>
          </select>

          <select value={priceRange} onChange={(event) => setPriceRange(event.target.value)}>
            <option value="all">Giá: Tất cả</option>
            <option value="under-300">Dưới 300.000 VND</option>
            <option value="300-700">300.000 - 700.000 VND</option>
            <option value="over-700">Trên 700.000 VND</option>
          </select>

          <button type="button" className="btn-clear" onClick={clearFilters}>
            Xóa bộ lọc
          </button>
        </div>

        {categories.length > 1 && (
          <div className="category-chips">
            {categories.map((category) => (
              <button
                key={category.key}
                type="button"
                className={activeCategory === category.key ? 'chip active' : 'chip'}
                onClick={() => setActiveCategory(category.key)}
              >
                {category.label}
              </button>
            ))}
          </div>
        )}
      </section>

      {error && <div className="alert alert-error">{error}</div>}

      {filteredServices.length === 0 ? (
        <div className="empty-state">
          <h3>Chưa có dịch vụ phù hợp</h3>
          <p>Hãy thử đổi từ khóa hoặc điều chỉnh lại bộ lọc để xem thêm kết quả.</p>
        </div>
      ) : (
        <div className="services-grid">
          {filteredServices.map((service) => {
            const price = Number(service.price) || 0;
            const duration = Number(service.duration) || 0;
            const bookingAction = getBookingAction(service.id);

            return (
              <article key={service.id} className="service-card">
                <div className="service-image-wrap">
                  <img
                    src={getServiceImage(service)}
                    alt={service.name}
                    className="service-image"
                    loading="lazy"
                    onError={(event) => {
                      if (event.currentTarget.src !== FALLBACK_SERVICE_IMAGE) {
                        event.currentTarget.src = FALLBACK_SERVICE_IMAGE;
                      }
                    }}
                  />
                </div>

                <div className="service-badges">
                  <span className="category-pill">{getCategoryLabel(service.category)}</span>
                  <span className="collection-pill">{getCollectionLabel(service.category)}</span>
                </div>

                <div className="service-card-top">
                  <h3>{service.name}</h3>
                  <span>{formatDurationLabel(duration)}</span>
                </div>

                <p>{service.description || 'Mô tả đang được cập nhật cho dịch vụ này.'}</p>

                <div className="service-meta">
                  <div className="price-block">
                    <strong>{formatVnd(price)}</strong>
                    <small>Giá tại salon</small>
                  </div>
                  <small className="meta-note">Đặt nhanh trên hệ thống</small>
                </div>

                <div className="service-actions">
                  <Link to={`/services/${service.id}`} className="btn-details">
                    Xem chi tiết
                  </Link>
                  {bookingAction && (
                    <Link to={bookingAction.target} className="btn-primary">
                      {bookingAction.label}
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Services;