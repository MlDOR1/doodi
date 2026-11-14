import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "DOODI Movie Review";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const font = await readFile(join(process.cwd(), "assets/poppins-700.woff"));

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Poppins",
          backgroundColor: "#1a070b",
          backgroundImage:
            "radial-gradient(ellipse 60% 70% at 50% 40%, rgba(224,38,63,0.35), rgba(26,7,11,0) 70%), repeating-linear-gradient(90deg, rgba(0,0,0,0.55) 0px, rgba(120,14,32,0.5) 38px, rgba(190,28,52,0.35) 62px, rgba(120,14,32,0.5) 86px, rgba(0,0,0,0.55) 124px)",
        }}
      >
        <div style={{ fontSize: 210, lineHeight: 1, color: "white", letterSpacing: -6 }}>DOODI</div>
        <div style={{ marginTop: 8, fontSize: 76, lineHeight: 1, color: "#e0263f", letterSpacing: 6 }}>MOVIE REVIEW</div>
        <div style={{ marginTop: 44, fontSize: 32, color: "#f6ede8", letterSpacing: 2 }}>Thai movie reviews from real viewers</div>
      </div>
    ),
    { ...size, fonts: [{ name: "Poppins", data: font, weight: 700, style: "normal" }] },
  );
}
