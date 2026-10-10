/**
 * 设置：档案、算法开关、自定义食物、数据导出。
 */

import { useRef, useState } from 'react'
import { db, saveProfile } from '../db'
import type { Food, Profile } from '../types'
import type { Computed } from '../lib/compute'
import { exportCSV, exportJSON, importJSON } from '../lib/backup'

interface Props {
  profile: Profile
  computed: Computed
  onChanged: () => void | Promise<void>
}

export default function Settings({ profile, computed, onChanged }: Props) {
  const [p, setP] = useState<Profile>(profile)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // 自定义食物
  const [showFood, setShowFood] = useState(false)
  const [fName, setFName] = useState('')
  const [fUnit, setFUnit] = useState('份')
  const [fKcal, setFKcal] = useState('')
  const [fP, setFP] = useState('')
  const [fF, setFF] = useState('')
  const [fC, setFC] = useState('')

  const dirty = JSON.stringify(p) !== JSON.stringify(profile)

  async function save() {
    setBusy(true)
    try {
      await saveProfile(p)
      setMsg('已保存，目标值已重算')
      await onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function addFood() {
    const kcal = parseFloat(fKcal)
    if (!fName.trim() || !Number.isFinite(kcal)) {
      setMsg('至少要有名称和热量')
      return
    }
    const food: Food = {
      name: fName.trim(),
      aliases: [],
      category: '自定义',
      unitName: fUnit.trim() || '份',
      kcal,
      protein: parseFloat(fP) || 0,
      fat: parseFloat(fF) || 0,
      carb: parseFloat(fC) || 0,
      isCustom: true,
      useCount: 0
    }
    await db.foods.add(food)
    setFName('')
    setFKcal('')
    setFP('')
    setFF('')
    setFC('')
    setMsg('已加入食物库')
  }

  async function handleImport(file: File) {
    setBusy(true)
    try {
      const text = await file.text()
      const r = await importJSON(text)
      setMsg(`导入成功：${Object.entries(r.counts).map(([k, v]) => `${k} ${v}`).join('、')}`)
      await onChanged()
    } catch (e) {
      setMsg(`导入失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  async function wipe() {
    if (!confirm('确定清空所有数据？这会删掉全部饮食、体重和训练记录，无法撤销。\n建议先导出备份。')) {
      return
    }
    setBusy(true)
    try {
      await db.delete()
      location.reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">设置</h1>

      {msg && (
        <div className="alert info" onClick={() => setMsg(null)}>
          {msg}
        </div>
      )}

      {/* 档案 */}
      <div className="card">
        <div className="card-title">身体数据</div>

        <div className="grid-2">
          <div className="field">
            <label>年龄</label>
            <input
              type="number"
              value={p.age}
              onChange={(e) => setP({ ...p, age: int(e.target.value, p.age) })}
            />
          </div>
          <div className="field">
            <label>身高 cm</label>
            <input
              type="number"
              value={p.heightCm}
              onChange={(e) => setP({ ...p, heightCm: flt(e.target.value, p.heightCm) })}
            />
          </div>
          <div className="field">
            <label>起始体重 kg</label>
            <input
              type="number"
              value={p.startWeightKg}
              onChange={(e) => setP({ ...p, startWeightKg: flt(e.target.value, p.startWeightKg) })}
            />
          </div>
          <div className="field">
            <label>目标体重 kg</label>
            <input
              type="number"
              value={p.targetWeightKg}
              onChange={(e) => setP({ ...p, targetWeightKg: flt(e.target.value, p.targetWeightKg) })}
            />
          </div>
          <div className="field">
            <label>体脂率 %（可留空）</label>
            <input
              type="number"
              value={p.bodyFatPct ?? ''}
              onChange={(e) =>
                setP({
                  ...p,
                  bodyFatPct: e.target.value.trim() === '' ? undefined : flt(e.target.value, 0)
                })
              }
            />
          </div>
          <div className="field">
            <label>活动系数</label>
            <input
              type="number"
              step="0.025"
              value={p.activityFactor}
              onChange={(e) => setP({ ...p, activityFactor: flt(e.target.value, p.activityFactor) })}
            />
          </div>
          <div className="field">
            <label>减重速率 kg/周</label>
            <input
              type="number"
              step="0.05"
              value={p.rateKgPerWeek}
              onChange={(e) => setP({ ...p, rateKgPerWeek: flt(e.target.value, p.rateKgPerWeek) })}
            />
          </div>
          <div className="field">
            <label>蛋白 g/kg 去脂体重</label>
            <input
              type="number"
              step="0.1"
              value={p.proteinPerKgLbm}
              onChange={(e) => setP({ ...p, proteinPerKgLbm: flt(e.target.value, p.proteinPerKgLbm) })}
            />
          </div>
        </div>

        <div className="field">
          <label>脂肪占热量 %</label>
          <input
            type="number"
            value={Math.round(p.fatPctOfKcal * 100)}
            onChange={(e) =>
              setP({ ...p, fatPctOfKcal: int(e.target.value, 28) / 100 })
            }
          />
        </div>

        <button className="btn primary block" disabled={!dirty || busy} onClick={() => void save()}>
          {dirty ? '保存修改' : '没有改动'}
        </button>
      </div>

      {/* 算法 */}
      <div className="card">
        <div className="card-title">TDEE 算法</div>

        <div className="row-between" style={{ marginBottom: 10 }}>
          <div className="grow">
            <div style={{ fontSize: 14 }}>自适应 TDEE</div>
            <div className="faint">用真实体重趋势反推消耗，每周重算</div>
          </div>
          <button
            className={`chip${p.adaptiveEnabled ? ' on' : ''}`}
            onClick={() => setP({ ...p, adaptiveEnabled: !p.adaptiveEnabled })}
          >
            {p.adaptiveEnabled ? '已开启' : '已关闭'}
          </button>
        </div>

        <div className="field">
          <label>手动覆盖 TDEE（留空 = 自动）</label>
          <input
            type="number"
            placeholder={`当前 ${computed.tdee}`}
            value={p.tdeeOverride ?? ''}
            onChange={(e) =>
              setP({
                ...p,
                tdeeOverride: e.target.value.trim() === '' ? undefined : int(e.target.value, 0)
              })
            }
          />
          <div className="field-hint">
            一般不用填。只有在你确信算法算错（比如连续几周体重不动但摄入没变）时才手动锁一个值。
          </div>
        </div>

        <button className="btn primary block" disabled={!dirty || busy} onClick={() => void save()}>
          保存修改
        </button>
      </div>

      {/* 自定义食物 */}
      <div className="card">
        <div className="card-title">
          <span>自定义食物</span>
          <button className="btn ghost sm" onClick={() => setShowFood(!showFood)}>
            {showFood ? '收起' : '添加'}
          </button>
        </div>

        {!showFood && (
          <div className="faint">
            食堂某个固定窗口的菜、常买的外卖，录一次以后一键复用。
            这是让这个 App 越用越快的关键。
          </div>
        )}

        {showFood && (
          <>
            <div className="field">
              <label>名称</label>
              <input
                placeholder="如：二楼土豆烧鸡"
                value={fName}
                onChange={(e) => setFName(e.target.value)}
              />
            </div>
            <div className="grid-2">
              <div className="field">
                <label>单位</label>
                <input value={fUnit} onChange={(e) => setFUnit(e.target.value)} />
              </div>
              <div className="field">
                <label>热量 kcal</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={fKcal}
                  onChange={(e) => setFKcal(e.target.value)}
                />
              </div>
              <div className="field">
                <label>蛋白 g</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={fP}
                  onChange={(e) => setFP(e.target.value)}
                />
              </div>
              <div className="field">
                <label>脂肪 g</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={fF}
                  onChange={(e) => setFF(e.target.value)}
                />
              </div>
              <div className="field">
                <label>碳水 g</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={fC}
                  onChange={(e) => setFC(e.target.value)}
                />
              </div>
            </div>
            <button className="btn primary block" onClick={() => void addFood()}>
              加入食物库
            </button>
          </>
        )}
      </div>

      {/* 数据 */}
      <div className="card">
        <div className="card-title">数据</div>
        <div className="faint" style={{ marginBottom: 12, lineHeight: 1.6 }}>
          所有数据都在这台手机的浏览器本地存储里，没有服务器。
          <br />
          <b>建议每周导出一次备份</b>——换手机、清缓存、误删都靠它。
        </div>

        <div className="btn-row" style={{ marginTop: 0 }}>
          <button className="btn grow" onClick={() => void exportJSON()}>
            导出 JSON 备份
          </button>
          <button className="btn grow" onClick={() => void exportCSV()}>
            导出 CSV
          </button>
        </div>

        <div className="btn-row">
          <button
            className="btn ghost grow"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            从备份恢复
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleImport(f)
            e.target.value = ''
          }}
        />
        <div className="field-hint">
          恢复会<b>清空现有数据</b>再写入备份内容，请先导出当前数据。
        </div>

        <div className="btn-row">
          <button className="btn danger block grow" disabled={busy} onClick={() => void wipe()}>
            清空所有数据
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">关于</div>
        <div className="faint" style={{ lineHeight: 1.7 }}>
          衡 · v0.1
          <br />
          数据只存在本地。不上传、不联网、无账号。
          <br />
          源码：github.com/cengceng666wa-gif/heng
        </div>
      </div>
    </div>
  )
}

function int(s: string, fallback: number): number {
  const v = parseInt(s, 10)
  return Number.isFinite(v) ? v : fallback
}
function flt(s: string, fallback: number): number {
  const v = parseFloat(s)
  return Number.isFinite(v) ? v : fallback
}
