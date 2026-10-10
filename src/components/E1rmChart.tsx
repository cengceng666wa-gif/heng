/**
 * e1RM 进度曲线。
 *
 * e1RM（估算 1RM）是渐进超负荷唯一可量化的证据。
 * 重量没变但次数上去了，它也会涨——这正是新手最常发生却看不见的进步。
 *
 * 手写 SVG，和体重曲线共用同一套视觉语言。
 */

import type { E1rmPoint } from '../lib/analytics'

interface Props {
  points: E1rmPoint[]
  height?: number
}

export default function E1rmChart({ points, height = 150 }: Props) {
  if (points.length < 2) {
    return (
      <div className="empty" style={{ padding: '20px 12px', fontSize: 12.5 }}>
        {points.length === 0
          ? '这个动作还没有带重量的记录。'
          : '只记录了一次，再来一次就能看出趋势。'}
      </div>
    )
  }

  const W = 320
  const H = height
  const PAD = { l: 38, r: 12, t: 14, b: 22 }

  const values = points.map((p) => p.value)
  let min = Math.min(...values)
  let max = Math.max(...values)
  const span = Math.max(1, max - min)
  min -= span * 0.15
  max += span * 0.15

  const x = (i: number) => PAD.l + (i / (points.length - 1)) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b)

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join(' ')

  const gridCount = 3
  const grid = Array.from({ length: gridCount + 1 }, (_, i) => {
    const v = min + ((max - min) * i) / gridCount
    return { v, y: y(v) }
  })

  const first = points[0]
  const last = points[points.length - 1]
  const gain = last.value - first.value
  const gainPct = first.value > 0 ? (gain / first.value) * 100 : 0
  const unreliable = points.some((p) => !p.reliable)

  return (
    <div className="chart-wrap">
      <div className="row-between" style={{ marginBottom: 6, padding: '0 4px' }}>
        <span className="faint num">
          {first.value} → {last.value} kg e1RM
        </span>
        <span
          className="num"
          style={{
            fontSize: 13,
            fontWeight: 650,
            color: gain >= 0 ? 'var(--ok)' : 'var(--bad)'
          }}
        >
          {gain >= 0 ? '+' : ''}
          {gain.toFixed(1)} kg（{gainPct >= 0 ? '+' : ''}
          {gainPct.toFixed(1)}%）
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        {grid.map((g, i) => (
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
              {g.v.toFixed(0)}
            </text>
          </g>
        ))}

        <path
          d={path}
          fill="none"
          stroke="var(--carb)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map((p, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(p.value)}
            r={p.reliable ? 2.6 : 2.2}
            fill={p.reliable ? 'var(--carb)' : 'none'}
            stroke="var(--carb)"
            strokeWidth={p.reliable ? 0 : 1.4}
          />
        ))}

        <text x={PAD.l} y={H - 5} fontSize={8.5} fill="var(--fg-faint)">
          {md(first.date)}
        </text>
        <text x={W - PAD.r} y={H - 5} textAnchor="end" fontSize={8.5} fill="var(--fg-faint)">
          {md(last.date)}
        </text>
      </svg>

      <div className="chart-legend">
        <span>
          <span className="dot" style={{ background: 'var(--carb)' }} />
          e1RM 估算值
        </span>
        {unreliable && (
          <span>
            <span
              className="dot"
              style={{ background: 'transparent', border: '1.4px solid var(--carb)' }}
            />
            次数 &gt;12，误差偏大
          </span>
        )}
      </div>
    </div>
  )
}

function md(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${Number(m)}/${Number(d)}`
}
