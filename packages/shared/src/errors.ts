export class DependencyRiskRadarError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DependencyRiskRadarError';
  }
}

export class UnsupportedEcosystemError extends DependencyRiskRadarError {
  constructor(ecosystem: string) {
    super(`Unsupported ecosystem: ${ecosystem}`, 'UNSUPPORTED_ECOSYSTEM', { ecosystem });
  }
}

export class MissingLockfileError extends DependencyRiskRadarError {
  constructor(repoPath: string) {
    super(`No supported lockfile found in ${repoPath}`, 'MISSING_LOCKFILE', { repoPath });
  }
}

export class MalformedInputError extends DependencyRiskRadarError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'MALFORMED_INPUT', details);
  }
}

export class InvalidReferenceError extends DependencyRiskRadarError {
  constructor(ref: string, details?: Record<string, unknown>) {
    super(`Invalid git reference: ${ref}`, 'INVALID_REFERENCE', details ?? { ref });
  }
}

export class PolicyValidationError extends DependencyRiskRadarError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'POLICY_VALIDATION_ERROR', details);
  }
}

export class MissingMetadataError extends DependencyRiskRadarError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'MISSING_METADATA', details);
  }
}

export class ProviderTimeoutError extends DependencyRiskRadarError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'PROVIDER_TIMEOUT', details);
  }
}

export class ProviderRateLimitError extends DependencyRiskRadarError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'PROVIDER_RATE_LIMIT', details);
  }
}
