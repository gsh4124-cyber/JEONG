export default function AuthErrorPage() {
  return (
    <main className="landing">
      <section className="landingCard">
        <div className="landingSeal" aria-hidden="true">整</div>
        <div className="landingCopy">
          <h1>Google 연결 설정을 확인해주세요</h1>
          <p>JEONG 자체는 실행 중이지만 Google OAuth 연결이 완료되지 않았습니다.</p>
        </div>
        <a className="primaryButton" href="/dashboard">JEONG으로 돌아가기</a>
        <p className="landingPrivacy">
          Google Cloud의 승인된 리디렉션 URI에 http://localhost:3000/api/auth/callback/google 이 정확히 등록되어 있어야 합니다.
        </p>
      </section>
    </main>
  );
}
