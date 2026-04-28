// AdminDashboardDispatcher - selects the correct role-specific dashboard
// based on the authenticated user's primary role. The shared /admin route
// renders this; backend RLS still enforces actual data access.
//
// Routing logic:
//   power_admin / admin (legacy)  -> PowerAdminDashboard (full system view)
//   system_admin                  -> SystemAdminDashboard
//   schedule_admin                -> ScheduleAdminDashboard
//   schedule_manager              -> ScheduleManagerDashboard
//   anything else                 -> PowerAdminDashboard fallback (RLS will gate)

import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import PowerAdminDashboard from './PowerAdminDashboard';
import SystemAdminDashboard from './SystemAdminDashboard';
import ScheduleAdminDashboard from './ScheduleAdminDashboard';
import ScheduleManagerDashboard from './ScheduleManagerDashboard';

const AdminDashboardDispatcher: React.FC = () => {
    const { role } = useAuth();
    switch (role) {
        case 'system_admin':
            return <SystemAdminDashboard />;
        case 'schedule_admin':
            return <ScheduleAdminDashboard />;
        case 'schedule_manager':
            return <ScheduleManagerDashboard />;
        case 'power_admin':
        case 'admin':
        default:
            return <PowerAdminDashboard />;
    }
};

export default AdminDashboardDispatcher;
