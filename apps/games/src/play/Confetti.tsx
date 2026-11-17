import { useEffect, useRef } from "react";
import type { TeamColor } from "#/game/game";
import { prefersReducedMotion } from "./motion";

interface Piece {
  x: number;
  y: number;
  dx: number;
  dy: number;
  spin: number;
  turn: number;
  readonly size: number;
  readonly color: string;
}

const DURATION_MS = 5000;

/** A burst of paper in the winners' colours, once, when the results come up. */
export function Confetti({ colors }: { readonly colors: ReadonlyArray<TeamColor> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const palette = colors.join(",");

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (element === null || context === null || context === undefined || prefersReducedMotion()) {
      return;
    }
    const theme = getComputedStyle(document.documentElement);
    const paints = [
      ...palette.split(",").map((color) => theme.getPropertyValue(`--color-team-${color}`)),
      theme.getPropertyValue("--color-brass-400"),
    ].filter((paint) => paint.trim() !== "");

    const scale = window.devicePixelRatio;
    const width = window.innerWidth;
    const height = window.innerHeight;
    element.width = width * scale;
    element.height = height * scale;
    context.scale(scale, scale);

    // Two cannons, one in each bottom corner, firing towards the middle.
    const pieces = Array.from({ length: 180 }, (_, index): Piece => {
      const fromLeft = index % 2 === 0;
      const angle = (fromLeft ? -Math.PI / 3 : (-2 * Math.PI) / 3) + (Math.random() - 0.5) * 0.9;
      const speed = (0.55 + Math.random() * 0.75) * Math.sqrt(height) * 0.95;
      return {
        x: fromLeft ? -10 : width + 10,
        y: height * 0.85,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        spin: Math.random() * Math.PI,
        turn: (Math.random() - 0.5) * 0.4,
        size: 7 + Math.random() * 8,
        color: paints[index % paints.length] ?? "white",
      };
    });

    const startedAt = performance.now();
    let frame = requestAnimationFrame(function draw(now) {
      const elapsed = now - startedAt;
      context.clearRect(0, 0, width, height);
      context.globalAlpha = Math.min(1, (DURATION_MS - elapsed) / 1000);
      for (const piece of pieces) {
        piece.dy += 0.45;
        piece.dx *= 0.985;
        piece.dy *= 0.985;
        piece.x += piece.dx;
        piece.y += piece.dy;
        piece.spin += piece.turn;
        context.save();
        context.translate(piece.x, piece.y);
        context.rotate(piece.spin);
        context.fillStyle = piece.color;
        // Squashing the height by the spin makes the paper look like it tumbles.
        context.fillRect(
          -piece.size / 2,
          (-piece.size * Math.cos(piece.spin * 2)) / 4,
          piece.size,
          (piece.size * Math.cos(piece.spin * 2)) / 2,
        );
        context.restore();
      }
      if (elapsed < DURATION_MS) frame = requestAnimationFrame(draw);
      else context.clearRect(0, 0, width, height);
    });
    return () => cancelAnimationFrame(frame);
  }, [palette]);

  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-20 size-full"
    />
  );
}
