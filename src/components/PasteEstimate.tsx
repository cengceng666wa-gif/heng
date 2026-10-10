/**
 * 粘贴解析（底部弹层）。
 *
 * 工作流：在豆包里拍照识别 → 复制结果 → 粘到这里 → 自动拆成条目 → 确认入库。
 *
 * 边打字边解析，不做「点一下解析」——多一次点击就多一分放弃的概率。
 */

import { useMemo, useState } from 'react'
import type { MealKey } from '../types'
import { MEAL_LABEL } from '../types'
import { parseNutritionText, type ParsedItem } from '../lib/parseNutrition'

interface Props {
  meal: MealKey
  onClose: () => void
  onConfirm: (items: ParsedItem[]) => void | Promise<void>
}

const PLACEHOLDER = `把豆包识别出来的结果直接粘进来，比如：

鸡腿饭 1份 热量650千卡 蛋白质30克 脂肪20克 碳水72克
炒青菜 1份 热量120千卡 蛋白质3克 脂肪9克 碳水7克

表格、分点列表、一句话都能认。`

export default function PasteEstimate({ meal, onClose, onConfirm }: Props) {
  const [text, setText] = useState('')
  const [dropped, setDropped] = useState<Set<number>>(new Set())
  const [edits, setEdits] = useState<Record<number, number>>({})
  const [saving, setSaving] = useState(false)

  const result = useMemo(() => parseNutritionText(text), [text])

  // 编辑过的热量优先
  const items: ParsedItem[] = useMemo(
    () =>
      result.items.map((it, i) => ({
        ...it,
        kcal: edits[i] !== undefined ? edits[i] : it.kcal
      })),
    [result.items, edits]
  )

  const selected = items.filter((_, i) => !dropped.has(i))
  const totalKcal = selected.reduce((a, b) => a + b.kcal * b.qty, 0)
  const totalP = selected.reduce((a, b) => a + b.protein * b.qty, 0)

  const hasText = text.trim().length > 0

  return (
    <div className="sheet-mask" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div className="grow">
            <div className="sheet-title">粘贴解析</div>
            <div className="faint">加到{MEAL_LABEL[meal]}</div>
          </div>
          <button className="btn ghost sm" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="sheet-body">
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setDropped(new Set())
              setEdits({})
            }}
            placeholder={PLACEHOLDER}
            rows={7}
            style={{ resize: 'vertical', fontSize: 13.5, lineHeight: 1.6 }}
          />

          {!hasText && (
            <div className="field-hint">
              支持 markdown 表格、分点列表、一行一条，四种格式都能认。
              这个功能不联网——识别在豆包那边完成，App 只负责拆解。
            </div>
          )}

          {hasText && result.items.length === 0 && (
            <div className="alert warn" style={{ marginTop: 12 }}>
              {result.warning}
            </div>
          )}

          {items.length > 0 && (
            <>
              <div className="faint" style={{ margin: '14px 0 8px' }}>
                解析出 {items.length} 项。点圆圈可以取消勾选，数值能直接改。
              </div>

              {items.map((it, i) => (
                <div className="log-item" key={i}>
                  <button
                    className={`check${dropped.has(i) ? '' : ' on'}`}
                    onClick={() => {
                      const next = new Set(dropped)
                      if (next.has(i)) next.delete(i)
                      else next.add(i)
                      setDropped(next)
                    }}
                  >
                    ✓
                  </button>
                  <div className="grow">
                    <div className="log-name">{it.name}</div>
                    <div className="log-macro">
                      {trim(it.qty)} {it.unit} · 蛋{it.protein} 脂{it.fat} 碳{it.carb}
                      {it.kcal === 0 && (
                        <span style={{ color: 'var(--warn)' }}> · 缺热量</span>
                      )}
                    </div>
                  </div>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={it.kcal}
                    style={{ width: 70, padding: '5px 7px', fontSize: 13 }}
                    onChange={(e) =>
                      setEdits((prev) => ({
                        ...prev,
                        [i]: parseInt(e.target.value, 10) || 0
                      }))
                    }
                  />
                  <span className="faint tiny">kcal</span>
                </div>
              ))}

              {result.unparsed.length > 0 && (
                <div className="alert warn" style={{ marginTop: 10 }}>
                  这几段没解析出数值，建议手动加：
                  <br />
                  {result.unparsed.slice(0, 5).join(' / ')}
                </div>
              )}

              <div className="nutri-preview" style={{ marginTop: 12 }}>
                <div className="nutri-cell">
                  <div className="v num" style={{ color: 'var(--kcal)' }}>
                    {Math.round(totalKcal)}
                  </div>
                  <div className="l">合计 kcal</div>
                </div>
                <div className="nutri-cell">
                  <div className="v num" style={{ color: 'var(--protein)' }}>
                    {Math.round(totalP)}
                  </div>
                  <div className="l">蛋白 g</div>
                </div>
              </div>

              <button
                className="btn primary block"
                style={{ marginTop: 14 }}
                disabled={saving || selected.length === 0}
                onClick={() => {
                  setSaving(true)
                  void Promise.resolve(onConfirm(selected))
                }}
              >
                {saving
                  ? '添加中…'
                  : `添加 ${selected.length} 项（${Math.round(totalKcal)} kcal）`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
}
