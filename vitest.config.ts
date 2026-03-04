import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: [
      {
        find: /^(\.{1,2}\/.*)\.js$/,
        replacement: "$1",
      },
    ],
    extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
  },
});
