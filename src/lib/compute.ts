/**
 * 把散落在各表里的数据聚合成界面需要的「当前状态」。
 *
 * TDEE 的优先级：手动覆盖 > 自适应 > 静态公式
 */

import type { Profile, TdeePoint } from '../types'
import {
  adaptiveTdee,
  buildTrend,
  estimateBmr,
  formulaTdee,
  macroTargets,
  type AdaptiveResult,
  type BmrBreakdown,
  type MacroTargets,
  type TrendPoint
} from './tdee'
import { addDays, todayISO } from './tdee'
import { allTdee, allWeights, dailyIntakeMap, latestTdee } from '../db'

export type TdeeSource = 'override' | 'adaptive' | 'formula'

export interface Computed {
  bmr: BmrBreakdown
  /** 当前实际采用的 TDEE */
  tdee: number
  tdeeSource: TdeeSource
  /** 自适应算法的原始结果（数据不足时为 null） */
  adaptive: AdaptiveResult | null
  targets: MacroTargets
  /** 全历史体重趋势 */
  trend: TrendPoint[]
  /** 最近一次称重值（没有记录时回退到档案里的起始体重） */
  currentWeight: number
  /** 最近一次称重日期 */
  currentWeightDate: string | null
  tdeeHistory: TdeePoint[]
  /** 自适应还需多少天数据才能生效 */
  adaptiveDaysNeeded: number
}

const HISTORY_DAYS = 120

export async function computeAll(profile: Profile): Promise<Computed> {
  const today = todayISO()
  const from = addDays(today, -HISTORY_DAYS)

  const [weights, intake, history] = await Promise.all([
    allWeights(),
    dailyIntakeMap(from, today),
    allTdee()
  ])

  const formula = formulaTdee(profile)
  const adaptive = profile.adaptiveEnabled
    ? adaptiveTdee(intake, weights, today)
    : null

  let tdee = formula
  let tdeeSource: TdeeSource = 'formula'

  if (adaptive) {
    tdee = adaptive.tdee
    tdeeSource = 'adaptive'
  }
  if (profile.tdeeOverride && profile.tdeeOverride > 0) {
    tdee = profile.tdeeOverride
    tdeeSource = 'override'
  }

  tdee = Math.round(tdee)

  const last = weights.length > 0 ? weights[weights.length - 1] : null

  // 自适应还差几天
  const loggedDays = [...intake.values()].filter((v) => v > 0).length
  const adaptiveDaysNeeded = Math.max(0, 10 - loggedDays)

  return {
    bmr: estimateBmr(profile),
    tdee,
    tdeeSource,
    adaptive,
    targets: macroTargets(profile, tdee),
    trend: buildTrend(weights),
    currentWeight: last?.kg ?? profile.startWeightKg,
    currentWeightDate: last?.date ?? null,
    tdeeHistory: history,
    adaptiveDaysNeeded
  }
}

/** 供设置页显示：上一次记录的 TDEE */
export async function previousTdee(): Promise<TdeePoint | undefined> {
  return latestTdee()
}
