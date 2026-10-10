/**
 * 数据导出 / 导入。
 *
 * 数据全是本地的，所以「能带走」是底线功能——换手机、清缓存、误删浏览器数据
 * 都靠它兜底。Android Chrome 的 PWA 存储虽然稳，但不该赌。
 */

import { db } from '../db'
import { buildTrend, toISO } from './tdee'

export interface Dump {
  app: 'heng'
  version: number
  exportedAt: string
  profile: unknown[]
  foods: unknown[]
  logs: unknown[]
  weights: unknown[]
  tdee: unknown[]
  exercises: unknown[]
  programDays: unknown[]
  sessions: unknown[]
  setLogs: unknown[]
}

export async function dumpAll(): Promise<Dump> {
  const [
    profile,
    foods,
    logs,
    weights,
    tdee,
    exercises,
    programDays,
    sessions,
    setLogs
  ] = await Promise.all([
    db.profile.toArray(),
    db.foods.toArray(),
    db.logs.toArray(),
    db.weights.toArray(),
    db.tdee.toArray(),
    db.exercises.toArray(),
    db.programDays.toArray(),
    db.sessions.toArray(),
    db.setLogs.toArray()
  ])

  return {
    app: 'heng',
    version: 1,
    exportedAt: new Date().toISOString(),
    profile,
    foods,
    logs,
    weights,
    tdee,
    exercises,
    programDays,
    sessions,
    setLogs
  }
}

export function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportJSON(): Promise<void> {
  const dump = await dumpAll()
  const stamp = toISO(new Date())
  download(
    `heng-backup-${stamp}.json`,
    JSON.stringify(dump, null, 2),
    'application/json'
  )
}

/**
 * 导出「每日汇总」CSV——比原始记录更适合丢进 Excel 看趋势。
 * 列：日期, 热量, 蛋白, 脂肪, 碳水, 实际体重, 趋势体重
 */
export async function exportCSV(): Promise<void> {
  const [logs, weights] = await Promise.all([db.logs.toArray(), db.weights.toArray()])

  const daily = new Map<string, { kcal: number; p: number; f: number; c: number }>()
  for (const l of logs) {
    const cur = daily.get(l.date) ?? { kcal: 0, p: 0, f: 0, c: 0 }
    cur.kcal += l.kcal
    cur.p += l.protein
    cur.f += l.fat
    cur.c += l.carb
    daily.set(l.date, cur)
  }

  const trend = buildTrend(weights)
  const trendByDate = new Map(trend.map((t) => [t.date, t.trend]))
  const rawByDate = new Map(weights.map((w) => [w.date, w.kg]))

  const allDates = [...new Set([...daily.keys(), ...weights.map((w) => w.date)])].sort()

  const rows: string[] = ['日期,热量kcal,蛋白g,脂肪g,碳水g,实际体重kg,趋势体重kg']
  for (const d of allDates) {
    const t = daily.get(d)
    const t2 = trendByDate.get(d)
    rows.push(
      [
        d,
        t ? round0(t.kcal) : '',
        t ? round1(t.p) : '',
        t ? round1(t.f) : '',
        t ? round1(t.c) : '',
        rawByDate.get(d) ?? '',
        t2 !== undefined ? round2(t2) : ''
      ].join(',')
    )
  }

  download(`heng-daily-${toISO(new Date())}.csv`, '\uFEFF' + rows.join('\n'), 'text/csv')
}

/** 从 JSON 备份恢复。会清空现有数据。 */
export async function importJSON(text: string): Promise<{ ok: true; counts: Record<string, number> }> {
  const data = JSON.parse(text) as Partial<Dump>
  if (data.app !== 'heng') {
    throw new Error('这不是「衡」的备份文件')
  }

  await db.transaction(
    'rw',
    [
      db.profile,
      db.foods,
      db.logs,
      db.weights,
      db.tdee,
      db.exercises,
      db.programDays,
      db.sessions,
      db.setLogs
    ],
    async () => {
      await Promise.all([
        db.profile.clear(),
        db.foods.clear(),
        db.logs.clear(),
        db.weights.clear(),
        db.tdee.clear(),
        db.exercises.clear(),
        db.programDays.clear(),
        db.sessions.clear(),
        db.setLogs.clear()
      ])

      if (data.profile?.length) await db.profile.bulkAdd(data.profile as never[])
      if (data.foods?.length) await db.foods.bulkAdd(data.foods as never[])
      if (data.logs?.length) await db.logs.bulkAdd(data.logs as never[])
      if (data.weights?.length) await db.weights.bulkAdd(data.weights as never[])
      if (data.tdee?.length) await db.tdee.bulkAdd(data.tdee as never[])
      if (data.exercises?.length) await db.exercises.bulkAdd(data.exercises as never[])
      if (data.programDays?.length) await db.programDays.bulkAdd(data.programDays as never[])
      if (data.sessions?.length) await db.sessions.bulkAdd(data.sessions as never[])
      if (data.setLogs?.length) await db.setLogs.bulkAdd(data.setLogs as never[])
    }
  )

  return {
    ok: true,
    counts: {
      食物: data.foods?.length ?? 0,
      饮食记录: data.logs?.length ?? 0,
      体重: data.weights?.length ?? 0,
      训练: data.sessions?.length ?? 0,
      组记录: data.setLogs?.length ?? 0
    }
  }
}

function round0(n: number): string {
  return String(Math.round(n))
}
function round1(n: number): string {
  return String(Math.round(n * 10) / 10)
}
function round2(n: number): string {
  return String(Math.round(n * 100) / 100)
}
