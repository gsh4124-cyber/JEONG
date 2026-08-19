import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JEONG — Life Operating System",
    short_name: "JEONG",
    description: "오늘의 방향, 일정, 할 일과 기록을 연결하는 개인 운영 비서",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f7f1e6",
    theme_color: "#bd8a30",
    icons: [
      { src: "/celestial/jeong-sun-final.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/celestial/jeong-moon-final.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
