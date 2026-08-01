import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// 데모 전용 설정 — demo/ 를 루트로 띄우고, 패키지 이름 import 를
// 소스(src/)로 alias 해서 빌드 없이 바로 수정·플레이할 수 있게 한다.
export default defineConfig({
  root: "demo",
  plugins: [react()],
  resolve: {
    alias: {
      "joop-arcade-engine": fileURLToPath(new URL("./src/index.ts", import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
});
