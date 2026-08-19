export default function Loading() {
  return (
    <main className="jeongLoadingPage" aria-live="polite" aria-busy="true">
      <div className="jeongLoadingSeal" aria-hidden="true">整</div>
      <strong>JEONG을 정리하고 있습니다.</strong>
      <span>잠시만 기다려 주세요.</span>
    </main>
  );
}
