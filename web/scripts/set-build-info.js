#!/usr/bin/env node

/**
 * Set Build Info
 * 
 * This script sets build-time environment variables for version tracking.
 * It reads the package.json version and sets VITE_APP_VERSION and VITE_BUILD_TIME.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setBuildInfo() {
  // Read package.json
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  // Get version
  const version = packageJson.version;

  // Get build time
  const buildTime = new Date().toISOString();

  // Get commit hash (if git is available)
  let commitHash = 'unknown';
  try {
    const { execSync } = await import('child_process');
    commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch (error) {
    // Git not available or not a git repository
    console.warn('Git not available, commit hash set to unknown');
  }

  // Create .env.build file
  const envBuildPath = path.join(__dirname, '..', '.env.build');
  const envContent = `VITE_APP_VERSION=${version}
VITE_BUILD_TIME=${buildTime}
VITE_COMMIT_HASH=${commitHash}
`;

  fs.writeFileSync(envBuildPath, envContent);

  console.log(`Build info set:`);
  console.log(`  Version: ${version}`);
  console.log(`  Build Time: ${buildTime}`);
  console.log(`  Commit Hash: ${commitHash}`);
}

setBuildInfo();
