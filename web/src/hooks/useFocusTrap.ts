import { useEffect, type RefObject } from 'react';

/**
 * Custom hook to trap focus within a modal or dialog
 * Ensures keyboard users cannot tab out of the modal
 * Restores focus to the trigger element when the modal closes
 */
export function useFocusTrap(isActive: boolean, containerRef: RefObject<HTMLElement | HTMLDivElement | null>) {
    useEffect(() => {
        if (!isActive || !containerRef.current) return;

        const container = containerRef.current;
        const focusableElements = container.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        // Save the previously focused element
        const previouslyFocused = document.activeElement as HTMLElement;

        // Focus the first element when modal opens
        setTimeout(() => firstElement.focus(), 100);

        const handleTab = (e: Event) => {
            const keyboardEvent = e as KeyboardEvent;
            if (keyboardEvent.key !== 'Tab') return;

            if (keyboardEvent.shiftKey) {
                // Shift + Tab: if on first element, move to last
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                // Tab: if on last element, move to first
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        };

        const handleEscape = (e: Event) => {
            const keyboardEvent = e as KeyboardEvent;
            if (keyboardEvent.key === 'Escape') {
                // Let the parent component handle the close logic
                // This hook just ensures focus management
            }
        };

        container.addEventListener('keydown', handleTab);
        container.addEventListener('keydown', handleEscape);

        return () => {
            container.removeEventListener('keydown', handleTab);
            container.removeEventListener('keydown', handleEscape);
            // Restore focus to the previously focused element
            if (previouslyFocused && document.contains(previouslyFocused)) {
                previouslyFocused.focus();
            }
        };
    }, [isActive, containerRef]);
}
