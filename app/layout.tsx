import type { Metadata } from "next";
import "./globals.css";
import "./jeong-v2.css";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "JEONG",
  description: "오늘의 방향, 일정, 실행과 기록을 연결하는 Personal Life OS"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="jeongV2" suppressHydrationWarning><PwaRegister />{children}</body>
    </html>
  );
}
