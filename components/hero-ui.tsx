import styles from "./home-hero.module.css";

export type HeroUIProps = {
  title: string;
  theme: "light" | "dark";
  dateLabel: string;
  timeLabel: string;
  weatherLoading: boolean;
  weatherIcon: string;
  weatherTemperature: string;
  weatherLabel: string;
  weatherDetail: string;
  onWeather: () => void;
  onSearch: () => void;
  onTheme: () => void;
  onMenu: () => void;
};

export function HeroUI(props: HeroUIProps) {
  return (
    <div className={styles.heroUI}>
      <div className={styles.controls}>
        <button className={styles.search} onClick={props.onSearch}>
          전체 검색<kbd>Ctrl+K</kbd>
        </button>
        <button className={styles.toolButton} aria-label="테마 전환" onClick={props.onTheme}>
          {props.theme === "light" ? "☼" : "☾"}
        </button>
        <button className={styles.toolButton} aria-label="아침 기록 열기" onClick={props.onMenu}>
          ☰
        </button>
      </div>

      <div className={styles.heroComposition}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}>JEONG · LIFE OPERATING SYSTEM</span>
          <h1>{props.title}</h1>
          <p>
            무엇이 주어졌느냐가 아니라,
            <br />
            주어진 것을 어떻게 활용하느냐가 중요하다.
          </p>
        </div>
        <div className={styles.clock}>
          <span>{props.dateLabel}</span>
          <strong>{props.timeLabel}</strong>
        </div>
        <button className={styles.weather} onClick={props.onWeather} title="날씨 새로고침">
          <b>{props.weatherLoading ? "…" : props.weatherIcon}</b>
          <span>
            <strong>{props.weatherLoading ? "--" : props.weatherTemperature}</strong>
            {props.weatherLoading ? "날씨 불러오는 중" : props.weatherLabel}
            <small>{props.weatherDetail}</small>
          </span>
        </button>
      </div>
    </div>
  );
}
