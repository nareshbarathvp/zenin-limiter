import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  dts: true,
  format: ["esm", "cjs"],
  outDir: "dist",
  target: "es2020",
  clean: true,
  external: ["@nestjs/common", "class-transformer", "class-validator"],
});
