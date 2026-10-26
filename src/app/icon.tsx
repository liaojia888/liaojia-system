import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

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
          background: "linear-gradient(135deg, #0b4a36, #047857)",
          borderRadius: 8,
          color: "#ecfdf5",
          fontSize: 18,
          fontWeight: 700,
        }}
      >
        L
      </div>
    ),
    { ...size },
  );
}
