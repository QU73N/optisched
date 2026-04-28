# Role Capability Matrix

This document defines the capabilities and permissions for each user role in OptiSched.

## Roles

| Role | Description |
|------|-------------|
| **student** | Can view their own schedule, upcoming classes, and announcements |
| **teacher** | Can manage their schedule, preferences, workload, requests, and sections |
| **admin** | Full administrative access to scheduling, users, and system configuration |
| **schedule_admin** | Can manage schedules, conflicts, and approval workflows |
| **schedule_manager** | Can manage data sharing, templates, and schedule history |
| **power_admin** | Can manage backups, emergency overrides, and feature flags |
| **system_admin** | Can manage system rules, audit logs, user activity, and health monitoring |

## Capability Matrix

| Capability | Student | Teacher | Admin | Schedule Admin | Schedule Manager | Power Admin | System Admin |
|------------|---------|---------|-------|---------------|-----------------|-------------|--------------|
| **Scheduling** |
| View own schedule | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Manage own preferences | - | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Submit schedule requests | - | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View all schedules | - | - | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit all schedules | - | - | ✓ | ✓ | - | - | - |
| Approve/reject requests | - | - | ✓ | ✓ | - | - | - |
| Resolve conflicts | - | - | ✓ | ✓ | - | - | - |
| **User Management** |
| View user list | - | - | ✓ | - | - | ✓ | ✓ |
| Create/edit users | - | - | ✓ | - | - | - | ✓ |
| Deactivate users | - | - | ✓ | - | - | - | ✓ |
| Assign roles | - | - | - | - | - | - | ✓ |
| **System Administration** |
| View audit logs | - | - | ✓ | - | - | ✓ | ✓ |
| View user activity | - | - | ✓ | - | - | ✓ | ✓ |
| Manage sessions | - | - | ✓ | - | - | ✓ | ✓ |
| View system health | - | - | - | - | - | ✓ | ✓ |
| Manage system rules | - | - | - | - | - | - | ✓ |
| **Data Management** |
| Export data | - | - | ✓ | - | ✓ | ✓ | ✓ |
| Import data | - | - | ✓ | - | ✓ | ✓ | ✓ |
| Manage data sharing | - | - | ✓ | - | ✓ | ✓ | ✓ |
| Manage templates | - | - | ✓ | - | ✓ | ✓ | ✓ |
| **Power Admin** |
| Manage backups | - | - | - | - | - | ✓ | ✓ |
| Activate overrides | - | - | - | - | - | ✓ | ✓ |
| Manage feature flags | - | - | - | - | - | ✓ | ✓ |
| **Communication** |
| View announcements | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create announcements | - | - | ✓ | - | - | ✓ | ✓ |
| Send messages | - | - | ✓ | ✓ | - | ✓ | ✓ |
| Chat with peers | - | ✓ | ✓ | ✓ | - | ✓ | ✓ |
| **AI Features** |
| AI schedule chat | - | - | ✓ | ✓ | - | ✓ | ✓ |
| OptiBot | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## Notes

- **Multi-role support**: Users can have multiple roles simultaneously (e.g., a teacher who is also a schedule_admin)
- **Role hierarchy**: System Admin has the broadest access, followed by Power Admin, then standard Admin
- **Row-Level Security (RLS)**: Database policies enforce role-based access at the data layer
- **Audit trail**: All administrative actions are logged in `audit_logs` table
