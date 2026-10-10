/**
 * 第一版食物库种子数据
 *
 * 设计原则：
 *   - 全是「一份 / 一个 / 一碗」这种目视单位，因为食堂菜没法称重
 *   - 优先覆盖真实会吃的东西：食堂鸡腿饭、鸭腿饭、新疆本地食物
 *   - 数值是估算值（食堂份量差异很大），用几天后按自己的实际情况在 App 里改
 *
 * 注意：食堂炒菜用油普遍比家里多，脂肪那一栏别按家常菜估。
 */

import type { Food } from '../types'

/** 只填必要字段，其余在 initSeed 里补 */
type SeedFood = Omit<Food, 'id' | 'useCount'>

export const SEED_FOODS: SeedFood[] = [
  // =========================================================================
  // 食堂主力：套餐饭（他的主要食物，放最前面）
  // =========================================================================
  {
    name: '鸡腿饭（食堂一份）',
    aliases: ['鸡腿饭', '鸡腿套餐', '腿饭'],
    category: '食堂套餐',
    unitName: '份',
    unitGrams: 480,
    kcal: 650,
    protein: 30,
    fat: 20,
    carb: 72,
    note: '含一个中等鸡腿 + 一份米饭 + 配菜。米饭减半可省约 145 kcal'
  },
  {
    name: '鸭腿饭（食堂一份）',
    aliases: ['鸭腿饭', '鸭腿套餐'],
    category: '食堂套餐',
    unitName: '份',
    unitGrams: 480,
    kcal: 730,
    protein: 33,
    fat: 33,
    carb: 70,
    note: '鸭皮脂肪高，去皮可省约 90 kcal'
  },
  {
    name: '鸡腿饭 · 半份米饭',
    aliases: ['鸡腿饭半饭', '鸡腿饭少饭'],
    category: '食堂套餐',
    unitName: '份',
    kcal: 505,
    protein: 28,
    fat: 19,
    carb: 40,
    note: '点餐时说「半份饭」，最省事的热量控制手段'
  },
  {
    name: '鸭腿饭 · 半份米饭',
    aliases: ['鸭腿饭半饭', '鸭腿饭少饭'],
    category: '食堂套餐',
    unitName: '份',
    kcal: 585,
    protein: 31,
    fat: 32,
    carb: 38
  },
  {
    name: '炒素菜 + 鸭腿（一份）',
    aliases: ['素菜鸭腿', '鸭腿素菜'],
    category: '食堂套餐',
    unitName: '份',
    kcal: 450,
    protein: 25,
    fat: 30,
    carb: 15,
    note: '高蛋白低碳水组合，减脂期很合适，但注意食堂油量大'
  },
  {
    name: '炒素菜 + 大鸡腿（一份）',
    aliases: ['素菜鸡腿', '鸡腿素菜'],
    category: '食堂套餐',
    unitName: '份',
    kcal: 350,
    protein: 25,
    fat: 22,
    carb: 14
  },

  // =========================================================================
  // 单个肉
  // =========================================================================
  {
    name: '大鸡腿（卤/烤，1个）',
    aliases: ['鸡腿', '大鸡腿', '卤鸡腿', '烤鸡腿'],
    category: '肉类',
    unitName: '个',
    unitGrams: 120,
    kcal: 200,
    protein: 22,
    fat: 12,
    carb: 1,
    note: '去皮可省约 50 kcal、少 6g 脂肪'
  },
  {
    name: '卤鸭腿（1个）',
    aliases: ['鸭腿', '卤鸭腿'],
    category: '肉类',
    unitName: '个',
    unitGrams: 130,
    kcal: 300,
    protein: 22,
    fat: 23,
    carb: 1
  },
  {
    name: '炸鸡腿（1个）',
    aliases: ['炸鸡腿', '炸鸡'],
    category: '肉类',
    unitName: '个',
    unitGrams: 120,
    kcal: 290,
    protein: 20,
    fat: 19,
    carb: 10,
    note: '裹粉油炸，热量比卤鸡腿高约 45%'
  },
  {
    name: '鸡胸肉（熟，100g）',
    aliases: ['鸡胸', '鸡胸肉'],
    category: '肉类',
    unitName: '100g',
    unitGrams: 100,
    kcal: 165,
    protein: 31,
    fat: 3.6,
    carb: 0,
    note: '蛋白/热量比最高的天然食物，能买到就优先吃'
  },
  {
    name: '烤羊肉串（1串）',
    aliases: ['羊肉串', '烤肉串', '烤串'],
    category: '肉类',
    unitName: '串',
    unitGrams: 30,
    kcal: 70,
    protein: 6,
    fat: 5,
    carb: 0.5
  },

  // =========================================================================
  // 主食
  // =========================================================================
  {
    name: '白米饭（食堂一份）',
    aliases: ['米饭', '白饭', '大米饭'],
    category: '主食',
    unitName: '份',
    unitGrams: 250,
    kcal: 290,
    protein: 6.5,
    fat: 0.8,
    carb: 65,
    note: '食堂默认份量约 250g 熟重。减脂期最容易省下的就是这一项'
  },
  {
    name: '白米饭（半份）',
    aliases: ['半份米饭', '少饭'],
    category: '主食',
    unitName: '份',
    unitGrams: 125,
    kcal: 145,
    protein: 3.3,
    fat: 0.4,
    carb: 32
  },
  {
    name: '馒头（1个）',
    aliases: ['馒头', '白馒头'],
    category: '主食',
    unitName: '个',
    unitGrams: 100,
    kcal: 220,
    protein: 7,
    fat: 1,
    carb: 47
  },
  {
    name: '花卷（1个）',
    aliases: ['花卷'],
    category: '主食',
    unitName: '个',
    unitGrams: 90,
    kcal: 195,
    protein: 5,
    fat: 4,
    carb: 35
  },
  {
    name: '馕（1个）',
    aliases: ['馕', '新疆馕'],
    category: '主食',
    unitName: '个',
    unitGrams: 200,
    kcal: 560,
    protein: 16,
    fat: 7,
    carb: 108,
    note: '热量密度很高，一个馕约等于两碗米饭'
  },
  {
    name: '面条（熟，1碗）',
    aliases: ['面条', '挂面', '汤面'],
    category: '主食',
    unitName: '碗',
    unitGrams: 250,
    kcal: 280,
    protein: 9,
    fat: 1.5,
    carb: 56
  },
  {
    name: '粥（1碗）',
    aliases: ['粥', '白粥', '小米粥'],
    category: '主食',
    unitName: '碗',
    unitGrams: 300,
    kcal: 90,
    protein: 2,
    fat: 0.5,
    carb: 19
  },

  // =========================================================================
  // 新疆本地（热量核弹，必须建库才躲得开）
  // =========================================================================
  {
    name: '拌面/拉条子（一份）',
    aliases: ['拌面', '拉条子', '新疆拌面'],
    category: '新疆特色',
    unitName: '份',
    unitGrams: 500,
    kcal: 850,
    protein: 22,
    fat: 28,
    carb: 125,
    note: '碳水+油双高，蛋白质却很少。减脂期不建议频繁吃'
  },
  {
    name: '大盘鸡（一人份）',
    aliases: ['大盘鸡'],
    category: '新疆特色',
    unitName: '份',
    unitGrams: 300,
    kcal: 550,
    protein: 30,
    fat: 33,
    carb: 25,
    note: '鸡肉本身没问题，热量主要在油和土豆。少蘸汤汁'
  },
  {
    name: '抓饭（一份）',
    aliases: ['抓饭', '手抓饭', '羊肉抓饭'],
    category: '新疆特色',
    unitName: '份',
    unitGrams: 350,
    kcal: 750,
    protein: 18,
    fat: 30,
    carb: 100
  },
  {
    name: '新疆老酸奶（150g）',
    aliases: ['酸奶', '老酸奶'],
    category: '奶制品',
    unitName: '杯',
    unitGrams: 150,
    kcal: 130,
    protein: 6,
    fat: 5,
    carb: 15
  },

  // =========================================================================
  // 食堂常见菜（按一份估）
  // =========================================================================
  {
    name: '炒素菜（食堂一份）',
    aliases: ['素菜', '炒青菜', '青菜'],
    category: '食堂菜品',
    unitName: '份',
    unitGrams: 200,
    kcal: 150,
    protein: 3,
    fat: 11,
    carb: 8,
    note: '食堂炒菜油大，脂肪那栏别按家常估。可要求「少油」'
  },
  {
    name: '番茄炒蛋（一份）',
    aliases: ['番茄炒蛋', '西红柿炒蛋'],
    category: '食堂菜品',
    unitName: '份',
    unitGrams: 220,
    kcal: 220,
    protein: 12,
    fat: 15,
    carb: 10
  },
  {
    name: '麻婆豆腐（一份）',
    aliases: ['麻婆豆腐', '豆腐'],
    category: '食堂菜品',
    unitName: '份',
    unitGrams: 200,
    kcal: 250,
    protein: 14,
    fat: 18,
    carb: 9
  },
  {
    name: '宫保鸡丁（一份）',
    aliases: ['宫保鸡丁', '鸡丁'],
    category: '食堂菜品',
    unitName: '份',
    unitGrams: 200,
    kcal: 350,
    protein: 20,
    fat: 22,
    carb: 18
  },
  {
    name: '青椒肉丝（一份）',
    aliases: ['青椒肉丝'],
    category: '食堂菜品',
    unitName: '份',
    unitGrams: 200,
    kcal: 280,
    protein: 15,
    fat: 20,
    carb: 10
  },
  {
    name: '土豆丝（一份）',
    aliases: ['土豆丝', '炒土豆丝'],
    category: '食堂菜品',
    unitName: '份',
    unitGrams: 200,
    kcal: 210,
    protein: 4,
    fat: 12,
    carb: 23,
    note: '本质是主食不是菜，别当蔬菜吃'
  },

  // =========================================================================
  // 早餐
  // =========================================================================
  {
    name: '肉包子（1个）',
    aliases: ['包子', '肉包'],
    category: '早餐',
    unitName: '个',
    unitGrams: 100,
    kcal: 200,
    protein: 7,
    fat: 8,
    carb: 25
  },
  {
    name: '煮鸡蛋（1个）',
    aliases: ['鸡蛋', '水煮蛋', '白煮蛋'],
    category: '蛋类',
    unitName: '个',
    unitGrams: 50,
    kcal: 70,
    protein: 6.5,
    fat: 5,
    carb: 0.5
  },
  {
    name: '煎鸡蛋（1个）',
    aliases: ['煎蛋', '荷包蛋'],
    category: '蛋类',
    unitName: '个',
    unitGrams: 55,
    kcal: 95,
    protein: 6.5,
    fat: 7.5,
    carb: 0.5
  },
  {
    name: '蛋炒饭（一份）',
    aliases: ['蛋炒饭', '炒饭'],
    category: '食堂套餐',
    unitName: '份',
    unitGrams: 350,
    kcal: 600,
    protein: 15,
    fat: 22,
    carb: 80
  },
  {
    name: '兰州拉面（一碗）',
    aliases: ['拉面', '兰州拉面', '牛肉面'],
    category: '食堂套餐',
    unitName: '碗',
    unitGrams: 600,
    kcal: 550,
    protein: 22,
    fat: 15,
    carb: 80
  },

  // =========================================================================
  // 奶 / 饮品 / 补剂
  // =========================================================================
  {
    name: '全脂牛奶（250ml）',
    aliases: ['牛奶', '纯牛奶'],
    category: '奶制品',
    unitName: '盒',
    unitGrams: 250,
    kcal: 155,
    protein: 8,
    fat: 8.5,
    carb: 12
  },
  {
    name: '脱脂牛奶（250ml）',
    aliases: ['脱脂奶', '脱脂牛奶'],
    category: '奶制品',
    unitName: '盒',
    unitGrams: 250,
    kcal: 85,
    protein: 8.5,
    fat: 0.5,
    carb: 12,
    note: '同样蛋白少 70 kcal，减脂期更划算'
  },
  {
    name: '无糖豆浆（250ml）',
    aliases: ['豆浆', '无糖豆浆'],
    category: '饮品',
    unitName: '杯',
    unitGrams: 250,
    kcal: 60,
    protein: 7,
    fat: 3,
    carb: 3
  },
  {
    name: '有糖豆浆（250ml）',
    aliases: ['甜豆浆'],
    category: '饮品',
    unitName: '杯',
    unitGrams: 250,
    kcal: 120,
    protein: 7,
    fat: 4,
    carb: 15
  },
  {
    name: '乳清蛋白粉（1勺30g）',
    aliases: ['蛋白粉', '乳清蛋白', '蛋白粉一勺'],
    category: '补剂',
    unitName: '勺',
    unitGrams: 30,
    kcal: 120,
    protein: 24,
    fat: 1.5,
    carb: 3,
    note: '食堂吃不够蛋白时性价比最高的解法：4元买 24g 蛋白'
  },
  {
    name: '奶茶（中杯全糖）',
    aliases: ['奶茶', '珍珠奶茶'],
    category: '饮品',
    unitName: '杯',
    unitGrams: 500,
    kcal: 450,
    protein: 5,
    fat: 12,
    carb: 78,
    note: '一杯约等于两碗米饭，且几乎没有饱腹感'
  },
  {
    name: '可乐（330ml）',
    aliases: ['可乐', '汽水'],
    category: '饮品',
    unitName: '罐',
    unitGrams: 330,
    kcal: 140,
    protein: 0,
    fat: 0,
    carb: 35
  }
]
