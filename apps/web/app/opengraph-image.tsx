import { ImageResponse } from "next/og";

export const alt = "Yalp — lightweight todo and MCP connections";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #fafafa 0%, #ececec 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            padding: 48,
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              color: "#111",
            }}
          >
            Yalp
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 500,
              color: "#444",
              textAlign: "center",
              maxWidth: 900,
              lineHeight: 1.35,
            }}
          >
            Keep your tasks in one place. Connect AI tools via MCP.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
