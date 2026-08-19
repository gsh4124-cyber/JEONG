"use client";

import styles from "./jeong-shell.module.css";

type NavigationItem = { v: string; t: string; icon: string };
type NavigationGroup = { label: string; items: readonly NavigationItem[] };

type Props = { groups: readonly NavigationGroup[]; activeView: string; onNavigate: (view: string) => void };

export function JeongShellNavigation({ groups, activeView, onNavigate }: Props) {
  const mobileItems = [
    { v: "home", t: "홈", icon: "⌂" }, { v: "day", t: "오늘", icon: "◷" },
    { v: "calendar", t: "캘린더", icon: "▦" }, { v: "records", t: "기록", icon: "✎" },
    { v: "projects", t: "프로젝트", icon: "▤" }, { v: "ai", t: "ChatGPT", icon: "✧" },
  ];
  return <>
    <aside className={`premiumSidebar ${styles.sidebar}`}>
      <button type="button" className={`brandBlock ${styles.brand} ${styles.brandButton}`} onClick={()=>onNavigate("home")} aria-label="홈으로 이동"><div className="seal">整</div><div><strong>PROJECT JEONG</strong><small>Your Private Assistant</small></div></button>
      <div className={`navScroll ${styles.navigation}`}>{groups.map((group, groupIndex)=><section className="navGroup" key={groupIndex}>{group.label&&<span>{group.label}</span>}{group.items.map(item=><button key={item.v} className={activeView===item.v?"active":""} onClick={()=>onNavigate(item.v)}><i>{item.icon}</i><span>{item.t}</span></button>)}</section>)}</div>
      <button type="button" className={`${styles.profile} ${styles.profileButton}`} onClick={()=>onNavigate("profile")} aria-label="개인정보로 이동"><div className={styles.profileAvatar} aria-hidden="true">整</div><div className={styles.profileCopy}><strong>황제</strong><small>JEONG Life OS</small></div></button>
    </aside>
    <nav className={`mobileBottomNav ${styles.mobileNavigation}`} aria-label="모바일 주요 메뉴">{mobileItems.map(item=><button key={item.v} className={activeView===item.v?"active":""} onClick={()=>onNavigate(item.v)}><i>{item.icon}</i><span>{item.t}</span></button>)}</nav>
  </>;
}
