// useIdleTimeout - Session 2 / Task C4 of HARDENING_PLAN.md
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
    const warningRef = useRef<boolean>(false);
    const disabledRef = useRef<boolean>(!!disabled);

    // Latest callback refs so the listener/effect identity stays stable
    // across re-renders. Without this, parent re-renders (e.g. AuthContext
    // value changing) would tear down and re-attach 6 document listeners
    // every render, causing input lag during state-heavy flows like logout.
    const onWarnRef = useRef(onWarn);
    const onTimeoutRef = useRef(onTimeout);
    const idleMinutesRef = useRef(idleMinutes);
    const graceSecondsRef = useRef(graceSeconds);
    useEffect(() => { onWarnRef.current = onWarn; }, [onWarn]);
    useEffect(() => { onTimeoutRef.current = onTimeout; }, [onTimeout]);
    useEffect(() => { idleMinutesRef.current = idleMinutes; }, [idleMinutes]);
    useEffect(() => { graceSecondsRef.current = graceSeconds; }, [graceSeconds]);
    useEffect(() => { disabledRef.current = !!disabled; }, [disabled]);

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
        if (disabledRef.current) return;
        idleTimerRef.current = window.setTimeout(() => {
            setSecondsLeft(graceSecondsRef.current);
            warningRef.current = true;
            setWarning(true);
            onWarnRef.current();
            tickRef.current = window.setInterval(() => {
                setSecondsLeft(s => Math.max(0, s - 1));
            }, 1000);
            graceTimerRef.current = window.setTimeout(() => {
                clearGrace();
                warningRef.current = false;
                setWarning(false);
                onTimeoutRef.current();
            }, graceSecondsRef.current * 1000);
        }, idleMinutesRef.current * 60 * 1000);
    }, []);

    const reset = useCallback(() => {
        clearGrace();
        warningRef.current = false;
        setWarning(false);
        lastActivityRef.current = Date.now();
        armIdle();
    }, [armIdle]);

    // Re-arm the idle timer when configuration changes without re-attaching
    // the activity listeners. The handler reads the latest values from refs.
    useEffect(() => {
        if (disabled) return;
        armIdle();
    }, [idleMinutes, disabled, armIdle]);

    useEffect(() => {
        if (disabled) {
            clearIdle();
            clearGrace();
            warningRef.current = false;
            // Note: `warning` state is gated by `!disabled` in the return value,
            // so no setWarning call is needed here (and would just trigger an
            // extra render). The modal closes via the gated boolean.
            return;
        }

        const handler = () => {
            const now = Date.now();
            if (now - lastActivityRef.current < THROTTLE_MS) return;
            lastActivityRef.current = now;
            // If we're already in the warning phase, don't auto-dismiss on
            // mousemove - the user must take an explicit action.
            if (warningRef.current) return;
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
    }, [disabled, armIdle]);

    return { reset, warning: warning && !disabled, secondsLeft };
}
