import { ImageResponse } from "next/og";

export const alt = "Wedding — a whitelabel wedding-site platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 96,
        background: "#2f3a35",
        color: "#f5efe0",
      }}
    >
      <div style={{ fontSize: 28, letterSpacing: 6, textTransform: "uppercase", color: "#e8d9b5" }}>
        Whitelabel wedding sites
      </div>
      <div style={{ fontSize: 112, marginTop: 24 }}>Wedding</div>
      <div style={{ fontSize: 36, marginTop: 24, color: "#cfd8d2" }}>
        Multi-tenant · Postgres RLS · token-based theming
      </div>
    </div>,
    size,
  );
}
