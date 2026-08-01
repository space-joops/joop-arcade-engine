// 데모 앱 — vite alias 로 "joop-arcade-engine" 이 ../src 를 가리키므로
// 소스를 고치면 HMR 로 바로 반영된다. 실제 사용자가 쓰게 될 코드 그대로다.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ArcadeGame } from "joop-arcade-engine";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ArcadeGame
      // 커스터마이징 예시 — 지우면 전부 기본값으로 동작한다.
      // config={{ thrust: 1.6, fuel: 120 }}
      // accentColor="#ff2e97"
      // labels={{ title: "My Space Sweeper 🚀" }}
      onGameOver={(summary) => console.log("[demo] game over:", summary)}
    />
  </StrictMode>,
);
