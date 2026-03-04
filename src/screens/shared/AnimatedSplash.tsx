import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Dimensions, StyleSheet } from 'react-native';
import Svg, { Rect, Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { Image } from 'react-native';

const { width, height } = Dimensions.get('window');

interface Props {
    onFinish: () => void;
}

const AnimatedSplash: React.FC<Props> = ({ onFinish }) => {
    const logoScale = useRef(new Animated.Value(0.3)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const textOpacity = useRef(new Animated.Value(0)).current;
    const textTranslate = useRef(new Animated.Value(30)).current;
    const taglineOpacity = useRef(new Animated.Value(0)).current;
    const shimmerOpacity = useRef(new Animated.Value(0)).current;
    const ringScale = useRef(new Animated.Value(0.5)).current;
    const ringOpacity = useRef(new Animated.Value(0)).current;
    const fadeOut = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Sequence of animations
        Animated.sequence([
            // 1. Logo fades in and scales up with bounce
            Animated.parallel([
                Animated.spring(logoScale, {
                    toValue: 1,
                    friction: 4,
                    tension: 40,
                    useNativeDriver: true,
                }),
                Animated.timing(logoOpacity, {
                    toValue: 1,
                    duration: 600,
                    useNativeDriver: true,
                }),
                // Ring expands behind logo
                Animated.parallel([
                    Animated.timing(ringScale, {
                        toValue: 1.5,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.sequence([
                        Animated.timing(ringOpacity, {
                            toValue: 0.3,
                            duration: 400,
                            useNativeDriver: true,
                        }),
                        Animated.timing(ringOpacity, {
                            toValue: 0,
                            duration: 400,
                            useNativeDriver: true,
                        }),
                    ]),
                ]),
            ]),

            // 2. Small pause
            Animated.delay(200),

            // 3. Title "OptiSched" slides up and fades in
            Animated.parallel([
                Animated.timing(textOpacity, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                }),
                Animated.spring(textTranslate, {
                    toValue: 0,
                    friction: 6,
                    tension: 40,
                    useNativeDriver: true,
                }),
            ]),

            // 4. Tagline fades in
            Animated.timing(taglineOpacity, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),

            // 5. Shimmer/glow pulse
            Animated.sequence([
                Animated.timing(shimmerOpacity, {
                    toValue: 0.6,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(shimmerOpacity, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]),

            // 6. Hold for a moment
            Animated.delay(500),

            // 7. Fade out everything
            Animated.timing(fadeOut, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onFinish();
        });
    }, []);

    return (
        <Animated.View style={[styles.container, { opacity: fadeOut }]}>
            {/* Background gradient circles */}
            <View style={styles.bgCircle1} />
            <View style={styles.bgCircle2} />

            {/* Expanding ring */}
            <Animated.View
                style={[
                    styles.ring,
                    {
                        transform: [{ scale: ringScale }],
                        opacity: ringOpacity,
                    },
                ]}
            />

            {/* Logo */}
            <Animated.View
                style={[
                    styles.logoWrap,
                    {
                        transform: [{ scale: logoScale }],
                        opacity: logoOpacity,
                    },
                ]}
            >
                {/* Shimmer glow behind logo */}
                <Animated.View
                    style={[
                        styles.shimmer,
                        { opacity: shimmerOpacity },
                    ]}
                />
                <Svg width={140} height={140} viewBox="0 0 120 120">
                    <Defs>
                        <SvgLinearGradient id="splashBody" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor="#3b82f6" />
                            <Stop offset="50%" stopColor="#2563eb" />
                            <Stop offset="100%" stopColor="#1d4ed8" />
                        </SvgLinearGradient>
                        <SvgLinearGradient id="splashHeader" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor="#1e40af" />
                            <Stop offset="100%" stopColor="#1e3a8a" />
                        </SvgLinearGradient>
                        <SvgLinearGradient id="splashCheck" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor="#22c55e" />
                            <Stop offset="100%" stopColor="#16a34a" />
                        </SvgLinearGradient>
                        <SvgLinearGradient id="splashPin" x1="0%" y1="0%" x2="0%" y2="100%">
                            <Stop offset="0%" stopColor="#93c5fd" />
                            <Stop offset="100%" stopColor="#60a5fa" />
                        </SvgLinearGradient>
                    </Defs>
                    {/* Shadow */}
                    <Rect x="18" y="22" width="84" height="80" rx="14" fill="rgba(0,0,0,0.3)" />
                    {/* Calendar body */}
                    <Rect x="15" y="18" width="84" height="80" rx="14" fill="url(#splashBody)" />
                    {/* Header band */}
                    <Rect x="15" y="18" width="84" height="24" rx="14" fill="url(#splashHeader)" />
                    <Rect x="15" y="32" width="84" height="10" fill="url(#splashHeader)" />
                    {/* White content area */}
                    <Rect x="22" y="46" width="70" height="46" rx="6" fill="rgba(255,255,255,0.95)" />
                    {/* Grid cells row 1 */}
                    <Rect x="28" y="52" width="12" height="10" rx="3" fill="rgba(37,99,235,0.15)" />
                    <Rect x="44" y="52" width="12" height="10" rx="3" fill="rgba(37,99,235,0.15)" />
                    <Rect x="60" y="52" width="12" height="10" rx="3" fill="rgba(37,99,235,0.15)" />
                    <Rect x="76" y="52" width="12" height="10" rx="3" fill="rgba(37,99,235,0.2)" />
                    {/* Grid cells row 2 */}
                    <Rect x="28" y="66" width="12" height="10" rx="3" fill="rgba(37,99,235,0.12)" />
                    <Rect x="44" y="66" width="12" height="10" rx="3" fill="rgba(37,99,235,0.12)" />
                    <Rect x="60" y="66" width="12" height="10" rx="3" fill="#2563eb" />
                    <Rect x="76" y="66" width="12" height="10" rx="3" fill="rgba(37,99,235,0.12)" />
                    {/* Grid cells row 3 */}
                    <Rect x="28" y="80" width="12" height="8" rx="3" fill="rgba(37,99,235,0.08)" />
                    <Rect x="44" y="80" width="12" height="8" rx="3" fill="rgba(37,99,235,0.08)" />
                    {/* Check badge circle */}
                    <Path d="M 88 82 m -14 0 a 14 14 0 1 0 28 0 a 14 14 0 1 0 -28 0" fill="url(#splashCheck)" />
                    <Path d="M82 82 L86 86 L94 78" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    {/* Calendar pins */}
                    <Rect x="36" y="12" width="6" height="16" rx="3" fill="url(#splashPin)" />
                    <Rect x="72" y="12" width="6" height="16" rx="3" fill="url(#splashPin)" />
                    {/* Pin highlights */}
                    <Rect x="37.5" y="13" width="3" height="6" rx="1.5" fill="rgba(255,255,255,0.4)" />
                    <Rect x="73.5" y="13" width="3" height="6" rx="1.5" fill="rgba(255,255,255,0.4)" />
                    {/* Header shine */}
                    <Rect x="20" y="20" width="40" height="4" rx="2" fill="rgba(255,255,255,0.08)" />
                </Svg>
            </Animated.View>

            {/* App name */}
            <Animated.View
                style={{
                    opacity: textOpacity,
                    transform: [{ translateY: textTranslate }],
                }}
            >
                <Text style={styles.title}>OptiSched</Text>
            </Animated.View>

            {/* Tagline */}
            <Animated.View style={{ opacity: taglineOpacity }}>
                <Text style={styles.tagline}>Smart Scheduling, Simple Solutions</Text>
                <Text style={styles.school}>STI College Meycauayan</Text>
            </Animated.View>

            {/* Bottom version */}
            <Animated.View style={[styles.bottomSection, { opacity: taglineOpacity }]}>
                <View style={styles.versionPill}>
                    <Text style={styles.versionText}>v1.0.0</Text>
                </View>
            </Animated.View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#0f172a',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999,
    },
    bgCircle1: {
        position: 'absolute',
        width: width * 1.5,
        height: width * 1.5,
        borderRadius: width * 0.75,
        backgroundColor: 'rgba(37, 99, 235, 0.04)',
        top: -width * 0.3,
        left: -width * 0.25,
    },
    bgCircle2: {
        position: 'absolute',
        width: width * 1.2,
        height: width * 1.2,
        borderRadius: width * 0.6,
        backgroundColor: 'rgba(59, 130, 246, 0.03)',
        bottom: -width * 0.4,
        right: -width * 0.3,
    },
    ring: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        borderWidth: 3,
        borderColor: 'rgba(59, 130, 246, 0.4)',
    },
    logoWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    shimmer: {
        position: 'absolute',
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
    },
    logoImage: {
        width: 140,
        height: 140,
    },
    title: {
        fontSize: 38,
        fontWeight: '800',
        color: '#ffffff',
        letterSpacing: 1,
        textAlign: 'center',
        marginBottom: 8,
    },
    tagline: {
        fontSize: 15,
        color: '#94a3b8',
        textAlign: 'center',
        fontWeight: '400',
        letterSpacing: 0.5,
    },
    school: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
        fontWeight: '500',
        marginTop: 4,
    },
    bottomSection: {
        position: 'absolute',
        bottom: 60,
        alignItems: 'center',
    },
    versionPill: {
        backgroundColor: 'rgba(51, 65, 85, 0.5)',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
    },
    versionText: {
        color: '#64748b',
        fontSize: 12,
        fontWeight: '500',
    },
});

export default AnimatedSplash;
