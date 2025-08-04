type KeyType = "ip" | "user-agent" | "header:X-API-KEY" | "path" | "custom";

export interface KeyGeneratorOptions {
  keyType?: KeyType;
  headerName?: string;
  customKeyGenerator?: (req: any) => string;
}

export function createKeyGenerator(
  options: KeyGeneratorOptions = {}
): (req: any) => string {
  const { keyType = "ip", headerName, customKeyGenerator } = options;

  if (keyType === "custom" && typeof customKeyGenerator === "function") {
    return customKeyGenerator;
  }

  switch (keyType) {
    case "ip":
      return (req) =>
        req.ip || req.connection?.remoteAddress || "__unknown_ip__";
    case "user-agent":
      return (req) => req.headers?.["user-agent"] || "__unknown_ua__";
    case "path":
      return (req) => req.path || req.url || "__unknown_path__";
    default:
      if (keyType.startsWith("header:")) {
        const header = keyType.split(":")[1] || headerName;
        return (req) =>
          req.headers?.[header?.toLowerCase()] ||
          `__unknown_header_${header}__`;
      }
      return (req) => req.ip || "__unknown__";
  }
}
