import React, { createContext, useContext, useState, ReactNode } from 'react';
import { View, Text, StyleSheet,  Modal, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors } from '../constants/colors';
import { useTheme } from './ThemeContext';
import { AnimatedPressable } from '../components/AnimatedPressable';

interface AlertOptions {
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    buttons?: {
        text: string;
        onPress?: () => void;
        style?: 'default' | 'cancel' | 'destructive';
    }[];
}

interface AlertContextType {
    showAlert: (options: AlertOptions) => void;
    hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const useAlert = () => {
    const context = useContext(AlertContext);
    if (!context) {
        throw new Error('useAlert must be used within an AlertProvider');
    }
    return context;
};

export const AlertProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [alertConfig, setAlertConfig] = useState<AlertOptions | null>(null);
    const { colors } = useTheme();

    // Use slide animation
    const [slideAnim] = useState(new Animated.Value(50));
    const [fadeAnim] = useState(new Animated.Value(0));

    const showAlert = (options: AlertOptions) => {
        setAlertConfig(options);
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const hideAlert = () => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: 50,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => setAlertConfig(null));
    };

    const handleButtonPress = (onPress?: () => void) => {
        hideAlert();
        if (onPress) {
            // slight delay to let modal animate out before firing action
            setTimeout(onPress, 200);
        }
    };

    const getIcon = (type?: string) => {
        switch (type) {
            case 'success': return <MaterialIcons name="check-circle" size={32} color={Colors.success} />;
            case 'error': return <MaterialIcons name="error" size={32} color={Colors.error} />;
            case 'warning': return <MaterialIcons name="warning" size={32} color={Colors.warning} />;
            default: return <MaterialIcons name="info" size={32} color={Colors.primary} />;
        }
    };

    const buttons = alertConfig?.buttons || [{ text: 'OK' }];

    return (
        <AlertContext.Provider value={{ showAlert, hideAlert }}>
            {children}
            {alertConfig && (
                <Modal visible={!!alertConfig} transparent animationType="none" onRequestClose={hideAlert}>
                    <BlurView intensity={20} tint={colors.isDark ? 'dark' : 'light'} style={styles.overlay}>
                        <Animated.View style={[
                            styles.alertBox,
                            {
                                backgroundColor: colors.isDark ? Colors.surfaceDark : Colors.white,
                                borderColor: colors.isDark ? Colors.slate700 : Colors.slate200,
                                opacity: fadeAnim,
                                transform: [{ translateY: slideAnim }]
                            }
                        ]}>
                            {/* Icon & Title */}
                            <View style={styles.header}>
                                {getIcon(alertConfig.type)}
                                <Text style={[styles.title, { color: colors.isDark ? Colors.white : Colors.slate900 }]}>
                                    {alertConfig.title}
                                </Text>
                            </View>

                            {/* Message */}
                            <Text style={[styles.message, { color: colors.isDark ? Colors.slate300 : Colors.slate600 }]}>
                                {alertConfig.message}
                            </Text>

                            {/* Buttons */}
                            <View style={styles.buttonContainer}>
                                {buttons.map((btn, idx) => {
                                    const isDestructive = btn.style === 'destructive';
                                    const isCancel = btn.style === 'cancel';
                                    return (
                                        <AnimatedPressable
                                            key={idx}
                                            style={[
                                                styles.button,
                                                isCancel ? styles.buttonCancel : (isDestructive ? styles.buttonDestructive : styles.buttonPrimary),
                                                { flex: buttons.length > 2 ? 1 : undefined } // Adjust layout if > 2 buttons
                                            ]}
                                            onPress={() => handleButtonPress(btn.onPress)}
                                        >
                                            <Text style={[
                                                styles.buttonText,
                                                isCancel ? (colors.isDark ? { color: Colors.slate300 } : { color: Colors.slate800 }) : { color: Colors.white }
                                            ]}>
                                                {btn.text}
                                            </Text>
                                        </AnimatedPressable>
                                    );
                                })}
                            </View>
                        </Animated.View>
                    </BlurView>
                </Modal>
            )}
        </AlertContext.Provider>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)', // fallback behind blur
        padding: 24,
    },
    alertBox: {
        width: '100%',
        maxWidth: 380,
        borderRadius: 20,
        borderWidth: 1,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        flex: 1,
    },
    message: {
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 24,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        flexWrap: 'wrap',
    },
    button: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 12,
        minWidth: 90,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonPrimary: {
        backgroundColor: Colors.primary,
    },
    buttonDestructive: {
        backgroundColor: Colors.error,
    },
    buttonCancel: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: Colors.slate500,
    },
    buttonText: {
        fontSize: 15,
        fontWeight: '600',
    },
});
