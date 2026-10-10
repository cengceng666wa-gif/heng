/**
 * 训练页。
 *
 * 「完成一项就划掉」分三层，自下而上自动推导：
 *   组级   —— 勾某一组
 *   动作级 —— 该动作所有目标组都勾上 → 动作名划线
 *   日级   —— 该训练日所有动作完成 → 整张卡片划线
 *
 * 另有一条逃生通道：某天只有 20 分钟，练两个动作就走，
 * 可以点「今天到此为止」——日级照样划线，但记录标成「部分完成」。
 * 现有 App 大多做得很差（要么全勾要么全废），真实生活里这条通道必须有。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  allProgramDays,
  db,
  findSession,
  getOrCreateSession,
  lastPerformance,
  sessionsBetween,
  setsForSession,
  toggleSet,
  updateSet
} from '../db'
import type { Exercise, ProgramDay, Session, SetLog } from '../types'
import { MUSCLE_LABEL } from '../types'
import { addDays, isoWeekday, todayISO } from '../lib/tdee'

interface Props {
  onChanged: () => void | Promise<void>
}

interface Pending {
  weight: number
  reps: number
}

export default function Train({ onChanged }: Props) {
  const [days, setDays] = useState<ProgramDay[]>([])
  const [exMap, setExMap] = useState<Map<number, Exercise>>(new Map())
  const [date, setDate] = useState(todayISO())
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [sets, setSets] = useState<SetLog[]>([])
  const [pending, setPending] = useState<Record<number, Pending>>({})
  const [lastPerf, setLastPerf] = useState<Record<number, string>>({})
  const [weekDone, setWeekDone] = useState(0)
  const [tick, setTick] = useState(0)

  // 初始化：计划与动作库
  useEffect(() => {
    void (async () => {
      const [ds, exs] = await Promise.all([allProgramDays(), db.exercises.toArray()])
      setDays(ds)
      setExMap(new Map(exs.map((e) => [e.id!, e])))

      // 默认展开今天该练的那天。
      // 休息日就展开「下一个训练日」——否则四张卡片全收起，
      // 用户想补练一次却找不到入口。
      const wd = isoWeekday(todayISO())
      const exact = ds.find((d) => d.weekdayHint === wd)
      const fallback = ds.find((d) => d.weekdayHint > wd) ?? ds[0]
      const target = exact ?? fallback
      setOpenIndex(target ? target.index : null)
    })()
  }, [])

  // 本周完成度
  useEffect(() => {
    void (async () => {
      const today = todayISO()
      const wd = isoWeekday(today)
      const monday = addDays(today, -(wd - 1))
      const sunday = addDays(monday, 6)
      const list = await sessionsBetween(monday, sunday)
      let done = 0
      for (const s of list) {
        if (s.partial) {
          done++
          continue
        }
        const rows = await setsForSession(s.id!)
        const day = days.find((d) => d.index === s.programDayIndex)
        if (day && isDayComplete(day, rows)) done++
      }
      setWeekDone(done)
    })()
  }, [days, tick])

  // 载入当前展开训练日的数据
  const reloadDay = useCallback(async () => {
    if (openIndex === null) return
    const day = days.find((d) => d.index === openIndex)
    if (!day) return

    const s = await findSession(date, day.index)
    setSession(s ?? null)
    setSets(s ? await setsForSession(s.id!) : [])

    // 「上次用了多少」提示 + 新组的默认值
    const pend: Record<number, Pending> = {}
    const hints: Record<number, string> = {}
    for (const item of day.items) {
      const prev = await lastPerformance(item.exerciseId, date)
      if (prev.length > 0) {
        const top = prev.reduce((a, b) => (b.weightKg > a.weightKg ? b : a), prev[0])
        pend[item.exerciseId] = { weight: top.weightKg, reps: top.reps }
        hints[item.exerciseId] = `${prev.length} 组 · 最高 ${top.weightKg}kg×${top.reps}`
      } else {
        pend[item.exerciseId] = { weight: 0, reps: item.repMax }
      }
    }
    setPending(pend)
    setLastPerf(hints)
  }, [openIndex, days, date])

  useEffect(() => {
    void reloadDay()
  }, [reloadDay, tick])

  const refresh = useCallback(async () => {
    setTick((n) => n + 1)
    await onChanged()
  }, [onChanged])

  const todaySuggest = useMemo(() => {
    const wd = isoWeekday(date)
    return days.find((d) => d.weekdayHint === wd) ?? null
  }, [days, date])

  async function handleToggle(day: ProgramDay, item: ProgramDay['items'][number], setIndex: number) {
    const ex = exMap.get(item.exerciseId)
    if (!ex) return
    const s = await getOrCreateSession(date, day)
    const p = pending[item.exerciseId] ?? { weight: 0, reps: item.repMax }
    await toggleSet(s, { id: item.exerciseId, name: item.exerciseName }, setIndex, {
      weightKg: p.weight,
      reps: p.reps
    })
    await refresh()
  }

  async function handleSetChange(
    item: ProgramDay['items'][number],
    setIndex: number,
    patch: Partial<SetLog>,
    day: ProgramDay
  ) {
    const s = await getOrCreateSession(date, day)
    await updateSet(s.id!, item.exerciseId, setIndex, patch)
    await refresh()
  }

  async function handlePending(item: ProgramDay['items'][number], p: Pending) {
    setPending((prev) => ({ ...prev, [item.exerciseId]: p }))
  }

  async function markPartial(day: ProgramDay) {
    const s = await getOrCreateSession(date, day)
    await db.sessions.update(s.id!, { partial: true, finishedAt: new Date().toISOString() })
    await refresh()
  }

  async function clearPartial(day: ProgramDay) {
    const s = await findSession(date, day.index)
    if (!s?.id) return
    await db.sessions.update(s.id, { partial: false })
    await refresh()
  }

  return (
    <div className="page">
      <h1 className="page-title">训练</h1>

      {/* 日期 + 本周达标 */}
      <div className="row-between" style={{ marginBottom: 12 }}>
        <button className="btn ghost sm" onClick={() => setDate(addDays(date, -1))}>
          ‹
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>
            {date === todayISO() ? '今天' : shortDate(date)}
          </div>
          <div className="faint">本周达标 {weekDone}/4</div>
        </div>
        <button
          className="btn ghost sm"
          disabled={date >= todayISO()}
          style={{ opacity: date >= todayISO() ? 0.3 : 1 }}
          onClick={() => setDate(addDays(date, 1))}
        >
          ›
        </button>
      </div>

      {/* 今天该练 */}
      {date === todayISO() && (
        <div className="card" style={{ borderColor: 'rgba(79,156,240,0.32)' }}>
          <div className="card-title">今天</div>
          {todaySuggest ? (
            <div className="row">
              <div className="grow">
                <div className="session-title">{todaySuggest.title}</div>
                <div className="faint">
                  {todaySuggest.items.length} 个动作 ·{' '}
                  {todaySuggest.items.reduce((a, b) => a + b.sets, 0)} 组
                </div>
              </div>
              <button
                className="btn sm"
                onClick={() => setOpenIndex(todaySuggest.index)}
              >
                去记录
              </button>
            </div>
          ) : (
            <div className="muted">
              今天休息。恢复也是训练的一部分。
              {(todaySuggest === null) && <br />}
              <span className="faint">
                想补练的话，点下面任意一个训练日就能记录。
              </span>
            </div>
          )}
        </div>
      )}

      {/* 四个训练日 */}
      {days.map((day) => {
        const isOpen = openIndex === day.index
        const daySets = isOpen ? sets : []
        const relatedSession = isOpen ? session : null
        const complete = isOpen && relatedSession
          ? relatedSession.partial || isDayComplete(day, daySets)
          : false

        return (
          <div
            className={`card session-card${complete ? ' done' : ''}`}
            key={day.index}
          >
            <button
              className="row-between"
              style={{ width: '100%', textAlign: 'left' }}
              onClick={() => setOpenIndex(isOpen ? null : day.index)}
            >
              <div className="grow">
                <div className="session-title">
                  {complete && '✓ '}
                  {day.title}
                </div>
                <div className="faint">
                  周{cnWeekday(day.weekdayHint)} · {day.items.length} 动作 ·{' '}
                  {day.items.reduce((a, b) => a + b.sets, 0)} 组
                  {relatedSession?.partial && ' · 部分完成'}
                </div>
              </div>
              <span className="faint">{isOpen ? '⌃' : '⌄'}</span>
            </button>

            {isOpen && (
              <div style={{ marginTop: 10 }}>
                {day.items.map((item) => {
                  const ex = exMap.get(item.exerciseId)
                  const itemSets = daySets.filter((s) => s.exerciseId === item.exerciseId)
                  const doneCount = itemSets.filter((s) => s.done).length
                  const itemDone = doneCount >= item.sets
                  const p = pending[item.exerciseId] ?? { weight: 0, reps: item.repMax }

                  return (
                    <div
                      className={`exercise${itemDone ? ' done' : ''}`}
                      key={item.exerciseId}
                    >
                      <div className="exercise-head">
                        <div className={`check${itemDone ? ' on' : ''}`}>✓</div>
                        <div className="grow">
                          <div className="exercise-name">
                            {item.exerciseName}
                            {ex && (
                              <span className="badge">{MUSCLE_LABEL[ex.muscle]}</span>
                            )}
                          </div>
                          <div className="exercise-target">
                            {item.sets} × {item.repMin}–{item.repMax}
                            {ex?.type === 'timed' ? ' 秒' : ' 次'} · RPE ≤ {item.rpeMax}
                            {doneCount > 0 && ` · 已完成 ${doneCount}/${item.sets}`}
                          </div>
                        </div>
                      </div>

                      {ex?.cues && <div className="exercise-cues">{ex.cues}</div>}

                      <div className="sets">
                        {Array.from({ length: item.sets }, (_, i) => {
                          const row = itemSets.find((s) => s.setIndex === i)
                          const on = row?.done ?? false
                          return (
                            <button
                              key={i}
                              className={`set-chip${on ? ' on' : ''}`}
                              onClick={() => void handleToggle(day, item, i)}
                            >
                              {chipLabel(
                                row?.weightKg ?? p.weight,
                                row?.reps ?? p.reps,
                                ex?.type
                              )}
                            </button>
                          )
                        })}
                      </div>

                      <div className="row" style={{ marginTop: 8, marginLeft: 27, gap: 6 }}>
                        {ex?.type === 'weight' && (
                          <>
                            <input
                              type="number"
                              inputMode="decimal"
                              step="2.5"
                              value={p.weight}
                              style={{ width: 78, padding: '6px 8px', fontSize: 13 }}
                              onChange={(e) =>
                                void handlePending(item, {
                                  ...p,
                                  weight: parseFloat(e.target.value) || 0
                                })
                              }
                            />
                            <span className="faint">kg ×</span>
                          </>
                        )}
                        <input
                          type="number"
                          inputMode="numeric"
                          value={p.reps}
                          style={{ width: 60, padding: '6px 8px', fontSize: 13 }}
                          onChange={(e) =>
                            void handlePending(item, {
                              ...p,
                              reps: parseInt(e.target.value, 10) || 0
                            })
                          }
                        />
                        <span className="faint">
                          {ex?.type === 'timed' ? '秒' : '次'}
                        </span>
                        {itemSets.length > 0 && (
                          <button
                            className="btn ghost sm"
                            style={{ marginLeft: 'auto' }}
                            onClick={() => {
                              for (const s of itemSets) {
                                void handleSetChange(
                                  item,
                                  s.setIndex,
                                  { weightKg: p.weight, reps: p.reps },
                                  day
                                )
                              }
                            }}
                          >
                            套用到全部
                          </button>
                        )}
                      </div>

                      {lastPerf[item.exerciseId] && (
                        <div className="exercise-cues">
                          上次：{lastPerf[item.exerciseId]}
                        </div>
                      )}
                    </div>
                  )
                })}

                <div className="btn-row">
                  {relatedSession?.partial ? (
                    <button className="btn ghost sm grow" onClick={() => void clearPartial(day)}>
                      取消「部分完成」标记
                    </button>
                  ) : (
                    <button className="btn ghost sm grow" onClick={() => void markPartial(day)}>
                      今天到此为止
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}

      <div className="faint" style={{ textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
        重量能完成次数上限且 RPE ≤ 8 时，下次加重：
        <br />
        上肢 +2.5kg，下肢 +5kg。这就是渐进超负荷。
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

/** 某个训练日是否所有动作的所有目标组都完成 */
function isDayComplete(day: ProgramDay, rows: SetLog[]): boolean {
  if (rows.length === 0) return false
  return day.items.every((item) => {
    const done = rows.filter((r) => r.exerciseId === item.exerciseId && r.done).length
    return done >= item.sets
  })
}

function fmtW(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/**
 * 组标签。分三种情况，别混为一谈：
 *   重量动作 + 已填重量 → 60×8
 *   自重动作            → 自重×8
 *   重量动作但还没填重量 → 8次（不能说「自重」，杠铃卧推不是自重）
 *   计时动作            → 45s
 */
function chipLabel(weightKg: number, reps: number, type?: string): string {
  if (type === 'timed') return `${reps}s`
  if (weightKg > 0) return `${fmtW(weightKg)}×${reps}`
  if (type === 'bodyweight') return `自重×${reps}`
  return `${reps} 次`
}

function cnWeekday(n: number): string {
  return ['一', '二', '三', '四', '五', '六', '日'][n - 1] ?? '?'
}

function shortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()} 周${cnWeekday(isoWeekday(iso))}`
}
