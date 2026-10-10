/**
 * Dexie (IndexedDB) 表定义与种子数据
 *
 * 全部数据存在手机本地，不上传任何服务器。
 */

import Dexie, { type Table } from 'dexie'
import type {
  Exercise,
  Food,
  LogEntry,
  Profile,
  ProgramDay,
  Session,
  SetLog,
  TdeePoint,
  WeightEntry
} from './types'
import { SEED_FOODS } from './data/foods'
import { SEED_EXERCISES, SEED_PROGRAM } from './data/program'

export class HengDB extends Dexie {
  profile!: Table<Profile, number>
  foods!: Table<Food, number>
  logs!: Table<LogEntry, number>
  weights!: Table<WeightEntry, number>
  tdee!: Table<TdeePoint, number>
  exercises!: Table<Exercise, number>
  programDays!: Table<ProgramDay, number>
  sessions!: Table<Session, number>
  setLogs!: Table<SetLog, number>

  constructor() {
    super('heng')
    this.version(1).stores({
      profile: 'id',
      foods: '++id, name, category, useCount, lastUsedAt',
      logs: '++id, date, meal, foodId, [date+meal]',
      weights: '++id, &date',
      tdee: '++id, date',
      exercises: '++id, name, muscle',
      programDays: '++id, programId, index',
      sessions: '++id, date, programDayIndex, [date+programDayIndex]',
      setLogs: '++id, sessionId, date, exerciseId, [sessionId+exerciseId]'
    })
  }
}

export const db = new HengDB()

/**
 * 首次打开时灌入种子数据。
 * 只灌食物库、动作库和训练计划——用户档案和体重必须由用户自己填。
 */
export async function initSeed(): Promise<void> {
  const foodCount = await db.foods.count()
  if (foodCount === 0) {
    await db.foods.bulkAdd(SEED_FOODS.map((f) => ({ ...f, useCount: 0 })))
  }

  const exCount = await db.exercises.count()
  if (exCount === 0) {
    await db.exercises.bulkAdd(SEED_EXERCISES)
    // 动作自增 id 从 1 开始，SEED_PROGRAM 里的 exerciseId 与之对应
    await db.programDays.bulkAdd(SEED_PROGRAM)
  }
}

// ---------------------------------------------------------------------------
// 档案
// ---------------------------------------------------------------------------

export async function getProfile(): Promise<Profile | undefined> {
  return db.profile.get(1)
}

export async function saveProfile(p: Profile): Promise<void> {
  await db.profile.put({ ...p, id: 1 })
}

// ---------------------------------------------------------------------------
// 体重
// ---------------------------------------------------------------------------

export async function allWeights(): Promise<WeightEntry[]> {
  return db.weights.orderBy('date').toArray()
}

/** 同一天只保留一条记录，重复录入即覆盖 */
export async function upsertWeight(entry: Omit<WeightEntry, 'id'>): Promise<void> {
  const existing = await db.weights.where('date').equals(entry.date).first()
  if (existing?.id) {
    await db.weights.update(existing.id, entry)
  } else {
    await db.weights.add(entry)
  }
}

export async function latestWeight(): Promise<WeightEntry | undefined> {
  const list = await db.weights.orderBy('date').reverse().limit(1).toArray()
  return list[0]
}

// ---------------------------------------------------------------------------
// 饮食记录
// ---------------------------------------------------------------------------

export async function logsForDate(date: string): Promise<LogEntry[]> {
  return db.logs.where('date').equals(date).toArray()
}

export async function logsBetween(from: string, to: string): Promise<LogEntry[]> {
  return db.logs.where('date').between(from, to, true, true).toArray()
}

/**
 * 把一段时间内的记录聚合成「每日总摄入」，供自适应 TDEE 使用。
 */
export async function dailyIntakeMap(from: string, to: string): Promise<Map<string, number>> {
  const logs = await logsBetween(from, to)
  const map = new Map<string, number>()
  for (const l of logs) {
    map.set(l.date, (map.get(l.date) ?? 0) + l.kcal)
  }
  return map
}

/** 记录一条饮食，同时更新食物的使用频次（用于「常用」排序） */
export async function addLog(
  food: Food,
  date: string,
  meal: LogEntry['meal'],
  qty: number
): Promise<void> {
  const entry: LogEntry = {
    date,
    meal,
    foodId: food.id!,
    foodName: food.name,
    qty,
    unitName: food.unitName,
    kcal: round1(food.kcal * qty),
    protein: round1(food.protein * qty),
    fat: round1(food.fat * qty),
    carb: round1(food.carb * qty),
    createdAt: new Date().toISOString()
  }
  await db.logs.add(entry)
  if (food.id) {
    await db.foods.update(food.id, {
      useCount: (food.useCount ?? 0) + 1,
      lastUsedAt: new Date().toISOString()
    })
  }
}

export async function deleteLog(id: number): Promise<void> {
  await db.logs.delete(id)
}

// ---------------------------------------------------------------------------
// 训练
// ---------------------------------------------------------------------------

export async function allProgramDays(): Promise<ProgramDay[]> {
  const list = await db.programDays.toArray()
  return list.sort((a, b) => a.index - b.index)
}

/**
 * 查当天某个训练日的 session，不存在返回 undefined。
 * 用它而不是 getOrCreateSession，是为了避免「只是点开看看」就产生一堆空记录。
 */
export async function findSession(
  date: string,
  dayIndex: number
): Promise<Session | undefined> {
  return db.sessions.where('[date+programDayIndex]').equals([date, dayIndex]).first()
}

/**
 * 取某天某个训练日的 session，没有就建一个。
 * 在用户第一次勾选某一组时调用。
 */
export async function getOrCreateSession(date: string, day: ProgramDay): Promise<Session> {
  const existing = await findSession(date, day.index)
  if (existing) return existing

  const id = await db.sessions.add({
    date,
    programDayIndex: day.index,
    title: day.title,
    partial: false
  })
  return (await db.sessions.get(id))!
}

/** 某一周内所有 session（用于「本周达标 X/4」） */
export async function sessionsBetween(from: string, to: string): Promise<Session[]> {
  return db.sessions.where('date').between(from, to, true, true).toArray()
}

export async function setsForSession(sessionId: number): Promise<SetLog[]> {
  return db.setLogs.where('sessionId').equals(sessionId).toArray()
}

/** 勾选/取消某一组。第一组被勾上时自动记开始时间 */
export async function toggleSet(
  session: Session,
  exercise: { id: number; name: string },
  setIndex: number,
  defaults: { weightKg: number; reps: number; rpe?: number }
): Promise<void> {
  const row = await db.setLogs
    .where('[sessionId+exerciseId]')
    .equals([session.id!, exercise.id])
    .filter((s) => s.setIndex === setIndex)
    .first()

  if (row?.id) {
    await db.setLogs.update(row.id, { done: !row.done })
  } else {
    await db.setLogs.add({
      sessionId: session.id!,
      date: session.date,
      exerciseId: exercise.id,
      setIndex,
      weightKg: defaults.weightKg,
      reps: defaults.reps,
      rpe: defaults.rpe,
      done: true,
      createdAt: new Date().toISOString()
    })
  }

  if (!session.startedAt) {
    await db.sessions.update(session.id!, { startedAt: new Date().toISOString() })
  }
}

export async function updateSet(
  sessionId: number,
  exerciseId: number,
  setIndex: number,
  patch: Partial<SetLog>
): Promise<void> {
  const row = await db.setLogs
    .where('[sessionId+exerciseId]')
    .equals([sessionId, exerciseId])
    .filter((s) => s.setIndex === setIndex)
    .first()
  if (row?.id) {
    await db.setLogs.update(row.id, patch)
  } else {
    await db.setLogs.add({
      sessionId,
      date: '',
      exerciseId,
      setIndex,
      weightKg: 0,
      reps: 0,
      done: false,
      createdAt: new Date().toISOString(),
      ...patch
    } as SetLog)
  }
}

/** 找出某个动作上一次的训练数据，用于「上次用了多少」提示和渐进超负荷建议 */
export async function lastPerformance(
  exerciseId: number,
  beforeDate: string
): Promise<SetLog[]> {
  const rows = await db.setLogs
    .where('exerciseId')
    .equals(exerciseId)
    .filter((s) => s.done && s.date < beforeDate)
    .toArray()
  if (rows.length === 0) return []
  rows.sort((a, b) => (a.date < b.date ? 1 : -1))
  const lastDate = rows[0].date
  return rows.filter((r) => r.date === lastDate).sort((a, b) => a.setIndex - b.setIndex)
}

// ---------------------------------------------------------------------------
// TDEE
// ---------------------------------------------------------------------------

export async function latestTdee(): Promise<TdeePoint | undefined> {
  const list = await db.tdee.orderBy('date').reverse().limit(1).toArray()
  return list[0]
}

export async function allTdee(): Promise<TdeePoint[]> {
  return db.tdee.orderBy('date').toArray()
}

/** 同一天只保留一条 */
export async function recordTdee(point: Omit<TdeePoint, 'id'>): Promise<void> {
  const existing = await db.tdee.where('date').equals(point.date).first()
  if (existing?.id) {
    await db.tdee.update(existing.id, point)
  } else {
    await db.tdee.add(point)
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
