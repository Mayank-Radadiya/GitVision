"use client";

/**
 * Sparkline — a trend with no axes.
 *
 * Extracted from `contributor-widget.tsx`, where it was private to one file and
 * therefore untestable. It is now used by three surfaces, which is what finally
 * justified the extraction.
 *
 * Flat series are not an error case: a contributor with one commit a day draws
 * the same line as one with ten, and that is the correct reading. Dividing by a
 * zero max would produce `NaN` coordinates and silently vanish.
 */

interface SparklineProps {
  data: number[];
  /** Tailwind colour class for the stroke; the end dot uses `fill-current`. */
  className?: string;
  width?: number;
  height?: number;
  /** Renders an area fill beneath the line. Off for the 18px row variant. */
  filled?: boolean;
  label?: string;
}

function Sparkline({
  data,
  className,
  width = 56,
  height = 18,
  filled = false,
  label,
}: SparklineProps) {
  const safeData = data.length > 0 ? data : [0];
  const max = Math.max(...safeData, 1);
  const pad = 2;
  const innerHeight = height - pad * 2;
  const step =
    safeData.length > 1 ? width / (safeData.length - 1) : width;

  const points = safeData
    .map((value, index) => {
      const x = index * step;
      const y = height - pad - (value / max) * innerHeight;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const areaPath =
    filled && safeData.length > 1
      ? `M0,${height} L${points.replace(/ /g, " L")} L${width},${height} Z`
      : null;

  const lastIndex = safeData.length - 1;
  const lastX = lastIndex * step;
  const lastY = height - pad - (safeData[lastIndex]! / max) * innerHeight;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role={label ? "img" : "presentation"}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      preserveAspectRatio="none"
    >
      {areaPath && <path d={areaPath} fill="currentColor" opacity={0.1} />}
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {safeData.length > 1 && (
        <circle cx={lastX} cy={lastY} r={2} fill="currentColor" />
      )}
    </svg>
  );
}

export { Sparkline };
export default Sparkline;