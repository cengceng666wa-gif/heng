/**
 * 身体数据与 TDEE 算法
 *
 * 两条路线：
 *   1. 静态公式——首次使用、数据不足时给初值
 *   2. 自适应——用真实摄入 + 体重趋势反推真实消耗，每周重算
 *
 * 自适应是核心，因为静态公式对个人的误差可达 ±300–500 kcal，
 * 而自适应会随着数据积累收敛到真实值，顺带把食堂估份的系统性偏差吃掉。
 */

import type { Profile, WeightEntry } from '../types'

/** 1 kg 体重变化对应的能量（kcal），常用近似值 */
export const KCAL_PER_KG = 7700

/** EWMA 平滑系数。0.1 是每日体重的常用值：足够灵敏又不被单日波动带飞 */
export const EWMA_ALPHA = 0.1

/** 自适应 TDEE 需要的最小数据量 */
export const MIN_DAYS_FOR_ADAPTIVE = 10
export const ADAPTIVE_WINDOW_DAYS = 14

// ---------------------------------------------------------------------------
// 基础代谢
// ---------------------------------------------------------------------------

/** Mifflin-St Jeor。体脂未知时的默认选择，对高体脂人群会高估 */
export function mifflinStJeor(sex: Profile['sex'], kg: number, cm: number, age: number): number {
  const base = 10 * kg + 6.25 * cm - 5 * age
  return base + (sex === 'male' ? 5 : -161)
}

/** Katch-McArdle。已知体脂率时更准，因为它只用去脂体重，不虚高 */
export function katchMcArdle(lbmKg: number): number {
  return 370 + 21.6 * lbmKg
}

/** 去脂体重 */
export function leanBodyMass(weightKg: number, bodyFatPct: number): number {
  return weightKg * (1 - bodyFatPct / 100)
}

export interface BmrBreakdown {
  mifflin: number
  katch: number | null
  /** 实际采用的 BMR */
  value: number
  /** 采用的是哪个 */
  used: 'mifflin' | 'blend'
}

/**
 * BMR 估算。
 *
 * 已知体脂率时取两式折中——因为自报体脂率本身误差很大（家用体脂秤 ±5%），
 * 不该完全信任 Katch-McArdle，也不该无视它。
 */
export function estimateBmr(profile: Profile): BmrBreakdown {
  const mifflin = mifflinStJeor(profile.sex, profile.startWeightKg, profile.heightCm, profile.age)

  if (!profile.bodyFatPct || profile.bodyFatPct <= 0 || profile.bodyFatPct >= 70) {
    return { mifflin, katch: null, value: mifflin, used: 'mifflin' }
  }

  const lbm = leanBodyMass(profile.startWeightKg, profile.bodyFatPct)
  const katch = katchMcArdle(lbm)
  return { mifflin, katch, value: (mifflin + katch) / 2, used: 'blend' }
}

/** 静态公式算出的 TDEE */
export function formulaTdee(profile: Profile): number {
  return estimateBmr(profile).value * profile.activityFactor
}

// ---------------------------------------------------------------------------
// 体重趋势
// ---------------------------------------------------------------------------

export interface TrendPoint {
  date: string
  /** 实际称重值，缺失日为 null */
  raw: number | null
  /** EWMA 趋势值 */
  trend: number
  standard: boolean
}

/**
 * 把散乱的体重记录转成按日历日排列的 EWMA 趋势序列。
 *
 * 为什么不直接用原始值：单日体重波动 1–2 kg 全是水和糖原，
 * 直接拿去算 ΔW 会被噪声完全淹没。
 *
 * 非标准条件的称重（比如训练后脱水状态）降权处理：只用 alpha/3 的步长，
 * 既保留信息又不让它污染趋势。
 */
export function buildTrend(entries: WeightEntry[], alpha = EWMA_ALPHA): TrendPoint[] {
  if (entries.length === 0) return []

  const byDate = new Map<string, WeightEntry>()
  for (const e of entries) byDate.set(e.date, e)

  const dates = [...byDate.keys()].sort()
  const start = parseISO(dates[0])
  const end = parseISO(dates[dates.length - 1])

  const out: TrendPoint[] = []
  let trend: number | null = null

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = toISO(d)
    const entry = byDate.get(key)

    if (entry) {
      if (trend === null) {
        trend = entry.kg
      } else {
        // 非标准称重降权，避免脱水/饱腹状态把趋势拽偏
        const a = entry.standard ? alpha : alpha / 3
        trend = a * entry.kg + (1 - a) * trend
      }
      out.push({ date: key, raw: entry.kg, trend, standard: entry.standard })
    } else if (trend !== null) {
      // 没称重的日子趋势保持不变（不插值、不外推）
      out.push({ date: key, raw: null, trend, standard: true })
    }
  }

  return out
}

// ---------------------------------------------------------------------------
// 自适应 TDEE
// ---------------------------------------------------------------------------

export interface AdaptiveResult {
  /** 反推出来的 TDEE */
  tdee: number
  avgIntake: number
  deltaKg: number
  windowDays: number
  /** 有摄入记录的天数，用于判断可信度 */
  loggedDays: number
  /** 可信度 0–1，低于 0.6 建议只做参考 */
  confidence: number
}

/**
 * 用能量守恒反推真实 TDEE。
 *
 *   摄入 = 消耗 + 体重变化对应的能量
 *   → TDEE = 平均摄入 − (Δ趋势体重 × 7700 / 天数)
 *
 * 数据不足（天数不够、或记录断断续续）时返回 null，调用方应回退到公式值。
 *
 * @param dailyIntake  Map<'YYYY-MM-DD', 当日总摄入 kcal>
 * @param weights      全部体重记录
 * @param today        计算截止日
 * @param windowDays   回溯窗口天数
 */
export function adaptiveTdee(
  dailyIntake: Map<string, number>,
  weights: WeightEntry[],
  today: string,
  windowDays = ADAPTIVE_WINDOW_DAYS
): AdaptiveResult | null {
  const end = parseISO(today)
  const start = new Date(end)
  start.setDate(start.getDate() - (windowDays - 1))

  const inWindow = weights.filter((w) => {
    const d = parseISO(w.date)
    return d >= start && d <= end
  })

  const trend = buildTrend(inWindow)
  const points = trend.filter((p) => p.raw !== null)
  if (points.length < 4) return null

  // 窗口内实际跨度
  const first = parseISO(points[0].date)
  const last = parseISO(points[points.length - 1].date)
  const spanDays = Math.max(1, Math.round((last.getTime() - first.getTime()) / 86400000))

  const deltaKg = points[points.length - 1].trend - points[0].trend

  // 平均摄入：只统计窗口内有记录的日子
  let sum = 0
  let loggedDays = 0
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const v = dailyIntake.get(toISO(d))
    if (v !== undefined && v > 0) {
      sum += v
      loggedDays++
    }
  }
  if (loggedDays === 0) return null

  const avgIntake = sum / loggedDays

  // 数据量不足时不给结论
  if (spanDays < MIN_DAYS_FOR_ADAPTIVE || loggedDays < MIN_DAYS_FOR_ADAPTIVE) return null

  // 关键公式
  const tdee = avgIntake - (deltaKg * KCAL_PER_KG) / spanDays

  // 可信度：记录覆盖率 × 跨度充足度
  const coverage = loggedDays / windowDays
  const spanScore = Math.min(1, spanDays / windowDays)
  const confidence = Math.max(0, Math.min(1, coverage * 0.7 + spanScore * 0.3))

  // 明显不合理的值直接丢弃（数据录入错误或极端脱水）
  if (tdee < 900 || tdee > 6000) return null

  return { tdee, avgIntake, deltaKg, windowDays: spanDays, loggedDays, confidence }
}

/**
 * 每周更新 TDEE 时的平滑。
 *
 * 直接用实测值会让目标摄入天天跳，用户体验很差；
 * 用 0.7 旧 + 0.3 新，既不迟钝也不抖。
 */
export function smoothTdee(previous: number | null, measured: number, weight = 0.3): number {
  if (previous === null) return measured
  return previous * (1 - weight) + measured * weight
}

// ---------------------------------------------------------------------------
// 目标摄入与宏量
// ---------------------------------------------------------------------------

export interface MacroTargets {
  kcal: number
  protein: number
  fat: number
  carb: number
  /** 相对 TDEE 的缺口 */
  deficit: number
  /** 缺口占 TDEE 的比例，健康区间建议 0.15–0.30 */
  deficitPct: number
  warnings: string[]
}

/**
 * 算出每日目标。
 *
 * @param tdee 当前采用的 TDEE（自适应值优先）
 */
export function macroTargets(profile: Profile, tdee: number): MacroTargets {
  const deficit = (profile.rateKgPerWeek * KCAL_PER_KG) / 7
  const kcal = Math.round(tdee - deficit)
  const deficitPct = deficit / tdee

  // 蛋白质：优先按去脂体重算（减脂期保肌的关键）
  let lbm: number
  if (profile.bodyFatPct && profile.bodyFatPct > 0) {
    lbm = leanBodyMass(profile.startWeightKg, profile.bodyFatPct)
  } else {
    // 没有体脂率时按体重 0.8 估一个
    lbm = profile.startWeightKg * 0.8
  }
  const protein = Math.round(lbm * profile.proteinPerKgLbm / 5) * 5

  const fat = Math.round((kcal * profile.fatPctOfKcal) / 9 / 1) * 1
  const carbKcal = kcal - protein * 4 - fat * 9
  const carb = Math.max(0, Math.round(carbKcal / 4))

  const warnings: string[] = []
  if (deficitPct > 0.3) {
    warnings.push(`缺口占 TDEE 的 ${(deficitPct * 100).toFixed(0)}%，超过 30% 容易掉肌肉和影响训练表现`)
  }
  if (deficitPct > 0.25 && profile.bodyFatPct && profile.bodyFatPct < 15) {
    warnings.push('体脂已偏低，缺口建议收到 20% 以内')
  }
  if (carb < 80) {
    warnings.push('碳水低于 80g，训练表现可能明显下降，考虑降低减重速率')
  }
  if (kcal < 1200) {
    warnings.push('目标摄入低于 1200 kcal，不建议长期维持')
  }
  if (protein > kcal / 4) {
    warnings.push('蛋白质目标偏高，已挤占过多热量配额')
  }

  return { kcal, protein, fat, carb, deficit: Math.round(deficit), deficitPct, warnings }
}

/** 每周预计减重 kg（用于显示预期进度） */
export function weeklyLoss(profile: Profile): number {
  return profile.rateKgPerWeek
}

/** 按当前速率，从起始体重到目标体重要几周 */
export function weeksToGoal(profile: Profile, currentKg: number): number {
  if (profile.rateKgPerWeek <= 0) return Infinity
  return Math.max(0, (currentKg - profile.targetWeightKg) / profile.rateKgPerWeek)
}

// ---------------------------------------------------------------------------
// 日期工具（本地时区，不用 toISOString 以免被 UTC 带偏）
// ---------------------------------------------------------------------------

export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO(): string {
  return toISO(new Date())
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** 两个日期相差的天数 */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000)
}

/** 周一为 1 … 周日为 7 */
export function isoWeekday(iso: string): number {
  const d = parseISO(iso).getDay()
  return d === 0 ? 7 : d
}
