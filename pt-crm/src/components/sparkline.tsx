/** Lightweight SVG sparkline / bar chart — no chart library */

export function Sparkline({
  values,
  width = 160,
  height = 40,
  stroke = "#34d399",
  fill = "rgba(52, 211, 153, 0.12)",
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  className?: string;
}) {
  if (values.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        className={className}
        aria-hidden
      >
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="#3f3f46"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 2;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const y =
      height - pad - ((v - min) / range) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0]},${height} L${pts[0][0]},${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
    >
      <path d={area} fill={fill} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={pts[pts.length - 1][0]}
        cy={pts[pts.length - 1][1]}
        r={2.5}
        fill={stroke}
      />
    </svg>
  );
}

export function BarChart({
  values,
  labels,
  width = 320,
  height = 100,
  barColor = "#34d399",
  emptyColor = "#27272a",
  className,
}: {
  values: number[];
  labels?: string[];
  width?: number;
  height?: number;
  barColor?: string;
  emptyColor?: string;
  className?: string;
}) {
  const n = values.length || 1;
  const max = Math.max(...values, 1);
  const gap = 4;
  const barW = (width - gap * (n + 1)) / n;
  const labelH = labels?.length ? 16 : 0;
  const chartH = height - labelH;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      role="img"
    >
      {values.map((v, i) => {
        const h = (v / max) * (chartH - 4);
        const x = gap + i * (barW + gap);
        const y = chartH - h;
        return (
          <g key={i}>
            <rect
              x={x}
              y={0}
              width={barW}
              height={chartH}
              fill={emptyColor}
              rx={3}
              opacity={0.35}
            />
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, v > 0 ? 3 : 0)}
              fill={v > 0 ? barColor : "transparent"}
              rx={3}
            />
            {labels?.[i] && (
              <text
                x={x + barW / 2}
                y={height - 2}
                textAnchor="middle"
                fill="#71717a"
                fontSize={9}
              >
                {labels[i]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
