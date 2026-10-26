import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          background: "linear-gradient(145deg, #052e22, #047857)",
          color: "#ecfdf5",
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 700 }}>L</div>
        <div style={{ fontSize: 22, marginTop: 4, opacity: 0.9 }}>會計</div>
      </div>
    ),
    { ...size },
  );
}
