/**
 * 分析与复盘。
 *
 * 这里回答的是训练日志类 App 最容易漏掉的问题：
 *   「我这周到底做得怎么样？」而不是「我上周三练了几组」。
 *
 * 五个模块：
 *   1. 周报      —— 摄入 / 体重 / 训练完成率
 *   2. e1RM      —— 用重量×次数估 1RM，是渐进超负荷唯一可量化的证据
 *   3. 肌群容量  —— 每周组数对照 MEV–MRV 区间
 *   4. Deload    —— 连续加重多久该降载
 *   5. 平台期    —— 趋势体重不动时，到底是估错了还是代谢适应
 */

import { db, sessionsBetween, allWeights, logsBetween, dailyIntakeMap } from '../db'
import type { MuscleKey, Profile, SetLog } from '../types'
import { MUSCLE_VOLUME_TARGET } from '../data/program'
import type { Computed } from './compute'
import { addDays, buildTrend, isoWeekday, todayISO } from './tdee'

// ---------------------------------------------------------------------------
// 周边界
// ---------------------------------------------------------------------------

/** 返回某个日期所在周的周一 */
export function mondayOf(iso: string): string {
  return addDays(iso, -(isoWeekday(iso) - 1))
}

export interface WeekRange {
  start: string
  end: string
  label: string
}

export function weekRange(iso: string): WeekRange {
  const start = mondayOf(iso)
  const end = addDays(start, 6)
  return { start, end, label: `${md(start)} – ${md(end)}` }
}

export function previousWeek(iso: string): string {
  return addDays(mondayOf(iso), -7)
}

// ---------------------------------------------------------------------------
// 1. 周报
// ---------------------------------------------------------------------------

export interface WeeklyOverview {
  range: WeekRange
  /** 有饮食记录的天数 */
  loggedDays: number
  avgIntake: number
  avgProtein: number
  avgFat: number
  avgCarb: number
  /** 热量落在目标 ±5% 内的天数 */
  onTargetDays: number
  /** 蛋白达到目标 90% 的天数 */
  proteinHitDays: number
  /** 该周有记录的训练日数 */
  sessionDays: number
  completedSessions: number
  totalSets: number
  /** 总容量 = Σ 重量 × 次数 */
  volumeKg: number
  trendStart: number | null
  trendEnd: number | null
  deltaKg: number | null
  /** 计划里一周该练几天 */
  plannedDays: number
}

export async function weeklyOverview(
  computed: Computed,
  weekStartISO: string
): Promise<WeeklyOverview> {
  const range = weekRange(weekStartISO)
  const t = computed.targets

  const [logs, weights, sessions] = await Promise.all([
    logsBetween(range.start, range.end),
    allWeights(),
    sessionsBetween(range.start, range.end)
  ])

  // --- 饮食 ---
  const byDay = new Map<string, { kcal: number; p: number; f: number; c: number }>()
  for (const l of logs) {
    const cur = byDay.get(l.date) ?? { kcal: 0, p: 0, f: 0, c: 0 }
    cur.kcal += l.kcal
    cur.p += l.protein
    cur.f += l.fat
    cur.c += l.carb
    byDay.set(l.date, cur)
  }

  const days = [...byDay.values()]
  const loggedDays = days.length
  const sum = days.reduce(
    (a, d) => ({ kcal: a.kcal + d.kcal, p: a.p + d.p, f: a.f + d.f, c: a.c + d.c }),
    { kcal: 0, p: 0, f: 0, c: 0 }
  )
  const avg = (n: number) => (loggedDays > 0 ? n / loggedDays : 0)

  const onTargetDays = days.filter(
    (d) => Math.abs(d.kcal - t.kcal) <= t.kcal * 0.05
  ).length
  const proteinHitDays = days.filter((d) => d.p >= t.protein * 0.9).length

  // --- 体重 ---
  const trend = buildTrend(weights)
  const inRange = trend.filter((p) => p.date >= range.start && p.date <= range.end)
  const trendStart = inRange.length > 0 ? inRange[0].trend : null
  const trendEnd = inRange.length > 0 ? inRange[inRange.length - 1].trend : null
  const deltaKg =
    trendStart !== null && trendEnd !== null ? trendEnd - trendStart : null

  // --- 训练 ---
  let completedSessions = 0
  let totalSets = 0
  let volumeKg = 0
  for (const s of sessions) {
    const rows = await db.setLogs.where('sessionId').equals(s.id!).toArray()
    const done = rows.filter((r) => r.done)
    if (s.partial || done.length > 0) completedSessions++
    totalSets += done.length
    volumeKg += done.reduce((a, r) => a + r.weightKg * r.reps, 0)
  }

  return {
    range,
    loggedDays,
    avgIntake: avg(sum.kcal),
    avgProtein: avg(sum.p),
    avgFat: avg(sum.f),
    avgCarb: avg(sum.c),
    onTargetDays,
    proteinHitDays,
    sessionDays: sessions.length,
    completedSessions,
    totalSets,
    volumeKg: Math.round(volumeKg),
    trendStart,
    trendEnd,
    deltaKg,
    plannedDays: 4
  }
}

/** 取最近 n 周的周报，用于画趋势 */
export async function recentWeeks(
  computed: Computed,
  n = 6
): Promise<WeeklyOverview[]> {
  const out: WeeklyOverview[] = []
  let anchor = todayISO()
  for (let i = 0; i < n; i++) {
    out.push(await weeklyOverview(computed, anchor))
    anchor = previousWeek(anchor)
  }
  return out.reverse()
}

// ---------------------------------------------------------------------------
// 2. e1RM 与渐进超负荷
// ---------------------------------------------------------------------------

/**
 * Epley 公式估 1RM：1RM = w × (1 + reps/30)
 *
 * 注意：次数超过 12 次后误差迅速变大，所以只在 1–12 次范围内标记为可信。
 */
export function e1rm(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0
  if (reps === 1) return weightKg
  return weightKg * (1 + reps / 30)
}

export interface E1rmPoint {
  date: string
  value: number
  /** 该次的最佳组重量与次数 */
  weightKg: number
  reps: number
  /** 次数是否在可信范围内 */
  reliable: boolean
}

/** 某个动作的 e1RM 历史（每个训练日一个点） */
export async function e1rmHistory(exerciseId: number): Promise<E1rmPoint[]> {
  const rows = await db.setLogs
    .where('exerciseId')
    .equals(exerciseId)
    .filter((s) => s.done && s.weightKg > 0)
    .toArray()

  const byDate = new Map<string, SetLog[]>()
  for (const r of rows) {
    const list = byDate.get(r.date) ?? []
    list.push(r)
    byDate.set(r.date, list)
  }

  const out: E1rmPoint[] = []
  for (const [date, list] of byDate) {
    let best = list[0]
    let bestVal = e1rm(best.weightKg, best.reps)
    for (const s of list) {
      const v = e1rm(s.weightKg, s.reps)
      if (v > bestVal) {
        bestVal = v
        best = s
      }
    }
    out.push({
      date,
      value: Math.round(bestVal * 10) / 10,
      weightKg: best.weightKg,
      reps: best.reps,
      reliable: best.reps <= 12
    })
  }

  out.sort((a, b) => (a.date < b.date ? -1 : 1))
  return out
}

export type ProgressionAction = 'increase' | 'hold' | 'back'

export interface ProgressionSuggestion {
  exerciseId: number
  exerciseName: string
  muscle: MuscleKey
  action: ProgressionAction
  /** 建议增加的重量（kg），increase 时有意义 */
  delta: number
  reason: string
  lastSummary: string
  /** 上次 e1RM，用于参考 */
  lastE1rm: number
}

/**
 * 渐进超负荷建议。
 *
 * 判断规则（简单但站得住）：
 *   所有组都达到次数上限，且最重那组的 RPE ≤ 该动作允许上限 → 该加重
 *   有组次低于次数下限 → 说明太重了，建议回退
 *   其余情况保持
 *
 * 加重幅度：下肢 5kg，其余 2.5kg。这是实用的最小可加载增量。
 */
export async function progressionSuggestions(
  beforeDate: string
): Promise<ProgressionSuggestion[]> {
  const [days, exercises] = await Promise.all([
    db.programDays.toArray(),
    db.exercises.toArray()
  ])
  const exMap = new Map(exercises.map((e) => [e.id!, e]))

  const seen = new Set<number>()
  const out: ProgressionSuggestion[] = []

  for (const day of days) {
    for (const item of day.items) {
      if (seen.has(item.exerciseId)) continue
      seen.add(item.exerciseId)

      const all = await db.setLogs
        .where('exerciseId')
        .equals(item.exerciseId)
        .filter((s) => s.done && s.date < beforeDate)
        .toArray()
      if (all.length === 0) continue

      // 取最近一个有记录的日子
      all.sort((a, b) => (a.date < b.date ? 1 : -1))
      const lastDate = all[0].date
      const last = all.filter((s) => s.date === lastDate)
      const ex = exMap.get(item.exerciseId)
      if (!ex) continue

      const reps = last.map((s) => s.reps)
      const minReps = Math.min(...reps)
      const maxReps = Math.max(...reps)
      const top = last.reduce((a, b) => (b.weightKg > a.weightKg ? b : a), last[0])
      const topRpe = top.rpe

      // 计时动作（平板支撑）用的是秒不是次，措辞要跟着变
      const unit = ex.type === 'timed' ? '秒' : '次'

      const allAtTop = reps.every((r) => r >= item.repMax)
      const someBelowMin = minReps < item.repMin

      let action: ProgressionAction
      let delta = 0
      let reason: string

      if (someBelowMin) {
        action = 'back'
        delta = 0
        reason = `有组只做了 ${minReps} ${unit}，低于目标下限 ${item.repMin} ${unit}——重量偏大了，建议回退一档`
      } else if (allAtTop && (topRpe === undefined || topRpe <= item.rpeMax)) {
        action = 'increase'
        delta = ex.muscle === 'quads' || ex.muscle === 'hamstrings' || ex.muscle === 'glutes'
          ? 5
          : 2.5
        reason =
          topRpe === undefined
            ? `全部达到 ${item.repMax} ${unit}上限，该加重了`
            : `全部达到 ${item.repMax} ${unit}上限，且 RPE ${topRpe} ≤ ${item.rpeMax}`
      } else {
        action = 'hold'
        delta = 0
        reason =
          maxReps < item.repMax
            ? `当前最高 ${maxReps} ${unit}，还没到 ${item.repMax} ${unit}——先把${unit === '秒' ? '时长' : '次数'}做上去`
            : `${unit === '秒' ? '时长' : '次数'}已达标但 RPE 偏高，再用同样重量练一次`
      }

      out.push({
        exerciseId: item.exerciseId,
        exerciseName: item.exerciseName,
        muscle: ex.muscle,
        action,
        delta,
        reason,
        lastSummary: `${last.length} 组 · ${top.weightKg}kg×${top.reps}（最高）· ${fmtDate(lastDate)}`,
        lastE1rm: Math.round(e1rm(top.weightKg, top.reps) * 10) / 10
      })
    }
  }

  // 该加重的排前面
  const rank: Record<ProgressionAction, number> = { increase: 0, back: 1, hold: 2 }
  out.sort((a, b) => rank[a.action] - rank[b.action])
  return out
}

// ---------------------------------------------------------------------------
// 3. 肌群周容量
// ---------------------------------------------------------------------------

export interface MuscleVolume {
  muscle: MuscleKey
  /** 本周完成的组数 */
  sets: number
  mev: number
  mrv: number
  /** 相对 MRV 的比例 0–1+ */
  ratio: number
  status: 'low' | 'ok' | 'high'
}

/**
 * 统计指定周内每块肌肉完成的组数，对照 MEV–MRV。
 *
 * MEV = 最小有效容量，低于它几乎不长；
 * MRV = 最大可恢复容量，超过它就是在制造垃圾容量。
 */
export async function muscleVolume(weekStartISO: string): Promise<MuscleVolume[]> {
  const range = weekRange(weekStartISO)
  const [sessions, exercises] = await Promise.all([
    sessionsBetween(range.start, range.end),
    db.exercises.toArray()
  ])
  const exMap = new Map(exercises.map((e) => [e.id!, e]))

  const counts = new Map<MuscleKey, number>()

  for (const s of sessions) {
    const rows = await db.setLogs.where('sessionId').equals(s.id!).toArray()
    for (const r of rows) {
      if (!r.done) continue
      const ex = exMap.get(r.exerciseId)
      if (!ex) continue
      counts.set(ex.muscle, (counts.get(ex.muscle) ?? 0) + 1)
      // 次要肌群算 0.5 组
      for (const sec of ex.secondary ?? []) {
        counts.set(sec, (counts.get(sec) ?? 0) + 0.5)
      }
    }
  }

  return (Object.keys(MUSCLE_VOLUME_TARGET) as MuscleKey[]).map((m) => {
    const sets = counts.get(m) ?? 0
    const t = MUSCLE_VOLUME_TARGET[m]
    const ratio = t.mrv > 0 ? sets / t.mrv : 0
    let status: MuscleVolume['status'] = 'ok'
    if (sets < t.mev) status = 'low'
    else if (sets > t.mrv) status = 'high'
    return { muscle: m, sets, mev: t.mev, mrv: t.mrv, ratio, status }
  })
}

// ---------------------------------------------------------------------------
// 4. Deload 提醒
// ---------------------------------------------------------------------------

export interface DeloadAdvice {
  needed: boolean
  weeksTraining: number
  weeksSinceDeload: number | null
  reason: string
  detail: string
}

/**
 * 该不该减载。
 *
 * 判断依据：连续训练周数。一般 4–8 周加重后必须降一周，
 * 否则要么受伤，要么进入「练得越多恢复越差」的停滞。
 * 现有 App 基本不做这个提醒。
 */
export async function deloadAdvice(profile: Profile): Promise<DeloadAdvice> {
  const sessions = await db.sessions.toArray()
  if (sessions.length === 0) {
    return {
      needed: false,
      weeksTraining: 0,
      weeksSinceDeload: null,
      reason: '还没有训练记录',
      detail: ''
    }
  }

  const dates = [...new Set(sessions.map((s) => s.date))].sort()
  const firstMonday = mondayOf(dates[0])
  const thisMonday = mondayOf(todayISO())
  const weeksTraining = Math.round(
    (new Date(thisMonday).getTime() - new Date(firstMonday).getTime()) / (7 * 86400000)
  )

  const lastDeload = profile.lastDeloadDate ? mondayOf(profile.lastDeloadDate) : null
  const weeksSinceDeload = lastDeload
    ? Math.round(
        (new Date(thisMonday).getTime() - new Date(lastDeload).getTime()) / (7 * 86400000)
      )
    : weeksTraining

  // 训练周数够 6 周、且距上次减载也够 6 周 → 建议
  const needed = weeksTraining >= 6 && weeksSinceDeload >= 6

  return {
    needed,
    weeksTraining,
    weeksSinceDeload,
    reason: needed
      ? `已连续训练 ${weeksTraining} 周，距上次减载 ${weeksSinceDeload} 周`
      : `距上次减载 ${weeksSinceDeload} 周，还不到必要的时候`,
    detail: needed
      ? '下一周把所有重量降到平时的 60%，组数减半。这一周不追求进步，只为恢复。' +
        '减载周之后通常会明显感觉变强，不是浪费时间。'
      : '通常连续加重 4–8 周后才需要减载。这一周继续正常练。'
  }
}

/** 标记本周为减载周 */
export async function markDeload(mondayISO: string): Promise<void> {
  const p = await db.profile.get(1)
  if (!p) return
  await db.profile.update(1, { lastDeloadDate: mondayISO })
}

// ---------------------------------------------------------------------------
// 5. 平台期诊断
// ---------------------------------------------------------------------------

export interface PlateauDiagnosis {
  isPlateau: boolean
  /** 近 14 天趋势体重变化 */
  deltaKg: number
  /** 窗口内平均摄入 */
  avgIntake: number
  /** 有记录的天数 */
  loggedDays: number
  headline: string
  detail: string
  suggestion: string
}

/**
 * 平台期诊断。
 *
 * 体重趋势连续两周不动，有三种可能，必须区分开：
 *   1. 记漏了 —— 实际吃得比记录多
 *   2. 代谢适应 —— 体重降了，消耗自然跟着降，目标该下调
 *   3. 真的需要再创造缺口
 *
 * 不分青红皂白就让人「再少吃点」是大多数减脂失败的原因。
 */
export async function diagnosePlateau(
  computed: Computed,
  windowDays = 14
): Promise<PlateauDiagnosis> {
  const today = todayISO()
  const from = addDays(today, -(windowDays - 1))

  const [weights, intakeMap] = await Promise.all([
    allWeights(),
    dailyIntakeMap(from, today)
  ])

  const trend = buildTrend(weights).filter((p) => p.date >= from && p.date <= today)
  const withData = trend.filter((p) => p.raw !== null)

  const loggedDays = [...intakeMap.values()].filter((v) => v > 0).length
  const totalIntake = [...intakeMap.values()].reduce((a, b) => a + b, 0)
  const avgIntake = loggedDays > 0 ? totalIntake / loggedDays : 0

  if (withData.length < 5 || loggedDays < 7) {
    return {
      isPlateau: false,
      deltaKg: 0,
      avgIntake,
      loggedDays,
      headline: '数据还不够判断',
      detail: `需要至少 ${windowDays} 天里有一半以上的体重和饮食记录。目前有 ${withData.length} 天体重、${loggedDays} 天饮食。`,
      suggestion: '先把记录补齐，再谈平不平台。'
    }
  }

  const deltaKg = withData[withData.length - 1].trend - withData[0].trend
  const isPlateau = Math.abs(deltaKg) < 0.2

  if (!isPlateau) {
    return {
      isPlateau: false,
      deltaKg,
      avgIntake,
      loggedDays,
      headline: deltaKg < 0 ? '正常下降中' : '体重在上升',
      detail: `近 ${windowDays} 天趋势体重变化 ${deltaKg >= 0 ? '+' : ''}${deltaKg.toFixed(2)} kg，平均摄入 ${Math.round(avgIntake)} kcal。`,
      suggestion:
        deltaKg < 0
          ? '按当前节奏继续，不用改任何参数。'
          : '摄入高于消耗了。检查一下是不是有没记进去的东西，或者目标值该重算。'
    }
  }

  // --- 进入平台判断 ---
  const target = computed.targets
  const overEating = avgIntake > target.kcal + 100
  const underLogging = loggedDays < windowDays - 3

  let headline: string
  let detail: string
  let suggestion: string

  if (underLogging) {
    headline = '可能记漏了'
    detail = `${windowDays} 天里只有 ${loggedDays} 天有饮食记录。漏记的日子通常也没少吃。`
    suggestion = '先把记录补全再判断。漏记是减脂平台最常见的原因，不是代谢问题。'
  } else if (overEating) {
    headline = '实际摄入高于目标'
    detail = `平均摄入 ${Math.round(avgIntake)} kcal，目标是 ${target.kcal} kcal，超出 ${Math.round(avgIntake - target.kcal)} kcal。`
    suggestion = `每天超出的这部分，${windowDays} 天累计约 ${Math.round(((avgIntake - target.kcal) * windowDays) / 7700 * 100) / 100} kg 脂肪的当量。把超出的部分砍掉就能重新下降。`
  } else {
    // 记录到位、摄入也没超 → 就是代谢适应
    headline = '代谢适应（正常现象）'
    detail =
      `记录完整、摄入也没超标（平均 ${Math.round(avgIntake)} kcal vs 目标 ${target.kcal}），` +
      `说明你的消耗跟着体重一起降下来了。` +
      (computed.tdeeSource === 'adaptive'
        ? `自适应算法已经把 TDEE 下调到 ${computed.tdee} kcal，新目标 ${target.kcal} kcal。`
        : '自适应 TDEE 数据还不够，等它收敛后再看。')
    suggestion =
      '体重下降后消耗必然下降，这不是失败，是物理规律。' +
      '两个选择：把目标热量再降 100–150 kcal，或者保持吃不变、每天多走 2000 步。' +
      '推荐后者——同样能造成缺口，但不影响训练表现。'
  }

  return { isPlateau: true, deltaKg, avgIntake, loggedDays, headline, detail, suggestion }
}

// ---------------------------------------------------------------------------

function md(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${Number(m)}/${Number(d)}`
}

function fmtDate(iso: string): string {
  return md(iso)
}
