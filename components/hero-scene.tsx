import styles from "./home-hero.module.css";

export function HeroScene() {
  return (
    <div className={styles.heroScene} aria-hidden="true">
      <img
        className={styles.artworkLight}
        src="/celestial/hero-atmosphere-light.webp"
        alt=""
        draggable={false}
      />
      <img
        className={styles.artworkDark}
        src="/celestial/hero-atmosphere-dark.webp"
        alt=""
        draggable={false}
      />
      <div className={styles.sceneOverlay} />
      <div className={styles.sceneComposition}>
        <div className={styles.celestial}>
          <img
            className={styles.celestialLight}
            src="/celestial/jeong-sun-final.svg"
            alt=""
            draggable={false}
          />
          <img
            className={styles.celestialDark}
            src="/celestial/jeong-moon-final.svg"
            alt=""
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}
