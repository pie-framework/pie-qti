/**
 * Orchestration configuration
 */

import type { OrchestratorConfig } from '../orchestration/orchestrator.js';

/**
 * Configuration for the transformation pipeline orchestration
 */
export interface TransformPipelineConfig {
  /** Orchestration configuration */
  orchestration?: OrchestratorConfig;

  /** Storage configuration */
  storage?: {
    /** Storage backend type (extensible string) */
    type: string;

    /** Storage-specific options - extensible for custom backends */
    options?: Record<string, unknown>;
  };

  /** Default transformation options */
  defaultOptions?: {
    /** Skip validation by default */
    skipValidation?: boolean;

    /** Maximum concurrent transformations in batch */
    maxConcurrent?: number;

    /** Default timeout for transformations (ms) */
    timeout?: number;
  };
}

/**
 * Load orchestration configuration from environment or config file
 */
export function loadOrchestrationConfig(): TransformPipelineConfig {
  const config: TransformPipelineConfig = {
    orchestration: {
      name: 'in-memory',
    },
  };

  // Default retry policy
  if (process.env.ORCHESTRATOR_MAX_ATTEMPTS) {
    config.orchestration!.defaultRetryPolicy = {
      maxAttempts: parseInt(process.env.ORCHESTRATOR_MAX_ATTEMPTS, 10),
      initialInterval: parseInt(process.env.ORCHESTRATOR_RETRY_INITIAL_INTERVAL || '1000', 10),
      maxInterval: parseInt(process.env.ORCHESTRATOR_RETRY_MAX_INTERVAL || '30000', 10),
      backoffCoefficient: parseFloat(process.env.ORCHESTRATOR_RETRY_BACKOFF || '2'),
    };
  }

  // Storage configuration from environment - in-memory by default
  const storageType = process.env.STORAGE_TYPE || 'memory';
  config.storage = { type: storageType };

  // Only filesystem has a default option (basePath)
  if (storageType === 'filesystem') {
    config.storage.options = {
      basePath: process.env.STORAGE_BASE_PATH || './data',
    };
  }

  // Default options
  config.defaultOptions = {
    skipValidation: process.env.SKIP_VALIDATION === 'true',
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT || '5', 10),
    timeout: parseInt(process.env.DEFAULT_TIMEOUT || '300000', 10),
  };

  return config;
}

/**
 * Validate orchestration configuration
 */
export function validateOrchestrationConfig(config: TransformPipelineConfig): string[] {
  const errors: string[] = [];

  // Basic validation - most validation should be done by custom orchestrator/storage implementations
  if (config.orchestration && !config.orchestration.name) {
    errors.push('Orchestrator name is required');
  }

  if (config.storage && !config.storage.type) {
    errors.push('Storage type is required');
  }

  return errors;
}
