// useIdleTimeout — Session 2 / Task C4 of HARDENING_PLAN.md
//
// Monitors user activity and fires `onWarn` when the configured idle
// threshold is reached, then `onTimeout` after the grace period unless the
// user explicitly resets via `reset()`.
//
// Activity sources: pointer, key, scroll, focus, visibilitychange.
// All listeners are passive and use a single throttled handler.

import { useCallback, useEffect, useRef, useState } from 'react';

export interface IdleTimeoutOptions {
    /** Idle minutes before the warning fires. */
    idleMinutes: number;
    /** Seconds the warning stays visible before onTimeout. */
    graceSeconds: number;
    /** Called when idle threshold is reached. */
    onWarn: () => void;
    /** Called after grace expires without a reset(). */
    onTimeout: () => void;
    /** Disable the whole hook (e.g. when user is signed out). */
    disabled?: boolean;
}

export interface IdleTimeoutHandle {
    /** Cancel any active warning and restart the idle clock. */
    reset: () => void;
    /** Whether the warning modal should currently show. */
    warning: boolean;
    /** Seconds left in the grace period (only meaningful while warning=true). */
    secondsLeft: number;
}

const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
    'mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'visibilitychange',
];

const THROTTLE_MS = 1000;

export function useIdleTimeout(opts: IdleTimeoutOptions): IdleTimeoutHandle {
    const { idleMinutes, graceSeconds, onWarn, onTimeout, disabled } = opts;
    const [warning, setWarning] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(graceSeconds);

    const idleTimerRef = useRef<number | null>(null);
    const graceTimerRef = useRef<number | null>(null);
    const tickRef = useRef<number | null>(null);
    const lastActivityRef = useRef<number>(0);

    const clearIdle = () => {
        if (idleTimerRef.current !== null) {
            window.clearTimeout(idleTimerRef.current);
            idleTimerRef.current = null;
        }
    };
    const clearGrace = () => {
        if (graceTimerRef.current !== null) {
            window.clearTimeout(graceTimerRef.current);
            graceTimerRef.current = null;
        }
        if (tickRef.current !== null) {
            window.clearInterval(tickRef.current);
            tickRef.current = null;
        }
    };

    const armIdle = useCallback(() => {
        clearIdle();
        if (disabled) return;
        idleTimerRef.current = window.setTimeout(() => {
            setSecondsLeft(graceSeconds);
            setWarning(true);
            onWarn();
            tickRef.current = window.setInterval(() => {
                setSecondsLeft(s => Math.max(0, s - 1));
            }, 1000);
            graceTimerRef.current = window.setTimeout(() => {
                clearGrace();
                setWarning(false);
                onTimeout();
            }, graceSeconds * 1000);
        }, idleMinutes * 60 * 1000);
    }, [disabled, idleMinutes, graceSeconds, onWarn, onTimeout]);

    const reset = useCallback(() => {
        clearGrace();
        setWarning(false);
        lastActivityRef.current = Date.now();
        armIdle();
    }, [armIdle]);

    useEffect(() => {
        if (disabled) {
            clearIdle();
            clearGrace();
            return;
        }

        const handler = () => {
            const now = Date.now();
            if (now - lastActivityRef.current < THROTTLE_MS) return;
            lastActivityRef.current = now;
            // If we're already in the warning phase, don't auto-dismiss on
            // mousemove — the user must take an explicit action.
            if (warning) return;
            armIdle();
        };

        lastActivityRef.current = Date.now();
        ACTIVITY_EVENTS.forEach(ev => document.addEventListener(ev, handler, { passive: true }));
        armIdle();

        return () => {
            ACTIVITY_EVENTS.forEach(ev => document.removeEventListener(ev, handler));
            clearIdle();
            clearGrace();
        };
    }, [disabled, armIdle, warning]);

    return { reset, warning: warning && !disabled, secondsLeft };
}
