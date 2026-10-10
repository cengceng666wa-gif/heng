/**
 * 今天。
 *
 * 首屏就是「还能吃多少」——不点第二下。
 * 这是整个 App 最重要的一个数字。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addLog,
  dailyIntakeMap,
  deleteLog,
  logsForDate
} from '../db'
import type { DayTotals, Food, LogEntry, MealKey, Profile } from '../types'
import { MEAL_LABEL, MEAL_ORDER } from '../types'
import type { Computed } from '../lib/compute'
import { addDays, todayISO } from '../lib/tdee'
import FoodPicker from '../components/FoodPicker'

interface Props {
  profile: Profile
  computed: Computed
  onChanged: () => void | Promise<void>
}

const EMPTY: DayTotals = { kcal: 0, protein: 0, fat: 0, carb: 0 }

export default function Today({ computed, onChanged }: Props) {
  const [date, setDate] = useState(todayISO())
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [pickerMeal, setPickerMeal] = useState<MealKey | null>(null)
  const [intakeHint, setIntakeHint] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLogs(await logsForDate(date))
  }, [date])

  useEffect(() => {
    void load()
  }, [load])

  const totals = useMemo<DayTotals>(() => {
    return logs.reduce<DayTotals>(
      (acc, l) => ({
        kcal: acc.kcal + l.kcal,
        protein: acc.protein + l.protein,
        fat: acc.fat + l.fat,
        carb: acc.carb + l.carb
      }),
      { ...EMPTY }
    )
  }, [logs])

  const t = computed.targets
  const remaining = t.kcal - totals.kcal
  const isToday = date === todayISO()

  // 自适应算法还需要多少天数据——顺手提醒一下
  useEffect(() => {
    if (!isToday) return
    void (async () => {
      const map = await dailyIntakeMap(addDays(date, -30), date)
      const logged = [...map.values()].filter((v) => v > 0).length
      if (computed.tdeeSource === 'formula' && logged > 0 && logged < 10) {
        setIntakeHint(`自适应 TDEE 还差 ${10 - logged} 天记录（已记 ${logged} 天）`)
      } else {
        setIntakeHint(null)
      }
    })()
  }, [isToday, date, computed.tdeeSource, logs.length])

  async function handleAdd(food: Food, meal: MealKey, qty: number) {
    await addLog(food, date, meal, qty)
    await load()
    await onChanged()
  }

  async function handleDelete(id: number) {
    await deleteLog(id)
    await load()
    await onChanged()
  }

  return (
    <div className="page">
      {/* 日期切换 */}
      <div className="row-between" style={{ marginBottom: 10 }}>
        <button className="btn ghost sm" onClick={() => setDate(addDays(date, -1))}>
          ‹ 前一天
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 650, fontSize: 14 }}>
            {isToday ? '今天' : formatDay(date)}
          </div>
          {!isToday && (
            <button
              className="faint"
              style={{ textDecoration: 'underline' }}
              onClick={() => setDate(todayISO())}
            >
              回到今天
            </button>
          )}
        </div>
        <button
          className="btn ghost sm"
          disabled={isToday}
          style={{ opacity: isToday ? 0.3 : 1 }}
          onClick={() => setDate(addDays(date, 1))}
        >
          后一天 ›
        </button>
      </div>

      {/* 热量主数字 */}
      <div className="card">
        <div className={`kcal-big${remaining < 0 ? ' over' : ''}`}>
          <div className="v num">{Math.abs(Math.round(remaining))}</div>
          <div className="l">
            {remaining >= 0 ? '还能吃 kcal' : '已超出 kcal'}
          </div>
        </div>

        <MacroBar
          name="热量"
          cur={totals.kcal}
          target={t.kcal}
          unit="kcal"
          color="var(--kcal)"
        />
        <MacroBar
          name="蛋白质"
          cur={totals.protein}
          target={t.protein}
          unit="g"
          color="var(--protein)"
          emphasize
        />
        <MacroBar name="脂肪" cur={totals.fat} target={t.fat} unit="g" color="var(--fat)" />
        <MacroBar name="碳水" cur={totals.carb} target={t.carb} unit="g" color="var(--carb)" />

        <div className="faint" style={{ marginTop: 12, textAlign: 'center' }}>
          {tdeeLabel(computed)}
          {intakeHint && <div style={{ marginTop: 3 }}>{intakeHint}</div>}
        </div>
      </div>

      {/* 餐次 */}
      {MEAL_ORDER.map((meal) => {
        const items = logs.filter((l) => l.meal === meal)
        const sum = items.reduce((a, b) => a + b.kcal, 0)
        return (
          <div className="card" key={meal}>
            <div className="meal-head">
              <span className="meal-name">{MEAL_LABEL[meal]}</span>
              <span className="muted num tiny">{Math.round(sum)} kcal</span>
            </div>

            {items.map((l) => (
              <div className="log-item" key={l.id}>
                <div className="grow">
                  <div className="log-name">{l.foodName}</div>
                  <div className="log-macro">
                    {trim(l.qty)} {l.unitName} · 蛋{Math.round(l.protein)} 脂
                    {Math.round(l.fat)} 碳{Math.round(l.carb)}
                  </div>
                </div>
                <div className="log-kcal">{Math.round(l.kcal)}</div>
                <button
                  className="faint"
                  style={{ padding: '4px 2px 4px 6px', fontSize: 16 }}
                  onClick={() => l.id && void handleDelete(l.id)}
                  aria-label="删除"
                >
                  ×
                </button>
              </div>
            ))}

            <button className="add-btn" onClick={() => setPickerMeal(meal)}>
              + 添加食物
            </button>
          </div>
        )
      })}

      {pickerMeal && (
        <FoodPicker
          meal={pickerMeal}
          onClose={() => setPickerMeal(null)}
          onPick={async (food, qty) => {
            await handleAdd(food, pickerMeal, qty)
            setPickerMeal(null)
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function MacroBar({
  name,
  cur,
  target,
  unit,
  color,
  emphasize
}: {
  name: string
  cur: number
  target: number
  unit: string
  color: string
  emphasize?: boolean
}) {
  const pct = target > 0 ? (cur / target) * 100 : 0
  const over = cur > target
  return (
    <div className={`macro${over ? ' over' : ''}`}>
      <div className="macro-head">
        <span className="macro-name">
          {name}
          {emphasize && !over && cur < target * 0.8 && (
            <span style={{ color: 'var(--warn)', marginLeft: 6, fontSize: 11 }}>
              还差 {Math.round(target - cur)}
              {unit}
            </span>
          )}
        </span>
        <span className="macro-val">
          <span className="cur num" style={{ color: over ? 'var(--bad)' : undefined }}>
            {Math.round(cur)}
          </span>
          <span className="tgt num">
            {' '}
            / {target} {unit}
          </span>
        </span>
      </div>
      <div className="bar">
        <div
          className="bar-fill"
          style={{
            width: `${Math.min(100, pct)}%`,
            background: over ? 'var(--bad)' : color
          }}
        />
      </div>
    </div>
  )
}

function tdeeLabel(c: Computed): string {
  if (c.tdeeSource === 'override') return `TDEE ${c.tdee} kcal（手动设定）`
  if (c.tdeeSource === 'adaptive') {
    const conf = c.adaptive ? Math.round(c.adaptive.confidence * 100) : 0
    return `TDEE ${c.tdee} kcal（自适应实测 · 可信度 ${conf}%）`
  }
  return `TDEE ${c.tdee} kcal（公式估算，记录两周后自动校准）`
}

function formatDay(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${Number(m)}月${Number(d)}日`
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
}
