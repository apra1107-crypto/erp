import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Header from './components/Header';
import Hero from './components/Hero';
import Features from './components/Features';
import Footer from './components/Footer';
import LoginDialog from './components/LoginDialog';
import PrincipalDashboard from './pages/PrincipalDashboard';
import StudentDashboard from './pages/StudentDashboard';
import StudentAttendanceHistory from './pages/StudentAttendanceHistory';
import TeacherDashboard from './pages/TeacherDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminInstituteDetails from './pages/AdminInstituteDetails';
import InstituteRegister from './pages/InstituteRegister';
import StudentAdmitCard from './pages/StudentAdmitCard';
import StudentIDCard from './pages/StudentIDCard';
import StudentFees from './pages/StudentFees';
import Transport from './pages/Transport';
import LiveTracking from './pages/LiveTracking';
import DriverManifest from './pages/DriverManifest';
import ProtectedRoute from './components/ProtectedRoute';
import { ThemeProvider } from './context/ThemeContext';

const Layout = ({ children, onLoginClick }) => {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith('/dashboard') ||
    location.pathname.startsWith('/student-dashboard') ||
    location.pathname.startsWith('/teacher-dashboard') ||
    location.pathname.startsWith('/admin-dashboard') ||
    location.pathname.startsWith('/admin/institute') ||
    location.pathname.startsWith('/driver/manifest');

  return (
    <div className="app-container">
      {!isDashboard && <Header onLoginClick={onLoginClick} />}
      <main>{children}</main>
    </div>
  );
};

function App() {
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  return (
    <ThemeProvider>
      <Router>
        <Layout onLoginClick={() => setIsLoginOpen(true)}>
          <Routes>
            <Route path="/" element={
              <>
                <Hero onLoginClick={() => setIsLoginOpen(true)} />
                <Features />
                <Footer />
              </>
            } />
            <Route path="/register" element={<InstituteRegister />} />
            <Route path="/driver/manifest/:id" element={<DriverManifest />} />

            {/* Protected Routes */}
            <Route
              path="/dashboard/*"
              element={
                <ProtectedRoute allowedRoles={['principal']}>
                  <PrincipalDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student-dashboard/*"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <Routes>
                    <Route path="/" element={<StudentDashboard />} />
                    <Route path="/admit-card" element={<StudentAdmitCard />} />
                    <Route path="/id-card" element={<StudentIDCard />} />
                    <Route path="/attendance-history" element={<StudentAttendanceHistory />} />
                    <Route path="/fees" element={<StudentFees />} />
                    <Route path="/transport" element={<Transport />} />
                    <Route path="/transport/live/:id" element={<LiveTracking />} />
                  </Routes>
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher-dashboard/*"
              element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <TeacherDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin-dashboard"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/institute/:id"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminInstituteDetails />
                </ProtectedRoute>
              }
            />
          </Routes>
          <LoginDialog isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
        </Layout>
        <ToastContainer 
          position="top-right" 
          autoClose={3000}
          style={{ zIndex: 100000 }} 
        />
      </Router>
    </ThemeProvider>
  );
}

export default App;
