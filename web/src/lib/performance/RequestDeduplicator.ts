/**
 * API request deduplication and cancellation.
 * Prevents duplicate in-flight requests and cancels obsolete ones.
 */
class RequestDeduplicator {
  private inFlight = new Map<string, Promise<unknown>>();
  private controllers = new Map<string, AbortController>();
  private dedupeWindow = 500; // ms - dedupe identical requests within this window

  /**
   * Execute a request with deduplication.
   * If an identical request is already in-flight, returns the existing promise.
   * Cancels any previous request with the same key.
   */
  async dedupe<T>(
    key: string,
    fetcher: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    // Cancel previous request with same key
    this.cancel(key);

    // Check for in-flight duplicate
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const controller = new AbortController();
    this.controllers.set(key, controller);

    const promise = fetcher(controller.signal)
      .then((result) => {
        this.cleanup(key);
        return result;
      })
      .catch((err) => {
        this.cleanup(key);
        throw err;
      });

    this.inFlight.set(key, promise);

    // Auto-cleanup after dedupe window
    setTimeout(() => {
      if (this.inFlight.get(key) === promise) {
        this.cleanup(key);
      }
    }, this.dedupeWindow);

    return promise;
  }

  /**
   * Cancel an in-flight request by key.
   */
  cancel(key: string): void {
    const controller = this.controllers.get(key);
    if (controller) {
      controller.abort();
    }
    this.cleanup(key);
  }

  /**
   * Cancel all in-flight requests.
   */
  cancelAll(): void {
    for (const [key] of this.controllers) {
      this.cancel(key);
    }
  }

  private cleanup(key: string): void {
    this.inFlight.delete(key);
    this.controllers.delete(key);
  }
}

export const requestDeduplicator = new RequestDeduplicator();
