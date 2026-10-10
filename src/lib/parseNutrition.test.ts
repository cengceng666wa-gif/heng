/**
 * 粘贴解析器的测试。
 *
 * 这些用例不是凭空想的，是照着豆包（以及同类中文 AI）实际会输出的格式写的：
 *   - 一行一条、空格分隔
 *   - 一行一条、冒号分隔
 *   - markdown 表格（豆包很爱用）
 *   - 分点列表（菜名一行，营养各占一行）
 *   - 全角标点、markdown 加粗
 *
 * 换模型或换提问方式后输出格式会变，改解析器前先跑一遍这个。
 */

import { describe, expect, it } from 'vitest'
import { parseNutritionText } from './parseNutrition'

describe('一行一条 · 空格分隔', () => {
  it('解析出名称、份量、四项营养', () => {
    const r = parseNutritionText('鸡腿饭 1份 热量650千卡 蛋白质30克 脂肪20克 碳水72克')
    expect(r.items).toHaveLength(1)
    expect(r.items[0]).toMatchObject({
      name: '鸡腿饭',
      qty: 1,
      unit: '份',
      kcal: 650,
      protein: 30,
      fat: 20,
      carb: 72
    })
  })

  it('省略「热量」二字也能认出（650千卡）', () => {
    const r = parseNutritionText('鸡腿饭 650千卡 蛋白30克 脂肪20克 碳水72克')
    expect(r.items[0]).toMatchObject({
      name: '鸡腿饭',
      kcal: 650,
      protein: 30,
      fat: 20,
      carb: 72
    })
  })

  it('多行多条目', () => {
    const r = parseNutritionText(
      ['鸡腿饭 650千卡 蛋白30克 脂肪20克 碳水72克', '炒青菜 120千卡 蛋白3克 脂肪9克 碳水7克'].join(
        '\n'
      )
    )
    expect(r.items).toHaveLength(2)
    expect(r.items[0].name).toBe('鸡腿饭')
    expect(r.items[1]).toMatchObject({ name: '炒青菜', kcal: 120, fat: 9 })
  })

  it('带序号和项目符号', () => {
    const r = parseNutritionText('1. 鸡腿饭 650千卡 蛋白30克 脂肪20克 碳水72克')
    expect(r.items[0].name).toBe('鸡腿饭')
  })
})

describe('一行一条 · 冒号分隔', () => {
  it('中文冒号 + 约', () => {
    const r = parseNutritionText('鸡腿饭：热量约650千卡，蛋白质约30克，脂肪约20克，碳水约72克')
    expect(r.items[0]).toMatchObject({
      name: '鸡腿饭',
      kcal: 650,
      protein: 30,
      fat: 20,
      carb: 72
    })
  })

  it('全角数字与全角括号', () => {
    const r = parseNutritionText('鸡腿饭（１份）：热量６５０千卡 蛋白质３０克 脂肪２０克 碳水７２克')
    expect(r.items[0]).toMatchObject({
      name: '鸡腿饭',
      qty: 1,
      unit: '份',
      kcal: 650,
      protein: 30
    })
  })

  it('markdown 加粗不影响解析', () => {
    const r = parseNutritionText('**鸡腿饭**：热量650千卡，蛋白质30克，脂肪20克，碳水72克')
    expect(r.items[0].name).toBe('鸡腿饭')
    expect(r.items[0].kcal).toBe(650)
  })
})

describe('markdown 表格', () => {
  it('标准表头顺序', () => {
    const r = parseNutritionText(
      [
        '| 食物 | 份量 | 热量 | 蛋白质 | 脂肪 | 碳水 |',
        '| --- | --- | --- | --- | --- | --- |',
        '| 鸡腿饭 | 1份 | 650 | 30 | 20 | 72 |',
        '| 炒青菜 | 1份 | 120 | 3 | 9 | 7 |'
      ].join('\n')
    )
    expect(r.items).toHaveLength(2)
    expect(r.items[0]).toMatchObject({
      name: '鸡腿饭',
      qty: 1,
      unit: '份',
      kcal: 650,
      protein: 30,
      fat: 20,
      carb: 72
    })
    expect(r.items[1]).toMatchObject({ name: '炒青菜', kcal: 120 })
  })

  it('表头顺序被打乱也能按列名对上', () => {
    const r = parseNutritionText(
      [
        '| 食物 | 碳水 | 热量 | 脂肪 | 蛋白质 |',
        '| --- | --- | --- | --- | --- |',
        '| 鸡腿饭 | 72 | 650 | 20 | 30 |'
      ].join('\n')
    )
    expect(r.items[0]).toMatchObject({
      name: '鸡腿饭',
      kcal: 650,
      protein: 30,
      fat: 20,
      carb: 72
    })
  })

  it('带「千卡」单位的单元格', () => {
    const r = parseNutritionText(
      [
        '| 食物 | 热量 | 蛋白质 | 脂肪 | 碳水 |',
        '| --- | --- | --- | --- | --- |',
        '| 鸡腿饭 | 650 kcal | 30 g | 20 g | 72 g |'
      ].join('\n')
    )
    expect(r.items[0]).toMatchObject({ kcal: 650, protein: 30, fat: 20, carb: 72 })
  })
})

describe('分点列表', () => {
  it('菜名单独一行，营养各占一行', () => {
    const r = parseNutritionText(
      [
        '**鸡腿饭**',
        '- 热量：650 kcal',
        '- 蛋白质：30 g',
        '- 脂肪：20 g',
        '- 碳水化合物：72 g'
      ].join('\n')
    )
    expect(r.items).toHaveLength(1)
    expect(r.items[0]).toMatchObject({
      name: '鸡腿饭',
      kcal: 650,
      protein: 30,
      fat: 20,
      carb: 72
    })
  })

  it('多个菜名分块', () => {
    const r = parseNutritionText(
      [
        '鸡腿饭',
        '热量：650 kcal',
        '蛋白质：30 g',
        '',
        '炒青菜',
        '热量：120 kcal',
        '蛋白质：3 g'
      ].join('\n')
    )
    expect(r.items).toHaveLength(2)
    expect(r.items[0].name).toBe('鸡腿饭')
    expect(r.items[1]).toMatchObject({ name: '炒青菜', kcal: 120, protein: 3 })
  })
})

describe('兜底与容错', () => {
  it('完全没有营养信息时返回空并给提示', () => {
    const r = parseNutritionText('今天中午吃了一份鸡腿饭，感觉还行')
    expect(r.items).toHaveLength(0)
    expect(r.warning).toBeTruthy()
  })

  it('空输入不崩', () => {
    expect(parseNutritionText('').items).toHaveLength(0)
    expect(parseNutritionText('   \n  \n').items).toHaveLength(0)
  })

  it('缺项按 0 处理，不瞎猜', () => {
    const r = parseNutritionText('鸡腿饭 热量650千卡')
    expect(r.items[0]).toMatchObject({ kcal: 650, protein: 0, fat: 0, carb: 0 })
  })

  it('小数保留一位', () => {
    const r = parseNutritionText('牛奶 热量155千卡 蛋白质8.2克 脂肪8.5克 碳水12.1克')
    expect(r.items[0]).toMatchObject({ kcal: 155, protein: 8.2, fat: 8.5, carb: 12.1 })
  })

  it('名称为空的行不会被当成条目', () => {
    const r = parseNutritionText('| --- | --- |\n| 650 | 30 |')
    expect(r.items.every((i) => i.name.length > 0)).toBe(true)
  })
})
