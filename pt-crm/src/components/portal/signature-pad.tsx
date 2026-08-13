"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui";

export function SignaturePad({
  value,
  onChange,
}: {
  value: string;
  onChange: (dataUrl: string) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "#e4e4e7";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = ref.current!;
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  return (
    <div>
      <p id="sig-label" className="mb-1.5 text-xs font-medium text-zinc-400">
        Sign with your finger or mouse
      </p>
      <canvas
        ref={ref}
        role="img"
        aria-labelledby="sig-label"
        className="h-36 w-full touch-none rounded-xl border border-zinc-700 bg-zinc-900"
        onPointerDown={(e) => {
          drawing.current = true;
          const ctx = ref.current?.getContext("2d");
          if (!ctx) return;
          const p = pos(e);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = ref.current?.getContext("2d");
          if (!ctx) return;
          const p = pos(e);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }}
        onPointerUp={() => {
          drawing.current = false;
          const canvas = ref.current;
          if (canvas) onChange(canvas.toDataURL("image/png"));
        }}
      />
      <div className="mt-2 flex justify-end">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            const canvas = ref.current;
            const ctx = canvas?.getContext("2d");
            if (canvas && ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            onChange("");
          }}
        >
          Clear
        </Button>
      </div>
      {value ? (
        <p className="text-[11px] text-zinc-600">Signature captured</p>
      ) : null}
    </div>
  );
}
