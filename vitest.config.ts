import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node", // core 는 순수 함수라 DOM 이 필요 없다
  },
});
