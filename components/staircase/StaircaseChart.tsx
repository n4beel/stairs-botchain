"use client";

import React, { useState } from "react";
import { formatEther } from "viem";
import { priceAt } from "@/lib/stairs";

interface StaircaseChartProps {
  cap: number;
  supply: number;
  base: bigint;
  step: bigint;
  userHeld?: number;
  compact?: boolean;
}

export function StaircaseChart({
  cap,
  supply,
  base,
  step,
  userHeld = 0,
  compact = false,
}: StaircaseChartProps) {
  const [showTable, setShowTable] = useState(false);

  // If cap > 100, group steps in blocks of 10 for readability in the visual chart
  const isGrouped = cap > 100;
  const blockSize = isGrouped ? 10 : 1;
  const totalSteps = Math.ceil(cap / blockSize);
  const currentStepIndex = Math.min(supply, cap);

  // SVG dimensions
  const svgWidth = compact ? 280 : 640;
  const svgHeight = compact ? 120 : 260;
  const paddingLeft = compact ? 30 : 60;
  const paddingBottom = compact ? 20 : 36;
  const paddingTop = compact ? 10 : 20;
  const paddingRight = 16;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const stepWidth = chartWidth / totalSteps;

  // Prices calculation
  const minPrice = priceAt(base, step, 0);
  const maxPrice = priceAt(base, step, Math.max(0, cap - 1));

  // User copies flags: user holds copies from (supply - userHeld) to supply - 1
  const userStart = Math.max(0, supply - userHeld);
  const userEnd = supply;

  // Render steps
  const renderedSteps = [];
  for (let idx = 0; idx < totalSteps; idx++) {
    const rawStepIndex = idx * blockSize;
    const p = priceAt(base, step, rawStepIndex);
    const heightRatio =
      maxPrice > minPrice
        ? (Number((p - minPrice) * 1000n / (maxPrice - minPrice)) / 1000) * 0.85 + 0.15
        : 1.0;
    const stepHeight = chartHeight * Math.max(0.1, Math.min(1, heightRatio));

    const x = paddingLeft + idx * stepWidth;
    const y = paddingTop + chartHeight - stepHeight;

    const isSold = rawStepIndex + blockSize <= supply;
    const isNext = !isSold && rawStepIndex <= supply && supply < cap;
    const isFuture = !isSold && !isNext;

    // Is user holding this step?
    const hasUserCopy =
      userHeld > 0 &&
      rawStepIndex >= userStart &&
      rawStepIndex < userEnd;

    renderedSteps.push({
      idx,
      rawStepIndex,
      x,
      y,
      stepWidth,
      stepHeight,
      isSold,
      isNext,
      isFuture,
      hasUserCopy,
      price: p,
    });
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] font-condensed">
          Staircase Curve {isGrouped ? "(10-step blocks)" : ""}
        </span>
        <button
          type="button"
          onClick={() => setShowTable(!showTable)}
          className="text-xs text-[var(--accent)] underline hover:opacity-80 transition cursor-pointer"
        >
          {showTable ? "View chart" : "View step table (accessible)"}
        </button>
      </div>

      {showTable ? (
        <div className="max-h-60 overflow-y-auto border border-[var(--border-subtle)] rounded bg-[var(--bg-surface)] p-2">
          <table className="w-full text-xs text-left">
            <thead className="border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
              <tr>
                <th className="py-1 px-2">Step</th>
                <th className="py-1 px-2">Price (BOT)</th>
                <th className="py-1 px-2">Status</th>
                {userHeld > 0 && <th className="py-1 px-2">You hold</th>}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.min(cap, 50) }).map((_, i) => {
                const p = priceAt(base, step, i);
                const sold = i < supply;
                const next = i === supply;
                const held = userHeld > 0 && i >= userStart && i < userEnd;
                return (
                  <tr key={i} className="border-b border-[var(--border-subtle)]/30">
                    <td className="py-1 px-2 font-mono">#{i + 1}</td>
                    <td className="py-1 px-2 font-mono">{formatEther(p)}</td>
                    <td className="py-1 px-2">
                      {sold ? (
                        <span className="text-[var(--text-muted)]">Sold</span>
                      ) : next ? (
                        <span className="text-[var(--accent)] font-semibold">Next</span>
                      ) : (
                        <span className="text-[var(--text-muted)]/50">Available</span>
                      )}
                    </td>
                    {userHeld > 0 && (
                      <td className="py-1 px-2">
                        {held ? <span className="text-[var(--accent)] font-bold">★ Yes</span> : "—"}
                      </td>
                    )}
                  </tr>
                );
              })}
              {cap > 50 && (
                <tr>
                  <td colSpan={userHeld > 0 ? 4 : 3} className="py-2 px-2 text-center text-[var(--text-muted)]">
                    ... and {cap - 50} more steps up to {formatEther(maxPrice)} BOT
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="w-full overflow-x-auto border border-[var(--border-subtle)] rounded bg-[var(--bg-surface)] p-2">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto min-w-[280px] max-w-full block select-none"
            role="img"
            aria-label={`Staircase bonding curve with ${cap} steps. Current supply is ${supply}.`}
          >
            {/* Price axis line */}
            <line
              x1={paddingLeft}
              y1={paddingTop}
              x2={paddingLeft}
              y2={paddingTop + chartHeight}
              stroke="var(--border-default)"
              strokeWidth="1.5"
            />
            {/* Baseline */}
            <line
              x1={paddingLeft}
              y1={paddingTop + chartHeight}
              x2={svgWidth - paddingRight}
              y2={paddingTop + chartHeight}
              stroke="var(--border-default)"
              strokeWidth="1.5"
            />

            {/* Price axis labels */}
            {!compact && (
              <>
                <text
                  x={paddingLeft - 8}
                  y={paddingTop + 10}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--text-muted)"
                  fontFamily="monospace"
                >
                  {Number(formatEther(maxPrice)).toFixed(3)}
                </text>
                <text
                  x={paddingLeft - 8}
                  y={paddingTop + chartHeight}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--text-muted)"
                  fontFamily="monospace"
                >
                  {Number(formatEther(minPrice)).toFixed(3)}
                </text>
                <text
                  x={paddingLeft - 8}
                  y={paddingTop + chartHeight / 2}
                  textAnchor="end"
                  fontSize="9"
                  fill="var(--text-muted)"
                  transform={`rotate(-90 ${paddingLeft - 18} ${paddingTop + chartHeight / 2})`}
                >
                  Price (BOT)
                </text>
              </>
            )}

            {/* Steps */}
            {renderedSteps.map((s) => {
              let fillColor = "transparent";
              let strokeColor = "var(--border-subtle)";
              let strokeWidth = 1;

              if (s.isSold) {
                fillColor = "var(--accent)";
                strokeColor = "var(--accent)";
              } else if (s.isNext) {
                fillColor = "rgba(114, 9, 183, 0.15)";
                strokeColor = "var(--accent)";
                strokeWidth = 2;
              } else {
                fillColor = "rgba(44, 167, 183, 0.08)";
                strokeColor = "var(--border-subtle)";
              }

              return (
                <g key={s.idx} className="step-riser">
                  <rect
                    x={s.x}
                    y={s.y}
                    width={Math.max(1, s.stepWidth - 1)}
                    height={s.stepHeight}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    rx="1"
                  />

                  {/* Flag if user holds this step */}
                  {s.hasUserCopy && (
                    <circle
                      cx={s.x + s.stepWidth / 2}
                      cy={Math.max(paddingTop, s.y - 6)}
                      r={compact ? 2 : 4}
                      fill="#FFB703"
                      stroke="var(--text-primary)"
                      strokeWidth="1"
                    />
                  )}

                  {/* If next step, highlight with label on riser */}
                  {s.isNext && !compact && (
                    <text
                      x={s.x + s.stepWidth / 2}
                      y={s.y - 8}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="bold"
                      fill="var(--accent)"
                      fontFamily="monospace"
                    >
                      {formatEther(s.price)}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Baseline tick for current supply */}
            <text
              x={paddingLeft + (currentStepIndex / cap) * chartWidth}
              y={paddingTop + chartHeight + 16}
              textAnchor="middle"
              fontSize="10"
              fill="var(--text-primary)"
              fontFamily="var(--font-barlow-condensed)"
              fontWeight="bold"
            >
              {supply}/{cap} sold
            </text>
          </svg>
        </div>
      )}
    </div>
  );
}
