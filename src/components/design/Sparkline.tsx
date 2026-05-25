// CAREERFLOW: redesign — tiny inline SVG sparkline for dashboard stat cards.
// Pure SVG (no chart lib) so it renders crisply at small sizes.

export default function Sparkline({
  data,
  width = 88,
  height = 28,
  stroke = "var(--grade-a)",
  className,
}: {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  className?: string;
}) {
  if (!data || data.length < 2) {
    return <svg width={width} height={height} className={className} aria-hidden />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);
  const pad = 2;
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = pad + (height - pad * 2) * (1 - (v - min) / span);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      fill="none"
      aria-hidden
    >
      <polyline
        points={points.join(" ")}
        stroke={stroke}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
