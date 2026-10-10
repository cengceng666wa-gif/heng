/**
 * 首次设置。
 *
 * 个人数据只存 IndexedDB，绝不写进代码库——所以仓库可以公开。
 * 只问必要的，其余给合理默认值，并实时显示算出来的目标值，
 * 让用户改参数时立刻看到后果（这比填完再看有用得多）。
 */

import { useMemo, useState } from 'react'
import { saveProfile } from '../db'
import type { Profile, Sex } from '../types'
import { estimateBmr, formulaTdee, macroTargets } from '../lib/tdee'

interface Props {
  onDone: () => void | Promise<void>
}

const ACTIVITY_OPTIONS = [
  { v: 1.2, label: '久坐', desc: '几乎不运动' },
  { v: 1.375, label: '轻度', desc: '每周运动 1–3 次' },
  { v: 1.45, label: '中等偏低', desc: '每周 3–4 次' },
  { v: 1.55, label: '中度', desc: '每周 4–5 次' },
  { v: 1.725, label: '高度', desc: '每周 6–7 次' }
]

export default function Setup({ onDone }: Props) {
  const [sex, setSex] = useState<Sex>('male')
  const [age, setAge] = useState('19')
  const [heightCm, setHeightCm] = useState('183')
  const [weightKg, setWeightKg] = useState('90')
  const [targetKg, setTargetKg] = useState('80')
  const [bodyFat, setBodyFat] = useState('28')
  const [activity, setActivity] = useState(1.45)
  const [rate, setRate] = useState('0.7')
  const [proteinPerKg, setProteinPerKg] = useState('2.2')
  const [fatPct, setFatPct] = useState('28')
  const [advanced, setAdvanced] = useState(false)
  const [saving, setSaving] = useState(false)

  // 实时预览：改任何参数立刻看到目标值变化
  const preview = useMemo(() => {
    const draft: Profile = {
      id: 1,
      sex,
      age: num(age, 19),
      heightCm: num(heightCm, 183),
      startWeightKg: num(weightKg, 90),
      targetWeightKg: num(targetKg, 80),
      bodyFatPct: bodyFat.trim() === '' ? undefined : num(bodyFat, 28),
      activityFactor: activity,
      rateKgPerWeek: num(rate, 0.7),
      proteinPerKgLbm: num(proteinPerKg, 2.2),
      fatPctOfKcal: num(fatPct, 28) / 100,
      adaptiveEnabled: true,
      setupDone: true,
      createdAt: new Date().toISOString()
    }
    const bmr = estimateBmr(draft)
    const tdee = formulaTdee(draft)
    return { draft, bmr, tdee, targets: macroTargets(draft, tdee) }
  }, [sex, age, heightCm, weightKg, targetKg, bodyFat, activity, rate, proteinPerKg, fatPct])

  const weeks = useMemo(() => {
    const loss = num(weightKg, 90) - num(targetKg, 80)
    const r = num(rate, 0.7)
    return r > 0 ? Math.ceil(loss / r) : 0
  }, [weightKg, targetKg, rate])

  async function submit() {
    setSaving(true)
    try {
      await saveProfile(preview.draft)
      await onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="app">
      <div className="page">
        <h1 className="page-title">衡 · 首次设置</h1>
        <p className="faint" style={{ marginTop: -8, marginBottom: 16 }}>
          只存在这台手机里，不上传任何服务器。以后随时可在「设置」里改。
        </p>

        <div className="card">
          <div className="card-title">基本信息</div>

          <div className="field">
            <label>性别</label>
            <div className="chips">
              <button
                className={`chip${sex === 'male' ? ' on' : ''}`}
                onClick={() => setSex('male')}
              >
                男
              </button>
              <button
                className={`chip${sex === 'female' ? ' on' : ''}`}
                onClick={() => setSex('female')}
              >
                女
              </button>
            </div>
          </div>

          <div className="grid-2">
            <div className="field">
              <label>年龄</label>
              <input
                type="number"
                inputMode="numeric"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>
            <div className="field">
              <label>身高 cm</label>
              <input
                type="number"
                inputMode="decimal"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
              />
            </div>
            <div className="field">
              <label>当前体重 kg</label>
              <input
                type="number"
                inputMode="decimal"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
              />
            </div>
            <div className="field">
              <label>目标体重 kg</label>
              <input
                type="number"
                inputMode="decimal"
                value={targetKg}
                onChange={(e) => setTargetKg(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label>体脂率 %（不知道就留空）</label>
            <input
              type="number"
              inputMode="decimal"
              value={bodyFat}
              onChange={(e) => setBodyFat(e.target.value)}
            />
            <div className="field-hint">
              填了会用 Katch-McArdle 与通用公式取折中，对高体脂更准。
              自报体脂误差大，不确定就留空。
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">活动水平</div>
          <div className="chips">
            {ACTIVITY_OPTIONS.map((o) => (
              <button
                key={o.v}
                className={`chip${activity === o.v ? ' on' : ''}`}
                onClick={() => setActivity(o.v)}
                title={o.desc}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="field-hint">
            {ACTIVITY_OPTIONS.find((o) => o.v === activity)?.desc}
            ，系数 {activity}
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            <span>减脂速率</span>
            <span className="faint num">{rate} kg/周</span>
          </div>
          <input
            type="range"
            min={0.2}
            max={1.2}
            step={0.05}
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            style={{ padding: 0, background: 'transparent', border: 'none' }}
          />
          <div className="field-hint">
            健康区间是每周 0.5–1% 体重（你约 {fmt(num(weightKg, 90) * 0.005)}–
            {fmt(num(weightKg, 90) * 0.01)} kg）。按当前速率，约 <b>{weeks} 周</b> 到目标。
          </div>
        </div>

        <button className="btn ghost block sm" onClick={() => setAdvanced(!advanced)}>
          {advanced ? '收起高级选项' : '展开高级选项（蛋白质 / 脂肪占比）'}
        </button>

        {advanced && (
          <div className="card" style={{ marginTop: 10 }}>
            <div className="grid-2">
              <div className="field">
                <label>蛋白质 g/kg 去脂体重</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={proteinPerKg}
                  onChange={(e) => setProteinPerKg(e.target.value)}
                />
                <div className="field-hint">减脂期建议 1.6–2.4</div>
              </div>
              <div className="field">
                <label>脂肪占热量 %</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={fatPct}
                  onChange={(e) => setFatPct(e.target.value)}
                />
                <div className="field-hint">建议 20–30%</div>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-title">算出来的目标（公式初值）</div>

          <div className="stat-grid" style={{ marginBottom: 10 }}>
            <div className="stat">
              <div className="v num">{preview.bmr.value.toFixed(0)}</div>
              <div className="l">基础代谢 BMR</div>
            </div>
            <div className="stat">
              <div className="v num">{preview.tdee.toFixed(0)}</div>
              <div className="l">每日消耗 TDEE</div>
            </div>
          </div>

          <div className="stat-grid">
            <div className="stat">
              <div className="v num" style={{ color: 'var(--kcal)' }}>
                {preview.targets.kcal}
              </div>
              <div className="l">目标热量 kcal</div>
            </div>
            <div className="stat">
              <div className="v num" style={{ color: 'var(--protein)' }}>
                {preview.targets.protein}
              </div>
              <div className="l">蛋白质 g</div>
            </div>
            <div className="stat">
              <div className="v num" style={{ color: 'var(--fat)' }}>
                {preview.targets.fat}
              </div>
              <div className="l">脂肪 g</div>
            </div>
            <div className="stat">
              <div className="v num" style={{ color: 'var(--carb)' }}>
                {preview.targets.carb}
              </div>
              <div className="l">碳水 g</div>
            </div>
          </div>

          {preview.targets.warnings.map((w, i) => (
            <div className="alert warn" key={i} style={{ marginTop: 10, marginBottom: 0 }}>
              {w}
            </div>
          ))}

          <div className="alert info" style={{ marginTop: 10, marginBottom: 0 }}>
            这是<b>静态公式</b>的估算值，误差可能有 ±300–500 kcal。
            开始记录体重和饮食后，会用你的真实数据反推消耗，两周左右自动校准。
          </div>
        </div>

        <button className="btn primary block" disabled={saving} onClick={() => void submit()}>
          {saving ? '保存中…' : '开始使用'}
        </button>
      </div>
    </div>
  )
}

function num(s: string, fallback: number): number {
  const v = parseFloat(s)
  return Number.isFinite(v) ? v : fallback
}

function fmt(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2)
}
