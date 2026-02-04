'use client'

import { useMemo } from 'react'

interface DataPoint {
  date: string
  value: number
}

interface ProgressChartProps {
  data: DataPoint[]
  label: string
  color?: string
  unit?: string
}

export default function ProgressChart({ data, label, color = '#facc15', unit = 'kg' }: ProgressChartProps) {
  const chartData = useMemo(() => {
    if (data.length === 0) return { points: [], min: 0, max: 100 }
    
    const values = data.map(d => d.value)
    const min = Math.floor(Math.min(...values) * 0.9)
    const max = Math.ceil(Math.max(...values) * 1.1)
    
    return { points: data, min, max }
  }, [data])

  if (data.length === 0) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
        <p className="text-zinc-500 text-sm">No data yet for {label}</p>
      </div>
    )
  }

  const { points, min, max } = chartData
  const range = max - min || 1
  
  // Calculate chart dimensions
  const width = 100 // percentage
  const height = 80 // px
  const padding = { top: 10, right: 10, bottom: 25, left: 35 }
  
  // Create SVG path
  const getY = (value: number) => {
    const normalized = (value - min) / range
    return height - padding.bottom - (normalized * (height - padding.top - padding.bottom))
  }
  
  const getX = (index: number) => {
    if (points.length === 1) return 50
    return padding.left + (index / (points.length - 1)) * (100 - padding.left - padding.right)
  }
  
  // Build SVG path
  const pathD = points
    .map((point, i) => {
      const x = getX(i)
      const y = getY(point.value)
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  // Get latest value and change
  const latestValue = points[points.length - 1]?.value || 0
  const previousValue = points.length > 1 ? points[points.length - 2]?.value : latestValue
  const change = latestValue - previousValue
  const changePercent = previousValue > 0 ? ((change / previousValue) * 100).toFixed(1) : '0'

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
        <span className="text-white font-medium text-sm">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-sm">{latestValue}{unit}</span>
          {change !== 0 && (
            <span className={`text-xs font-medium ${change > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {change > 0 ? '+' : ''}{changePercent}%
            </span>
          )}
        </div>
      </div>
      
      {/* Chart */}
      <div className="px-2 py-3">
        <svg 
          viewBox={`0 0 100 ${height}`} 
          className="w-full"
          preserveAspectRatio="none"
          style={{ height: `${height}px` }}
        >
          {/* Grid lines */}
          <line 
            x1={padding.left} 
            y1={getY(min)} 
            x2={100 - padding.right} 
            y2={getY(min)} 
            stroke="#27272a" 
            strokeWidth="0.5" 
          />
          <line 
            x1={padding.left} 
            y1={getY((min + max) / 2)} 
            x2={100 - padding.right} 
            y2={getY((min + max) / 2)} 
            stroke="#27272a" 
            strokeWidth="0.5" 
          />
          <line 
            x1={padding.left} 
            y1={getY(max)} 
            x2={100 - padding.right} 
            y2={getY(max)} 
            stroke="#27272a" 
            strokeWidth="0.5" 
          />
          
          {/* Y-axis labels */}
          <text x={padding.left - 2} y={getY(max) + 1} fill="#71717a" fontSize="6" textAnchor="end">
            {max}
          </text>
          <text x={padding.left - 2} y={getY((min + max) / 2) + 1} fill="#71717a" fontSize="6" textAnchor="end">
            {Math.round((min + max) / 2)}
          </text>
          <text x={padding.left - 2} y={getY(min) + 1} fill="#71717a" fontSize="6" textAnchor="end">
            {min}
          </text>
          
          {/* Area fill */}
          <path
            d={`${pathD} L ${getX(points.length - 1)} ${height - padding.bottom} L ${getX(0)} ${height - padding.bottom} Z`}
            fill={color}
            fillOpacity="0.1"
          />
          
          {/* Line */}
          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Points */}
          {points.map((point, i) => (
            <circle
              key={i}
              cx={getX(i)}
              cy={getY(point.value)}
              r="2"
              fill={color}
            />
          ))}
          
          {/* X-axis labels */}
          {points.length <= 7 ? points.map((point, i) => (
            <text 
              key={i}
              x={getX(i)} 
              y={height - 5} 
              fill="#71717a" 
              fontSize="5" 
              textAnchor="middle"
            >
              {formatDate(point.date)}
            </text>
          )) : (
            <>
              <text x={getX(0)} y={height - 5} fill="#71717a" fontSize="5" textAnchor="middle">
                {formatDate(points[0].date)}
              </text>
              <text x={getX(points.length - 1)} y={height - 5} fill="#71717a" fontSize="5" textAnchor="middle">
                {formatDate(points[points.length - 1].date)}
              </text>
            </>
          )}
        </svg>
      </div>
    </div>
  )
}
