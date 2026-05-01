import React, { useRef, useEffect } from 'react';
import { Animated, ViewStyle, StyleProp } from 'react-native';

interface StaggeredViewProps {
    /** Delay before animation starts (ms). Stagger by incrementing this per child. */
    delay?: number;
    /** Animation duration (ms). Default: 400 */
    duration?: number;
    /** Vertical offset to animate from. Default: 16 */
    translateY?: number;
    /** Style for the container */
    style?: StyleProp<ViewStyle>;
    children: React.ReactNode;
}

/**
 * Reusable entrance-animation wrapper — mirrors the web's `dash-stagger` class.
 * Animates opacity (0→1) and translateY (offset→0) on mount.
 */
export const StaggeredView: React.FC<StaggeredViewProps> = ({
    delay = 0,
    duration = 400,
    translateY = 16,
    style,
    children,
}) => {
    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(progress, {
            toValue: 1,
            duration,
            delay,
            useNativeDriver: true,
        }).start();
    }, []);

    return (
        <Animated.View
            style={[
                style,
                {
                    opacity: progress,
                    transform: [
                        {
                            translateY: progress.interpolate({
                                inputRange: [0, 1],
                                outputRange: [translateY, 0],
                            }),
                        },
                    ],
                },
            ]}
        >
            {children}
        </Animated.View>
    );
};
