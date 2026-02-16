import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Header from './components/Header';
import Hero from './components/Hero';
import LoginDialog from './components/LoginDialog';
import PrincipalDashboard from './pages/PrincipalDashboard';
import StudentDashboard from './pages/StudentDashboard';
import StudentAttendanceHistory from './pages/StudentAttendanceHistory';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentFees from './pages/StudentFees';
import AdminDashboard from './pages/AdminDashboard';
import AdminInstituteDetails from './pages/AdminInstituteDetails';
import InstituteRegister from './pages/InstituteRegister';
import StudentAdmitCard from './pages/StudentAdmitCard';
import StudentIDCard from './pages/StudentIDCard';
import ProtectedRoute from './components/ProtectedRoute';
import { ThemeProvider, useTheme } from './context/ThemeContext';

const Layout = ({ children, onLoginClick }) => {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith('/dashboard') ||
    location.pathname.startsWith('/student-dashboard') ||
    location.pathname.startsWith('/teacher-dashboard') ||
    location.pathname.startsWith('/admin-dashboard') ||
    location.pathname.startsWith('/admin/institute');

  return (
    <div className="app-container">
      {!isDashboard && <Header onLoginClick={onLoginClick} />}
      <main>{children}</main>
    </div>
  );
};

const AppWithTheme = () => {
  const { theme } = useTheme();
  return (
    <>
      <Routes>
        <Route path="/" element={<Hero />} />
        <Route path="/register" element={<InstituteRegister />} />

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
                <Route path="/fees" element={<StudentFees />} />
                <Route path="/admit-card" element={<StudentAdmitCard />} />
                <Route path="/id-card" element={<StudentIDCard />} />
                <Route path="/attendance-history" element={<StudentAttendanceHistory />} />
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
      <ToastContainer position="top-right" theme={theme} />
    </>
  );
};

function App() {
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  return (
    <ThemeProvider>
      <Router>
        <Layout onLoginClick={() => setIsLoginOpen(true)}>
          <AppWithTheme />
          <LoginDialog isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
        </Layout>
      </Router>
    </ThemeProvider>
  );
}

export default App;
