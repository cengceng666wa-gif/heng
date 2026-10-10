/**
 * 体重趋势图。
 *
 * 手写 SVG，不引入图表库——一条线不值得多 100KB 依赖。
 *
 * 关键设计：同时画「原始称重点」和「EWMA 趋势线」。
 * 前者让用户看到真实的波动（一天差 1.5kg 是正常的），
 * 后者才是决策依据。
 */

import type { TrendPoint } from '../lib/tdee'

interface Props {
  points: TrendPoint[]
  targetKg?: number
  height?: number
}

export default function WeightChart({ points, targetKg, height = 170 }: Props) {
  if (points.length < 2) {
    return (
      <div className="empty" style={{ padding: '24px 16px' }}>
        至少记录两天的体重才会出图。
        <br />
        每天早上排空后、吃饭前称，数据最干净。
      </div>
    )
  }

  const W = 320
  const H = height
  const PAD = { l: 36, r: 12, t: 12, b: 22 }

  const trends = points.map((p) => p.trend)
  const raws = points.filter((p) => p.raw !== null).map((p) => p.raw as number)

  let min = Math.min(...trends, ...raws)
  let max = Math.max(...trends, ...raws)
  if (targetKg) {
    min = Math.min(min, targetKg)
    max = Math.max(max, targetKg)
  }
  const span = Math.max(0.5, max - min)
  min -= span * 0.12
  max += span * 0.12

  const x = (i: number) => PAD.l + (i / (points.length - 1)) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b)

  const trendPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.trend)}`).join(' ')

  // 四条水平网格线
  const gridCount = 4
  const gridLines = Array.from({ length: gridCount + 1 }, (_, i) => {
    const v = min + ((max - min) * i) / gridCount
    return { v, y: y(v) }
  })

  // 首尾日期标签
  const firstLabel = shortLabel(points[0].date)
  const lastLabel = shortLabel(points[points.length - 1].date)

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* 网格 */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={g.y}
              y2={g.y}
              stroke="var(--line)"
              strokeWidth={0.6}
              strokeDasharray={i === 0 || i === gridCount ? '0' : '2 3'}
            />
            <text
              x={PAD.l - 5}
              y={g.y + 3.2}
              textAnchor="end"
              fontSize={8.5}
              fill="var(--fg-faint)"
            >
              {g.v.toFixed(1)}
            </text>
          </g>
        ))}

        {/* 目标线 */}
        {targetKg !== undefined && targetKg >= min && targetKg <= max && (
          <g>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(targetKg)}
              y2={y(targetKg)}
              stroke="var(--ok)"
              strokeWidth={1}
              strokeDasharray="4 3"
              opacity={0.75}
            />
            <text
              x={W - PAD.r}
              y={y(targetKg) - 3}
              textAnchor="end"
              fontSize={8.5}
              fill="var(--ok)"
            >
              目标 {targetKg}
            </text>
          </g>
        )}

        {/* 原始称重点 */}
        {points.map((p, i) =>
          p.raw === null ? null : (
            <circle
              key={i}
              cx={x(i)}
              cy={y(p.raw)}
              r={p.standard ? 1.9 : 1.3}
              fill={p.standard ? 'var(--fg-faint)' : 'var(--warn)'}
              opacity={p.standard ? 0.55 : 0.9}
            />
          )
        )}

        {/* 趋势线 */}
        <path
          d={trendPath}
          fill="none"
          stroke="var(--protein)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* 末端点 */}
        <circle
          cx={x(points.length - 1)}
          cy={y(points[points.length - 1].trend)}
          r={3}
          fill="var(--protein)"
        />

        {/* 日期 */}
        <text x={PAD.l} y={H - 6} fontSize={8.5} fill="var(--fg-faint)">
          {firstLabel}
        </text>
        <text x={W - PAD.r} y={H - 6} textAnchor="end" fontSize={8.5} fill="var(--fg-faint)">
          {lastLabel}
        </text>
      </svg>

      <div className="chart-legend">
        <span>
          <span className="dot" style={{ background: 'var(--fg-faint)' }} />
          实际称重
        </span>
        <span>
          <span className="dot" style={{ background: 'var(--protein)' }} />
          趋势（EWMA）
        </span>
        {targetKg !== undefined && (
          <span>
            <span className="dot" style={{ background: 'var(--ok)' }} />
            目标
          </span>
        )}
      </div>
    </div>
  )
}

function shortLabel(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${Number(m)}/${Number(d)}`
}
