/**
 * Build Information
 * 
 * This module provides build-time information for version tracking and debugging.
 * The build info is generated during the build process.
 */

export interface BuildInfo {
  version: string;
  buildTime: string;
  commitHash?: string;
  environment: string;
}

/**
 * Get build information
 * In production, this is injected at build time via Vite
 */
export function getBuildInfo(): BuildInfo {
  return {
    version: import.meta.env.VITE_APP_VERSION || '0.0.0',
    buildTime: import.meta.env.VITE_BUILD_TIME || new Date().toISOString(),
    commitHash: import.meta.env.VITE_COMMIT_HASH,
    environment: import.meta.env.MODE || 'development',
  };
}

/**
 * Get application version
 */
export function getVersion(): string {
  return getBuildInfo().version;
}

/**
 * Get build time
 */
export function getBuildTime(): string {
  return getBuildInfo().buildTime;
}

/**
 * Get commit hash
 */
export function getCommitHash(): string | undefined {
  return getBuildInfo().commitHash;
}

/**
 * Get environment
 */
export function getEnvironment(): string {
  return getBuildInfo().environment;
}
