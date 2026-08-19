import { auth, signIn, signOut } from "@/auth";
import { Dashboard } from "@/components/dashboard";
import shellStyles from "@/components/jeong-shell.module.css";

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    return (
      <main className="landing">
        <section className="landingCard">
          <div className="landingSeal" aria-hidden="true">整</div>
          <div className="landingCopy">
            <h1>JEONG에 오신 것을 환영합니다</h1>
            <p>Google 계정을 연결하면 일정과 하루의 기록을 한 흐름에서 관리할 수 있습니다.</p>
          </div>
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/dashboard" });
            }}
          >
            <button className="primaryButton" type="submit">
              <svg className="googleLogo" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.75 2.98-4.33 2.98-7.39Z" />
                <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.38l-3.24-2.53c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.61A10 10 0 0 0 12 22Z" />
                <path fill="#FBBC05" d="M6.39 13.92A6.02 6.02 0 0 1 6.07 12c0-.67.11-1.32.32-1.92V7.47H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.53l3.35-2.61Z" />
                <path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.47l3.35 2.61C7.18 7.71 9.39 5.95 12 5.95Z" />
              </svg>
              <span>Google 계정 연결</span>
            </button>
          </form>
          <p className="landingPrivacy">계정 연결 정보는 일정과 기록을 불러오는 용도로만 사용됩니다.</p>
        </section>
      </main>
    );
  }

  return (
    <>
      <details className={`accountMenu sidebarAccountMenu ${shellStyles.accountOverlay}`}>
        <summary aria-label="계정 메뉴">
          {session.user?.image
            ? <img src={session.user.image} alt="" />
            : <span>{(session.user?.name || session.user?.email || "J").slice(0,1).toUpperCase()}</span>}
        </summary>
        <div className="accountDropdown">
          <strong>{session.user?.name || "JEONG 사용자"}</strong>
          <small>{session.user?.email}</small>
          <a href="/dashboard">Google 연결</a>
          <a href="/dashboard?view=profile">개인정보</a>
          <a href="/dashboard?view=settings">설정</a>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button className="accountLogout">로그아웃</button>
          </form>
        </div>
      </details>
      <Dashboard user={{ name: session.user?.name, email: session.user?.email, image: session.user?.image }} />
    </>
  );
}
