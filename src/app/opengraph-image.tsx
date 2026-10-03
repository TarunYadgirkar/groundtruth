import { ImageResponse } from "next/og";

export const alt = "Groundtruth: which housing laws apply at this address, on any date";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#f2efe6";
const INK = "#1e2b26";
const MUTED = "#5f6a62";
const ACCENT = "#c8452c";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: PAPER, padding: 72, color: INK }}>
        <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, color: MUTED }}>RENTAL HOUSING LAW NAVIGATOR</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 120, fontWeight: 800, letterSpacing: -4 }}>Groundtruth</div>
          <div style={{ display: "flex", fontSize: 40, color: MUTED }}>Which housing laws apply at this address, on any date.</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 24, color: MUTED }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ width: 16, height: 16, borderRadius: 8, background: ACCENT }} />
            500 buildings · CA · NJ · MA · cited to source text
          </div>
          <div style={{ display: "flex" }}>Not legal advice</div>
        </div>
      </div>
    ),
    size,
  );
}
