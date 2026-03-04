import React, { useRef } from 'react';
import { Pressable, PressableProps, Animated, StyleProp, ViewStyle, Platform } from 'react-native';

interface AnimatedPressableProps extends Omit<React.ComponentProps<typeof Pressable>, 'style' | 'children'> {
    style?: StyleProp<ViewStyle> | ((state: { pressed: boolean; hovered: boolean; focused: boolean }) => StyleProp<ViewStyle>);
    activeScale?: number;
    hoverOpacity?: number;
    activeOpacity?: number; // legacy prop
    children?: React.ReactNode | ((state: { pressed: boolean; hovered: boolean; focused: boolean }) => React.ReactNode);
}

export const AnimatedPressable: React.FC<AnimatedPressableProps> = ({
    style,
    activeScale = 0.95,
    hoverOpacity = 0.85,
    children,
    disabled,
    onPressIn,
    onPressOut,
    ...props
}) => {
    const scale = useRef(new Animated.Value(1)).current;
    const opacity = useRef(new Animated.Value(1)).current;

    const animateIn = (e: any) => {
        if (disabled) return;
        Animated.spring(scale, {
            toValue: activeScale,
            useNativeDriver: true,
            speed: 50,
            bounciness: 5,
        }).start();
        if (onPressIn) onPressIn(e);
    };

    const animateOut = (e: any) => {
        Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
            bounciness: 5,
        }).start();
        if (onPressOut) onPressOut(e);
    };

    const handleHoverIn = () => {
        if (disabled || Platform.OS !== 'web') return;
        Animated.timing(opacity, {
            toValue: hoverOpacity,
            duration: 150,
            useNativeDriver: true,
        }).start();
    };

    const handleHoverOut = () => {
        if (disabled || Platform.OS !== 'web') return;
        Animated.timing(opacity, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
        }).start();
    };

    return (
        <Pressable
            onPressIn={animateIn}
            onPressOut={animateOut}
            // @ts-ignore - onHoverIn/Out work in react-native-web
            onHoverIn={handleHoverIn}
            onHoverOut={handleHoverOut}
            disabled={disabled}
            style={(state) => {
                const baseStyle = typeof style === 'function' ? style(state as any) : style;
                return [baseStyle, { opacity: disabled ? 0.5 : 1 }] as any;
            }}
            {...props}
        >
            {(state) => (
                <Animated.View style={[{ transform: [{ scale }], opacity, width: '100%', alignItems: 'center', justifyContent: 'center' }, (Platform.OS === 'web' && !disabled ? { cursor: 'pointer' } : {})] as any}>
                    {typeof children === 'function' ? children(state as any) : children}
                </Animated.View>
            )}
        </Pressable>
    );
};
