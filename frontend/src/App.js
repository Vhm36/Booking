import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import authService from './services/authService';
import './App.css';

import Home from './pages/Home';
import Services from './pages/Services';
import ServiceDetail from './pages/ServiceDetail';
import Booking from './pages/Booking';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ZaloCallback from './pages/Auth/ZaloCallback';
import MyAppointments from './pages/MyAppointments';
import MyVouchers from './pages/MyVouchers';
import PaymentInvoice from './pages/PaymentInvoice';
import PaymentReturn from './pages/PaymentReturn';
import PaymentTransfer from './pages/PaymentTransfer';
import Profile from './pages/Profile';
import ChatBot from './pages/ChatBot';
import AdminDashboard from './pages/admin/Dashboard';
import ManageServices from './pages/admin/ManageServices';
import ManageAppointments from './pages/admin/ManageAppointments';
import Analytics from './pages/admin/Analytics';
import ManageStaff from './pages/admin/ManageStaff';
import StaffLeaveManagement from './pages/admin/StaffLeaveManagement';
import ManageCustomers from './pages/admin/ManageCustomers';
import ManageVouchers from './pages/admin/ManageVouchers';
import ServiceStaffDashboard from './pages/staff/ServiceStaffDashboard';
import StaffScheduleCalendar from './pages/admin/StaffScheduleCalendar';

import Header from './components/Header';
import Footer from './components/Footer';
import BottomNav from './components/BottomNav/BottomNav';
import ConsentBanner from './components/ConsentBanner';
import { readUserLocation } from './utils/consent';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(() => readUserLocation());

  useEffect(() => {
    const savedUser = authService.getUser();
    const savedToken = authService.getToken();

    if (savedUser && savedToken) {
      setUser(savedUser);
    } else {
      authService.logout();
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      document.body.classList.add('has-bottom-nav');
    } else {
      document.body.classList.remove('has-bottom-nav');
    }
    return () => document.body.classList.remove('has-bottom-nav');
  }, [user]);

  const isAuthenticated = Boolean(user && authService.getToken());
  const authenticatedUser = isAuthenticated ? user : null;

  const handleLogin = (userData) => {
    setUser(userData);
    authService.setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
    authService.logout();
  };

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  return (
    <Router>
      <div className="app">
        <Header user={authenticatedUser} onLogout={handleLogout} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home userLocation={userLocation} />} />
            <Route path="/services" element={<Services />} />
            <Route path="/services/:id" element={<ServiceDetail />} />
            <Route path="/payment-result" element={<PaymentReturn />} />
            <Route path="/payment-transfer/:paymentId" element={<PaymentTransfer />} />
            <Route path="/payment-bill/:paymentId" element={<PaymentInvoice />} />
            <Route
              path="/login"
              element={isAuthenticated ? <Navigate to="/" /> : <Login onLogin={handleLogin} />}
            />
            <Route
              path="/register"
              element={isAuthenticated ? <Navigate to="/" /> : <Register />}
            />
            <Route
              path="/forgot-password"
              element={isAuthenticated ? <Navigate to="/" /> : <ForgotPassword />}
            />
            <Route
              path="/reset-password"
              element={isAuthenticated ? <Navigate to="/" /> : <ResetPassword />}
            />
            <Route
              path="/auth/zalo-callback"
              element={isAuthenticated ? <Navigate to="/" /> : <ZaloCallback onLogin={handleLogin} />}
            />

            {isAuthenticated && user.role === 'customer' && (
              <>
                <Route path="/booking/:serviceId" element={<Booking />} />
                <Route path="/my-appointments" element={<MyAppointments />} />
                <Route path="/my-vouchers" element={<MyVouchers />} />
              </>
            )}

            {isAuthenticated && user.role === 'admin' && (
              <>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/services" element={<ManageServices />} />
                <Route path="/admin/staff" element={<ManageStaff />} />
                <Route path="/admin/staff-leave" element={<StaffLeaveManagement />} />
                <Route path="/admin/customers" element={<ManageCustomers />} />
                <Route path="/admin/vouchers" element={<ManageVouchers />} />
                <Route path="/admin/appointments" element={<ManageAppointments />} />
                <Route path="/admin/schedule" element={<StaffScheduleCalendar />} />
                <Route path="/admin/analytics" element={<Analytics />} />
              </>
            )}

            {isAuthenticated && user.role === 'staff' && (
              <>
                {(user.staff_role_name || '').trim().toLowerCase() === 'thu ngân' ? (
                  <>
                    <Route path="/staff/dashboard" element={<ManageAppointments />} />
                    <Route path="/staff/customers" element={<ManageCustomers />} />
                  </>
                ) : (
                  <>
                    <Route path="/staff/dashboard" element={<ServiceStaffDashboard />} />
                  </>
                )}
              </>
            )}

            {isAuthenticated && (
              <Route path="/profile" element={<Profile user={user} setUser={setUser} />} />
            )}

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        <ChatBot />
        <ConsentBanner onLocationChange={setUserLocation} />
        <Footer />
        {authenticatedUser && <BottomNav user={authenticatedUser} />}
      </div>
    </Router>
  );
}

export default App;
