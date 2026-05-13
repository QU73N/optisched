/**
 * Skeleton component system for instant UI rendering.
 * Provides contextual skeleton loaders that maintain stable layout dimensions.
 */
import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'circular' | 'rectangular';
  animation?: 'pulse' | 'wave' | 'none';
}

/**
 * Base skeleton component.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width,
  height,
  variant = 'rectangular',
  animation = 'pulse',
}) => {
  const style: React.CSSProperties = {
    width: width !== undefined ? (typeof width === 'number' ? `${width}px` : width) : undefined,
    height: height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : undefined,
  };

  const variantClasses = {
    text: 'skeleton-text',
    circular: 'skeleton-circular',
    rectangular: 'skeleton-rect',
  }[variant];

  const animationClasses = {
    pulse: 'skeleton-pulse',
    wave: 'skeleton-wave',
    none: '',
  }[animation];

  return (
    <div
      className={`skeleton ${variantClasses} ${animationClasses} ${className}`.trim()}
      style={style}
      role="presentation"
      aria-hidden="true"
    />
  );
};

/**
 * Card skeleton for dashboard cards.
 */
export const CardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton-card ${className}`}>
    <Skeleton height={24} width="60%" className="skeleton-card-title" />
    <Skeleton height={16} width="40%" className="skeleton-card-subtitle" />
    <div className="skeleton-card-content">
      <Skeleton height={48} variant="rectangular" className="skeleton-card-metric" />
      <Skeleton height={12} width="30%" className="skeleton-card-label" />
    </div>
  </div>
);

/**
 * Table skeleton for data tables.
 */
export const TableSkeleton: React.FC<{ rows?: number; columns?: number; className?: string }> = ({
  rows = 5,
  columns = 4,
  className = '',
}) => (
  <div className={`skeleton-table ${className}`}>
    <div className="skeleton-table-header">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} height={20} width={`${100 / columns}%`} />
      ))}
    </div>
    <div className="skeleton-table-body">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="skeleton-table-row">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} height={16} width={`${100 / columns}%`} />
          ))}
        </div>
      ))}
    </div>
  </div>
);

/**
 * Dashboard skeleton for admin/teacher/student dashboards.
 */
export const DashboardSkeleton: React.FC<{ cardCount?: number; className?: string }> = ({
  cardCount = 4,
  className = '',
}) => (
  <div className={`skeleton-dashboard ${className}`}>
    <div className="skeleton-dashboard-header">
      <Skeleton height={32} width={200} />
      <Skeleton height={36} width={120} variant="rectangular" />
    </div>
    <div className="skeleton-dashboard-cards">
      {Array.from({ length: cardCount }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
    <div className="skeleton-dashboard-sections">
      <div className="skeleton-dashboard-section">
        <Skeleton height={24} width={150} className="skeleton-section-title" />
        <TableSkeleton rows={3} columns={3} />
      </div>
      <div className="skeleton-dashboard-section">
        <Skeleton height={24} width={150} className="skeleton-section-title" />
        <TableSkeleton rows={3} columns={3} />
      </div>
    </div>
  </div>
);

/**
 * Schedule timetable skeleton.
 */
export const ScheduleSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton-schedule ${className}`}>
    <div className="skeleton-schedule-header">
      <Skeleton height={28} width={180} />
      <div className="skeleton-schedule-controls">
        <Skeleton height={36} width={100} variant="rectangular" />
        <Skeleton height={36} width={100} variant="rectangular" />
      </div>
    </div>
    <div className="skeleton-schedule-grid">
      {/* Time column */}
      <div className="skeleton-schedule-time">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} height={40} width={60} />
        ))}
      </div>
      {/* Days */}
      {Array.from({ length: 5 }).map((_, dayIndex) => (
        <div key={dayIndex} className="skeleton-schedule-day">
          <Skeleton height={32} width={80} />
          {Array.from({ length: 8 }).map((_, slotIndex) => (
            <Skeleton key={slotIndex} height={40} className="skeleton-schedule-slot" />
          ))}
        </div>
      ))}
    </div>
  </div>
);

/**
 * Notification list skeleton.
 */
export const NotificationSkeleton: React.FC<{ count?: number; className?: string }> = ({
  count = 5,
  className = '',
}) => (
  <div className={`skeleton-notifications ${className}`}>
    <div className="skeleton-notifications-header">
      <Skeleton height={24} width={120} />
      <Skeleton height={32} width={32} variant="circular" />
    </div>
    <div className="skeleton-notifications-list">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-notification-item">
          <Skeleton height={40} width={40} variant="circular" />
          <div className="skeleton-notification-content">
            <Skeleton height={16} width="70%" />
            <Skeleton height={14} width="50%" />
          </div>
          <Skeleton height={20} width={60} />
        </div>
      ))}
    </div>
  </div>
);

/**
 * Form skeleton for settings/profile forms.
 */
export const FormSkeleton: React.FC<{ fieldCount?: number; className?: string }> = ({
  fieldCount = 6,
  className = '',
}) => (
  <div className={`skeleton-form ${className}`}>
    <div className="skeleton-form-header">
      <Skeleton height={32} width={200} />
      <Skeleton height={14} width="60%" />
    </div>
    <div className="skeleton-form-fields">
      {Array.from({ length: fieldCount }).map((_, i) => (
        <div key={i} className="skeleton-form-field">
          <Skeleton height={16} width={120} className="skeleton-form-label" />
          <Skeleton height={40} variant="rectangular" />
        </div>
      ))}
    </div>
    <div className="skeleton-form-actions">
      <Skeleton height={40} width={120} variant="rectangular" />
      <Skeleton height={40} width={120} variant="rectangular" />
    </div>
  </div>
);
