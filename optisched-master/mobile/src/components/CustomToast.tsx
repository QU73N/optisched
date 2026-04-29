import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated,  Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AnimatedPressable } from './AnimatedPressable';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastConfig {
    type: ToastType;
    title: string;
    message?: string;
    duration?: number; // ms, default 3000
    actions?: { text: string; onPress: () => void; style?: 'default' | 'destructive' | 'cancel' }[];
}

interface ToastContextValue {
    showToast: (config: ToastConfig) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => { } });

export const useToast = () => useContext(ToastContext);

const TOAST_COLORS: Record<ToastType, { bg: string; border: string; icon: string; iconName: string }> = {
    success: { bg: 'rgba(16,185,129,0.15)', border: '#10b981', icon: '#34d399', iconName: 'check-circle' },
    error: { bg: 'rgba(239,68,68,0.15)', border: '#ef4444', icon: '#f87171', iconName: 'error' },
    warning: { bg: 'rgba(245,158,11,0.15)', border: '#f59e0b', icon: '#fbbf24', iconName: 'warning' },
    info: { bg: 'rgba(59,130,246,0.15)', border: '#3b82f6', icon: '#60a5fa', iconName: 'info' },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toast, setToast] = useState<ToastConfig | null>(null);
    const [visible, setVisible] = useState(false);
    const slideAnim = useRef(new Animated.Value(-200)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const hideToast = useCallback(() => {
        Animated.parallel([
            Animated.timing(slideAnim, { toValue: -200, duration: 300, useNativeDriver: true }),
            Animated.timing(opacityAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start(() => {
            setVisible(false);
            setToast(null);
        });
    }, [slideAnim, opacityAnim]);

    const showToast = useCallback((config: ToastConfig) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setToast(config);
        setVisible(true);
        Animated.parallel([
            Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
            Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]).start();

        if (!config.actions || config.actions.length === 0) {
            timerRef.current = setTimeout(hideToast, config.duration || 3000);
        }
    }, [slideAnim, opacityAnim, hideToast]);

    useEffect(() => {
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, []);

    const colors = toast ? TOAST_COLORS[toast.type] : TOAST_COLORS.info;

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {visible && toast && (
                <Animated.View style={[styles.overlay, { opacity: toast.actions?.length ? opacityAnim : new Animated.Value(0) }]}>
                    {toast.actions?.length ? (
                        <AnimatedPressable style={StyleSheet.absoluteFill} onPress={hideToast} activeOpacity={1} />
                    ) : null}
                    <Animated.View style={[styles.container, {
                        backgroundColor: '#1e293b',
                        borderColor: colors.border,
                        transform: [{ translateY: slideAnim }],
                        opacity: opacityAnim,
                    }]}>
                        <View style={styles.row}>
                            <View style={[styles.iconCircle, { backgroundColor: colors.bg }]}>
                                <MaterialIcons name={colors.iconName as any} size={22} color={colors.icon} />
                            </View>
                            <View style={styles.textSection}>
                                <Text style={styles.title}>{toast.title}</Text>
                                {toast.message && <Text style={styles.message}>{toast.message}</Text>}
                            </View>
                            <AnimatedPressable onPress={hideToast} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <MaterialIcons name="close" size={18} color="#94a3b8" />
                            </AnimatedPressable>
                        </View>
                        {toast.actions && toast.actions.length > 0 && (
                            <View style={styles.actions}>
                                {toast.actions.map((action, i) => (
                                    <AnimatedPressable
                                        key={i}
                                        style={[
                                            styles.actionBtn,
                                            action.style === 'destructive' && styles.actionDestructive,
                                            action.style === 'cancel' && styles.actionCancel,
                                            (!action.style || action.style === 'default') && { backgroundColor: colors.border },
                                        ]}
                                        onPress={() => { hideToast(); action.onPress(); }}
                                    >
                                        <Text style={[
                                            styles.actionText,
                                            action.style === 'cancel' && styles.actionCancelText,
                                        ]}>{action.text}</Text>
                                    </AnimatedPressable>
                                ))}
                            </View>
                        )}
                    </Animated.View>
                </Animated.View>
            )}
        </ToastContext.Provider>
    );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 9999, justifyContent: 'flex-start', alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
        paddingTop: 60,
    },
    container: {
        width: width - 32, borderRadius: 16, borderWidth: 1,
        padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3, shadowRadius: 12, elevation: 10,
    },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    iconCircle: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    textSection: { flex: 1, paddingTop: 2 },
    title: { fontSize: 15, fontWeight: '700', color: '#f1f5f9', marginBottom: 2 },
    message: { fontSize: 13, color: '#94a3b8', lineHeight: 18 },
    closeBtn: { padding: 4 },
    actions: { flexDirection: 'row', gap: 8, marginTop: 14, justifyContent: 'flex-end' },
    actionBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, minWidth: 80, alignItems: 'center' },
    actionDestructive: { backgroundColor: '#ef4444' },
    actionCancel: { backgroundColor: 'rgba(148,163,184,0.15)' },
    actionText: { fontSize: 13, fontWeight: '600', color: '#ffffff' },
    actionCancelText: { color: '#94a3b8' },
});
