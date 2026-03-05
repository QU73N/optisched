import React, { useRef } from 'react';
import { Pressable, Animated, StyleProp, ViewStyle, Platform, StyleSheet } from 'react-native';

interface AnimatedPressableProps extends Omit<React.ComponentProps<typeof Pressable>, 'style' | 'children'> {
    style?: StyleProp<ViewStyle> | ((state: { pressed: boolean; hovered: boolean; focused: boolean }) => StyleProp<ViewStyle>);
    activeScale?: number;
    hoverOpacity?: number;
    activeOpacity?: number; // legacy prop
    children?: React.ReactNode | ((state: { pressed: boolean; hovered: boolean; focused: boolean }) => React.ReactNode);
}

// Style properties that affect the element's position/size within its parent layout
const OUTER_PROPS = new Set([
    // Sizing
    'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
    'flex', 'flexGrow', 'flexShrink', 'flexBasis',
    // Spacing (margins)
    'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
    'marginHorizontal', 'marginVertical', 'marginStart', 'marginEnd',
    // Positioning
    'position', 'top', 'bottom', 'left', 'right',
    // Layout within parent
    'alignSelf', 'zIndex',
]);

function splitStyles(flatStyle: ViewStyle): { outer: ViewStyle; inner: ViewStyle } {
    const outer: any = {};
    const inner: any = {};
    let hasExplicitHeight = false;

    for (const [key, value] of Object.entries(flatStyle)) {
        if (OUTER_PROPS.has(key)) {
            outer[key] = value;
            if (['height', 'minHeight', 'maxHeight'].includes(key)) {
                hasExplicitHeight = true;
            }
        } else {
            inner[key] = value;
        }
    }

    // Always fill outer width, so visual background stretches if outer is flex: 1
    inner.width = '100%';

    // Force 100% height if outer has a defined height or is absolute.
    if (hasExplicitHeight || outer.position === 'absolute') {
        inner.height = '100%';
    }

    // Safely allow inner content to fill expanded parent without causing infinite loops in row flexboxes
    if (outer.flex !== undefined) {
        inner.flex = 1;
    }

    return { outer, inner };
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
                const flat = StyleSheet.flatten(baseStyle) || {};
                const { outer } = splitStyles(flat as ViewStyle);
                return outer;
            }}
            {...props}
        >
            {(state) => {
                const baseStyle = typeof style === 'function' ? style(state as any) : style;
                const flat = StyleSheet.flatten(baseStyle) || {};
                const { inner } = splitStyles(flat as ViewStyle);
                return (
                    <Animated.View style={[
                        inner,
                        {
                            transform: [{ scale }],
                            opacity: disabled ? 0.5 : opacity,
                        },
                        (Platform.OS === 'web' && !disabled ? { cursor: 'pointer' } : {}),
                    ] as any}>
                        {typeof children === 'function' ? children(state as any) : children}
                    </Animated.View>
                );
            }}
        </Pressable>
    );
};
