/**
 * DashCard.tsx — Shared dashboard UI primitives
 * Matches the web's Dashboard.css design system:
 *   .stat-card, .dash-section-header, .dash-class-card,
 *   .dash-day-progress-card, .dash-ann-item
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

/* ================================================================
   StatCard — matches web .stat-card
   Icon badge (top-left) → large number → label
   ================================================================ */
interface StatCardProps {
    icon: keyof typeof MaterialIcons.glyphMap;
    iconColor: string;
    iconBg: string;
    value: string | number;
    label: string;
}

export const StatCard: React.FC<StatCardProps> = ({ icon, iconColor, iconBg, value, label }) => {
    const { colors } = useTheme();
    return (
        <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[s.statIcon, { backgroundColor: iconBg }]}>
                <MaterialIcons name={icon} size={16} color={iconColor} />
            </View>
            <Text style={[s.statNumber, { color: colors.textPrimary }]}>{value}</Text>
            <Text style={[s.statLabel, { color: colors.textMuted }]}>{label}</Text>
        </View>
    );
};

/* ================================================================
   SectionHeader — matches web .dash-section-header
   Title (with optional icon) + optional count badge
   ================================================================ */
interface SectionHeaderProps {
    title: string;
    icon?: keyof typeof MaterialIcons.glyphMap;
    count?: number | string;
    rightElement?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, icon, count, rightElement }) => {
    const { colors } = useTheme();
    return (
        <View style={s.sectionHeader}>
            <View style={s.sectionHeaderLeft}>
                {icon && <MaterialIcons name={icon} size={15} color={colors.textMuted} />}
                <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
            </View>
            <View style={s.sectionHeaderRight}>
                {count !== undefined && (
                    <View style={[s.sectionCount, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[s.sectionCountText, { color: colors.textSecondary }]}>{count}</Text>
                    </View>
                )}
                {rightElement}
            </View>
        </View>
    );
};

/* ================================================================
   ClassCard — matches web .dash-class-card
   Color stripe | subject + status badge | details row | progress
   ================================================================ */
interface ClassCardProps {
    subject: string;
    color: string;
    statusLabel: string;
    statusBg: string;
    statusText: string;
    details: { icon: keyof typeof MaterialIcons.glyphMap; text: string }[];
    progress?: number;       // 0–100, only shown when provided
    isOngoing?: boolean;
    onPress?: () => void;
    onLongPress?: () => void;
}

export const ClassCard: React.FC<ClassCardProps> = ({
    subject, color, statusLabel, statusBg, statusText,
    details, progress, isOngoing,
}) => {
    const { colors } = useTheme();
    return (
        <View style={[
            s.classCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
            isOngoing && { borderColor: 'rgba(100,116,139,0.3)', backgroundColor: 'rgba(100,116,139,0.04)' },
        ]}>
            {/* Color stripe */}
            <View style={[s.classStripe, { backgroundColor: color }]} />

            {/* Body */}
            <View style={s.classBody}>
                {/* Top: subject + status */}
                <View style={s.classTop}>
                    <View style={s.classSubjectRow}>
                        {isOngoing && <View style={s.liveDot} />}
                        <Text style={[s.classSubject, { color: colors.textPrimary }]} numberOfLines={1}>{subject}</Text>
                    </View>
                    <View style={[s.classBadge, { backgroundColor: statusBg }]}>
                        <Text style={[s.classBadgeText, { color: statusText }]}>{statusLabel}</Text>
                    </View>
                </View>

                {/* Details row */}
                <View style={s.classDetails}>
                    {details.map((d, i) => (
                        <View key={i} style={s.classDetailItem}>
                            <MaterialIcons name={d.icon} size={13} color={colors.textMuted} style={{ opacity: 0.55 }} />
                            <Text style={[s.classDetailText, { color: colors.textSecondary }]} numberOfLines={1}>{d.text}</Text>
                        </View>
                    ))}
                </View>

                {/* Progress bar (ongoing only) */}
                {progress !== undefined && isOngoing && (
                    <View style={s.progressTrack}>
                        <View style={[s.progressFill, { width: `${progress}%`, backgroundColor: color }]} />
                    </View>
                )}
            </View>
        </View>
    );
};

/* ================================================================
   DayProgressBar — matches web .dash-day-progress-card
   Segmented horizontal bar + legend
   ================================================================ */
interface DayProgressBarProps {
    finished: number;
    ongoing: number;
    upcoming: number;
}

export const DayProgressBar: React.FC<DayProgressBarProps> = ({ finished, ongoing, upcoming }) => {
    const { colors } = useTheme();
    const total = finished + ongoing + upcoming;
    if (total === 0) return null;

    return (
        <View style={[s.dayProgressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Header */}
            <View style={s.dayProgressHeader}>
                <View style={s.dayProgressHeaderLeft}>
                    <MaterialIcons name="schedule" size={13} color={colors.textPrimary} />
                    <Text style={[s.dayProgressTitle, { color: colors.textPrimary }]}>Today's progress</Text>
                </View>
                <Text style={[s.dayProgressStats, { color: colors.textSecondary }]}>
                    <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>{finished}</Text>
                    <Text style={{ color: colors.textMuted }}>/{total}</Text> done
                </Text>
            </View>

            {/* Segmented bar */}
            <View style={s.segBar}>
                {finished > 0 && <View style={[s.segSection, { flex: finished, backgroundColor: '#94a3b8', borderTopLeftRadius: 999, borderBottomLeftRadius: 999 }]} />}
                {ongoing > 0 && <View style={[s.segSection, { flex: ongoing, backgroundColor: '#10b981' }]} />}
                {upcoming > 0 && <View style={[s.segSection, { flex: upcoming, backgroundColor: '#3b82f6', borderTopRightRadius: 999, borderBottomRightRadius: 999 }]} />}
            </View>

            {/* Legend */}
            <View style={s.dayLegend}>
                <View style={s.dayLegendItem}>
                    <MaterialIcons name="check-circle" size={11} color="#94a3b8" />
                    <Text style={[s.dayLegendLabel, { color: colors.textSecondary }]}>Finished </Text>
                    <Text style={[s.dayLegendValue, { color: colors.textPrimary }]}>{finished}</Text>
                </View>
                <View style={s.dayLegendItem}>
                    <View style={[s.legendDot, { backgroundColor: '#10b981' }]} />
                    <Text style={[s.dayLegendLabel, { color: colors.textSecondary }]}>Ongoing </Text>
                    <Text style={[s.dayLegendValue, { color: colors.textPrimary }]}>{ongoing}</Text>
                </View>
                <View style={s.dayLegendItem}>
                    <MaterialIcons name="schedule" size={11} color="#3b82f6" />
                    <Text style={[s.dayLegendLabel, { color: colors.textSecondary }]}>Upcoming </Text>
                    <Text style={[s.dayLegendValue, { color: colors.textPrimary }]}>{upcoming}</Text>
                </View>
            </View>
        </View>
    );
};

/* ================================================================
   AnnouncementItem — matches web .dash-ann-item
   Priority dot | title + content snippet + meta
   ================================================================ */
interface AnnouncementItemProps {
    title: string;
    content: string;
    meta: string;
    priority?: 'urgent' | 'important' | 'normal';
    rightElement?: React.ReactNode;
}

export const AnnouncementItem: React.FC<AnnouncementItemProps> = ({ title, content, meta, priority = 'normal', rightElement }) => {
    const { colors } = useTheme();
    const dotColor = priority === 'urgent' ? '#ef4444' : priority === 'important' ? '#f59e0b' : '#22c55e';

    return (
        <View style={[s.annItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Priority dot */}
            <View style={[s.annDot, { backgroundColor: dotColor }]} />

            {/* Body */}
            <View style={s.annBody}>
                <Text style={[s.annTitle, { color: colors.textPrimary }]} numberOfLines={1}>{title}</Text>
                <Text style={[s.annText, { color: colors.textSecondary }]} numberOfLines={2}>{content}</Text>
                <Text style={[s.annMeta, { color: colors.textMuted }]}>{meta}</Text>
            </View>
            {rightElement}
        </View>
    );
};

/* ================================================================
   EventItem — matches web .dash-event-item
   ================================================================ */
interface EventItemProps {
    title: string;
    meta: string;
    rightElement?: React.ReactNode;
}

export const EventItem: React.FC<EventItemProps> = ({ title, meta, rightElement }) => {
    const { colors } = useTheme();
    return (
        <View style={[s.eventItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={s.eventInfo}>
                <Text style={[s.eventTitle, { color: colors.textPrimary }]} numberOfLines={1}>{title}</Text>
                <Text style={[s.eventMeta, { color: colors.textMuted }]}>{meta}</Text>
            </View>
            {rightElement}
        </View>
    );
};

/* ================================================================
   Styles
   ================================================================ */
const s = StyleSheet.create({
    /* StatCard */
    statCard: {
        flex: 1,
        borderRadius: 8,
        borderWidth: 1,
        padding: 14,
        gap: 6,
    },
    statIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 2,
    },
    statNumber: {
        fontSize: 28,
        fontWeight: '700',
        letterSpacing: -0.5,
        lineHeight: 32,
    },
    statLabel: {
        fontSize: 12,
        fontWeight: '500',
    },

    /* SectionHeader */
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        marginBottom: 10,
    },
    sectionHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: -0.1,
    },
    sectionCount: {
        minWidth: 22,
        height: 20,
        paddingHorizontal: 8,
        borderRadius: 999,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionCountText: {
        fontSize: 11,
        fontWeight: '600',
    },

    /* ClassCard */
    classCard: {
        flexDirection: 'row',
        gap: 12,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 8,
    },
    classStripe: {
        width: 3,
        borderRadius: 2,
    },
    classBody: {
        flex: 1,
    },
    classTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    classSubjectRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#3FAF73',
    },
    classSubject: {
        fontSize: 13.5,
        fontWeight: '700',
        letterSpacing: -0.1,
        flex: 1,
    },
    classBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
    },
    classBadgeText: {
        fontSize: 10.5,
        fontWeight: '700',
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    classDetails: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        columnGap: 12,
    },
    classDetailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    classDetailText: {
        fontSize: 12,
    },
    progressTrack: {
        width: '100%',
        height: 4,
        marginTop: 8,
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },

    /* DayProgressBar */
    dayProgressCard: {
        borderRadius: 8,
        borderWidth: 1,
        padding: 14,
        paddingHorizontal: 18,
        marginBottom: 20,
    },
    dayProgressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dayProgressHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    dayProgressTitle: {
        fontSize: 12.5,
        fontWeight: '600',
    },
    dayProgressStats: {
        fontSize: 12.5,
        fontWeight: '600',
    },
    segBar: {
        flexDirection: 'row',
        height: 10,
        borderRadius: 999,
        overflow: 'hidden',
        backgroundColor: 'rgba(0,0,0,0.08)',
        marginVertical: 8,
    },
    segSection: {
        height: '100%',
    },
    dayLegend: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        columnGap: 14,
        marginTop: 4,
    },
    dayLegendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    dayLegendLabel: {
        fontSize: 12,
    },
    dayLegendValue: {
        fontSize: 12,
        fontWeight: '600',
    },

    /* AnnouncementItem */
    annItem: {
        flexDirection: 'row',
        gap: 10,
        padding: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 8,
    },
    annDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginTop: 6,
    },
    annBody: {
        flex: 1,
    },
    annTitle: {
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 2,
    },
    annText: {
        fontSize: 12,
        lineHeight: 17,
    },
    annMeta: {
        marginTop: 4,
        fontSize: 11,
    },

    /* EventItem */
    eventItem: {
        flexDirection: 'row',
        gap: 10,
        padding: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 8,
        alignItems: 'center',
    },
    eventInfo: {
        flex: 1,
    },
    eventTitle: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 2,
    },
    eventMeta: {
        fontSize: 11.5,
    },
});
