import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-shell">
        <div className="footer-compact">
          <div className="footer-brand">
            <span className="brand-mark">BB</span>
            <div>
              <strong>BeautyBook</strong>
              <small>Đặt lịch làm đẹp nhanh gọn</small>
            </div>
          </div>

          <nav className="footer-nav">
            <Link to="/services">Dịch vụ</Link>
            <Link to="/login">Đăng nhập</Link>
            <Link to="/register">Đăng ký</Link>
          </nav>

          <p className="footer-note">Hỗ trợ: 08:00 - 21:00</p>
          <p className="footer-copy">{currentYear} BeautyBook.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
