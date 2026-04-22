import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type Point = { x: number; y: number };

export interface SignaturePadHandle {
  clear: () => void;
  toDataURL: () => string | null;
  hasSignature: () => boolean;
}

interface SignaturePadProps {
  className?: string;
  onChange?: (dataUrl: string | null) => void;
}

const PAD_HEIGHT = 220;

const SignaturePad = React.forwardRef<SignaturePadHandle, SignaturePadProps>(
  ({ className, onChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const strokesRef = useRef<Point[][]>([]);
    const activeStrokeRef = useRef<Point[] | null>(null);
    const drawingRef = useRef(false);
    const [isEmpty, setIsEmpty] = useState(true);

    const getContext = () => canvasRef.current?.getContext("2d") ?? null;

    const paintBackground = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
    };

    const redraw = useCallback(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      const ctx = getContext();

      if (!canvas || !container || !ctx) return;

      const width = container.clientWidth;
      const height = PAD_HEIGHT;
      const scale = window.devicePixelRatio || 1;

      canvas.width = Math.max(1, Math.floor(width * scale));
      canvas.height = Math.max(1, Math.floor(height * scale));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      paintBackground(ctx, width, height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111111";
      ctx.lineWidth = 2.5;

      for (const stroke of strokesRef.current) {
        if (stroke.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i += 1) {
          ctx.lineTo(stroke[i].x, stroke[i].y);
        }
        ctx.stroke();
      }
    }, []);

    const emitChange = () => {
      const canvas = canvasRef.current;
      const hasInk = strokesRef.current.some((stroke) => stroke.length > 1);
      setIsEmpty(!hasInk);
      onChange?.(hasInk && canvas ? canvas.toDataURL("image/png") : null);
    };

    const appendPoint = (point: Point) => {
      if (!activeStrokeRef.current) return;
      activeStrokeRef.current.push(point);
      redraw();
    };

    const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.setPointerCapture(event.pointerId);
      drawingRef.current = true;
      const point = getPoint(event);
      activeStrokeRef.current = [point];
      strokesRef.current.push(activeStrokeRef.current);
      redraw();
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      event.preventDefault();
      appendPoint(getPoint(event));
    };

    const endStroke = (event?: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      if (event && canvasRef.current?.hasPointerCapture(event.pointerId)) {
        canvasRef.current.releasePointerCapture(event.pointerId);
      }

      activeStrokeRef.current = null;
      redraw();
      emitChange();
    };

    const clear = () => {
      strokesRef.current = [];
      activeStrokeRef.current = null;
      drawingRef.current = false;
      redraw();
      emitChange();
    };

    useImperativeHandle(ref, () => ({
      clear,
      toDataURL: () => {
        const canvas = canvasRef.current;
        const hasInk = strokesRef.current.some((stroke) => stroke.length > 1);
        return hasInk && canvas ? canvas.toDataURL("image/png") : null;
      },
      hasSignature: () => strokesRef.current.some((stroke) => stroke.length > 1),
    }));

    useEffect(() => {
      redraw();

      const handleResize = () => redraw();
      window.addEventListener("resize", handleResize);

      let resizeObserver: ResizeObserver | null = null;
      if (containerRef.current && "ResizeObserver" in window) {
        resizeObserver = new ResizeObserver(() => redraw());
        resizeObserver.observe(containerRef.current);
      }

      return () => {
        window.removeEventListener("resize", handleResize);
        resizeObserver?.disconnect();
      };
    }, [redraw]);

    return (
      <div
        ref={containerRef}
        className={cn("w-full overflow-hidden rounded-xl border border-border bg-background shadow-sm", className)}
      >
        <canvas
          ref={canvasRef}
          className="block w-full touch-none"
          style={{ height: PAD_HEIGHT }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endStroke}
          onPointerLeave={endStroke}
          onPointerCancel={endStroke}
        />
        <div className="flex items-center justify-between border-t border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <span>{isEmpty ? "Desenhe sua assinatura aqui" : "Assinatura capturada"}</span>
          <button type="button" onClick={clear} className="font-medium text-primary hover:underline">
            Limpar
          </button>
        </div>
      </div>
    );
  },
);

SignaturePad.displayName = "SignaturePad";

export default SignaturePad;
