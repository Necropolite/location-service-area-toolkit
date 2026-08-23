export type ServiceAreaValidationCode =
  | 'DUPLICATE_ID'
  | 'INVALID_AREA_TYPE'
  | 'INVALID_COORDINATES'
  | 'INVALID_EFFECT'
  | 'INVALID_ID'
  | 'INVALID_POLYGON'
  | 'INVALID_RADIUS'
  | 'INVALID_UNIT'
  | 'MISSING_AREAS'
  | 'MISSING_ORIGINS'
  | 'UNKNOWN_ORIGIN';

export type ServiceAreaValidationIssue = {
  code: ServiceAreaValidationCode;
  path: string;
  message: string;
};

export class ServiceAreaConfigurationError extends Error {
  readonly issues: ServiceAreaValidationIssue[];

  constructor(issues: ServiceAreaValidationIssue[]) {
    super(issues.map(issue => `${issue.path}: ${issue.message}`).join('; '));
    this.name = 'ServiceAreaConfigurationError';
    this.issues = issues;
  }
}

export type DistanceProviderErrorCode =
  | 'INVALID_DISTANCE'
  | 'INVALID_DURATION'
  | 'INVALID_METHOD'
  | 'INVALID_PROVIDER_ID'
  | 'UNIT_MISMATCH';

export class DistanceProviderError extends Error {
  readonly code: DistanceProviderErrorCode;
  readonly providerId: string;

  constructor(code: DistanceProviderErrorCode, providerId: string, message: string) {
    super(message);
    this.name = 'DistanceProviderError';
    this.code = code;
    this.providerId = providerId;
  }
}
