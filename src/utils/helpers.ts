// Utility helpers for OptiSched

/**
 * Format time string (HH:MM) to display format (e.g., "10:00 AM")
 */
export const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

/**
 * Format time range (e.g., "10:00 AM - 12:00 PM")
 */
export const formatTimeRange = (start: string, end: string): string => {
    return `${formatTime(start)} - ${formatTime(end)}`;
};

/**
 * Get greeting based on time of day
 */
export const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return '☀️ Good morning';
    if (hour < 17) return '🌤️ Good afternoon';
    return '🌙 Good evening';
};

/**
 * Get relative time string (e.g., "2m ago", "1h ago")
 */
export const getRelativeTime = (dateStr: string): string => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
};

/**
 * Get progress color based on percentage
 */
export const getProgressColor = (percentage: number): string => {
    if (percentage >= 100) return '#ef4444'; // red - overloaded
    if (percentage >= 80) return '#10b981';  // green - good
    if (percentage >= 50) return '#f59e0b';  // yellow - moderate
    return '#94a3b8'; // gray - low
};

/**
 * Get day abbreviation
 */
export const getDayAbbr = (day: string): string => {
    const map: Record<string, string> = {
        Monday: 'M',
        Tuesday: 'T',
        Wednesday: 'W',
        Thursday: 'Th',
        Friday: 'F',
        Saturday: 'S',
        Sunday: 'Su',
    };
    return map[day] || day.charAt(0);
};

/**
 * Get current week number in semester
 */
export const getCurrentWeek = (): number => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - startOfYear.getTime();
    return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
};

/**
 * Check if two time ranges overlap
 */
export const timeRangesOverlap = (
    start1: string, end1: string,
    start2: string, end2: string
): boolean => {
    const toMinutes = (t: string): number => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };
    const s1 = toMinutes(start1);
    const e1 = toMinutes(end1);
    const s2 = toMinutes(start2);
    const e2 = toMinutes(end2);
    return s1 < e2 && s2 < e1;
};

/**
 * Calculate remaining time for a class in progress
 */
export const getRemainingMinutes = (endTime: string): number => {
    const now = new Date();
    const [hours, minutes] = endTime.split(':').map(Number);
    const endDate = new Date();
    endDate.setHours(hours, minutes, 0, 0);
    const diffMs = endDate.getTime() - now.getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
};

/**
 * Calculate class progress percentage
 */
export const getClassProgress = (startTime: string, endTime: string): number => {
    const now = new Date();
    const toMinutes = (t: string): number => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const start = toMinutes(startTime);
    const end = toMinutes(endTime);
    const total = end - start;
    const elapsed = currentMinutes - start;
    return Math.max(0, Math.min(100, (elapsed / total) * 100));
};
