/**
 * 食物选择器（底部弹层）。
 *
 * 这是「输入成本」的主战场。设计目标：常见食物 3 秒内记完。
 *   1. 打开即显示「常用」（按使用次数排序），不是空白搜索框
 *   2. 支持别名搜索（搜「腿饭」能出鸡腿饭）
 *   3. 数量用 ± 按钮，不用键盘
 *   4. 选中即预览四项营养，确认前就知道会加多少
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { db } from '../db'
import type { Food, MealKey } from '../types'
import { MEAL_LABEL } from '../types'
import type { ParsedItem } from '../lib/parseNutrition'
import PasteEstimate from './PasteEstimate'

interface Props {
  meal: MealKey
  onClose: () => void
  onPick: (food: Food, qty: number) => void | Promise<void>
  /** 粘贴解析确认后的结果，由父组件负责入库 */
  onPasteItems: (items: ParsedItem[]) => void | Promise<void>
}

type TabKey = 'common' | 'recent' | 'all' | 'custom'

export default function FoodPicker({ meal, onClose, onPick, onPasteItems }: Props) {
  const [foods, setFoods] = useState<Food[]>([])
  const [tab, setTab] = useState<TabKey>('common')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Food | null>(null)
  const [showPaste, setShowPaste] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void (async () => {
      setFoods(await db.foods.toArray())
    })()
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q) {
      // 搜索时不分标签，全库模糊匹配
      return foods
        .map((f) => ({ f, score: matchScore(f, q) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score || b.f.useCount - a.f.useCount)
        .map((x) => x.f)
    }

    switch (tab) {
      case 'common':
        return [...foods]
          .filter((f) => !f.isCustom)
          .sort((a, b) => b.useCount - a.useCount || a.name.localeCompare(b.name, 'zh'))
          .slice(0, 24)
      case 'recent':
        return [...foods]
          .filter((f) => f.lastUsedAt)
          .sort((a, b) => (a.lastUsedAt! < b.lastUsedAt! ? 1 : -1))
          .slice(0, 24)
      case 'custom':
        return foods.filter((f) => f.isCustom)
      case 'all':
      default:
        return [...foods].sort((a, b) => a.name.localeCompare(b.name, 'zh'))
    }
  }, [foods, tab, query])

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'common', label: '常用' },
    { key: 'recent', label: '最近' },
    { key: 'all', label: '全部' },
    { key: 'custom', label: '我加的' }
  ]

  return (
    <div className="sheet-mask" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        {showPaste ? (
          <PasteEstimate
            meal={meal}
            onClose={() => setShowPaste(false)}
            onConfirm={async (items) => {
              await onPasteItems(items)
              setShowPaste(false)
              onClose()
            }}
          />
        ) : selected ? (
          <QtyStep
            food={selected}
            meal={meal}
            onBack={() => setSelected(null)}
            onConfirm={(qty) => void onPick(selected, qty)}
          />
        ) : (
          <>
            <div className="sheet-head">
              <div className="grow">
                <div className="sheet-title">添加到{MEAL_LABEL[meal]}</div>
              </div>
              <button className="btn ghost sm" onClick={() => setShowPaste(true)}>
                📋 粘贴
              </button>
              <button className="btn ghost sm" onClick={onClose}>
                关闭
              </button>
            </div>

            <div style={{ padding: '10px 14px 0' }}>
              <input
                ref={inputRef}
                placeholder="搜食物，如「鸡腿」「米饭」"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {!query && (
              <div className="chips" style={{ padding: '10px 14px 0', marginBottom: 0 }}>
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    className={`chip${tab === t.key ? ' on' : ''}`}
                    onClick={() => setTab(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            <div className="sheet-body">
              {results.length === 0 && (
                <div className="empty">
                  {query ? `没找到「${query}」` : '这里还是空的'}
                  <div style={{ marginTop: 8 }}>
                    可以在「设置 → 自定义食物」里自己加一条
                  </div>
                </div>
              )}

              {results.map((f) => (
                <button
                  key={f.id}
                  className="food-row"
                  style={{ width: '100%', textAlign: 'left' }}
                  onClick={() => setSelected(f)}
                >
                  <div className="grow">
                    <div className="food-name">
                      {f.name}
                      {f.useCount > 0 && <span className="badge">用过 {f.useCount} 次</span>}
                    </div>
                    <div className="food-sub">
                      {Math.round(f.kcal)} kcal · 蛋 {f.protein} 脂 {f.fat} 碳 {f.carb} / 1
                      {f.unitName}
                    </div>
                  </div>
                  <span className="faint">›</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function QtyStep({
  food,
  meal,
  onBack,
  onConfirm
}: {
  food: Food
  meal: MealKey
  onBack: () => void
  onConfirm: (qty: number) => void
}) {
  const [qty, setQty] = useState(1)

  const clamp = (n: number) => Math.max(0.25, Math.round(n * 4) / 4)

  return (
    <>
      <div className="sheet-head">
        <button className="btn ghost sm" onClick={onBack}>
          ‹ 返回
        </button>
        <div className="grow">
          <div className="sheet-title" style={{ fontSize: 15 }}>
            {food.name}
          </div>
          <div className="faint">加到{MEAL_LABEL[meal]}</div>
        </div>
      </div>

      <div className="sheet-body">
        {food.note && (
          <div className="alert info" style={{ marginBottom: 12 }}>
            {food.note}
          </div>
        )}

        <div className="qty-row">
          <button className="qty-btn" onClick={() => setQty(clamp(qty - 0.25))}>
            −
          </button>
          <div className="qty-val num">
            {Number.isInteger(qty) ? qty : qty.toFixed(2).replace(/0$/, '')}
            <span style={{ fontSize: 14, color: 'var(--fg-dim)', marginLeft: 6 }}>
              {food.unitName}
            </span>
          </div>
          <button className="qty-btn" onClick={() => setQty(clamp(qty + 0.25))}>
            +
          </button>
        </div>

        <div className="chips" style={{ justifyContent: 'center' }}>
          {[0.5, 1, 1.5, 2, 3].map((n) => (
            <button
              key={n}
              className={`chip${qty === n ? ' on' : ''}`}
              onClick={() => setQty(n)}
            >
              {n}
              {food.unitName}
            </button>
          ))}
        </div>

        <div className="nutri-preview">
          <div className="nutri-cell">
            <div className="v num" style={{ color: 'var(--kcal)' }}>
              {Math.round(food.kcal * qty)}
            </div>
            <div className="l">kcal</div>
          </div>
          <div className="nutri-cell">
            <div className="v num" style={{ color: 'var(--protein)' }}>
              {round1(food.protein * qty)}
            </div>
            <div className="l">蛋白 g</div>
          </div>
          <div className="nutri-cell">
            <div className="v num" style={{ color: 'var(--fat)' }}>
              {round1(food.fat * qty)}
            </div>
            <div className="l">脂肪 g</div>
          </div>
          <div className="nutri-cell">
            <div className="v num" style={{ color: 'var(--carb)' }}>
              {round1(food.carb * qty)}
            </div>
            <div className="l">碳水 g</div>
          </div>
        </div>

        {food.unitGrams && (
          <div className="faint" style={{ textAlign: 'center', marginTop: 8 }}>
            约 {Math.round(food.unitGrams * qty)} g
          </div>
        )}

        <button
          className="btn primary block"
          style={{ marginTop: 16 }}
          onClick={() => onConfirm(qty)}
        >
          添加
        </button>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------

/**
 * 匹配打分。名字命中权重最高，别名次之。
 * 支持拼音首字母会更好，但对几十条的自建库不值得。
 */
function matchScore(f: Food, q: string): number {
  const name = f.name.toLowerCase()
  if (name === q) return 100
  if (name.startsWith(q)) return 80
  if (name.includes(q)) return 60

  for (const a of f.aliases) {
    const al = a.toLowerCase()
    if (al === q) return 90
    if (al.startsWith(q)) return 70
    if (al.includes(q)) return 50
  }

  if (f.category.toLowerCase().includes(q)) return 20
  return 0
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
