import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import {
    View, Text, TextInput, StyleSheet, Image,
    KeyboardAvoidingView, Platform, StatusBar, Alert, Modal, ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Theme } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabase';
import { AnimatedPressable } from '../../components/AnimatedPressable';

const LoginScreen: React.FC = () => {
    const { signIn, isLoading } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showForgotModal, setShowForgotModal] = useState(false);
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotSuccess, setForgotSuccess] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');

    const handleForgotPassword = async () => {
        // Pre-fill with login email if available, but always open the modal
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
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={Colors.backgroundDark} />
            {/* Background pattern dots */}
            <View style={styles.patternBg} />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.content}
            >
                {/* Logo & Title */}
                <View style={styles.logoSection}>
                    <View style={styles.logoContainer}>
                        <Image
                            source={require('../../../assets/logo-white.png')}
                            style={{ width: 100, height: 100, borderRadius: 20 }}
                            resizeMode="contain"
                        />
                    </View>
                    <Text style={styles.title}>OptiSched</Text>
                    <Text style={styles.subtitle}>Smart Scheduling, Simple Solutions{'\n'}STI College Meycauayan</Text>
                </View>

                {/* Login Form */}
                <View style={styles.form}>
                    {/* Email Field */}
                    <View>
                        <Text style={styles.label}>INSTITUTIONAL EMAIL</Text>
                        <View style={styles.inputWrapper}>
                            <MaterialIcons name="school" size={20} color={Colors.textSecondaryDark} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="student@meycauayan.sti.edu.ph"
                                placeholderTextColor="#6b7280"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>
                    </View>

                    {/* Password Field */}
                    <View>
                        <Text style={styles.label}>PASSWORD</Text>
                        <View style={styles.inputWrapper}>
                            <MaterialIcons name="lock" size={20} color={Colors.textSecondaryDark} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="••••••••"
                                placeholderTextColor="#6b7280"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                            />
                            <AnimatedPressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                                <MaterialIcons
                                    name={showPassword ? 'visibility' : 'visibility-off'}
                                    size={20}
                                    color="#6b7280"
                                />
                            </AnimatedPressable>
                        </View>
                        <AnimatedPressable style={styles.forgotBtn} onPress={handleForgotPassword}>
                            <Text style={styles.forgotText}>Forgot Password?</Text>
                        </AnimatedPressable>
                    </View>

                    {/* Error Message */}
                    {error && (
                        <View style={styles.errorContainer}>
                            <MaterialIcons name="error-outline" size={16} color={Colors.error} />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    {/* Login Button */}
                    <AnimatedPressable
                        style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
                        onPress={handleLogin}
                        disabled={isLoading}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.loginBtnText}>
                            {isLoading ? 'Signing In...' : 'Get Started'}
                        </Text>
                    </AnimatedPressable>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        New to OptiSched?{'\n'}
                        <Text style={styles.footerSubText}>Contact the administrator for access.</Text>
                    </Text>
                </View>
            </KeyboardAvoidingView>

            {/* Forgot Password Modal */}
            <Modal visible={showForgotModal} animationType="fade" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', paddingHorizontal: 24 }}>
                    <View style={{ backgroundColor: '#1e293b', borderRadius: 20, padding: 28, borderWidth: 1, borderColor: '#334155' }}>
                        {forgotSuccess ? (
                            <View style={{ alignItems: 'center' }}>
                                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(16,185,129,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                                    <MaterialIcons name="check-circle" size={40} color="#34d399" />
                                </View>
                                <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.white, marginBottom: 8 }}>Request Sent!</Text>
                                <Text style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', lineHeight: 20, marginBottom: 8 }}>
                                    Your password reset request has been sent to the administrator.
                                </Text>
                                <View style={{ backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: 12, padding: 14, marginBottom: 20, width: '100%' }}>
                                    <Text style={{ fontSize: 12, color: '#60a5fa', fontWeight: '600', marginBottom: 4 }}>What happens next?</Text>
                                    <Text style={{ fontSize: 12, color: '#94a3b8', lineHeight: 18 }}>
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
                                <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.white, marginBottom: 8 }}>Reset Password</Text>
                                <Text style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', lineHeight: 20, marginBottom: 16 }}>
                                    Enter your email to send a password reset request:
                                </Text>
                                <View style={{ backgroundColor: '#0f172a', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 4, marginBottom: 20, width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#334155' }}>
                                    <MaterialIcons name="email" size={18} color="#60a5fa" />
                                    <TextInput
                                        style={{ flex: 1, color: Colors.white, fontSize: 14, paddingVertical: 10 }}
                                        value={forgotEmail}
                                        onChangeText={setForgotEmail}
                                        placeholder="Enter your email"
                                        placeholderTextColor="#6b7280"
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
                                    <Text style={{ color: '#94a3b8', fontSize: 14 }}>Cancel</Text>
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
        backgroundColor: '#0f1115'
    },
    patternBg: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.05
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 32
    },
    logoSection: {
        alignItems: 'center',
        marginBottom: 48
    },
    logoContainer: {
        marginBottom: 24
    },
    title: {
        fontSize: 30,
        fontWeight: '700',
        color: Colors.white,
        letterSpacing: -0.5,
        marginBottom: 8
    },
    subtitle: {
        fontSize: 14,
        color: Colors.textSecondaryDark,
        textAlign: 'center',
        lineHeight: 20,
        fontWeight: '300'
    },
    form: {
        gap: 20
    },
    label: {
        fontSize: 10,
        fontWeight: '500',
        color: Colors.textSecondaryDark,
        letterSpacing: 1.5,
        marginBottom: 4,
        paddingLeft: 4
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1f2937',
        borderWidth: 1,
        borderColor: '#374151',
        borderRadius: 12,
        paddingHorizontal: 12
    },
    inputIcon: {
        marginRight: 8
    },
    input: {
        flex: 1,
        color: Colors.white,
        fontSize: 14,
        paddingVertical: 14
    },
    eyeBtn: {
        padding: 4
    },
    forgotBtn: {
        alignSelf: 'flex-end',
        marginTop: 8
    },
    forgotText: {
        color: '#60a5fa',
        fontSize: 12
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: Colors.errorAlpha10,
        padding: 12,
        borderRadius: 8
    },
    errorText: {
        color: Colors.error,
        fontSize: 13
    },
    loginBtn: {
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 16,
        ...Theme.shadows.primary
    },
    loginBtnDisabled: {
        opacity: 0.6
    },
    loginBtnText: {
        color: Colors.white,
        fontSize: 14,
        fontWeight: '600'
    },
    footer: {
        marginTop: 32,
        alignItems: 'center'
    },
    footerText: {
        color: Colors.textSecondaryDark,
        fontSize: 12,
        textAlign: 'center'
    },
    footerSubText: {
        color: '#6b7280'
    }
});

export default LoginScreen;
