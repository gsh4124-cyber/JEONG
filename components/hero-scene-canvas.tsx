"use client";

import { useEffect, useRef } from "react";
import styles from "./home-hero.module.css";

type Theme = "light" | "dark";
type SceneAssets = {
  artwork: HTMLImageElement;
};

type Camera = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

type Star = {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  phase: number;
  twinkles: boolean;
};

type SceneCache = {
  background: HTMLCanvasElement;
  nebula: HTMLCanvasElement;
  staticStars: HTMLCanvasElement;
  celestialGlow: HTMLCanvasElement;
  celestialGraphic: HTMLCanvasElement;
  lightFlow: HTMLCanvasElement;
  atmosphere: HTMLCanvasElement;
  twinkleStars: Star[];
};

type MotionState = {
  targetX: number;
  targetY: number;
  currentX: number;
  currentY: number;
  lastPointerAt: number;
};

const SCENE_WIDTH = 1600;
const SCENE_HEIGHT = 520;
const CELESTIAL = { x: 198, y: 181, radius: 40, graphicWidth: 188, graphicHeight: 204 } as const;
const FOCAL_POINTS: Record<Theme, {
  sceneX: number;
  sceneY: number;
  viewportX: number;
  viewportY: number;
}> = {
  light: { sceneX: 0.18, sceneY: 0.42, viewportX: 0.215, viewportY: 0.45 },
  dark: { sceneX: 0.18, sceneY: 0.42, viewportX: 0.215, viewportY: 0.45 },
};

const ACTIVE_FRAME_INTERVAL = 1000 / 45;
const IDLE_FRAME_INTERVAL = 1000 / 20;
const THEME_CROSSFADE_MS = 350;

const clamp = (min: number, value: number, max: number) =>
  Math.min(max, Math.max(min, value));

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function createCanvas(width = SCENE_WIDTH, height = SCENE_HEIGHT) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function getContext(canvas: HTMLCanvasElement) {
  return canvas.getContext("2d");
}

function calculateCamera(width: number, height: number, theme: Theme): Camera {
  const scale = Math.max(width / SCENE_WIDTH, height / SCENE_HEIGHT);
  const scaledWidth = SCENE_WIDTH * scale;
  const scaledHeight = SCENE_HEIGHT * scale;
  const focal = FOCAL_POINTS[theme];
  const requestedX = width * focal.viewportX - SCENE_WIDTH * focal.sceneX * scale;
  const requestedY = height * focal.viewportY - SCENE_HEIGHT * focal.sceneY * scale;
  return {
    scale,
    offsetX: clamp(width - scaledWidth, requestedX, 0),
    offsetY: clamp(height - scaledHeight, requestedY, 0),
  };
}

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function createStars() {
  const random = seededRandom(35117);
  return Array.from({ length: 72 }, (_, index): Star => ({
    radius: 0.35 + random() * 0.8,
    alpha: 0.18 + random() * 0.42,
    x: random() * SCENE_WIDTH,
    y: random() * SCENE_HEIGHT,
    phase: random() * Math.PI * 2,
    twinkles: index % 5 === 0,
  }));
}

function drawStars(
  context: CanvasRenderingContext2D,
  stars: Star[],
  theme: Theme,
  time = 0,
  animated = false,
) {
  context.save();
  context.fillStyle = theme === "light" ? "rgba(255,252,240,.28)" : "rgba(205,224,255,.48)";
  for (const star of stars) {
    const twinkle = animated && star.twinkles ? 0.82 + Math.sin(time / 1900 + star.phase) * 0.18 : 1;
    context.globalAlpha = star.alpha * twinkle;
    context.beginPath();
    context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawNebula(context: CanvasRenderingContext2D, theme: Theme) {
  const gradient = context.createRadialGradient(
    SCENE_WIDTH * 0.68,
    SCENE_HEIGHT * 0.22,
    0,
    SCENE_WIDTH * 0.68,
    SCENE_HEIGHT * 0.22,
    SCENE_WIDTH * 0.62,
  );
  gradient.addColorStop(0, theme === "light" ? "rgba(255,253,247,.045)" : "rgba(76,125,191,.045)");
  gradient.addColorStop(0.48, theme === "light" ? "rgba(220,194,145,.01)" : "rgba(27,69,126,.018)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);
}

function drawCelestialGlow(context: CanvasRenderingContext2D, theme: Theme, size: number) {
  const center = size / 2;
  const radius = CELESTIAL.radius;
  const glow = context.createRadialGradient(center, center, radius * 0.3, center, center, radius * 3.25);
  glow.addColorStop(0, theme === "light" ? "rgba(244,198,103,.34)" : "rgba(190,216,252,.38)");
  glow.addColorStop(0.2, theme === "light" ? "rgba(231,181,84,.22)" : "rgba(125,169,226,.26)");
  glow.addColorStop(0.52, theme === "light" ? "rgba(218,183,119,.11)" : "rgba(75,127,194,.14)");
  glow.addColorStop(0.78, theme === "light" ? "rgba(232,205,155,.045)" : "rgba(55,101,162,.06)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(center, center, radius * 3.25, 0, Math.PI * 2);
  context.fill();
}

function drawStarPoint(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
) {
  context.save();
  context.translate(x, y);
  context.fillStyle = color;
  context.shadowColor = color;
  context.shadowBlur = radius * 4;
  context.beginPath();
  context.moveTo(0, -radius * 2.6);
  context.quadraticCurveTo(radius * 0.36, -radius * 0.36, radius * 2.6, 0);
  context.quadraticCurveTo(radius * 0.36, radius * 0.36, 0, radius * 2.6);
  context.quadraticCurveTo(-radius * 0.36, radius * 0.36, -radius * 2.6, 0);
  context.quadraticCurveTo(-radius * 0.36, -radius * 0.36, 0, -radius * 2.6);
  context.fill();
  context.restore();
}

function drawCelestialGraphic(context: CanvasRenderingContext2D, theme: Theme) {
  const width = CELESTIAL.graphicWidth;
  const height = CELESTIAL.graphicHeight;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = CELESTIAL.radius;
  const axisColor = theme === "light" ? "rgba(174,124,39,.46)" : "rgba(151,184,226,.38)";
  const ringColor = theme === "light" ? "rgba(184,133,43,.32)" : "rgba(135,172,220,.28)";
  const starColor = theme === "light" ? "rgba(221,161,48,.92)" : "rgba(221,235,255,.94)";

  context.save();
  context.lineWidth = 0.8;
  context.strokeStyle = axisColor;
  context.beginPath();
  context.moveTo(centerX, 7);
  context.lineTo(centerX, height - 7);
  context.moveTo(10, centerY);
  context.lineTo(width - 10, centerY);
  context.stroke();

  context.strokeStyle = ringColor;
  for (const ringRadius of [radius + 10, radius + 21, radius + 32]) {
    context.beginPath();
    context.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
    context.stroke();
  }

  context.setLineDash([1.4, 4.2]);
  context.globalAlpha = 0.64;
  context.beginPath();
  context.ellipse(centerX, centerY, radius + 42, radius + 18, 0, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([]);
  context.globalAlpha = 1;

  if (theme === "light") {
    const sunGlow = context.createRadialGradient(centerX - 7, centerY - 9, 2, centerX, centerY, radius + 14);
    sunGlow.addColorStop(0, "rgba(255,248,203,1)");
    sunGlow.addColorStop(0.22, "rgba(244,198,87,.98)");
    sunGlow.addColorStop(0.68, "rgba(207,137,24,.96)");
    sunGlow.addColorStop(1, "rgba(151,87,8,.92)");
    context.fillStyle = sunGlow;
    context.shadowColor = "rgba(235,173,52,.72)";
    context.shadowBlur = 18;
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
    context.strokeStyle = "rgba(255,238,169,.78)";
    context.lineWidth = 1.2;
    context.stroke();

    const random = seededRandom(8917);
    context.save();
    context.beginPath();
    context.arc(centerX, centerY, radius - 2, 0, Math.PI * 2);
    context.clip();
    for (let index = 0; index < 22; index += 1) {
      const angle = random() * Math.PI * 2;
      const distance = random() * (radius - 5);
      context.fillStyle = `rgba(255,241,183,${0.08 + random() * 0.2})`;
      context.beginPath();
      context.arc(centerX + Math.cos(angle) * distance, centerY + Math.sin(angle) * distance, 0.5 + random() * 1.5, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  } else {
    const rim = context.createRadialGradient(centerX - 13, centerY - 8, 3, centerX, centerY, radius + 6);
    rim.addColorStop(0, "rgba(255,251,224,1)");
    rim.addColorStop(0.58, "rgba(238,206,130,.98)");
    rim.addColorStop(1, "rgba(148,174,210,.5)");
    context.fillStyle = rim;
    context.shadowColor = "rgba(179,207,244,.52)";
    context.shadowBlur = 17;
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;

    const shadow = context.createRadialGradient(centerX + 11, centerY - 8, 4, centerX + 10, centerY, radius + 2);
    shadow.addColorStop(0, "#06101d");
    shadow.addColorStop(0.72, "#081525");
    shadow.addColorStop(1, "rgba(9,22,39,.96)");
    context.fillStyle = shadow;
    context.beginPath();
    context.arc(centerX + 15, centerY - 7, radius + 1, 0, Math.PI * 2);
    context.fill();
  }

  drawStarPoint(context, centerX, 13, 3.2, starColor);
  drawStarPoint(context, centerX, height - 13, 2.4, starColor);
  context.restore();
}

function drawLightFlow(context: CanvasRenderingContext2D, theme: Theme) {
  context.save();
  context.globalCompositeOperation = "screen";
  context.lineCap = "round";
  const flowColor = theme === "light" ? "219,196,154" : "126,168,224";
  for (let index = 0; index < 3; index += 1) {
    const offset = index * SCENE_HEIGHT * 0.045;
    context.beginPath();
    context.moveTo(SCENE_WIDTH * 0.08, SCENE_HEIGHT * 0.34 + offset);
    context.bezierCurveTo(
      SCENE_WIDTH * 0.31,
      SCENE_HEIGHT * 0.27 + offset,
      SCENE_WIDTH * 0.55,
      SCENE_HEIGHT * 0.46 - offset,
      SCENE_WIDTH * 1.03,
      SCENE_HEIGHT * 0.22 + offset,
    );
    context.strokeStyle = `rgba(${flowColor},${theme === "light" ? 0.10 - index * 0.014 : 0.062 - index * 0.009})`;
    context.lineWidth = 0.8 + index * 0.35;
    context.stroke();
  }
  context.restore();
}

function drawAtmosphere(context: CanvasRenderingContext2D, theme: Theme) {
  const overlay = context.createLinearGradient(0, 0, 0, SCENE_HEIGHT);
  if (theme === "light") {
    overlay.addColorStop(0, "rgba(255,250,244,.025)");
    overlay.addColorStop(0.72, "rgba(255,250,244,.055)");
    overlay.addColorStop(1, "rgba(247,241,229,.19)");
  } else {
    overlay.addColorStop(0, "rgba(5,10,20,.08)");
    overlay.addColorStop(0.74, "rgba(5,10,20,.18)");
    overlay.addColorStop(1, "rgba(7,19,33,.40)");
  }
  context.fillStyle = overlay;
  context.fillRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);
}

function drawNoise(context: CanvasRenderingContext2D, theme: Theme) {
  const random = seededRandom(9471);
  context.save();
  context.fillStyle = theme === "light" ? "rgba(92,62,24,.045)" : "rgba(220,232,250,.04)";
  for (let index = 0; index < 170; index += 1) {
    context.globalAlpha = 0.1 + random() * 0.22;
    context.fillRect(random() * SCENE_WIDTH, random() * SCENE_HEIGHT, 0.55, 0.55);
  }
  context.restore();
}

function createSceneCache(assets: SceneAssets, theme: Theme): SceneCache {
  const stars = createStars();
  const background = createCanvas();
  const backgroundContext = getContext(background);
  if (backgroundContext) {
    if (theme === "light") {
      backgroundContext.fillStyle = "#f7f1e7";
      backgroundContext.fillRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);
      backgroundContext.save();
      backgroundContext.globalAlpha = 0.60;
      backgroundContext.filter = "saturate(.78) brightness(1.04) contrast(.90)";
      backgroundContext.drawImage(assets.artwork, 0, 0, SCENE_WIDTH, SCENE_HEIGHT);
      backgroundContext.restore();
      backgroundContext.fillStyle = "rgba(255,253,248,.11)";
      backgroundContext.fillRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);
    } else {
      backgroundContext.fillStyle = "#071321";
      backgroundContext.fillRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);
      backgroundContext.save();
      backgroundContext.globalAlpha = 0.59;
      backgroundContext.filter = "saturate(.76) brightness(.78) contrast(.94)";
      backgroundContext.drawImage(assets.artwork, 0, 0, SCENE_WIDTH, SCENE_HEIGHT);
      backgroundContext.restore();
    }
  }

  const nebula = createCanvas();
  const nebulaContext = getContext(nebula);
  if (nebulaContext) drawNebula(nebulaContext, theme);

  const staticStars = createCanvas();
  const staticStarsContext = getContext(staticStars);
  if (staticStarsContext) drawStars(staticStarsContext, stars.filter((star) => !star.twinkles), theme);

  const glowSize = Math.ceil(CELESTIAL.radius * 6.7);
  const celestialGlow = createCanvas(glowSize, glowSize);
  const glowContext = getContext(celestialGlow);
  if (glowContext) drawCelestialGlow(glowContext, theme, glowSize);

  const celestialGraphic = createCanvas(CELESTIAL.graphicWidth, CELESTIAL.graphicHeight);
  const celestialContext = getContext(celestialGraphic);
  if (celestialContext) drawCelestialGraphic(celestialContext, theme);

  const lightFlow = createCanvas();
  const lightFlowContext = getContext(lightFlow);
  if (lightFlowContext) drawLightFlow(lightFlowContext, theme);

  const atmosphere = createCanvas();
  const atmosphereContext = getContext(atmosphere);
  if (atmosphereContext) {
    drawAtmosphere(atmosphereContext, theme);
    drawNoise(atmosphereContext, theme);
  }

  return {
    background,
    nebula,
    staticStars,
    celestialGlow,
    celestialGraphic,
    lightFlow,
    atmosphere,
    twinkleStars: stars.filter((star) => star.twinkles),
  };
}

function drawScene(
  context: CanvasRenderingContext2D,
  theme: Theme,
  cache: SceneCache,
  width: number,
  height: number,
  dpr: number,
  motion: MotionState,
  time: number,
  motionEnabled: boolean,
) {
  const scaleX = width / SCENE_WIDTH;
  const scaleY = height / SCENE_HEIGHT;
  const celestialScale = clamp(.78, width / SCENE_WIDTH, 1.12);
  const sceneX = motion.currentX * 1.25;
  const sceneY = motion.currentY * .8;
  const driftX = motionEnabled ? Math.sin(time / 3500) * 1.5 : 0;
  const driftY = motionEnabled ? Math.sin(time / 4500) : 0;
  const breathing = motionEnabled ? 0.92 + (Math.sin(time / 1300) + 1) * 0.04 : 1;
  const shimmer = motionEnabled ? 0.94 + (Math.sin(time / 2200) + 1) * 0.03 : 1;
  const glowSize = cache.celestialGlow.width;

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width * dpr, height * dpr);
  context.save();
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Atmosphere fills the hero without cover-cropping. Its vertical compression is
  // intentional: the complete aurora/light flow remains visible at every width.
  context.drawImage(cache.background, sceneX, sceneY, width, height);
  context.drawImage(cache.nebula, sceneX * 1.5 + driftX, sceneY * 1.25 + driftY, width, height);
  context.drawImage(cache.staticStars, sceneX * 3, sceneY * 2.5, width, height);
  context.save();
  context.translate(sceneX * 3, sceneY * 2.5);
  context.scale(scaleX, scaleY);
  drawStars(context, cache.twinkleStars, theme, time, motionEnabled);
  context.restore();

  context.drawImage(cache.atmosphere, 0, 0, width, height);

  // The celestial uses a uniform scale and its own normalized anchor so the
  // atmosphere may compress without turning the sun or moon into an ellipse.
  const celestialX = width * .15 + sceneX * 2.5;
  const celestialY = height * .43 + sceneY * 2.2;

  context.save();
  context.globalAlpha = breathing;
  context.drawImage(
    cache.celestialGlow,
    celestialX - glowSize * celestialScale / 2,
    celestialY - glowSize * celestialScale / 2,
    glowSize * celestialScale,
    glowSize * celestialScale,
  );
  context.restore();
  context.drawImage(
    cache.celestialGraphic,
    celestialX - CELESTIAL.graphicWidth * celestialScale / 2,
    celestialY - CELESTIAL.graphicHeight * celestialScale / 2,
    CELESTIAL.graphicWidth * celestialScale,
    CELESTIAL.graphicHeight * celestialScale,
  );

  context.save();
  context.globalAlpha = shimmer;
  context.drawImage(cache.lightFlow, sceneX * 4.5, sceneY * 3.5, width, height);
  context.restore();
  context.restore();
}

export function HeroSceneCanvas({ theme }: { theme: Theme }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const pointerTarget = stage?.parentElement;
    if (!stage || !canvas || !pointerTarget) return;

    let cancelled = false;
    let cache: SceneCache | null = null;
    let animationFrame = 0;
    let lastFrameAt = 0;
    let lastTickAt = performance.now();
    let transitionStartedAt = 0;
    let sceneVisible = true;
    let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const motion: MotionState = {
      targetX: 0,
      targetY: 0,
      currentX: 0,
      currentY: 0,
      lastPointerAt: 0,
    };

    const previousFrame = createCanvas(canvas.width || 1, canvas.height || 1);
    getContext(previousFrame)?.drawImage(canvas, 0, 0);

    const resizeCanvas = () => {
      const bounds = stage.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return null;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.max(1, Math.round(bounds.width * dpr));
      const pixelHeight = Math.max(1, Math.round(bounds.height * dpr));
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
      return { width: bounds.width, height: bounds.height, dpr };
    };

    const render = (time: number) => {
      if (cancelled || !cache) return;
      const size = resizeCanvas();
      const context = canvas.getContext("2d");
      if (!size || !context) return;
      drawScene(context, theme, cache, size.width, size.height, size.dpr, motion, time, !reducedMotion);

      if (!reducedMotion && transitionStartedAt > 0) {
        const progress = clamp(0, (time - transitionStartedAt) / THEME_CROSSFADE_MS, 1);
        if (progress < 1) {
          context.save();
          context.setTransform(1, 0, 0, 1, 0, 0);
          context.globalAlpha = 1 - progress;
          context.drawImage(previousFrame, 0, 0, canvas.width, canvas.height);
          context.restore();
        }
      }
    };

    const tick = (time: number) => {
      if (cancelled || !sceneVisible || document.visibilityState === "hidden") return;
      const delta = Math.min(64, time - lastTickAt);
      lastTickAt = time;
      const smoothing = 1 - Math.exp(-delta / 180);
      motion.currentX += (motion.targetX - motion.currentX) * smoothing;
      motion.currentY += (motion.targetY - motion.currentY) * smoothing;

      const pointerActive = time - motion.lastPointerAt < 650
        || Math.abs(motion.targetX - motion.currentX) > 0.01
        || Math.abs(motion.targetY - motion.currentY) > 0.01;
      const transitionActive = transitionStartedAt > 0 && time - transitionStartedAt < THEME_CROSSFADE_MS;
      const interval = pointerActive || transitionActive ? ACTIVE_FRAME_INTERVAL : IDLE_FRAME_INTERVAL;
      if (time - lastFrameAt >= interval) {
        render(time);
        lastFrameAt = time;
      }
      animationFrame = window.requestAnimationFrame(tick);
    };

    const startAnimation = () => {
      window.cancelAnimationFrame(animationFrame);
      lastTickAt = performance.now();
      if (reducedMotion) {
        motion.targetX = 0;
        motion.targetY = 0;
        motion.currentX = 0;
        motion.currentY = 0;
        render(0);
        return;
      }
      if (sceneVisible && document.visibilityState !== "hidden") {
        animationFrame = window.requestAnimationFrame(tick);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (reducedMotion) return;
      const bounds = stage.getBoundingClientRect();
      motion.targetX = clamp(-1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1, 1);
      motion.targetY = clamp(-1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1, 1);
      motion.lastPointerAt = performance.now();
    };

    const onPointerLeave = () => {
      motion.targetX = 0;
      motion.targetY = 0;
      motion.lastPointerAt = performance.now();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        window.cancelAnimationFrame(animationFrame);
      } else {
        startAnimation();
      }
    };

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionPreferenceChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      startAnimation();
    };

    const observer = new ResizeObserver(() => {
      if (sceneVisible) render(performance.now());
    });
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      sceneVisible = entry?.isIntersecting ?? true;
      if (sceneVisible) startAnimation();
      else window.cancelAnimationFrame(animationFrame);
    }, { threshold: 0.01 });
    observer.observe(stage);
    visibilityObserver.observe(stage);
    pointerTarget.addEventListener("pointermove", onPointerMove, { passive: true });
    pointerTarget.addEventListener("pointerleave", onPointerLeave, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    motionPreference.addEventListener("change", onMotionPreferenceChange);

    Promise.all([
      loadImage(`/celestial/hero-atmosphere-${theme}.webp`),
    ]).then(([artwork]) => {
      if (cancelled) return;
      cache = createSceneCache({ artwork }, theme);
      transitionStartedAt = reducedMotion ? 0 : performance.now();
      render(transitionStartedAt);
      startAnimation();
    }).catch(() => {
      // Keep the UI usable even if a visual asset cannot be decoded.
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
      visibilityObserver.disconnect();
      pointerTarget.removeEventListener("pointermove", onPointerMove);
      pointerTarget.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motionPreference.removeEventListener("change", onMotionPreferenceChange);
    };
  }, [theme]);

  return (
    <div ref={stageRef} className={styles.heroSceneCanvas} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
