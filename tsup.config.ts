import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  dts: true,
  format: ["esm", "cjs"],
  outDir: "dist",
  target: "es2020",
  clean: true,
  external: ["@nestjs/common", "class-transformer", "class-validator"],
  // Additional optimizations
  minify: false, // Keep readable for debugging
  sourcemap: true, // Help with debugging
  splitting: false, // Single bundle for better tree-shaking
  treeshake: true, // Remove unused code
  // Ensure proper module resolution
  noExternal: [],
  // Optimize for Node.js environments
  platform: "node",
  // Ensure proper TypeScript compilation
  tsconfig: "tsconfig.json",
});
