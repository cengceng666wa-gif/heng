/**
 * 粘贴解析 —— 把豆包（或任意 AI）估算出来的营养文字，转成结构化食物条目。
 *
 * 为什么不用内置视觉 API：
 *   用户用的是豆包，免费且中文食物识别更准。App 里再塞一个收费 API
 *   既多花钱又更差，还会把「纯离线」这个核心承诺打破。
 *
 * 难点不在解析本身，在于**模型的输出格式极不稳定**。
 * 同样是豆包，可能给你 markdown 表格、可能给你分点列表、也可能一句话说完。
 * 所以这里逐种格式兜底，并且宁可少解析几条也不要解析错。
 */

export interface ParsedItem {
  name: string
  qty: number
  unit: string
  kcal: number
  protein: number
  fat: number
  carb: number
}

export interface ParseResult {
  items: ParsedItem[]
  /** 没能解析出数值的片段，提示用户手动补 */
  unparsed: string[]
  /** 整体提示 */
  warning?: string
}

// ---------------------------------------------------------------------------
// 关键词
// ---------------------------------------------------------------------------

const NUM = String.raw`(\d+(?:\.\d+)?)`

const RE = {
  // 热量：热量/能量/卡路里/千卡/大卡/kcal/kj
  kcal: new RegExp(
    String.raw`(?:热量|能量|卡路里|千卡|大卡|kcal|Kcal|KCAL|KJ|kj)\s*(?:含量)?\s*[:：=]?\s*(?:约|大约|大概|≈|~)?\s*${NUM}`,
    'i'
  ),
  protein: new RegExp(
    String.raw`(?:蛋白质|蛋白|protein)\s*(?:含量)?\s*[:：=]?\s*(?:约|大约|大概|≈|~)?\s*${NUM}`,
    'i'
  ),
  fat: new RegExp(
    String.raw`(?:脂肪|fat)\s*(?:含量)?\s*[:：=]?\s*(?:约|大约|大概|≈|~)?\s*${NUM}`,
    'i'
  ),
  carb: new RegExp(
    String.raw`(?:碳水化合物|碳水|糖类|carb\w*)\s*(?:含量)?\s*[:：=]?\s*(?:约|大约|大概|≈|~)?\s*${NUM}`,
    'i'
  ),
  // 纯数值形式：650 千卡 / 650kcal（没写「热量」两字）
  bareKcal: new RegExp(String.raw`${NUM}\s*(?:千卡|大卡|kcal|Kcal|KCAL)`, 'i'),
  // 份量：1份 / 2碗 / 约150g
  qtyUnit: new RegExp(
    String.raw`(?:^|[\s（(：:,，])${NUM}\s*(份|碗|个|只|块|片|杯|勺|串|盘|盒|袋|根|条|张)`,
    'i'
  )
}

const ANY_NUMBER = /\d+(?:\.\d+)?/

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------

export function parseNutritionText(raw: string): ParseResult {
  const text = normalize(raw)
  if (!text.trim()) {
    return { items: [], unparsed: [], warning: '没有输入任何内容' }
  }

  // 1. 优先试 markdown 表格——豆包很爱输出这个格式，而且结构最清晰
  const fromTable = parseMarkdownTable(text)
  if (fromTable.length > 0) {
    return { items: fromTable, unparsed: [] }
  }

  // 2. 按行 / 按块解析
  return parseBlocks(text)
}

// ---------------------------------------------------------------------------
// 预处理
// ---------------------------------------------------------------------------

function normalize(s: string): string {
  return (
    s
      // markdown 强调符号会干扰关键词匹配
      .replace(/\*\*/g, '')
      .replace(/__/g, '')
      // 中文全角括号、冒号、逗号统一
      .replace(/[（]/g, '(')
      .replace(/[）]/g, ')')
      .replace(/[：]/g, ':')
      .replace(/[，、]/g, ',')
      // 全角数字
      .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
      // 全角点
      .replace(/[．]/g, '.')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
  )
}

// ---------------------------------------------------------------------------
// 格式一：markdown 表格
// ---------------------------------------------------------------------------

/**
 * 豆包最常输出的格式：
 *   | 食物 | 份量 | 热量 | 蛋白质 | 脂肪 | 碳水 |
 *   | --- | --- | --- | --- | --- | --- |
 *   | 鸡腿饭 | 1份 | 650 | 30 | 20 | 72 |
 *
 * 策略：先定位表头，按列名建立「列索引 → 营养字段」的映射，
 * 再逐行取值。不要硬编码列顺序——模型给的表头顺序每次都可能不同。
 */
function parseMarkdownTable(text: string): ParsedItem[] {
  const lines = text.split('\n')

  // 找到含营养关键词的表头行
  const headerIdx = lines.findIndex(
    (l) => l.includes('|') && (RE.kcal.test(l) || RE.protein.test(l) || l.includes('热量'))
  )
  if (headerIdx < 0) return []

  const headers = splitRow(lines[headerIdx])
  const map = mapColumns(headers)
  if (map.kcal === undefined && map.protein === undefined) return []

  const items: ParsedItem[] = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.includes('|')) {
      // 表格结束（允许中间有空行）
      if (line.trim() === '' && items.length > 0) break
      continue
    }
    // 分隔行 |---|---|
    if (/^\s*\|?[\s:|-]+\|?\s*$/.test(line)) continue

    const cells = splitRow(line)
    if (cells.length < 2) continue

    const name = cells[0].replace(/^[\s\d.、)）]+/, '').trim()
    if (!name) continue

    const pick = (idx?: number) =>
      idx !== undefined && cells[idx] !== undefined ? toNum(cells[idx]) : 0

    const qtyUnit = parseQtyUnit(cells[map.qty ?? -1] ?? name)

    items.push({
      name: stripNutritionTail(name),
      qty: qtyUnit.qty,
      unit: qtyUnit.unit,
      kcal: Math.round(pick(map.kcal)),
      protein: round1(pick(map.protein)),
      fat: round1(pick(map.fat)),
      carb: round1(pick(map.carb))
    })
  }

  return items.filter((i) => i.name && (i.kcal > 0 || i.protein > 0))
}

function splitRow(line: string): string[] {
  return line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((c) => c.trim())
}

interface ColMap {
  kcal?: number
  protein?: number
  fat?: number
  carb?: number
  qty?: number
}

function mapColumns(headers: string[]): ColMap {
  const map: ColMap = {}
  headers.forEach((h, i) => {
    const s = h.toLowerCase()
    if (map.kcal === undefined && (s.includes('热量') || s.includes('能量') || s.includes('kcal') || s.includes('千卡') || s.includes('大卡')))
      map.kcal = i
    else if (map.protein === undefined && (s.includes('蛋白') || s.includes('protein')))
      map.protein = i
    else if (map.fat === undefined && (s.includes('脂肪') || s.includes('fat')))
      map.fat = i
    else if (map.carb === undefined && (s.includes('碳水') || s.includes('糖类') || s.includes('carb')))
      map.carb = i
    else if (map.qty === undefined && (s.includes('份量') || s.includes('分量') || s.includes('数量') || s.includes('克重') || s.includes('重量')))
      map.qty = i
  })
  return map
}

// ---------------------------------------------------------------------------
// 格式二：分行 / 分块
// ---------------------------------------------------------------------------

function parseBlocks(text: string): ParseResult {
  const lines = text.split('\n')
  const items: ParsedItem[] = []
  const unparsed: string[] = []

  // 每条记录可能跨多行，用「有名字没数值」的行作为新条目的开头
  let current: { name: string; blob: string[] } | null = null

  const flush = () => {
    if (!current) return
    const item = buildItem(current.name, current.blob.join('\n'))
    if (item) items.push(item)
    else if (current.name.trim().length > 1) unparsed.push(current.name.trim())
    current = null
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    // 跳过分隔线和纯表头残留
    if (/^[\s|:*-]+$/.test(line)) continue

    const n = countNumbers(line)
    // 只要这一行自己带了营养关键词（哪怕只有一个数值），就当成完整条目处理。
    // 早先只按「数值个数 ≥ 2」判断，会把「鸡腿饭 热量650千卡」整条丢掉。
    const hasNutrient =
      RE.kcal.test(line) ||
      RE.bareKcal.test(line) ||
      RE.protein.test(line) ||
      RE.fat.test(line) ||
      RE.carb.test(line)

    if (hasNutrient || n >= 2) {
      const item = buildItem(line, line)
      if (item) {
        flush()
        items.push(item)
      } else if (current) {
        // 例如「- 热量：650 kcal」这种属于上一行的菜名
        current.blob.push(line)
      } else {
        unparsed.push(line)
      }
    } else if (n === 0) {
      // 没有数值 → 可能是新的菜名
      flush()
      current = { name: line, blob: [] }
    } else {
      // 只有一个数值且无营养关键词 → 属于当前条目的某个字段
      if (current) current.blob.push(line)
    }
  }
  flush()

  const warning =
    items.length === 0
      ? '没能从这段文字里解析出食物。可以试着让豆包按「食物名 + 热量 + 蛋白 + 脂肪 + 碳水」一行一条输出。'
      : undefined

  return { items, unparsed, warning }
}

function buildItem(nameLine: string, blob: string): ParsedItem | null {
  const kcal = matchNum(RE.kcal, blob) ?? matchNum(RE.bareKcal, blob) ?? 0
  const protein = matchNum(RE.protein, blob) ?? 0
  const fat = matchNum(RE.fat, blob) ?? 0
  const carb = matchNum(RE.carb, blob) ?? 0

  // 一个数值都没有，不算条目
  if (kcal === 0 && protein === 0 && fat === 0 && carb === 0) return null

  const name = stripNutritionTail(nameLine)
  if (!name) return null

  const qu = parseQtyUnit(nameLine)

  return {
    name,
    qty: qu.qty,
    unit: qu.unit,
    kcal: Math.round(kcal),
    protein: round1(protein),
    fat: round1(fat),
    carb: round1(carb)
  }
}

/**
 * 从带营养信息的行里剥出菜名。
 * 「鸡腿饭:650千卡,蛋白30克,脂肪20克,碳水72克」→「鸡腿饭」
 */
function stripNutritionTail(s: string): string {
  let out = s

  // 去掉行首的序号 / 项目符号
  out = out.replace(/^\s*(?:\d+[.、)]|[-*•·])\s*/, '')

  // 从第一个营养关键词或「数字+单位」处截断
  const cutPoints: number[] = []
  for (const re of [RE.kcal, RE.protein, RE.fat, RE.carb, RE.bareKcal]) {
    const m = out.match(re)
    if (m?.index !== undefined) cutPoints.push(m.index)
  }
  const bare = out.match(new RegExp(String.raw`${NUM}\s*(?:千卡|大卡|kcal|克|g|G)\b`, 'i'))
  if (bare?.index !== undefined) cutPoints.push(bare.index)

  if (cutPoints.length > 0) {
    out = out.slice(0, Math.min(...cutPoints))
  }

  // 去掉名字里残留的份量（「鸡腿饭 1份」→「鸡腿饭」）
  out = out.replace(
    new RegExp(String.raw`\s*\d+(?:\.\d+)?\s*(?:份|碗|个|只|块|片|杯|勺|串|盘|盒|袋|根|条|张)\s*`, 'g'),
    ' '
  )

  // 去掉尾部的冒号、括号、空格
  out = out.replace(/[\s:：,，、(/（]+$/, '').trim()

  // 如果名字里还留着括号里的份量，去掉
  out = out.replace(/[（(][^）)]*[）)]\s*$/, '').trim()

  // 折叠多余空格
  out = out.replace(/\s{2,}/g, ' ').trim()

  return out
}

function parseQtyUnit(s: string): { qty: number; unit: string } {
  const m = s.match(RE.qtyUnit)
  if (m) {
    const q = parseFloat(m[1])
    if (Number.isFinite(q) && q > 0 && q <= 20) {
      return { qty: q, unit: m[2] }
    }
  }
  return { qty: 1, unit: '份' }
}

function matchNum(re: RegExp, s: string): number | null {
  const m = s.match(re)
  if (!m) return null
  const v = parseFloat(m[1])
  return Number.isFinite(v) ? v : null
}

function countNumbers(s: string): number {
  return (s.match(/\d+(?:\.\d+)?/g) ?? []).length
}

function toNum(s: string): number {
  const m = s.match(ANY_NUMBER)
  if (!m) return 0
  const v = parseFloat(m[0])
  return Number.isFinite(v) ? v : 0
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
