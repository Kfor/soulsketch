import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  await params; // token available for future personalization

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
          background:
            "linear-gradient(135deg, #1a0a2e 0%, #0a0014 50%, #2d1b4e 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "40px",
          }}
        >
          <p
            style={{
              fontSize: "24px",
              color: "rgba(192,132,252,0.9)",
              marginBottom: "8px",
              letterSpacing: "4px",
              textTransform: "uppercase",
            }}
          >
            SoulSketch
          </p>
          <h1
            style={{
              fontSize: "56px",
              fontWeight: "bold",
              color: "white",
              marginBottom: "16px",
              textAlign: "center",
            }}
          >
            Someone drew their soulmate
          </h1>
          <p
            style={{
              fontSize: "28px",
              color: "rgba(255,255,255,0.7)",
              textAlign: "center",
              maxWidth: "600px",
            }}
          >
            Can you guess which one they like? Take the challenge!
          </p>
          <div
            style={{
              display: "flex",
              marginTop: "40px",
              background: "linear-gradient(135deg, #7c3aed, #ec4899)",
              borderRadius: "999px",
              padding: "16px 40px",
            }}
          >
            <p
              style={{
                fontSize: "22px",
                color: "white",
                fontWeight: "bold",
              }}
            >
              Draw Your Soulmate →
            </p>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
