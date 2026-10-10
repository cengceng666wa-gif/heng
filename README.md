# 衡 · heng

> 个人减脂与力量训练追踪器。自适应 TDEE 热量管理 + 可勾选划掉的力量训练计划。

**给谁用**：一个人，一台 Android 手机，一个食堂。
**不是什么**：不是社交 App，不是健身内容平台，没有账号体系，没有云同步。

---

## 为什么自己写

市面上的 App 各缺一块：

| App | 强在哪 | 缺什么 |
| --- | --- | --- |
| 薄荷健康 | 中式食物库最全 | 只管吃不管练 |
| MyFitnessPal | 库最大 | 广告 + 订阅，中文食物弱 |
| MacroFactor | 自适应 TDEE 算法最强 | 英文，几乎没有中式食物，贵 |
| Cronometer | 微量营养素最细 | 录入慢，界面劝退 |
| Keep | 练 + 吃 + 盯闭环 | 核心功能要会员 |
| Hevy / Strong | 训练记录快 | 完全不管吃 |

**没有一个同时做到「中式食堂食物 + 自适应 TDEE + 训练计划打卡」。** 而且自用不需要 10 万条食物库——实际会吃的就那几十样，自己录一次，比接任何 API 都准。

---

## 两条核心设计决策

### 1. 输入成本决定生死

记录类 App 失败的原因从来不是算错，而是**录入太麻烦**。所以：

- 首屏就是「今天还能吃多少」，不点第二下
- 常用食物按使用频次排序，一键复用
- 支持「份」「碗」「个」等目视单位，不强迫按克输入
- 食堂菜没法称重 → 用拳/掌/拇指估份，误差交给自适应算法吃掉

### 2. 目标值必须会自己动

静态公式（Mifflin-St Jeor）× 活动系数，对个人的误差能到 ±300–500 kcal。
所以目标摄入不是写死的，而是**每周用真实数据反推**：

```
能量守恒：  摄入 = 消耗(TDEE) + 体重变化        (1 kg 体重 ≈ 7700 kcal)

  TDEE   = 近 14 天平均摄入 − (趋势体重变化kg × 7700 / 14)
  目标摄入 = TDEE − 缺口
  缺口    = 目标速率(kg/周) × 7700 / 7
```

三个必须处理的细节：

1. **体重用 EWMA 趋势，不用原始值**——单日波动 1–2 kg 全是水和糖原，直接算会被噪声带飞
2. **前两周用公式给初值**，界面上标明「校准中」，这是过渡不是 bug
3. **每周只调一次，新值只占 30%**（`新 = 0.7×旧 + 0.3×实测`），否则目标天天跳

---

## 功能范围

### v1 · 已完成

- [x] 个人食物库 + 模糊搜索 + 一键复用
- [x] 今日摄入 vs 目标：热量 + 蛋白/脂肪/碳水
- [x] 自适应 TDEE 每周重算
- [x] 体重录入 + EWMA 趋势曲线（标准/非标准称重分级）
- [x] 训练计划 + 三层打勾划线 + 「今天到此为止」逃生通道
- [x] 组记录（重量 / 次数 / RPE）
- [x] 导出 JSON / CSV，支持从备份恢复
- [x] 离线可用（Service Worker）

### v2 · 已完成

- [x] 周报（平均摄入 / 体重变化 / 训练完成率 / 达标天数）
- [x] e1RM 曲线 + 渐进超负荷建议（「该加重了」）
- [x] 每肌群周组数热力图，对照 MEV–MRV
- [x] Deload 提醒
- [x] 平台期诊断（区分「记漏了」和「代谢适应」）
- [x] AI 估算结果粘贴解析（豆包 → 复制 → 粘贴入库）
- [x] Capacitor 打包真 APK

### 明确不做

账号体系、云同步、社交、排行榜、动效、手环接入、**内置拍照识别 API**。

最后一条值得解释：内置视觉 API 意味着要么作者替你付钱，要么把 key 塞进前端代码。
所以改用**粘贴解析**——你在豆包那边识别（免费、中文食物更准），复制文字，
App 负责把文字拆成结构化条目。App 本身因此可以保持**完全离线**。

---

## 关键设计：三层打卡

「完成一项就划掉」表面是 UI，真正的难点在状态模型。划掉分三层，自下而上自动推导：

```
组级     set_log.done            勾「第 3 组 60kg×8 完成」
动作级   所有目标组完成       →  自动划线
日级     所有动作完成         →  整条训练日划线
周级     本周 3/4 完成        →  周计划显示 75%
```

**但允许手动覆盖**：某天只有 20 分钟，练两个动作就走，可以点「今天到此为止」——
日级照样划线，记录里标成「部分完成」。现有 App 大多做得很烂（要么全勾要么全废）。

---

## 关键设计：打卡用「周达标天数」而不是「连续 N 天」

Streak 靠损失厌恶驱动，副作用是**用户为了不断签开始造假**——随手填个数字应付。
记录类 App 一旦数据失真就彻底失去意义。

所以主指标是**「本周达标 X/7 天」**：不达标不惩罚，趋势对了就奖励。

---

## 关键设计：平台期要分三种情况

体重趋势连续两周不动，可能是完全不同的三件事：

| 情况 | 判断依据 | 对策 |
| --- | --- | --- |
| 记漏了 | 有记录的天数 < 11/14 | 先补记录，别急着改参数 |
| 吃超了 | 平均摄入 > 目标 +100 | 砍掉超出的部分 |
| 代谢适应 | 记录完整、摄入没超 | 降 100–150 kcal 或多走 2000 步 |

不分青红皂白就让人「再少吃点」，是大多数减脂失败的原因。

---

## 技术栈

| 层 | 选型 | 为什么 |
| --- | --- | --- |
| 构建 | Vite 7 | 快，零配置 |
| UI | React 19 + TypeScript | 长期可维护 |
| 存储 | Dexie (IndexedDB) | 纯本地，无服务器，离线天然可用 |
| 图表 | 手写 SVG | 一条趋势线不值得引入 recharts |
| 离线 | vite-plugin-pwa | 加到主屏幕后即全屏 App |
| 测试 | Vitest | 粘贴解析器格式多变，必须有回归测试 |
| 部署 | GitHub Pages | 免费，推 main 自动发布 |
| 打包 | Capacitor 8 | 同一套代码出真 APK，零重写 |

**数据完全存在手机本地 IndexedDB 里**，不上传任何服务器。
全 App 唯一的网络请求是 Service Worker 拉静态资源。

---

## 开发

```bash
pnpm install
pnpm dev          # 本地开发，手机连同一 WiFi 可访问
pnpm build        # 产出 dist/
pnpm preview      # 预览构建产物
```

### 手机上安装

线上地址：**https://cengceng666wa-gif.github.io/heng/**

用手机 Chrome 打开 → 右上角菜单 → **添加到主屏幕**。
之后就是一个全屏 App，有图标、无地址栏、断网也能用。

### 部署

推到 `main` 分支即自动构建发布（GitHub Actions，见 `.github/workflows/deploy.yml`）。
无需任何额外账号或配置。

> 如果 GitHub Pages 在国内访问太慢，可以换成 Cloudflare Pages：
> 连同一个仓库，Build command 填 `pnpm build`，Output directory 填 `dist`。

### 重新生成图标

```bash
python scripts/make_icons.py
```

### 跑测试

```bash
pnpm test
```

粘贴解析器的格式回归测试（对应 `src/lib/parseNutrition.test.ts`）。
换 AI 模型或改提问方式导致输出格式变了，改解析器前先跑这个。

---

## 打包成 Android APK（可选）

PWA 已经够用，但 APK 有两个优势：**不依赖网络**（静态资源全打包进去，
GitHub Pages 在国内慢也无所谓）、**方便发给别人**（一个文件 vs 一段安装说明）。

### 一次性环境准备（约 2–3 GB）

```powershell
# 1. JDK 21（Capacitor 8 的 sourceCompatibility 是 21，JDK 17 会报「无效的源发行版：21」）
winget install --id Microsoft.OpenJDK.21

# 2. Android 命令行工具
#    下载 https://dl.google.com/android/repository/commandlinetools-win-*_latest.zip
#    解压到 D:\Android\Sdk\cmdline-tools\latest

# 3. 装 SDK 包（Capacitor 8 需要 compileSdk 36）
$env:JAVA_HOME="C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot"
D:\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat `
  --sdk_root=D:\Android\Sdk `
  --install "platform-tools" "platforms;android-36" "build-tools;36.0.0"

# 4. 告诉 Gradle SDK 在哪（此文件已被 gitignore）
echo "sdk.dir=D:/Android/Sdk" > android/local.properties
```

### 编译

每次新开的终端都要先设 `JAVA_HOME`：

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot"
$env:ANDROID_HOME = "D:\Android\Sdk"
```

```bash
pnpm apk          # debug 版
pnpm apk:release  # release 版，需要先配签名
```

产物：`android/app/build/outputs/apk/debug/app-debug.apk`

拷到手机上点开安装（需要允许「安装未知来源应用」）。

### 改了代码之后

```bash
pnpm cap:sync     # 重新构建 web 产物并同步进 android 工程
pnpm apk
```

---

---

## 数据安全

Android Chrome 的 PWA 存储比较稳，但仍建议定期用 App 内的「导出」按钮备份。
换手机时导入 JSON 即可恢复。

**个人身体数据不写进代码库**——首次打开走设置页，数据只进 IndexedDB。

---

## 目录结构

```
src/
  lib/
    tdee.ts            BMR / TDEE / EWMA / 自适应算法
    analytics.ts       周报 / e1RM / 肌群容量 / Deload / 平台期诊断
    parseNutrition.ts  AI 估算文本 → 结构化食物条目
    compute.ts         把各表数据聚合成界面所需的「当前状态」
    backup.ts          导出 / 导入
  data/
    foods.ts           食物库种子数据（80 条，含新疆本地食物）
    program.ts         4 天上下肢训练计划 + 20 个动作
  components/
    FoodPicker.tsx     食物选择弹层
    PasteEstimate.tsx  粘贴解析弹层
    WeightChart.tsx    体重趋势（手写 SVG）
    E1rmChart.tsx      力量进度（手写 SVG）
  pages/               今天 / 训练 / 趋势 / 报告 / 设置
  db.ts                Dexie 表定义与种子
```

---

## 许可

个人项目，未指定开源许可。
