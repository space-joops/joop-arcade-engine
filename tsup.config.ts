import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts", // 전체(React 컴포넌트 포함)
    core: "src/core.ts", // 헤드리스 코어만(React 불필요)
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom"],
  // Next.js(RSC) 호스트에서 클라이언트 컴포넌트로 인식되도록 배너를 남긴다.
  // core 엔트리에도 붙지만 RSC 외 환경에서는 무해한 문자열이다.
  banner: { js: '"use client";' },
});
