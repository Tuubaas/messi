import { useMemo } from "react";
import { encode } from "uqr";

/** A QR code as an SVG. Dark on a light tile with a quiet margin: that is what cameras expect. */
export function QrCode({
  value,
  label,
  className,
}: {
  readonly value: string;
  readonly label: string;
  readonly className?: string;
}) {
  const { size, path } = useMemo(() => {
    const code = encode(value, { ecc: "M", border: 2 });
    const squares = code.data.flatMap((row, y) =>
      row.flatMap((dark, x) => (dark ? [`M${x} ${y}h1v1h-1z`] : [])),
    );
    return { size: code.size, path: squares.join("") };
  }, [value]);

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={size} height={size} rx="1.5" fill="oklch(0.97 0.018 92)" />
      <path d={path} fill="oklch(0.16 0.03 312)" />
    </svg>
  );
}
