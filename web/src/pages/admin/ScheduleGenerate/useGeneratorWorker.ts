/**
 * Custom hook to manage the schedule generation Web Worker
 * 
 * This hook provides a clean interface for running schedule generation
 * in a Web Worker, which allows the generation to continue even when
 * the browser tab is inactive (backgrounded).
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type {
    GenerationConfig,
    GenerationProgress,
    GenerationResult,
    Section,
    Subject,
    Teacher,
    Room,
    ExistingSchedule,
} from './types';

interface UseGeneratorWorkerReturn {
    isGenerating: boolean;
    progress: GenerationProgress;
    result: GenerationResult | null;
    error: string | null;
    startGeneration: (params: {
        subjects: Subject[];
        teachers: Teacher[];
        rooms: Room[];
        sections: Section[];
        existing: ExistingSchedule[];
        config: GenerationConfig;
        institutionalPolicies?: Record<string, unknown>;
    }) => void;
    cancelGeneration: () => void;
    reset: () => void;
}

const DEFAULT_PROGRESS: GenerationProgress = {
    subStage: 'idle',
    attempt: 0,
    totalAttempts: 1,
    placed: 0,
    total: 0,
    message: '',
};

export function useGeneratorWorker(): UseGeneratorWorkerReturn {
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState<GenerationProgress>(DEFAULT_PROGRESS);
    const [result, setResult] = useState<GenerationResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const workerRef = useRef<Worker | null>(null);

    // Initialize worker on mount
    useEffect(() => {
        // Create the worker using Vite's worker import syntax
        workerRef.current = new Worker(
            new URL('./generator.worker.ts', import.meta.url),
            { type: 'module' }
        );

        const worker = workerRef.current;

        // Handle messages from the worker
        worker.onmessage = (event: MessageEvent) => {
            const { type, payload } = event.data;

            switch (type) {
                case 'progress':
                    setProgress(payload as GenerationProgress);
                    break;
                case 'result':
                    setResult(payload as GenerationResult);
                    setIsGenerating(false);
                    break;
                case 'error':
                    setError(payload as string);
                    setIsGenerating(false);
                    break;
                case 'cancelled':
                    setIsGenerating(false);
                    setError('Generation was cancelled');
                    break;
            }
        };

        // Handle worker errors
        worker.onerror = (event: ErrorEvent) => {
            console.error('[WORKER HOOK] Worker error:', event);
            setError(`Worker error: ${event.message}`);
            setIsGenerating(false);
        };

        // Cleanup worker on unmount
        return () => {
            if (worker) {
                worker.terminate();
            }
        };
    }, []);

    const startGeneration = useCallback((params: {
        subjects: Subject[];
        teachers: Teacher[];
        rooms: Room[];
        sections: Section[];
        existing: ExistingSchedule[];
        config: GenerationConfig;
        institutionalPolicies?: Record<string, unknown>;
    }) => {
        if (!workerRef.current) {
            setError('Worker not initialized');
            return;
        }

        // Reset state
        setResult(null);
        setError(null);
        setIsGenerating(true);
        setProgress({
            subStage: 'loading',
            attempt: 0,
            totalAttempts: 1,
            placed: 0,
            total: 0,
            message: 'Starting generation in worker thread',
        });

        // Send generation request to worker
        workerRef.current.postMessage({
            type: 'generate',
            payload: params,
        });
    }, []);

    const cancelGeneration = useCallback(() => {
        if (workerRef.current) {
            workerRef.current.postMessage({ type: 'cancel' });
            setIsGenerating(false);
            setError('Generation cancelled');
        }
    }, []);

    const reset = useCallback(() => {
        setResult(null);
        setError(null);
        setProgress(DEFAULT_PROGRESS);
    }, []);

    return {
        isGenerating,
        progress,
        result,
        error,
        startGeneration,
        cancelGeneration,
        reset,
    };
}
