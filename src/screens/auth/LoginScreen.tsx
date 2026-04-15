import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    View, Text, TextInput, StyleSheet, Image, Animated, Dimensions,
    KeyboardAvoidingView, Platform, StatusBar, Alert, Modal, ActivityIndicator, ScrollView
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../config/supabase';
import { AnimatedPressable } from '../../components/AnimatedPressable';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CARD_MAX_W = isWeb ? 420 : width;

// Logo assets
const logoLight = require('../../../assets/logo.png');
const logoDark = require('../../../assets/logo-white.png');

// Theme-aware color tokens
const getLoginColors = (isDark: boolean) => ({
    bg: isDark ? '#080a10' : '#f0f2f5',
    orbA: isDark ? 'rgba(19,91,236,0.06)' : 'rgba(19,91,236,0.05)',
    orbB: isDark ? 'rgba(96,165,250,0.04)' : 'rgba(19,91,236,0.03)',
    glow: isDark ? 'rgba(19,91,236,0.25)' : 'rgba(19,91,236,0.12)',
    title: isDark ? '#ffffff' : '#0f172a',
    subtitle: isDark ? '#64748b' : '#64748b',
    badgeBg: isDark ? 'rgba(96,165,250,0.08)' : 'rgba(19,91,236,0.06)',
    badgeText: isDark ? '#60a5fa' : '#2563eb',
    card: isDark ? '#111827' : '#ffffff',
    cardBorder: isDark ? '#1e293b' : '#e5e7eb',
    cardTitle: isDark ? '#e2e8f0' : '#1e293b',
    label: isDark ? '#64748b' : '#6b7280',
    inputBg: isDark ? '#0c0f18' : '#f8fafc',
    inputBorder: isDark ? '#1e293b' : '#e2e8f0',
    inputFocusBorder: isDark ? '#2563eb' : '#3b82f6',
    inputFocusBg: isDark ? '#0f1219' : '#f0f5ff',
    inputText: isDark ? '#f1f5f9' : '#0f172a',
    placeholder: isDark ? '#4b5563' : '#9ca3af',
    iconDefault: isDark ? '#4b5563' : '#9ca3af',
    iconFocus: isDark ? '#60a5fa' : '#3b82f6',
    forgotText: isDark ? '#60a5fa' : '#2563eb',
    errorBg: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.06)',
    errorBorder: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.15)',
    errorText: isDark ? '#f87171' : '#dc2626',
    divider: isDark ? '#1e293b' : '#e5e7eb',
    dividerText: isDark ? '#475569' : '#9ca3af',
    footerText: isDark ? '#4b5563' : '#9ca3af',
    eyeIcon: isDark ? '#6b7280' : '#9ca3af',
    // Modal
    modalOverlay: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.4)',
    modalBg: isDark ? '#1e293b' : '#ffffff',
    modalBorder: isDark ? '#334155' : '#e5e7eb',
    modalText: isDark ? '#ffffff' : '#0f172a',
    modalSubtext: isDark ? '#94a3b8' : '#64748b',
    modalInfoBg: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.06)',
    modalInfoLabel: isDark ? '#60a5fa' : '#2563eb',
    modalInfoText: isDark ? '#94a3b8' : '#64748b',
    modalInputBg: isDark ? '#0f172a' : '#f8fafc',
    modalInputBorder: isDark ? '#334155' : '#e2e8f0',
    modalInputText: isDark ? '#ffffff' : '#0f172a',
    modalCancel: isDark ? '#94a3b8' : '#64748b',
});

const LoginScreen: React.FC = () => {
    const { signIn, isLoading } = useAuth();
    const { colors: themeColors } = useTheme();
    const isDark = themeColors.isDark;
    const c = useMemo(() => getLoginColors(isDark), [isDark]);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showForgotModal, setShowForgotModal] = useState(false);
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotSuccess, setForgotSuccess] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [emailFocused, setEmailFocused] = useState(false);
    const [passwordFocused, setPasswordFocused] = useState(false);

    // --- Entrance animations ---
    const logoScale = useRef(new Animated.Value(0.6)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const formTranslate = useRef(new Animated.Value(50)).current;
    const formOpacity = useRef(new Animated.Value(0)).current;
    const footerOpacity = useRef(new Animated.Value(0)).current;
    const btnShine = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Staggered entrance: logo → form → footer
        Animated.sequence([
            // 1) Logo bounces in
            Animated.parallel([
                Animated.spring(logoScale, {
                    toValue: 1,
                    friction: 5,
                    tension: 50,
                    useNativeDriver: true,
                }),
                Animated.timing(logoOpacity, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                }),
            ]),
            // 2) Form slides up
            Animated.parallel([
                Animated.spring(formTranslate, {
                    toValue: 0,
                    friction: 7,
                    tension: 45,
                    useNativeDriver: true,
                }),
                Animated.timing(formOpacity, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }),
            ]),
            // 3) Footer fades in
            Animated.timing(footerOpacity, {
                toValue: 1,
                duration: 350,
                useNativeDriver: true,
            }),
        ]).start();

        // Subtle periodic shine sweep on button
        Animated.loop(
            Animated.sequence([
                Animated.delay(4000),
                Animated.timing(btnShine, { toValue: 1, duration: 600, useNativeDriver: true }),
                Animated.timing(btnShine, { toValue: 0, duration: 600, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    const handleForgotPassword = async () => {
        setForgotEmail(email.trim());
        setShowForgotModal(true);
        setForgotSuccess(false);
    };

    const submitForgotPassword = async () => {
        if (!forgotEmail.trim()) {
            Alert.alert('Error', 'Please enter your email address.');
            return;
        }
        setForgotLoading(true);
        try {
            const { error: insertError } = await supabase.from('password_reset_requests').insert({
                email: forgotEmail.trim().toLowerCase(),
                status: 'pending',
                requested_at: new Date().toISOString(),
            });
            if (insertError) {
                Alert.alert('Error', insertError.message);
                setShowForgotModal(false);
            } else {
                setForgotSuccess(true);
            }
        } catch {
            Alert.alert('Error', 'Failed to send request.');
            setShowForgotModal(false);
        } finally {
            setForgotLoading(false);
        }
    };

    const handleLogin = async () => {
        if (!email || !password) {
            setError('Please fill in all fields');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        setError(null);
        const result = await signIn(email, password);
        if (result.error) {
            setError(result.error);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: c.bg }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={c.bg} />

            {/* Background ambient orbs */}
            <View style={[styles.orbTopRight, { backgroundColor: c.orbA }]} />
            <View style={[styles.orbBottomLeft, { backgroundColor: c.orbB }]} />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.content}
                >
                    {/* ── Logo & Title ── */}
                    <Animated.View style={[
                        styles.logoSection,
                        {
                            opacity: logoOpacity,
                            transform: [{ scale: logoScale }],
                        },
                    ]}>
                        <View style={styles.logoContainer}>
                            <Image
                                source={isDark ? logoDark : logoLight}
                                style={styles.logoImage}
                                resizeMode="contain"
                            />
                        </View>
                        <Text style={[styles.title, { color: c.title }]}>OptiSched</Text>
                        <Text style={[styles.subtitle, { color: c.subtitle }]}>Smart Scheduling, Simple Solutions</Text>
                        <View style={[styles.schoolBadge, { backgroundColor: c.badgeBg }]}>
                            <MaterialIcons name="school" size={13} color={c.badgeText} />
                            <Text style={[styles.schoolText, { color: c.badgeText }]}>STI College Meycauayan</Text>
                        </View>
                    </Animated.View>

                    {/* ── Login Card ── */}
                    <Animated.View style={[
                        styles.card,
                        {
                            backgroundColor: c.card,
                            borderColor: c.cardBorder,
                            opacity: formOpacity,
                            transform: [{ translateY: formTranslate }],
                        },
                    ]}>
                        <Text style={[styles.cardTitle, { color: c.cardTitle }]}>Sign in to your account</Text>

                        {/* Email */}
                        <View style={styles.fieldGroup}>
                            <Text style={[styles.label, { color: c.label }]}>INSTITUTIONAL EMAIL</Text>
                            <View style={[
                                styles.inputWrapper,
                                { backgroundColor: c.inputBg, borderColor: c.inputBorder },
                                emailFocused && { borderColor: c.inputFocusBorder, backgroundColor: c.inputFocusBg },
                            ]}>
                                <MaterialIcons name="mail-outline" size={18} color={emailFocused ? c.iconFocus : c.iconDefault} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { color: c.inputText }]}
                                    placeholder="student@meycauayan.sti.edu.ph"
                                    placeholderTextColor={c.placeholder}
                                    value={email}
                                    onChangeText={setEmail}
                                    onFocus={() => setEmailFocused(true)}
                                    onBlur={() => setEmailFocused(false)}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                            </View>
                        </View>

                        {/* Password */}
                        <View style={styles.fieldGroup}>
                            <View style={styles.labelRow}>
                                <Text style={[styles.label, { color: c.label }]}>PASSWORD</Text>
                                <AnimatedPressable style={styles.forgotBtn} onPress={handleForgotPassword}>
                                    <Text style={[styles.forgotText, { color: c.forgotText }]}>Forgot Password?</Text>
                                </AnimatedPressable>
                            </View>
                            <View style={[
                                styles.inputWrapper,
                                { backgroundColor: c.inputBg, borderColor: c.inputBorder },
                                passwordFocused && { borderColor: c.inputFocusBorder, backgroundColor: c.inputFocusBg },
                            ]}>
                                <MaterialIcons name="lock-outline" size={18} color={passwordFocused ? c.iconFocus : c.iconDefault} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { color: c.inputText }]}
                                    placeholder="Enter your password"
                                    placeholderTextColor={c.placeholder}
                                    value={password}
                                    onChangeText={setPassword}
                                    onFocus={() => setPasswordFocused(true)}
                                    onBlur={() => setPasswordFocused(false)}
                                    secureTextEntry={!showPassword}
                                />
                                <AnimatedPressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                                    <MaterialIcons
                                        name={showPassword ? 'visibility' : 'visibility-off'}
                                        size={18}
                                        color={c.eyeIcon}
                                    />
                                </AnimatedPressable>
                            </View>
                        </View>

                        {/* Error */}
                        {error && (
                            <View style={[styles.errorContainer, { backgroundColor: c.errorBg, borderColor: c.errorBorder }]}>
                                <MaterialIcons name="error-outline" size={16} color={c.errorText} />
                                <Text style={[styles.errorText, { color: c.errorText }]}>{error}</Text>
                            </View>
                        )}

                        {/* Login Button */}
                        <View>
                            <AnimatedPressable
                                style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
                                onPress={handleLogin}
                                disabled={isLoading}
                                activeOpacity={0.8}
                            >
                                {isLoading ? (
                                    <View style={styles.loginBtnInner}>
                                        <ActivityIndicator size="small" color={Colors.white} />
                                        <Text style={styles.loginBtnText}>Signing In...</Text>
                                    </View>
                                ) : (
                                    <View style={styles.loginBtnInner}>
                                        <Text style={styles.loginBtnText}>Get Started</Text>
                                        <MaterialIcons name="arrow-forward" size={18} color={Colors.white} />
                                    </View>
                                )}
                            </AnimatedPressable>
                            {/* Shine overlay */}
                            <Animated.View
                                pointerEvents="none"
                                style={[
                                    styles.btnShine,
                                    {
                                        opacity: btnShine.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.18, 0] }),
                                    },
                                ]}
                            />
                        </View>
                    </Animated.View>

                    {/* ── Footer ── */}
                    <Animated.View style={[styles.footer, { opacity: footerOpacity }]}>
                        <View style={styles.dividerRow}>
                            <View style={[styles.dividerLine, { backgroundColor: c.divider }]} />
                            <Text style={[styles.dividerText, { color: c.dividerText }]}>New here?</Text>
                            <View style={[styles.dividerLine, { backgroundColor: c.divider }]} />
                        </View>
                        <Text style={[styles.footerText, { color: c.footerText }]}>
                            Contact the administrator for access.
                        </Text>
                    </Animated.View>
                </KeyboardAvoidingView>
            </ScrollView>

            {/* ── Forgot Password Modal ── */}
            <Modal visible={showForgotModal} animationType="fade" transparent>
                <View style={{ flex: 1, backgroundColor: c.modalOverlay, justifyContent: 'center', paddingHorizontal: 24 }}>
                    <View style={{ backgroundColor: c.modalBg, borderRadius: 20, padding: 28, borderWidth: 1, borderColor: c.modalBorder, maxWidth: CARD_MAX_W, alignSelf: 'center', width: '100%' }}>
                        {forgotSuccess ? (
                            <View style={{ alignItems: 'center' }}>
                                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(16,185,129,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                                    <MaterialIcons name="check-circle" size={40} color="#34d399" />
                                </View>
                                <Text style={{ fontSize: 20, fontWeight: '700', color: c.modalText, marginBottom: 8 }}>Request Sent!</Text>
                                <Text style={{ fontSize: 13, color: c.modalSubtext, textAlign: 'center', lineHeight: 20, marginBottom: 8 }}>
                                    Your password reset request has been sent to the administrator.
                                </Text>
                                <View style={{ backgroundColor: c.modalInfoBg, borderRadius: 12, padding: 14, marginBottom: 20, width: '100%' }}>
                                    <Text style={{ fontSize: 12, color: c.modalInfoLabel, fontWeight: '600', marginBottom: 4 }}>What happens next?</Text>
                                    <Text style={{ fontSize: 12, color: c.modalInfoText, lineHeight: 18 }}>
                                        • Admin will review your request{"\n"}
                                        • If approved, password resets to:{"\n"}
                                        {'  '}surname.last6digits of ID{"\n"}
                                        • Check back or contact admin
                                    </Text>
                                </View>
                                <AnimatedPressable
                                    style={{ backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', width: '100%' }}
                                    onPress={() => { setShowForgotModal(false); setForgotSuccess(false); }}
                                >
                                    <Text style={{ color: Colors.white, fontSize: 15, fontWeight: '600' }}>Got it</Text>
                                </AnimatedPressable>
                            </View>
                        ) : (
                            <View style={{ alignItems: 'center' }}>
                                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(245,158,11,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                                    <MaterialIcons name="lock-reset" size={36} color="#f59e0b" />
                                </View>
                                <Text style={{ fontSize: 20, fontWeight: '700', color: c.modalText, marginBottom: 8 }}>Reset Password</Text>
                                <Text style={{ fontSize: 13, color: c.modalSubtext, textAlign: 'center', lineHeight: 20, marginBottom: 16 }}>
                                    Enter your email to send a password reset request:
                                </Text>
                                <View style={{ backgroundColor: c.modalInputBg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 4, marginBottom: 20, width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: c.modalInputBorder }}>
                                    <MaterialIcons name="email" size={18} color={c.modalInfoLabel} />
                                    <TextInput
                                        style={{ flex: 1, color: c.modalInputText, fontSize: 14, paddingVertical: 10 }}
                                        value={forgotEmail}
                                        onChangeText={setForgotEmail}
                                        placeholder="Enter your email"
                                        placeholderTextColor={c.placeholder}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                    />
                                </View>
                                <AnimatedPressable
                                    style={{ backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', width: '100%', marginBottom: 10, opacity: forgotLoading ? 0.7 : 1 }}
                                    onPress={submitForgotPassword} disabled={forgotLoading}
                                >
                                    {forgotLoading ? (
                                        <ActivityIndicator color={Colors.white} />
                                    ) : (
                                        <Text style={{ color: Colors.white, fontSize: 15, fontWeight: '600' }}>Send Reset Request</Text>
                                    )}
                                </AnimatedPressable>
                                <AnimatedPressable
                                    style={{ paddingVertical: 10, alignItems: 'center', width: '100%' }}
                                    onPress={() => setShowForgotModal(false)}
                                >
                                    <Text style={{ color: c.modalCancel, fontSize: 14 }}>Cancel</Text>
                                </AnimatedPressable>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    orbTopRight: {
        position: 'absolute',
        width: 320,
        height: 320,
        borderRadius: 160,
        top: -90,
        right: -90,
    },
    orbBottomLeft: {
        position: 'absolute',
        width: 260,
        height: 260,
        borderRadius: 130,
        bottom: -70,
        left: -70,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 40,
    },

    // Logo section
    logoSection: {
        alignItems: 'center',
        marginBottom: 36,
    },
    logoContainer: {
        marginBottom: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoImage: {
        width: 88,
        height: 88,
        borderRadius: 22,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        fontFamily: 'Lexend, system-ui, -apple-system, sans-serif',
        letterSpacing: -0.5,
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 14,
        textAlign: 'center',
        fontWeight: '400',
        marginBottom: 10,
    },
    schoolBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
    },
    schoolText: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.3,
    },

    // Card
    card: {
        width: '100%',
        maxWidth: CARD_MAX_W,
        borderRadius: 20,
        borderWidth: 1,
        padding: 28,
        gap: 18,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },

    // Fields
    fieldGroup: {
        gap: 6,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    label: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1.5,
        paddingLeft: 2,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 14,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 14,
        paddingVertical: 14,
    },
    eyeBtn: {
        padding: 6,
    },
    forgotBtn: {
        paddingVertical: 2,
    },
    forgotText: {
        fontSize: 11,
        fontWeight: '500',
    },

    // Error
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
    },
    errorText: {
        fontSize: 13,
        flex: 1,
    },

    // Button
    loginBtn: {
        backgroundColor: Colors.primary,
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 4,
    },
    loginBtnDisabled: {
        opacity: 0.6,
    },
    loginBtnInner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    loginBtnText: {
        color: Colors.white,
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    btnShine: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        marginTop: 4,
    },

    // Footer
    footer: {
        marginTop: 28,
        alignItems: 'center',
        width: '100%',
        maxWidth: CARD_MAX_W,
        gap: 10,
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        gap: 12,
    },
    dividerLine: {
        flex: 1,
        height: 1,
    },
    dividerText: {
        fontSize: 12,
        fontWeight: '500',
    },
    footerText: {
        fontSize: 12,
        textAlign: 'center',
    },
});

export default LoginScreen;
