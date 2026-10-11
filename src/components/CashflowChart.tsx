import React, { useState, useRef } from 'react';

export interface ChartDataPoint {
  name: string;
  fullDate?: string;
  Sell: number;
  Expense: number;
  Profit: number;
}

interface CashflowChartProps {
  data: ChartDataPoint[];
  chartType: 'line' | 'bar';
}

export function CashflowChart({ data, chartType }: CashflowChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!data || data.length === 0) {
    return (
      <div className="h-64 sm:h-80 w-full flex items-center justify-center text-gray-400 text-xs font-semibold">
        No transaction data available for this period.
      </div>
    );
  }

  // Calculate scales
  const maxVal = Math.max(
    ...data.map(d => Math.max(d.Sell || 0, d.Expense || 0, d.Profit || 0)),
    100
  );
  // Round up maxVal for pleasant grid ticks
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)));
  const ceiling = Math.ceil(maxVal / magnitude) * magnitude;
  const gridTicks = [0, Math.round(ceiling * 0.33), Math.round(ceiling * 0.66), ceiling];

  // SVG dimensions & margins
  const width = 800;
  const height = 320;
  const paddingLeft = 55;
  const paddingRight = 25;
  const paddingTop = 20;
  const paddingBottom = 45;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const getX = (index: number) => {
    if (data.length === 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (data.length - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    const clamped = Math.max(0, val);
    const ratio = clamped / ceiling;
    return paddingTop + chartHeight - ratio * chartHeight;
  };

  // Build SVG path for line chart
  const buildLinePath = (key: 'Sell' | 'Expense' | 'Profit') => {
    if (data.length === 0) return '';
    if (data.length === 1) {
      const x = getX(0);
      const y = getY(data[0][key] || 0);
      return `M ${x - 20} ${y} L ${x + 20} ${y}`;
    }

    return data.reduce((path, d, i) => {
      const x = getX(i);
      const y = getY(d[key] || 0);
      if (i === 0) return `M ${x} ${y}`;
      // Smooth curve using cubic bezier control points
      const prevX = getX(i - 1);
      const prevY = getY(data[i - 1][key] || 0);
      const cx1 = prevX + (x - prevX) / 2;
      const cy1 = prevY;
      const cx2 = prevX + (x - prevX) / 2;
      const cy2 = y;
      return `${path} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x} ${y}`;
    }, '');
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const relativeY = e.clientY - rect.top;

    // Convert relativeX in container to SVG viewBox coordinate
    const scaleX = width / rect.width;
    const svgX = relativeX * scaleX;

    if (svgX < paddingLeft - 20 || svgX > width - paddingRight + 20) {
      setHoveredIndex(null);
      setMousePos(null);
      return;
    }

    // Find nearest data point
    let closestIndex = 0;
    let minDistance = Infinity;
    data.forEach((_, i) => {
      const pointX = getX(i);
      const dist = Math.abs(svgX - pointX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = i;
      }
    });

    setHoveredIndex(closestIndex);
    setMousePos({ x: relativeX, y: relativeY });
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
    setMousePos(null);
  };

  const activePoint = hoveredIndex !== null ? data[hoveredIndex] : null;

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full select-none cursor-crosshair"
    >
      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        className="w-full h-auto max-h-[380px] overflow-visible"
      >
        {/* Horizontal gridlines */}
        {gridTicks.map((tick, i) => {
          const y = getY(tick);
          return (
            <g key={i}>
              <line 
                x1={paddingLeft} 
                y1={y} 
                x2={width - paddingRight} 
                y2={y} 
                stroke="#e2e8f0" 
                strokeDasharray={i === 0 ? undefined : '3 3'}
                strokeWidth={1}
              />
              <text 
                x={paddingLeft - 8} 
                y={y + 4} 
                textAnchor="end" 
                fontSize="10" 
                fill="#64748b" 
                fontWeight="500"
              >
                {tick >= 1000 ? `${(tick / 1000).toFixed(0)}k` : tick}
              </text>
            </g>
          );
        })}

        {/* X-Axis labels */}
        {data.map((d, i) => {
          // If too many items (e.g. > 15), skip odd ones for cleanliness
          if (data.length > 15 && i % 2 !== 0 && i !== data.length - 1) return null;
          const x = getX(i);
          const isSelected = hoveredIndex === i;

          return (
            <text 
              key={i} 
              x={x} 
              y={height - paddingBottom + 18} 
              textAnchor="middle" 
              fontSize="10" 
              fill={isSelected ? '#084b3e' : '#64748b'} 
              fontWeight={isSelected ? '700' : '500'}
            >
              {d.name}
            </text>
          );
        })}

        {/* Vertical hover guide line */}
        {hoveredIndex !== null && (
          <line
            x1={getX(hoveredIndex)}
            y1={paddingTop}
            x2={getX(hoveredIndex)}
            y2={paddingTop + chartHeight}
            stroke="#94a3b8"
            strokeDasharray="3 3"
            strokeWidth={1.5}
          />
        )}

        {/* Render Bar Chart */}
        {chartType === 'bar' && (() => {
          const slotWidth = chartWidth / data.length;
          const barWidth = Math.max(3, Math.min(14, (slotWidth - 8) / 3));

          return data.map((d, i) => {
            const centerX = data.length === 1 ? getX(0) : paddingLeft + (i + 0.5) * slotWidth;
            const isHovered = hoveredIndex === i;

            // 3 bars per group: Sell, Expense, Profit
            const sellY = getY(d.Sell || 0);
            const sellH = Math.max(0, (paddingTop + chartHeight) - sellY);

            const expY = getY(d.Expense || 0);
            const expH = Math.max(0, (paddingTop + chartHeight) - expY);

            const profY = getY(d.Profit || 0);
            const profH = Math.max(0, (paddingTop + chartHeight) - profY);

            return (
              <g key={i} opacity={hoveredIndex !== null && !isHovered ? 0.45 : 1}>
                {/* Sell Bar */}
                <rect
                  x={centerX - barWidth * 1.5 - 1}
                  y={sellY}
                  width={barWidth}
                  height={sellH}
                  fill="#2563eb"
                  rx="2"
                  className="transition-all duration-150"
                />
                {/* Expense Bar */}
                <rect
                  x={centerX - barWidth * 0.5}
                  y={expY}
                  width={barWidth}
                  height={expH}
                  fill="#ef4444"
                  rx="2"
                  className="transition-all duration-150"
                />
                {/* Profit Bar */}
                <rect
                  x={centerX + barWidth * 0.5 + 1}
                  y={profY}
                  width={barWidth}
                  height={profH}
                  fill="#10b981"
                  rx="2"
                  className="transition-all duration-150"
                />
              </g>
            );
          });
        })()}

        {/* Render Line Chart */}
        {chartType === 'line' && (
          <>
            {/* 1. Sell Line */}
            <path
              d={buildLinePath('Sell')}
              fill="none"
              stroke="#2563eb"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* 2. Expense Line */}
            <path
              d={buildLinePath('Expense')}
              fill="none"
              stroke="#ef4444"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* 3. Profit Line */}
            <path
              d={buildLinePath('Profit')}
              fill="none"
              stroke="#10b981"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Dots on Hovered Point */}
            {hoveredIndex !== null && activePoint && (
              <g>
                {/* Sell Dot */}
                <circle
                  cx={getX(hoveredIndex)}
                  cy={getY(activePoint.Sell || 0)}
                  r={5}
                  fill="#2563eb"
                  stroke="#ffffff"
                  strokeWidth={2}
                />
                {/* Expense Dot */}
                <circle
                  cx={getX(hoveredIndex)}
                  cy={getY(activePoint.Expense || 0)}
                  r={5}
                  fill="#ef4444"
                  stroke="#ffffff"
                  strokeWidth={2}
                />
                {/* Profit Dot */}
                <circle
                  cx={getX(hoveredIndex)}
                  cy={getY(activePoint.Profit || 0)}
                  r={5}
                  fill="#10b981"
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              </g>
            )}
          </>
        )}
      </svg>

      {/* Floating HTML Tooltip */}
      {hoveredIndex !== null && activePoint && mousePos && (
        <div
          className="absolute z-20 pointer-events-none bg-white/95 backdrop-blur-xs p-3 rounded-xl shadow-xl border border-gray-200 text-xs min-w-[170px] animate-in fade-in duration-100"
          style={{
            left: Math.min(Math.max(mousePos.x + 12, 10), (containerRef.current?.clientWidth || 300) - 180),
            top: Math.max(mousePos.y - 70, 5)
          }}
        >
          <div className="font-bold text-gray-900 pb-1.5 mb-1.5 border-b border-gray-100">
            {activePoint.fullDate || activePoint.name}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-gray-700">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-[#2563eb] inline-block" />
                Sell:
              </span>
              <span className="font-bold font-mono">Tk {(activePoint.Sell || 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-gray-700">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-[#ef4444] inline-block" />
                Expense:
              </span>
              <span className="font-bold font-mono">Tk {(activePoint.Expense || 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-gray-700">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-[#10b981] inline-block" />
                Profit:
              </span>
              <span className="font-bold font-mono text-emerald-600">Tk {(activePoint.Profit || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
