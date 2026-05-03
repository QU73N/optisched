/**
 * Environment Configuration Validation
 * 
 * This module validates environment variables at startup to ensure
 * all required configuration is present and valid.
 */

import { z } from 'zod';

/**
 * Configuration Schema
 * Validates all environment variables
 */
const ConfigSchema = z.object({
  // Supabase Configuration
  supabaseUrl: z.string().url('Invalid Supabase URL'),
  supabaseAnonKey: z.string().min(1, 'Supabase anon key is required'),
  
  // API Configuration
  apiUrl: z.string().url('Invalid API URL'),
  
  // Logging
  logLevel: z.enum(['debug', 'info', 'warn', 'error']),
  
  // AI Services (Optional)
  geminiApiKey: z.string().optional(),
  groqApiKey: z.string().optional(),
  openrouterApiKey: z.string().optional(),
  
  // Feature Flags
  enableOptibot: z.boolean().default(true),
  enableAnalytics: z.boolean().default(false),
  
  // Environment
  nodeEnv: z.enum(['development', 'staging', 'production']).default('development'),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

/**
 * Parse and validate environment configuration
 */
function parseConfig(): AppConfig {
  try {
    const rawConfig = {
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
      supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      apiUrl: import.meta.env.VITE_API_URL || import.meta.env.VITE_SUPABASE_URL,
      logLevel: import.meta.env.VITE_LOG_LEVEL || 'info',
      geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY,
      groqApiKey: import.meta.env.VITE_GROQ_API_KEY,
      openrouterApiKey: import.meta.env.VITE_OPENROUTER_API_KEY,
      enableOptibot: import.meta.env.VITE_ENABLE_OPTIBOT === 'true',
      enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
      nodeEnv: import.meta.env.MODE || 'development',
    };
    
    return ConfigSchema.parse(rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Configuration validation failed:');
      error.issues.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      throw new Error('Invalid configuration. Please check your environment variables.');
    }
    throw error;
  }
}

/**
 * Export validated configuration
 */
export const config = parseConfig();

/**
 * Get current environment
 */
export function getEnvironment(): 'development' | 'staging' | 'production' {
  return config.nodeEnv;
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return config.nodeEnv === 'development';
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return config.nodeEnv === 'production';
}

/**
 * Check if running in staging
 */
export function isStaging(): boolean {
  return config.nodeEnv === 'staging';
}
