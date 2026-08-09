"use client";

import styles from "./home-hero.module.css";
import { HeroScene } from "./hero-scene";
import { HeroUI, type HeroUIProps } from "./hero-ui";

type Props = HeroUIProps;

export function HomeHero(props: Props) {
  return (
    <header className={styles.hero}>
      <HeroScene />
      <HeroUI {...props} />
    </header>
  );
}
