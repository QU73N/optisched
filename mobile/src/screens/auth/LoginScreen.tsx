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

// Theme-aware color tokens — aligned with web brand palette
const getLoginColors = (isDark: boolean) => ({
    bg: isDark ? '#0B0F14' : '#F8FAFC',
    orbA: isDark ? 'rgba(73,136,196,0.06)' : 'rgba(28,77,141,0.05)',
    orbB: isDark ? 'rgba(189,232,245,0.04)' : 'rgba(73,136,196,0.03)',
    glow: isDark ? 'rgba(73,136,196,0.25)' : 'rgba(28,77,141,0.12)',
    title: isDark ? '#E6EDF5' : '#0F172A',
    subtitle: isDark ? '#7C8A9A' : '#475569',
    badgeBg: isDark ? 'rgba(73,136,196,0.1)' : 'rgba(28,77,141,0.06)',
    badgeText: isDark ? '#4988C4' : '#1C4D8D',
    card: isDark ? '#121821' : '#ffffff',
    cardBorder: isDark ? '#263241' : '#D7E3F1',
    cardTitle: isDark ? '#E6EDF5' : '#0F172A',
    label: isDark ? '#7C8A9A' : '#64748B',
    inputBg: isDark ? '#0F141B' : '#EEF4FA',
    inputBorder: isDark ? '#263241' : '#D7E3F1',
    inputFocusBorder: isDark ? '#4988C4' : '#1C4D8D',
    inputFocusBg: isDark ? '#121821' : '#F8FAFC',
    inputText: isDark ? '#E6EDF5' : '#0F172A',
    placeholder: isDark ? '#7C8A9A' : '#64748B',
    iconDefault: isDark ? '#7C8A9A' : '#64748B',
    iconFocus: isDark ? '#4988C4' : '#1C4D8D',
    forgotText: isDark ? '#4988C4' : '#1C4D8D',
    errorBg: isDark ? 'rgba(224,93,93,0.08)' : 'rgba(200,75,75,0.06)',
    errorBorder: isDark ? 'rgba(224,93,93,0.15)' : 'rgba(200,75,75,0.15)',
    errorText: isDark ? '#E05D5D' : '#C84B4B',
    divider: isDark ? '#263241' : '#D7E3F1',
    dividerText: isDark ? '#7C8A9A' : '#64748B',
    footerText: isDark ? '#7C8A9A' : '#64748B',
    eyeIcon: isDark ? '#7C8A9A' : '#64748B',
    // Modal
    modalOverlay: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.3)',
    modalBg: isDark ? '#1B2430' : '#ffffff',
    modalBorder: isDark ? '#263241' : '#D7E3F1',
    modalText: isDark ? '#E6EDF5' : '#0F172A',
    modalSubtext: isDark ? '#A9B4C2' : '#475569',
    modalInfoBg: isDark ? 'rgba(73,136,196,0.1)' : 'rgba(28,77,141,0.06)',
    modalInfoLabel: isDark ? '#4988C4' : '#1C4D8D',
    modalInfoText: isDark ? '#A9B4C2' : '#475569',
    modalInputBg: isDark ? '#0F141B' : '#EEF4FA',
    modalInputBorder: isDark ? '#263241' : '#D7E3F1',
    modalInputText: isDark ? '#E6EDF5' : '#0F172A',
    modalCancel: isDark ? '#A9B4C2' : '#475569',
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
            const { error } = await supabase.from('password_reset_requests').insert({
                email: forgotEmail.trim().toLowerCase(),
                status: 'pending',
                requested_at: new Date().toISOString(),
            });
            if (error) {
                // Fallback: create notification
                await supabase.from('notifications').insert({
                    title: 'Password Reset Request',
                    message: `${forgotEmail.trim()} has requested a password reset. Reason: Forgot password`,
                    type: 'system',
                    is_read: false,
                    user_id: '00000000-0000-0000-0000-000000000000',
                });
            }
            setForgotSuccess(true);
        } catch {
            Alert.alert('Error', 'Failed to send reset request.');
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
                                        • Your request is now pending admin approval{"\n"}
                                        • The administrator will set a new password for you{"\n"}
                                        • Contact the admin if you need immediate assistance
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
                                    <MaterialIcons name="lock-reset" size={36} color="#E6A23C" />
                                </View>
                                <Text style={{ fontSize: 20, fontWeight: '700', color: c.modalText, marginBottom: 8 }}>Forgot Password</Text>
                                <Text style={{ fontSize: 13, color: c.modalSubtext, textAlign: 'center', lineHeight: 20, marginBottom: 16 }}>
                                    Enter your email to request a password reset from the administrator:
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
                                        <Text style={{ color: Colors.white, fontSize: 15, fontWeight: '600' }}>Send Request</Text>
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
