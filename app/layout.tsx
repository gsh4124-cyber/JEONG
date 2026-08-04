import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JEONG",
  description: "Google Calendar와 Gmail을 읽는 개인 업무 비서"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
