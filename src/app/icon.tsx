import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

const font = await readFile(join(process.cwd(), "assets/poppins-700.woff"));

export default function Icon() {
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
          fontSize: 46,
          fontFamily: "Poppins",
          borderRadius: 14,
        }}
      >
        D
      </div>
    ),
    { ...size, fonts: [{ name: "Poppins", data: font, weight: 700, style: "normal" }] },
  );
}
