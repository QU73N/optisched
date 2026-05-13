/**
 * Optimistic mutation hook.
 * Updates UI immediately before server confirmation, rolls back on failure.
 */
import { useState, useCallback, useRef } from 'react';

interface OptimisticMutationOptions<TData, TVariables> {
  /** The mutation function */
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** Called with the optimistic data immediately */
  onMutate?: (variables: TVariables) => void;
  /** Called with the server response on success */
  onSuccess?: (data: TData, variables: TVariables) => void;
  /** Called on error, with rollback data */
  onError?: (error: Error, variables: TVariables, rollback: () => void) => void;
  /** Called after success or error */
  onSettled?: () => void;
  /** Rollback function to restore previous state */
  rollback?: () => void;
}

interface OptimisticMutationResult<TVariables> {
  mutate: (variables: TVariables) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
  reset: () => void;
}

export function useOptimisticMutation<TData, TVariables>({
  mutationFn,
  onMutate,
  onSuccess,
  onError,
  onSettled,
  rollback,
}: OptimisticMutationOptions<TData, TVariables>): OptimisticMutationResult<TVariables> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const mutate = useCallback(async (variables: TVariables): Promise<void> => {
    setIsLoading(true);
    setError(null);

    // Apply optimistic update immediately
    onMutate?.(variables);

    try {
      const data = await mutationFn(variables);
      if (!mountedRef.current) return;

      onSuccess?.(data, variables);
    } catch (err) {
      if (!mountedRef.current) return;

      const error = err as Error;
      setError(error);

      // Rollback on failure
      rollback?.();
      onError?.(error, variables, () => rollback?.());
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        onSettled?.();
      }
    }
  }, [mutationFn, onMutate, onSuccess, onError, onSettled, rollback]);

  const reset = useCallback(() => {
    setError(null);
  }, []);

  return { mutate, isLoading, error, reset };
}
