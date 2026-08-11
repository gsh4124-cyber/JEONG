"use client";

import styles from "./home-hero.module.css";
import { HeroSceneCanvas } from "./hero-scene-canvas";
import { HeroUI, type HeroUIProps } from "./hero-ui";

type Props = HeroUIProps;

export function HomeHero(props: Props) {
  return (
    <header className={styles.hero}>
      <HeroSceneCanvas key={props.theme} theme={props.theme} />
      <HeroUI {...props} />
    </header>
  );
}
