import { auth, signIn, signOut } from "@/auth";
import { Dashboard } from "@/components/dashboard";

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    return (
      <main className="landing">
        <section className="landingCard">
          <div className="seal">整</div>
          <h1>Google 연결이 필요합니다</h1>
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/dashboard" });
            }}
          >
            <button className="primaryButton" type="submit">Google 계정 연결</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <>
      <details className="accountMenu sidebarAccountMenu">
        <summary aria-label="계정 메뉴">
          {session.user?.image
            ? <img src={session.user.image} alt="" />
            : <span>{(session.user?.name || session.user?.email || "J").slice(0,1).toUpperCase()}</span>}
        </summary>
        <div className="accountDropdown">
          <strong>{session.user?.name || "JEONG 사용자"}</strong>
          <small>{session.user?.email}</small>
          <a href="/dashboard">Google 연결</a>
          <a href="/dashboard?view=settings">프로필 및 설정</a>
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
      <Dashboard />
    </>
  );
}
