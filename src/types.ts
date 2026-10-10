// 全局类型定义

export type Sex = 'male' | 'female'

/** 餐次 */
export type MealKey = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export const MEAL_LABEL: Record<MealKey, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐'
}

export const MEAL_ORDER: MealKey[] = ['breakfast', 'lunch', 'dinner', 'snack']

/** 肌群 */
export type MuscleKey =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'

export const MUSCLE_LABEL: Record<MuscleKey, string> = {
  chest: '胸',
  back: '背',
  shoulders: '肩',
  biceps: '肱二头',
  triceps: '肱三头',
  quads: '股四头',
  hamstrings: '腘绳肌',
  glutes: '臀',
  calves: '小腿',
  core: '核心'
}

/** 用户档案（首次打开设置页填写，只存 IndexedDB，不入代码库） */
export interface Profile {
  id: 1
  sex: Sex
  age: number
  heightCm: number
  startWeightKg: number
  targetWeightKg: number
  /** 体脂率 %，可选。有值时 BMR 用 Katch-McArdle 与 Mifflin 折中 */
  bodyFatPct?: number
  /** 活动系数，1.2 久坐 / 1.375 轻度 / 1.5 中度 / 1.55 较高 / 1.725 高 */
  activityFactor: number
  /** 目标减重速率 kg/周（正数表示减重） */
  rateKgPerWeek: number
  /** 蛋白质目标 g/kg 去脂体重 */
  proteinPerKgLbm: number
  /** 脂肪占热量比 0–1 */
  fatPctOfKcal: number
  /** 手动覆盖 TDEE（设了就不用自适应值） */
  tdeeOverride?: number
  /** 是否启用自适应 TDEE */
  adaptiveEnabled: boolean
  setupDone: boolean
  createdAt: string
}

/** 食物库条目。所有营养值都是「每 1 个单位」 */
export interface Food {
  id?: number
  name: string
  /** 搜索别名，如「鸡腿饭」的 aliases: ['鸡腿','腿饭'] */
  aliases: string[]
  category: string
  /** 目视单位：份 / 碗 / 个 / 拳 / 勺 */
  unitName: string
  /** 一个单位大约多少克（可选，用于参考） */
  unitGrams?: number
  kcal: number
  protein: number
  fat: number
  carb: number
  fiber?: number
  isCustom?: boolean
  /** 使用次数，用于「常用」排序 */
  useCount: number
  lastUsedAt?: string
  note?: string
}

/** 一条饮食记录（营养值是录入时的快照，改食物库不影响历史） */
export interface LogEntry {
  id?: number
  /** YYYY-MM-DD */
  date: string
  meal: MealKey
  foodId: number
  foodName: string
  qty: number
  unitName: string
  kcal: number
  protein: number
  fat: number
  carb: number
  createdAt: string
}

/** 体重记录 */
export interface WeightEntry {
  id?: number
  date: string
  kg: number
  /** 是否标准条件（晨起、排空、空腹）。非标准数据在算法中降权 */
  standard: boolean
  note?: string
  createdAt: string
}

/** TDEE 估算历史，每周一条 */
export interface TdeePoint {
  id?: number
  date: string
  value: number
  method: 'formula' | 'adaptive'
  /** 计算时用到的平均摄入 */
  avgIntake?: number
  /** 计算窗口内的趋势体重变化 */
  deltaKg?: number
  /** 窗口天数 */
  windowDays?: number
}

export type ExerciseType = 'weight' | 'bodyweight' | 'timed'

/** 动作库 */
export interface Exercise {
  id?: number
  name: string
  muscle: MuscleKey
  /** 次要肌群 */
  secondary?: MuscleKey[]
  equipment: string
  type: ExerciseType
  cues?: string
}

/** 训练计划里的一项（内嵌在 ProgramDay 中） */
export interface ProgramItem {
  exerciseId: number
  exerciseName: string
  sets: number
  repMin: number
  repMax: number
  /** 允许的最大 RPE，超过说明该加重了 */
  rpeMax: number
  restSec: number
  order: number
}

/** 训练日 */
export interface ProgramDay {
  id?: number
  programId: number
  /** 0-based */
  index: number
  title: string
  /** 建议放在周几，1=周一 … 7=周日 */
  weekdayHint: number
  items: ProgramItem[]
}

/** 一次实际训练 */
export interface Session {
  id?: number
  date: string
  programDayIndex: number
  title: string
  startedAt?: string
  finishedAt?: string
  /** 手动标记「今天到此为止」——允许提前结束并照样划线 */
  partial: boolean
  note?: string
}

/** 每一组的记录 */
export interface SetLog {
  id?: number
  sessionId: number
  date: string
  exerciseId: number
  /** 0-based 组序 */
  setIndex: number
  weightKg: number
  reps: number
  rpe?: number
  done: boolean
  createdAt: string
}

/** 单日营养汇总 */
export interface DayTotals {
  kcal: number
  protein: number
  fat: number
  carb: number
}
