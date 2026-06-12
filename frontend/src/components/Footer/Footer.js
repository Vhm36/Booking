import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const BackToTopIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="back-to-top-icon"
    aria-hidden="true"
    focusable="false"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 18V6" />
    <path d="m7 11 5-5 5 5" />
  </svg>
);

function Footer() {
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 260);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <>
      <footer className="footer">
        <div className="footer-shell">
          <section className="footer-column footer-brand-column" aria-label="BeautyBook">
            <div className="footer-brand">
              <span className="footer-brand-mark">BB</span>
              <div className="footer-brand-copy">
                <strong>BeautyBook</strong>
                <small>Đặt lịch làm đẹp nhanh gọn.</small>
              </div>
            </div>
          </section>

          <nav className="footer-column footer-links" aria-label="Liên kết cuối trang">
            <h2>Liên kết</h2>
            <div className="footer-link-list">
              <Link to="/">Trang chủ</Link>
              <Link to="/services">Dịch vụ</Link>
              <Link to="/login">Đăng nhập</Link>
            </div>
          </nav>

          <address className="footer-column footer-support">
            <h2>Hỗ trợ</h2>
            <div className="footer-contact-list">
              <a href="mailto:support@beautybook.vn">
                <span aria-hidden="true">✉</span>
                support@beautybook.vn
              </a>
              <a href="tel:0123456789">
                <span aria-hidden="true">☎</span>
                0123 456 789
              </a>
            </div>
          </address>
        </div>

        <div className="footer-bottom">
          <p>2026 BeautyBook. All rights reserved.</p>
        </div>
      </footer>

      <button
        type="button"
        className={`back-to-top ${showBackToTop ? 'is-visible' : ''}`.trim()}
        onClick={scrollToTop}
        aria-label="Lên đầu trang"
        title="Lên đầu trang"
      >
        <BackToTopIcon />
      </button>
    </>
  );
}

export default Footer;
