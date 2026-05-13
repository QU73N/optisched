/**
 * Predictive user behavior system.
 * Tracks common navigation sequences and preloads probable next screens.
 * Uses lightweight heuristics only - no invasive analytics.
 */
type NavigationSequence = {
  from: string;
  to: string;
  count: number;
  lastSeen: number;
};

type RolePatterns = {
  role: string;
  sequences: NavigationSequence[];
};

const STORAGE_KEY = 'optisched-nav-patterns';
const MAX_SEQUENCES = 50;
const DECAY_DAYS = 7;

class PredictiveService {
  private patterns: RolePatterns[] = [];

  constructor() {
    this.load();
  }

  /**
   * Record a navigation event.
   */
  record(from: string, to: string, role: string): void {
    if (from === to) return;

    let rolePattern = this.patterns.find((p) => p.role === role);
    if (!rolePattern) {
      rolePattern = { role, sequences: [] };
      this.patterns.push(rolePattern);
    }

    const existing = rolePattern.sequences.find((s) => s.from === from && s.to === to);
    if (existing) {
      existing.count++;
      existing.lastSeen = Date.now();
    } else {
      rolePattern.sequences.push({
        from,
        to,
        count: 1,
        lastSeen: Date.now(),
      });
    }

    // Prune old sequences
    this.prune(rolePattern);
    this.save();
  }

  /**
   * Predict the most likely next routes from the current path.
   */
  predict(currentPath: string, role: string, limit = 3): string[] {
    const rolePattern = this.patterns.find((p) => p.role === role);
    if (!rolePattern) return [];

    const candidates = rolePattern.sequences
      .filter((s) => s.from === currentPath)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map((s) => s.to);

    return candidates;
  }

  /**
   * Get top destinations for a role regardless of current path.
   */
  getTopDestinations(role: string, limit = 5): string[] {
    const rolePattern = this.patterns.find((p) => p.role === role);
    if (!rolePattern) return [];

    const destCounts = new Map<string, number>();
    for (const seq of rolePattern.sequences) {
      destCounts.set(seq.to, (destCounts.get(seq.to) || 0) + seq.count);
    }

    return [...destCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([dest]) => dest);
  }

  private prune(rolePattern: RolePatterns): void {
    const cutoff = Date.now() - DECAY_DAYS * 24 * 60 * 60 * 1000;
    rolePattern.sequences = rolePattern.sequences
      .filter((s) => s.lastSeen > cutoff)
      .slice(0, MAX_SEQUENCES);
  }

  private load(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.patterns = JSON.parse(stored);
      }
    } catch {
      this.patterns = [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.patterns));
    } catch {
      // Storage full or unavailable
    }
  }
}

export const predictiveService = new PredictiveService();
