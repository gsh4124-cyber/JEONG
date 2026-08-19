"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("JEONG runtime error", error);
  }, [error]);

  return (
    <main className="jeongErrorPage">
      <section className="jeongErrorCard">
        <div className="jeongErrorSeal" aria-hidden="true">整</div>
        <span>JEONG RECOVERY</span>
        <h1>화면을 불러오지 못했습니다.</h1>
        <p>
          사용자 기록은 건드리지 않습니다. 먼저 다시 시도해 보고, 같은 오류가 반복되면
          JEONG 실행 창을 종료한 뒤 JEONG-RUN.cmd로 다시 시작해 주세요.
        </p>
        <div className="jeongErrorActions">
          <button className="primaryButton" type="button" onClick={reset}>다시 시도</button>
          <button className="secondaryButton" type="button" onClick={() => window.location.reload()}>페이지 새로고침</button>
        </div>
        {error.message && <details><summary>오류 정보</summary><code>{error.message}</code></details>}
      </section>
    </main>
  );
}
