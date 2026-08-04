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
      <header className="accountBar">
        <span>{session.user?.email}</span>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button className="plainButton">로그아웃</button>
        </form>
      </header>
      <Dashboard />
    </>
  );
}
