/**
 * 报告页 —— 复盘。
 *
 * 训练记录类 App 最容易漏掉的问题：
 * 它们告诉你「上周三练了几组」，但不告诉你「你这周到底做得怎么样」。
 *
 * 五个模块：
 *   1. 本周总览：摄入 / 体重 / 训练完成率
 *   2. 平台期诊断：趋势体重不动时，区分「记漏了」和「代谢适应」
 *   3. Deload 提醒
 *   4. 肌群周组数 vs MEV–MRV
 *   5. 力量进度：e1RM 曲线 + 「该加重了」
 */

import { useCallback, useEffect, useState } from 'react'
import type { Profile } from '../types'
import { MUSCLE_LABEL } from '../types'
import type { Computed } from '../lib/compute'
import {
  deloadAdvice,
  diagnosePlateau,
  e1rmHistory,
  markDeload,
  mondayOf,
  muscleVolume,
  progressionSuggestions,
  weekRange,
  weeklyOverview,
  type DeloadAdvice,
  type E1rmPoint,
  type MuscleVolume,
  type PlateauDiagnosis,
  type ProgressionSuggestion,
  type WeeklyOverview
} from '../lib/analytics'
import { addDays, todayISO } from '../lib/tdee'
import E1rmChart from '../components/E1rmChart'

interface Props {
  profile: Profile
  computed: Computed
  onChanged: () => void | Promise<void>
}

export default function Report({ profile, computed, onChanged }: Props) {
  const [anchor, setAnchor] = useState(todayISO())
  const [overview, setOverview] = useState<WeeklyOverview | null>(null)
  const [muscles, setMuscles] = useState<MuscleVolume[]>([])
  const [plateau, setPlateau] = useState<PlateauDiagnosis | null>(null)
  const [deload, setDeload] = useState<DeloadAdvice | null>(null)
  const [suggestions, setSuggestions] = useState<ProgressionSuggestion[]>([])
  const [openEx, setOpenEx] = useState<number | null>(null)
  const [e1rmPts, setE1rmPts] = useState<E1rmPoint[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const week = mondayOf(anchor)
    const [ov, mv, pl, dl, sg] = await Promise.all([
      weeklyOverview(computed, anchor),
      muscleVolume(anchor),
      diagnosePlateau(computed),
      deloadAdvice(profile),
      progressionSuggestions(todayISO())
    ])
    setOverview(ov)
    setMuscles(mv)
    setPlateau(pl)
    setDeload(dl)
    setSuggestions(sg)
    setLoading(false)
    void week
  }, [anchor, computed, profile])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (openEx === null) return
    void (async () => setE1rmPts(await e1rmHistory(openEx)))()
  }, [openEx])

  const range = weekRange(anchor)
  const isThisWeek = mondayOf(anchor) === mondayOf(todayISO())

  const increases = suggestions.filter((s) => s.action === 'increase')
  const regressions = suggestions.filter((s) => s.action === 'back')

  return (
    <div className="page">
      <h1 className="page-title">报告</h1>

      {/* 周选择 */}
      <div className="row-between" style={{ marginBottom: 12 }}>
        <button className="btn ghost sm" onClick={() => setAnchor(addDays(anchor, -7))}>
          ‹ 上一周
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>
            {isThisWeek ? '本周' : range.label}
          </div>
          <div className="faint">{range.label}</div>
        </div>
        <button
          className="btn ghost sm"
          disabled={isThisWeek}
          style={{ opacity: isThisWeek ? 0.3 : 1 }}
          onClick={() => setAnchor(addDays(anchor, 7))}
        >
          下一周 ›
        </button>
      </div>

      {loading && <div className="empty">读取中…</div>}

      {!loading && overview && (
        <>
          {/* ---------- 1. 本周总览 ---------- */}
          <div className="card">
            <div className="card-title">本周总览</div>

            <div className="stat-grid">
              <div className="stat">
                <div className="v num">{Math.round(overview.avgIntake)}</div>
                <div className="l">平均摄入 kcal（目标 {computed.targets.kcal}）</div>
              </div>
              <div className="stat">
                <div
                  className="v num"
                  style={{
                    color:
                      overview.deltaKg === null
                        ? undefined
                        : overview.deltaKg <= 0
                          ? 'var(--ok)'
                          : 'var(--bad)'
                  }}
                >
                  {overview.deltaKg === null
                    ? '—'
                    : `${overview.deltaKg >= 0 ? '+' : ''}${overview.deltaKg.toFixed(2)}`}
                </div>
                <div className="l">体重变化 kg（趋势）</div>
              </div>
              <div className="stat">
                <div className="v num">
                  {overview.completedSessions}
                  <span style={{ fontSize: 14, color: 'var(--fg-faint)' }}>
                    /{overview.plannedDays}
                  </span>
                </div>
                <div className="l">训练完成</div>
              </div>
              <div className="stat">
                <div className="v num">{overview.totalSets}</div>
                <div className="l">完成组数 · {fmtVolume(overview.volumeKg)}</div>
              </div>
            </div>

            <div className="grid-2" style={{ marginTop: 8 }}>
              <div className="stat">
                <div className="v num">
                  {overview.onTargetDays}
                  <span style={{ fontSize: 13, color: 'var(--fg-faint)' }}>/7</span>
                </div>
                <div className="l">热量达标天数（±5%）</div>
              </div>
              <div className="stat">
                <div className="v num" style={{ color: 'var(--protein)' }}>
                  {overview.proteinHitDays}
                  <span style={{ fontSize: 13, color: 'var(--fg-faint)' }}>/7</span>
                </div>
                <div className="l">蛋白达标天数（≥90%）</div>
              </div>
            </div>

            <div className="faint" style={{ marginTop: 10 }}>
              平均：蛋白 {Math.round(overview.avgProtein)}g · 脂肪{' '}
              {Math.round(overview.avgFat)}g · 碳水 {Math.round(overview.avgCarb)}g
              {overview.loggedDays < 7 && ` · 仅 ${overview.loggedDays} 天有记录`}
            </div>

            {overview.loggedDays > 0 && overview.loggedDays < 5 && (
              <div className="alert warn" style={{ marginTop: 10, marginBottom: 0 }}>
                这周只有 {overview.loggedDays} 天有饮食记录。漏记的日子通常也没少吃，
                平均值会偏低，别拿它做判断依据。
              </div>
            )}

            {/* 完成率评价：用达标天数而不是连续打卡 */}
            {overview.loggedDays >= 5 && (
              <div
                className={`alert ${overview.proteinHitDays >= 4 ? 'info' : 'warn'}`}
                style={{ marginTop: 10, marginBottom: 0 }}
              >
                {rateMessage(overview)}
              </div>
            )}
          </div>

          {/* ---------- 2. 平台期诊断 ---------- */}
          {plateau && (
            <div className="card">
              <div className="card-title">
                <span>平台期诊断</span>
                <span
                  className="faint"
                  style={{ color: plateau.isPlateau ? 'var(--warn)' : undefined }}
                >
                  {plateau.headline}
                </span>
              </div>
              <div className="faint" style={{ lineHeight: 1.65 }}>
                {plateau.detail}
              </div>
              <div
                className={`alert ${plateau.isPlateau ? 'warn' : 'info'}`}
                style={{ marginTop: 10, marginBottom: 0 }}
              >
                {plateau.suggestion}
              </div>
            </div>
          )}

          {/* ---------- 3. Deload ---------- */}
          {deload && deload.weeksTraining > 0 && (
            <div className="card">
              <div className="card-title">
                <span>减载提醒</span>
                <span className="faint">{deload.reason}</span>
              </div>
              <div className="faint" style={{ lineHeight: 1.65 }}>
                {deload.detail}
              </div>
              {deload.needed && (
                <button
                  className="btn block"
                  style={{ marginTop: 12 }}
                  onClick={() => void (async () => {
                    await markDeload(mondayOf(todayISO()))
                    await onChanged()
                    await load()
                  })()}
                >
                  本周已减载，记录一下
                </button>
              )}
              {!deload.needed && deload.weeksSinceDeload !== null && (
                <div className="faint" style={{ marginTop: 8 }}>
                  上次减载：{deload.weeksSinceDeload} 周前
                </div>
              )}
            </div>
          )}

          {/* ---------- 4. 肌群周组数 ---------- */}
          <div className="card">
            <div className="card-title">
              <span>本周肌群训练量</span>
              <span className="faint">组数 vs MEV–MRV</span>
            </div>

            {muscles.every((m) => m.sets === 0) ? (
              <div className="empty" style={{ padding: '18px 8px' }}>
                这一周还没有训练记录。
              </div>
            ) : (
              <>
                {muscles
                  .slice()
                  .sort((a, b) => b.ratio - a.ratio)
                  .map((m) => (
                    <MuscleBar key={m.muscle} data={m} />
                  ))}

                <div className="faint" style={{ marginTop: 12, lineHeight: 1.6 }}>
                  MEV = 最小有效容量（低于它几乎不长）·
                  MRV = 最大可恢复容量（超过它是垃圾容量）。
                  <br />
                  次要肌群按 0.5 组折算。
                </div>

                {muscles.filter((m) => m.status === 'low' && m.sets > 0).length > 0 && (
                  <div className="alert warn" style={{ marginTop: 10, marginBottom: 0 }}>
                    {muscles
                      .filter((m) => m.status === 'low' && m.sets > 0)
                      .map((m) => MUSCLE_LABEL[m.muscle])
                      .join('、')}
                    {' '}低于最小有效容量。要么这周没练够，要么计划里缺这个部位的动作。
                  </div>
                )}
                {muscles.filter((m) => m.status === 'high').length > 0 && (
                  <div className="alert warn" style={{ marginTop: 10, marginBottom: 0 }}>
                    {muscles
                      .filter((m) => m.status === 'high')
                      .map((m) => MUSCLE_LABEL[m.muscle])
                      .join('、')}
                    {' '}超过最大可恢复容量。这类容量多半是白练，还挤占恢复，建议砍一些。
                  </div>
                )}
              </>
            )}
          </div>

          {/* ---------- 5. 力量进度 ---------- */}
          <div className="card">
            <div className="card-title">
              <span>力量进度建议</span>
              <span className="faint">{suggestions.length} 个动作</span>
            </div>

            {suggestions.length === 0 ? (
              <div className="empty" style={{ padding: '18px 8px' }}>
                还没有训练记录，先在「训练」页勾几组。
              </div>
            ) : (
              <>
                {increases.length > 0 && (
                  <div className="alert info" style={{ marginBottom: 10 }}>
                    <b>{increases.length} 个动作该加重了：</b>
                    {increases.map((s) => s.exerciseName).join('、')}
                  </div>
                )}
                {regressions.length > 0 && (
                  <div className="alert warn" style={{ marginBottom: 10 }}>
                    <b>{regressions.length} 个动作重量偏大：</b>
                    {regressions.map((s) => s.exerciseName).join('、')}
                    ，有组数掉到目标下限以下。
                  </div>
                )}

                {suggestions.map((s) => (
                  <div key={s.exerciseId} style={{ borderBottom: '1px solid rgba(51,55,61,0.5)' }}>
                    <button
                      className="row-between"
                      style={{ width: '100%', textAlign: 'left', padding: '10px 0' }}
                      onClick={() =>
                        setOpenEx(openEx === s.exerciseId ? null : s.exerciseId)
                      }
                    >
                      <div className="grow">
                        <div style={{ fontSize: 14, fontWeight: 550 }}>
                          {s.exerciseName}
                          <span className="badge">{MUSCLE_LABEL[s.muscle]}</span>
                        </div>
                        <div className="faint" style={{ marginTop: 2 }}>
                          {s.reason}
                        </div>
                        <div className="faint" style={{ marginTop: 2 }}>
                          上次：{s.lastSummary} · e1RM {s.lastE1rm}kg
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flex: 'none' }}>
                        {s.action === 'increase' && (
                          <div style={{ color: 'var(--ok)', fontWeight: 650, fontSize: 15 }}>
                            +{s.delta}
                            <span style={{ fontSize: 11 }}>kg</span>
                          </div>
                        )}
                        {s.action === 'hold' && (
                          <div className="faint" style={{ fontSize: 12 }}>
                            保持
                          </div>
                        )}
                        {s.action === 'back' && (
                          <div style={{ color: 'var(--warn)', fontSize: 12 }}>回退</div>
                        )}
                        <div className="faint" style={{ fontSize: 15 }}>
                          {openEx === s.exerciseId ? '⌃' : '⌄'}
                        </div>
                      </div>
                    </button>

                    {openEx === s.exerciseId && (
                      <div style={{ paddingBottom: 14 }}>
                        <E1rmChart points={e1rmPts} />
                      </div>
                    )}
                  </div>
                ))}

                <div className="faint" style={{ marginTop: 12, lineHeight: 1.6 }}>
                  e1RM 用 Epley 公式估算：重量 × (1 + 次数 ÷ 30)。
                  次数超过 12 次后误差变大，图上会标成空心点。
                  它是渐进超负荷唯一可量化的证据——重量没变但次数上去了，e1RM 也会涨。
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function MuscleBar({ data }: { data: MuscleVolume }) {
  const { sets, mev, mrv, ratio, status } = data
  const color =
    status === 'low' ? 'var(--warn)' : status === 'high' ? 'var(--bad)' : 'var(--ok)'

  return (
    <div style={{ marginBottom: 10 }}>
      <div className="row-between" style={{ marginBottom: 4 }}>
        <span style={{ fontSize: 13 }}>
          {MUSCLE_LABEL[data.muscle]}
          {status === 'low' && <span className="badge">偏少</span>}
          {status === 'high' && <span className="badge">过量</span>}
        </span>
        <span className="faint num">
          {trim(sets)} 组 / {mev}–{mrv}
        </span>
      </div>
      <div style={{ position: 'relative' }}>
        <div className="bar" style={{ height: 6 }}>
          <div
            className="bar-fill"
            style={{ width: `${Math.min(100, ratio * 100)}%`, background: color }}
          />
        </div>
        {/* MEV 与 MRV 刻度 */}
        <div
          style={{
            position: 'absolute',
            left: `${(mev / mrv) * 100}%`,
            top: -2,
            width: 1,
            height: 10,
            background: 'var(--fg-faint)'
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '100%',
            top: -2,
            width: 1,
            height: 10,
            background: 'var(--fg-faint)'
          }}
        />
      </div>
    </div>
  )
}

function rateMessage(o: WeeklyOverview): string {
  const logRate = o.loggedDays / 7
  const trainRate = o.completedSessions / o.plannedDays

  const parts: string[] = []
  if (logRate >= 6 / 7) parts.push('饮食记录很完整')
  else parts.push('饮食记录还差几天')

  if (trainRate >= 0.75) parts.push('训练完成度不错')
  else if (trainRate >= 0.5) parts.push('训练完成了一半以上，保持住')
  else parts.push('这周训练少了点')

  parts.push(
    o.proteinHitDays >= 5
      ? '蛋白吃得很到位——这是减脂保肌最关键的一项'
      : `蛋白只有 ${o.proteinHitDays} 天达标，这是最值得先补的短板`
  )

  return parts.join('。') + '。'
}

function fmtVolume(kg: number): string {
  if (kg >= 10000) return `${(kg / 1000).toFixed(1)}t 容量`
  return `${kg} kg 容量`
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}
