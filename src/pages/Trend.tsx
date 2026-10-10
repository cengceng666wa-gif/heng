/**
 * 趋势页：体重曲线 + TDEE 面板。
 *
 * 这里回答三个问题：
 *   1. 我在往目标走吗？（趋势线，不是单日数字）
 *   2. 我的真实消耗是多少？（自适应 TDEE）
 *   3. 我还差多久？（按当前速率外推）
 */

import { useMemo, useState } from 'react'
import { upsertWeight } from '../db'
import type { Profile } from '../types'
import type { Computed } from '../lib/compute'
import { todayISO, weeksToGoal } from '../lib/tdee'
import WeightChart from '../components/WeightChart'

interface Props {
  profile: Profile
  computed: Computed
  onChanged: () => void | Promise<void>
}

export default function Trend({ profile, computed, onChanged }: Props) {
  const [kg, setKg] = useState('')
  const [standard, setStandard] = useState(true)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const trend = computed.trend
  const latest = trend.length > 0 ? trend[trend.length - 1] : null

  const stats = useMemo(() => {
    if (!latest) {
      return { change: 0, toGoal: 0, perWeek: null as number | null, weeks: 0 }
    }
    const change = latest.trend - profile.startWeightKg
    const toGoal = latest.trend - profile.targetWeightKg

    // 用最近 21 天趋势算实际速率，比用目标速率真实
    let perWeek: number | null = null
    if (trend.length >= 8) {
      const window = trend.slice(-21)
      const first = window[0]
      const days = window.length - 1
      if (days >= 7) {
        perWeek = ((latest.trend - first.trend) / days) * 7
      }
    }

    const weeks = perWeek && perWeek < 0 ? toGoal / -perWeek : weeksToGoal(profile, latest.trend)
    return { change, toGoal, perWeek, weeks }
  }, [trend, latest, profile])

  async function save() {
    const v = parseFloat(kg)
    if (!Number.isFinite(v) || v <= 0) {
      setMsg('请输入有效体重')
      return
    }
    setSaving(true)
    try {
      await upsertWeight({
        date: todayISO(),
        kg: v,
        standard,
        note: note.trim() || undefined,
        createdAt: new Date().toISOString()
      })
      setKg('')
      setNote('')
      setMsg('已记录')
      await onChanged()
      setTimeout(() => setMsg(null), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">趋势</h1>

      {/* 记录体重 */}
      <div className="card">
        <div className="card-title">记录今天的体重</div>
        <div className="row" style={{ gap: 8 }}>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder={latest ? `上次 ${latest.trend.toFixed(1)}` : '如 89.5'}
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            style={{ flex: 1 }}
          />
          <span className="muted">kg</span>
          <button className="btn primary" disabled={saving} onClick={() => void save()}>
            记录
          </button>
        </div>

        <div className="chips" style={{ marginTop: 10, marginBottom: 0 }}>
          <button
            className={`chip${standard ? ' on' : ''}`}
            onClick={() => setStandard(true)}
          >
            标准（晨起排空）
          </button>
          <button
            className={`chip${!standard ? ' on' : ''}`}
            onClick={() => setStandard(false)}
          >
            非标准（训练后等）
          </button>
        </div>
        <div className="field-hint">
          {standard
            ? '最干净的条件。数据算全权重。'
            : '已降权处理，不会把趋势带偏——但别频繁在脱水状态下称。'}
        </div>

        {msg && (
          <div className="alert info" style={{ marginTop: 10, marginBottom: 0 }}>
            {msg}
          </div>
        )}
      </div>

      {/* 曲线 */}
      <div className="card">
        <div className="card-title">
          <span>体重曲线</span>
          <span className="faint num">
            {latest ? `${latest.trend.toFixed(1)} kg` : '暂无数据'}
          </span>
        </div>
        <WeightChart points={trend} targetKg={profile.targetWeightKg} />

        {trend.length > 0 && (
          <div className="stat-grid" style={{ marginTop: 14 }}>
            <div className="stat">
              <div
                className="v num"
                style={{ color: stats.change <= 0 ? 'var(--ok)' : 'var(--bad)' }}
              >
                {stats.change >= 0 ? '+' : ''}
                {stats.change.toFixed(1)}
              </div>
              <div className="l">较起始 {profile.startWeightKg}kg</div>
            </div>
            <div className="stat">
              <div className="v num">{Math.max(0, stats.toGoal).toFixed(1)}</div>
              <div className="l">距目标 {profile.targetWeightKg}kg</div>
            </div>
            <div className="stat">
              <div className="v num">
                {stats.perWeek === null ? '—' : `${stats.perWeek.toFixed(2)}`}
              </div>
              <div className="l">实际 kg/周（近 3 周）</div>
            </div>
            <div className="stat">
              <div className="v num">
                {Number.isFinite(stats.weeks) && stats.weeks > 0
                  ? `${Math.ceil(stats.weeks)}`
                  : '—'}
              </div>
              <div className="l">预计还需周数</div>
            </div>
          </div>
        )}

        {stats.perWeek !== null && stats.perWeek > -0.1 && trend.length >= 8 && (
          <div className="alert warn" style={{ marginTop: 10, marginBottom: 0 }}>
            近 3 周趋势几乎没动。这不一定是吃多了——体重下降后消耗会跟着降，
            自适应 TDEE 会把新目标算出来。先确认饮食记录有没有漏记。
          </div>
        )}
      </div>

      {/* TDEE 面板 */}
      <div className="card">
        <div className="card-title">代谢估算</div>

        <div className="stat-grid">
          <div className="stat">
            <div className="v num">{computed.tdee}</div>
            <div className="l">
              当前 TDEE
              <br />
              <span style={{ color: 'var(--fg-dim)' }}>{sourceLabel(computed)}</span>
            </div>
          </div>
          <div className="stat">
            <div className="v num">{computed.bmr.value.toFixed(0)}</div>
            <div className="l">
              基础代谢 BMR
              <br />
              <span style={{ color: 'var(--fg-dim)' }}>
                {computed.bmr.used === 'blend' ? '两式折中' : 'Mifflin 公式'}
              </span>
            </div>
          </div>
        </div>

        {computed.bmr.katch !== null && (
          <div className="faint" style={{ marginTop: 8 }}>
            对照：Mifflin {computed.bmr.mifflin.toFixed(0)} · Katch-McArdle{' '}
            {computed.bmr.katch.toFixed(0)} kcal
          </div>
        )}

        {computed.adaptive ? (
          <div style={{ marginTop: 12 }}>
            <div className="stat-grid">
              <div className="stat">
                <div className="v num">{Math.round(computed.adaptive.avgIntake)}</div>
                <div className="l">窗口内平均摄入</div>
              </div>
              <div className="stat">
                <div className="v num">
                  {computed.adaptive.deltaKg >= 0 ? '+' : ''}
                  {computed.adaptive.deltaKg.toFixed(2)}
                </div>
                <div className="l">趋势体重变化 kg</div>
              </div>
            </div>
            <div className="alert info" style={{ marginTop: 10, marginBottom: 0 }}>
              用 {computed.adaptive.windowDays} 天数据反推：
              <br />
              摄入 {Math.round(computed.adaptive.avgIntake)} − (
              {computed.adaptive.deltaKg.toFixed(2)} × 7700 ÷{' '}
              {computed.adaptive.windowDays}) = <b>{computed.tdee} kcal</b>
              <br />
              可信度 {Math.round(computed.adaptive.confidence * 100)}%
              （有记录的 {computed.adaptive.loggedDays} 天）
            </div>
          </div>
        ) : (
          <div className="alert info" style={{ marginTop: 12, marginBottom: 0 }}>
            自适应 TDEE 还在攒数据。
            需要<b>至少 10 天</b>的体重 + 饮食记录才能反推真实消耗。
            {computed.adaptiveDaysNeeded > 0 && (
              <>
                <br />
                当前还差约 {computed.adaptiveDaysNeeded} 天。
              </>
            )}
            <br />
            在那之前用的是公式估算值，误差可能有 ±300–500 kcal。
          </div>
        )}
      </div>

      {/* 目标 */}
      <div className="card">
        <div className="card-title">目标设定</div>
        <div className="faint" style={{ lineHeight: 1.7 }}>
          目标热量 <b className="num">{computed.targets.kcal}</b> kcal
          （缺口 <b className="num">{computed.targets.deficit}</b> kcal，
          占 TDEE 的 <b className="num">
            {(computed.targets.deficitPct * 100).toFixed(0)}%
          </b>）
          <br />
          蛋白 <b className="num">{computed.targets.protein}</b>g · 脂肪{' '}
          <b className="num">{computed.targets.fat}</b>g · 碳水{' '}
          <b className="num">{computed.targets.carb}</b>g
          <br />
          速率 <b className="num">{profile.rateKgPerWeek}</b> kg/周
        </div>
        {computed.targets.warnings.map((w, i) => (
          <div className="alert warn" key={i} style={{ marginTop: 10, marginBottom: 0 }}>
            {w}
          </div>
        ))}
      </div>
    </div>
  )
}

function sourceLabel(c: Computed): string {
  if (c.tdeeSource === 'override') return '手动设定'
  if (c.tdeeSource === 'adaptive') return '自适应实测'
  return '公式估算'
}
