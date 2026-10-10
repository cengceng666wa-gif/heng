/**
 * 动作库与训练计划种子数据
 *
 * 计划：Upper / Lower 4 分化（上肢A → 下肢A → 休 → 上肢B → 下肢B → 休 → 休）
 *
 * 为什么是 4 分化而不是 PPL：
 *   PPL 是 3 天或 6 天的设计，硬塞进 4 天会让每个肌群每周只练 1 次。
 *   上下肢分化能以 4 天频率让每个肌群每周练到 2 次——这是新手增肌/减脂保肌的黄金频率。
 *
 * 为什么每个训练日只有 5–6 个动作：
 *   用户「试过但没坚持下来」。计划太长 = 给逃避找借口。
 *   60 分钟能做完的计划，才有人真的做完。这是行为设计，不是训练学。
 *
 * exerciseId 与下面 SEED_EXERCISES 的显式 id 一一对应。
 */

import type { Exercise, ProgramDay } from '../types'

const PROGRAM_ID = 1

/** 显式指定 id，避免依赖自增顺序 */
export const SEED_EXERCISES: Exercise[] = [
  // --- 上肢 A ---
  {
    id: 1,
    name: '杠铃卧推',
    muscle: 'chest',
    secondary: ['triceps', 'shoulders'],
    equipment: '杠铃',
    type: 'weight',
    cues: '肩胛后收下沉，杠铃落到胸骨中下部，肘约 45–60°'
  },
  {
    id: 2,
    name: '坐姿划船',
    muscle: 'back',
    secondary: ['biceps'],
    equipment: '器械',
    type: 'weight',
    cues: '先沉肩再拉，肘贴身后拉，不要耸肩'
  },
  {
    id: 3,
    name: '哑铃肩推',
    muscle: 'shoulders',
    secondary: ['triceps'],
    equipment: '哑铃',
    type: 'weight',
    cues: '核心收紧不要塌腰，下放到耳朵高度即可'
  },
  {
    id: 4,
    name: '高位下拉',
    muscle: 'back',
    secondary: ['biceps'],
    equipment: '器械',
    type: 'weight',
    cues: '想着用肘往下拉，不是用手拽'
  },
  {
    id: 5,
    name: '绳索下压',
    muscle: 'triceps',
    equipment: '绳索',
    type: 'weight',
    cues: '上臂夹紧固定不动，只有小臂在动'
  },
  {
    id: 6,
    name: '哑铃弯举',
    muscle: 'biceps',
    equipment: '哑铃',
    type: 'weight',
    cues: '肘别往前跑，下放阶段控制住'
  },

  // --- 下肢 A ---
  {
    id: 7,
    name: '腿举',
    muscle: 'quads',
    secondary: ['glutes'],
    equipment: '器械',
    type: 'weight',
    cues: '膝不要完全锁死，下放到大腿接近腹部'
  },
  {
    id: 8,
    name: '罗马尼亚硬拉',
    muscle: 'hamstrings',
    secondary: ['glutes', 'back'],
    equipment: '杠铃',
    type: 'weight',
    cues: '屈髋不屈膝，杠铃贴腿下滑，感受腘绳肌拉伸'
  },
  {
    id: 9,
    name: '腿屈伸',
    muscle: 'quads',
    equipment: '器械',
    type: 'weight'
  },
  {
    id: 10,
    name: '腿弯举',
    muscle: 'hamstrings',
    equipment: '器械',
    type: 'weight'
  },
  {
    id: 11,
    name: '站姿提踵',
    muscle: 'calves',
    equipment: '器械',
    type: 'weight',
    cues: '底部充分拉伸，顶部停一秒'
  },
  {
    id: 12,
    name: '平板支撑',
    muscle: 'core',
    equipment: '自重',
    type: 'timed',
    cues: '臀部和肩胛收紧，不要塌腰'
  },

  // --- 上肢 B ---
  {
    id: 13,
    name: '哑铃上斜卧推',
    muscle: 'chest',
    secondary: ['shoulders', 'triceps'],
    equipment: '哑铃',
    type: 'weight'
  },
  {
    id: 14,
    name: '引体向上',
    muscle: 'back',
    secondary: ['biceps'],
    equipment: '自重',
    type: 'bodyweight',
    cues: '做不了就用弹力带辅助，或用高位下拉替代'
  },
  {
    id: 15,
    name: '单臂哑铃划船',
    muscle: 'back',
    equipment: '哑铃',
    type: 'weight'
  },
  {
    id: 16,
    name: '哑铃侧平举',
    muscle: 'shoulders',
    equipment: '哑铃',
    type: 'weight',
    cues: '小重量高次数，不要用斜方肌代偿'
  },
  {
    id: 17,
    name: '面拉',
    muscle: 'shoulders',
    secondary: ['back'],
    equipment: '绳索',
    type: 'weight',
    cues: '对着脸拉，肘高于手，练后束和肩健康'
  },
  {
    id: 18,
    name: '锤式弯举',
    muscle: 'biceps',
    equipment: '哑铃',
    type: 'weight'
  },

  // --- 下肢 B ---
  {
    id: 19,
    name: '杠铃臀推',
    muscle: 'glutes',
    secondary: ['hamstrings'],
    equipment: '杠铃',
    type: 'weight',
    cues: '下巴微收，顶到躯干与地面平行即可，不要过度挺腰'
  },
  {
    id: 20,
    name: '卷腹',
    muscle: 'core',
    equipment: '自重',
    type: 'bodyweight'
  }
]

export const SEED_PROGRAM: ProgramDay[] = [
  {
    programId: PROGRAM_ID,
    index: 0,
    title: '上肢 A · 水平推拉',
    weekdayHint: 1,
    items: [
      { exerciseId: 1, exerciseName: '杠铃卧推', sets: 4, repMin: 6, repMax: 8, rpeMax: 8, restSec: 150, order: 0 },
      { exerciseId: 2, exerciseName: '坐姿划船', sets: 4, repMin: 8, repMax: 10, rpeMax: 8, restSec: 120, order: 1 },
      { exerciseId: 3, exerciseName: '哑铃肩推', sets: 3, repMin: 8, repMax: 10, rpeMax: 8, restSec: 120, order: 2 },
      { exerciseId: 4, exerciseName: '高位下拉', sets: 3, repMin: 10, repMax: 12, rpeMax: 8, restSec: 90, order: 3 },
      { exerciseId: 5, exerciseName: '绳索下压', sets: 3, repMin: 10, repMax: 12, rpeMax: 9, restSec: 60, order: 4 },
      { exerciseId: 6, exerciseName: '哑铃弯举', sets: 3, repMin: 10, repMax: 12, rpeMax: 9, restSec: 60, order: 5 }
    ]
  },
  {
    programId: PROGRAM_ID,
    index: 1,
    title: '下肢 A · 股四头为主',
    weekdayHint: 2,
    items: [
      { exerciseId: 7, exerciseName: '腿举', sets: 4, repMin: 8, repMax: 10, rpeMax: 8, restSec: 150, order: 0 },
      { exerciseId: 8, exerciseName: '罗马尼亚硬拉', sets: 3, repMin: 8, repMax: 10, rpeMax: 8, restSec: 150, order: 1 },
      { exerciseId: 9, exerciseName: '腿屈伸', sets: 3, repMin: 12, repMax: 15, rpeMax: 9, restSec: 90, order: 2 },
      { exerciseId: 10, exerciseName: '腿弯举', sets: 3, repMin: 12, repMax: 15, rpeMax: 9, restSec: 90, order: 3 },
      { exerciseId: 11, exerciseName: '站姿提踵', sets: 4, repMin: 12, repMax: 15, rpeMax: 9, restSec: 60, order: 4 },
      { exerciseId: 12, exerciseName: '平板支撑', sets: 3, repMin: 45, repMax: 60, rpeMax: 9, restSec: 60, order: 5 }
    ]
  },
  {
    programId: PROGRAM_ID,
    index: 2,
    title: '上肢 B · 垂直推拉',
    weekdayHint: 4,
    items: [
      { exerciseId: 13, exerciseName: '哑铃上斜卧推', sets: 4, repMin: 8, repMax: 10, rpeMax: 8, restSec: 120, order: 0 },
      { exerciseId: 14, exerciseName: '引体向上', sets: 3, repMin: 5, repMax: 8, rpeMax: 8, restSec: 150, order: 1 },
      { exerciseId: 15, exerciseName: '单臂哑铃划船', sets: 3, repMin: 8, repMax: 10, rpeMax: 8, restSec: 90, order: 2 },
      { exerciseId: 16, exerciseName: '哑铃侧平举', sets: 4, repMin: 12, repMax: 15, rpeMax: 9, restSec: 60, order: 3 },
      { exerciseId: 17, exerciseName: '面拉', sets: 3, repMin: 15, repMax: 20, rpeMax: 9, restSec: 60, order: 4 },
      { exerciseId: 18, exerciseName: '锤式弯举', sets: 3, repMin: 10, repMax: 12, rpeMax: 9, restSec: 60, order: 5 }
    ]
  },
  {
    programId: PROGRAM_ID,
    index: 3,
    title: '下肢 B · 后链为主',
    weekdayHint: 5,
    items: [
      { exerciseId: 19, exerciseName: '杠铃臀推', sets: 4, repMin: 8, repMax: 10, rpeMax: 8, restSec: 150, order: 0 },
      { exerciseId: 7, exerciseName: '腿举', sets: 3, repMin: 10, repMax: 12, rpeMax: 8, restSec: 120, order: 1 },
      { exerciseId: 10, exerciseName: '腿弯举', sets: 3, repMin: 10, repMax: 12, rpeMax: 9, restSec: 90, order: 2 },
      { exerciseId: 11, exerciseName: '站姿提踵', sets: 4, repMin: 12, repMax: 15, rpeMax: 9, restSec: 60, order: 3 },
      { exerciseId: 20, exerciseName: '卷腹', sets: 3, repMin: 15, repMax: 20, rpeMax: 9, restSec: 60, order: 4 }
    ]
  }
]

/** 每个肌群每周的组数区间（MEV–MRV），用于 v2 的训练量热力图 */
export const MUSCLE_VOLUME_TARGET: Record<string, { mev: number; mrv: number }> = {
  chest: { mev: 8, mrv: 22 },
  back: { mev: 10, mrv: 25 },
  shoulders: { mev: 8, mrv: 26 },
  biceps: { mev: 6, mrv: 20 },
  triceps: { mev: 6, mrv: 20 },
  quads: { mev: 8, mrv: 20 },
  hamstrings: { mev: 6, mrv: 20 },
  glutes: { mev: 4, mrv: 16 },
  calves: { mev: 6, mrv: 20 },
  core: { mev: 4, mrv: 16 }
}
