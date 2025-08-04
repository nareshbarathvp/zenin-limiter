import { LimiterConfig } from "../types";

export interface ValidationError {
  field: string;
  message: string;
}

export function validateConfig(config: LimiterConfig): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate limit
  if (typeof config.limit === "function") {
    // Function-based limits are valid for adaptive rate limiting
  } else if (typeof config.limit !== "number" || config.limit <= 0) {
    errors.push({
      field: "limit",
      message: "Limit must be a positive number or a function",
    });
  }

  // Validate windowInSeconds
  if (
    typeof config.windowInSeconds !== "number" ||
    config.windowInSeconds <= 0
  ) {
    errors.push({
      field: "windowInSeconds",
      message: "windowInSeconds must be a positive number",
    });
  }

  // Validate strategy
  if (
    config.strategy &&
    !["fixed", "sliding", "tokenBucket"].includes(config.strategy)
  ) {
    errors.push({
      field: "strategy",
      message: "Strategy must be one of: fixed, sliding, tokenBucket",
    });
  }

  // Validate keyType
  if (
    config.keyType &&
    !["ip", "user-agent", "path", "custom"].includes(config.keyType) &&
    !config.keyType.startsWith("header:")
  ) {
    errors.push({
      field: "keyType",
      message:
        "keyType must be one of: ip, user-agent, path, custom, or header:HEADER_NAME",
    });
  }

  // Validate limiterConfig
  if (config.limiterConfig) {
    if (
      config.limiterConfig.maxStoreSize &&
      (typeof config.limiterConfig.maxStoreSize !== "number" ||
        config.limiterConfig.maxStoreSize <= 0)
    ) {
      errors.push({
        field: "limiterConfig.maxStoreSize",
        message: "maxStoreSize must be a positive number",
      });
    }

    if (
      config.limiterConfig.cleanupInterval &&
      (typeof config.limiterConfig.cleanupInterval !== "number" ||
        config.limiterConfig.cleanupInterval <= 0)
    ) {
      errors.push({
        field: "limiterConfig.cleanupInterval",
        message: "cleanupInterval must be a positive number",
      });
    }
  }

  return errors;
}

export function throwIfInvalid(config: LimiterConfig): void {
  const errors = validateConfig(config);
  if (errors.length > 0) {
    const errorMessage = errors
      .map((error) => `${error.field}: ${error.message}`)
      .join(", ");
    throw new Error(`Invalid rate limiter configuration: ${errorMessage}`);
  }
}
