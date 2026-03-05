"use client";
import { useEffect, useRef, useState } from "react";

interface RadialGaugeProps {
  value: number;
  max: number;
  color: string;
  trackColor?: string;
  label: string;
  subLabel: string;
  delay?: number;
}

export function RadialGauge({
  value,
  max,
  color,
  trackColor = "#e5ddd0",
  label,
  subLabel,
  delay = 0,
}: RadialGaugeProps) {
  const r = 36;
  const cx = 48;
  const cy = 48;
  const strokeWidth = 7;
  // 270° arc (from 135° to 405°)
  const arcAngle = 270;
  const circumference = 2 * Math.PI * r;
  const arcLength = (arcAngle / 360) * circumference;
  const gap = circumference - arcLength;

  const pctVal = max > 0 ? Math.min(value / max, 1) : 0;

  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(pctVal), delay + 100);
    return () => clearTimeout(timer);
  }, [pctVal, delay]);

  const fillLength = animated * arcLength;

  // Rotation: start at 135° (bottom-left)
  const rotation = 135;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="96" height="96" viewBox="0 0 96 96">
        {/* Track arc */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${arcLength} ${gap}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(${rotation} ${cx} ${cy})`}
        />
        {/* Value arc */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${fillLength} ${circumference - fillLength}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(${rotation} ${cx} ${cy})`}
          style={{ transition: `stroke-dasharray ${1 + delay * 0.001}s cubic-bezier(.4,0,.2,1)` }}
        />
        {/* Center % text */}
        <text
          x={cx} y={cy - 3}
          textAnchor="middle"
          fill={color}
          fontSize="13"
          fontFamily="'JetBrains Mono', monospace"
          fontWeight="700"
        >
          {(pctVal * 100).toFixed(0)}%
        </text>
        <text
          x={cx} y={cy + 11}
          textAnchor="middle"
          fill="#9c8f7a"
          fontSize="7"
          fontFamily="'JetBrains Mono', monospace"
        >
          of PO
        </text>
      </svg>
      <div
        className="text-xs font-semibold text-center leading-tight"
        style={{ color, fontFamily: "'Cormorant Garamond', serif", fontSize: 13 }}
      >
        {label}
      </div>
      <div className="text-xs text-center" style={{ color: "#9c8f7a", fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>
        {subLabel}
      </div>
    </div>
  );
}
