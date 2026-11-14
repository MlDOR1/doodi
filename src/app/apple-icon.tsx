import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const font = await readFile(join(process.cwd(), "assets/poppins-700.woff"));

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#e0263f",
          color: "white",
          fontSize: 130,
          fontFamily: "Poppins",
        }}
      >
        D
      </div>
    ),
    { ...size, fonts: [{ name: "Poppins", data: font, weight: 700, style: "normal" }] },
  );
}
