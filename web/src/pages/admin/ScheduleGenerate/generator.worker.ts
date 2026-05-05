/**
 * Web Worker for Schedule Generation
 * 
 * This worker runs the schedule generation in a separate thread to prevent
 * browser throttling when the tab is inactive. Web Workers continue to run
 * even when the browser tab is backgrounded, ensuring generation completes
 * regardless of user interaction.
 */

import type {
    GenerationConfig,
    GenerationProgress,
    Section,
    Subject,
    Teacher,
    Room,
    ExistingSchedule,
} from './types';
import { runGenerator } from './generator';

interface WorkerMessage {
    type: 'generate' | 'cancel';
    payload?: {
        subjects: Subject[];
        teachers: Teacher[];
        rooms: Room[];
        sections: Section[];
        existing: ExistingSchedule[];
        config: GenerationConfig;
        institutionalPolicies?: Record<string, unknown>;
    };
}

let isCancelled = false;

// Listen for messages from the main thread
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
    const { type, payload } = event.data;

    if (type === 'generate' && payload) {
        isCancelled = false;
        runGenerationInWorker(payload);
    } else if (type === 'cancel') {
        isCancelled = true;
    }
};

async function runGenerationInWorker(payload: {
    subjects: Subject[];
    teachers: Teacher[];
    rooms: Room[];
    sections: Section[];
    existing: ExistingSchedule[];
    config: GenerationConfig;
    institutionalPolicies?: Record<string, unknown>;
}) {
    try {
        console.log('[WORKER] Starting generation in worker thread');

        const { subjects, teachers, rooms, sections, existing, config, institutionalPolicies } = payload;

        // Progress callback that posts messages back to main thread
        const onProgress = (progress: GenerationProgress) => {
            if (isCancelled) {
                postMessage({ type: 'cancelled' });
                return;
            }
            postMessage({ type: 'progress', payload: progress });
        };

        // Run the generator
        const result = await runGenerator(
            { subjects, teachers, rooms, sections, existing, config, institutionalPolicies },
            onProgress,
        );

        if (isCancelled) {
            postMessage({ type: 'cancelled' });
            return;
        }

        console.log('[WORKER] Generation completed successfully');
        postMessage({ type: 'result', payload: result });
    } catch (error) {
        console.error('[WORKER] Generation error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        postMessage({ type: 'error', payload: errorMessage });
    }
}
