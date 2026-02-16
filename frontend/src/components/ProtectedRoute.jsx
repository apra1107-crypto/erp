import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, allowedRoles }) => {
    const token = localStorage.getItem('token');
    const userType = localStorage.getItem('userType');

    // 1. Check if authenticated
    if (!token || !userType) {
        return <Navigate to="/" replace />;
    }

    // 2. Check role permission
    if (allowedRoles && !allowedRoles.includes(userType)) {
        // If logged in but wrong role, redirect to appropriate dashboard
        // preventing "unauthorized" page flash
        return <Navigate to="/" replace />;
        // The Hero component at "/" will handle the correct redirect 
        // back to the user's actual allowed dashboard.
    }

    // 3. Render content
    return children;
};

export default ProtectedRoute;
