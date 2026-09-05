# 面试数据契约 Schema

`interviews/` 目录下有**两种**文件，由不同 skill 写入：

| 文件类型 | 命名 | 写入方 | 语义 |
|---|---|---|---|
| **记录文件** | `{YYYY-MM-DD}-{jd-slug}.md` | `mock-interview` | 一场面试的原始记录（front matter + 每题 Q&A）；**一旦 `status: completed` 即冻结，永不被其他 skill 改写** |
| **聚合文件** | `{YYYY-MM-DD}-summary.md`（同名加 `-v2` / `-v3`） | `interview-summary` | 跨场聚合复盘（吃 N 个记录文件，输出 1 份能力画像 + 补课计划） |

未来任何写 `interviews/` 的 skill 都严格遵循本契约。**字段名是契约，不要随意改名；只能加新字段，不能改语义。**

当前 Schema 版本：`v1`

---

## 第一部分 · 记录文件 Schema（mock-interview 写）

### 命名

```
{YYYY-MM-DD}-{jd-slug}.md
```

例如：`2026-05-11-bytedance-sre-p6.md`。`jd-slug` 由 `{公司缩写}-{岗位}-{级别}` 组成，全小写、连字符分隔、ASCII 字符。同日同 slug 重复时加 `-2` / `-3` 后缀。

### 文件整体结构

```
---
<YAML front matter，机器可读>
---

# {jd_company} {jd_role} 模拟面试

## Q1 · {维度} · {题目摘要}

**L1 · 基础认知**
- 提问：……
- 回答要点：……
- 卡壳原话：> "……"     # 没卡壳就省略此行

**L2 · 深入细节**       # 仅当面试官追问到 L2 才出现
- 追问：……
- 回答要点：……

**L3 · 边界场景**       # 仅当追问到 L3 才出现
- 追问：……
- 回答要点：……

**本题评分**：{1-5}/5（层次理由）

## Q2 · ...
```

**记录文件没有"面试总结"段**——总结一律由 interview-summary 写到独立的聚合文件，不回写记录文件。

### Front Matter 字段（全部由 mock-interview 维护）

| 字段 | 类型 | 说明 |
|---|---|---|
| `schema_version` | string | 固定为 `"v1"` |
| `interview_id` | string | 与文件名一致（不含 `.md`），如 `2026-05-11-bytedance-sre-p6` |
| `source` | string | `mock`（mock-interview 产出）/ `real`（未来 real-interview-import 产出）。当前默认 `mock` |
| `date` | string (YYYY-MM-DD) | 面试日期 |
| `jd_slug` | string | 公司+岗位+级别的 slug |
| `jd_company` | string | 公司名 |
| `jd_role` | string | 岗位名，如 `SRE` / `运维开发` |
| `jd_level` | string | 级别，如 `P6` / `高级`；可为空 |
| `jd_source` | string | JD 来源（链接、粘贴文本等） |
| `candidate_level` | string | `初级` / `中级` / `高级` |
| `resume_refs` | string[] | 引用的简历文件路径数组 |
| `dimensions` | string[] | 本场考察维度 3-5 个，由 JD 决定，**不写死** |
| `match_score` | int (0-100) | 面试前简历-JD 匹配度总分 |
| `match_breakdown` | object | 6 维匹配度明细，见下文 |
| `match_recommendation` | string | `推荐` / `可面试-需补强` / `不建议-偏差过大` |
| `started_at` | string (ISO 8601) | 面试开始时间 |
| `ended_at` | string (ISO 8601) | 面试结束时间；`aborted` 时也写当前时间 |
| `status` | string | `in_progress` / `completed` / `aborted` |
| `question_count` | int | 已记录的提问数，每题 +1 |

**关键不变量**：以下字段一旦 `status: completed` 即冻结，interview-summary 不会回写任何分析字段（如 overall_score）到记录文件——分析字段都在聚合文件里。

### `match_breakdown` 结构

匹配度评分由 6 个维度加权得出，总分 100。评分口径以仓库根目录 `shared/match-scoring.md` 为唯一来源；本节只规定记录文件中的存储结构：

```yaml
match_breakdown:
  hard_skill_hit:     {score: 22, weight: 25, note: "JD 必备 K8s/Prom/Go，命中 K8s/Prom 缺 Go"}
  yoe_level_fit:      {score: 12, weight: 15, note: "JD P6 要 5+，简历 6 年"}
  scale_fit:          {score: 10, weight: 15, note: "JD 大厂高并发，简历中等规模"}
  business_fit:       {score: 12, weight: 15, note: "JD 短视频，简历金融，部分迁移"}
  bonus_hit:          {score: 8,  weight: 15, note: "加分项 5 项命中 3 项"}
  critical_gap:       {score: 12, weight: 15, note: "强必须项无空白"}
```

`match_score` = 6 个 `score` 字段之和。

### 阈值规则（mock-interview 启动时判定）

- `match_score ≥ 75`：`match_recommendation = "推荐"`，正常开始
- `60 ≤ match_score < 75`：`match_recommendation = "可面试-需补强"`，展示报告后让用户确认
- `match_score < 60`：`match_recommendation = "不建议-偏差过大"`，强警告并列出 top 3 缺口；用户回 "继续" 才开面

### 每题正文结构（钻孔式分层）

每题按"L1 基础认知 → L2 深入细节 → L3 边界场景"递进。**L1 必填**（初始题目）；L2/L3 按用户答题深度按需添加，单题最多 3 层。

```markdown
## Q{n} · {维度} · {题目摘要}

**L1 · 基础认知**
- 提问：{L1 完整题目原文}
- 回答要点：{用户 L1 回答的要点，1-3 行，不逐字}
- 卡壳原话：> "{用户 L1 卡壳的原话}"      # 没有卡壳就省略此行（不要写"无"）

**L2 · 深入细节**       # 仅当面试官实际追问 L2 时才出现整段
- 追问：{L2 完整追问原文}
- 回答要点：{用户 L2 回答}
- 卡壳原话：> "..."

**L3 · 边界场景**       # 仅当实际追问 L3 时才出现
- 追问：{L3 完整追问原文}
- 回答要点：{用户 L3 回答}
- 卡壳原话：> "..."

**本题评分**：{1-5}/5（{简短理由，应体现层次表现，如 "L1 OK，L2 起卡，L3 断"}）
```

**层次定义**（参考 mock-interview 钻孔式三层）：

| 层 | 主题 | 考察意图 |
|---|---|---|
| **L1 · 基础认知** | 整体理解 | 候选人对题目所在技术领域的认知地图是否完整 |
| **L2 · 深入细节** | 实践经验 | 落地踩坑、工具链熟悉度、具体参数与命令 |
| **L3 · 边界场景** | 技术边界 | 异常/边角场景、性能极限、演进路径与权衡 |

**约束**：

- **卡壳原话必须逐字保留**，禁止改写成"K8s 不熟"这种总结性表述
- 没有卡壳的层**直接省略 "卡壳原话" 这一行**，不要写"无"（让原话字段只在真有卡壳时出现，便于聚合时直接扫）
- 实时记录追求"快、准、原始"，不做提炼
- 面试中途不要打断节奏询问"要不要记录这一题"，按规则自动追加
- 单题最多 3 层；同一维度连续 3 题（L1 都包含）后必须切换维度（避免在同方向过度钻取）
- 评分必须有"层次理由"——比如 5 分要在三层都答好，2 分通常是 L1 OK 但 L2 起就断

---

## 第二部分 · 聚合文件 Schema（interview-summary 写）

### 命名

```
{YYYY-MM-DD}-summary.md          # 首次
{YYYY-MM-DD}-summary-v2.md       # 同日重新聚合
{YYYY-MM-DD}-summary-v3.md
```

- 日期是**生成总结的日期**，不是任何一场面试的日期
- 同名加版本号 `v2` / `v3`...
- 跨场聚合，**文件名不含某场面试的 slug**

### 文件整体结构

```
---
<YAML front matter，机器可读>
---

# 跨场面试聚合复盘 · {time_range}

## 一、维度评分（跨场聚合）
| 维度 | 得分 | 出现场数 | 简评 |
|---|---|---|---|

## 二、整体评分 与 匹配度对照
- 整体（跨场均值）：...
- 各场匹配度 vs 实际表现表

## 二·补 · 层次穿透率（L1/L2/L3 通过率）
| 层 | 进入题数 | 通过题数 | 通过率 | 信号 |

## 三、Top Gaps（跨场严重度排序）
1. ...

## 四、卡壳点回顾（按维度归类，原话保留 + 来源标注）
- **{维度}**
  - [{date} {公司缩写} Q{n}] > "..."

## 五、更强的人会怎么答（针对低分题）
- **[{date} {公司} Q{n}]**：{标准答题路径}

## 六、补课优先级（按 ROI 排序）
| 优先级 | 主题 | 为什么优先 | 建议动作 |

## 七、表达问题（跨场观察）
- ...
```

### Front Matter 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `schema_version` | string | 固定为 `"v1"` |
| `summary_id` | string | 与文件名一致（不含 `.md`），如 `2026-05-11-summary` 或 `2026-05-11-summary-v2` |
| `generated_at` | string (ISO 8601) | 生成总结的时间 |
| `version` | string | `v1` / `v2` / `v3`...；首次为 `v1` |
| `included_interviews` | string[] | **本次聚合包含的所有 `interview_id`**，必须存在不能为空。这是追溯结论来源的唯一依据 |
| `time_range` | string | 包含面试的日期范围，如 `2026-05-08 ~ 2026-05-11`；单场就写单日 |
| `interview_count` | int | `len(included_interviews)` |
| `source_filter` | string | 本次聚合的来源筛选：`all` / `mock_only` / `real_only`；默认 `all` |
| `overall_score` | float (1.0-5.0) | 跨场所有题目评分的加权均值 |
| `dimension_scores` | object | 每个维度的跨场聚合评分，如 `{"K8s 排障": 2.5}`。聚合方式：该维度在所有场出现题目评分的均值；单场 N/A 不计入分母 |
| `dimension_coverage` | object | 每个维度被几场面试覆盖，如 `{"K8s 排障": 2}`。给"出现场数"列用 |
| `layer_pass_rate` | object | 跨场层次穿透率，键为 `L1` / `L2` / `L3`，值为 `{reached, passed, rate}`。`reached` = 进入该层的题数，`passed` = 该层评估 ≥ 3 的题数，`rate` = passed/reached（保留 1 位小数）。L1 = 所有题；L2 = 实际追问到 L2 的题；L3 = 实际追问到 L3 的题 |
| `top_gaps` | string[] | 按严重程度排序，每条 1 行 |
| `study_plan` | object[] | 每项 `{priority: "P0"/"P1"/"P2", topic: "...", reason: "...", action: "..."}` |
| `tags` | string[] | 自由标签，命名约定见下方 |

### `tags` 命名约定

供未来跨多份 summary 文件统计长期趋势用，命名保持稳定：

**维度类**：
- 维度弱标记：`{维度小写}-weak`，如 `k8s-weak`、`prometheus-weak`
- 维度强标记：`{维度小写}-strong`

**层次画像类**（基于 `layer_pass_rate`）：
- `knowledge-gap` —— L1 通过率 < 0.5，认知层缺口，需补基础知识
- `lack-hands-on` —— L1 ≥ 0.7 且 L2 < 0.4，懂概念缺实操，需做项目
- `lack-edge-thinking` —— L1 ≥ 0.7 且 L2 ≥ 0.5 且 L3 < 0.3，实操扎实缺边界思考，需读 case study

**其他**：
- `expression-gap` —— 单题证据显示候选人知识高于初答呈现；仅作 coaching 或有充分跨场证据时使用
- `compressed-reasoning` —— 推理链存在明显 A→D 跳跃；通常与 `expression-gap` 并列
- 软技能：`communication-ok` / `communication-weak`
- 匹配度异常：`overestimated`（简历高估自己）/ `underestimated`（简历低估自己）
- 聚合规模：`small-sample`（< 3 场）/ `large-sample`（≥ 5 场）
- `aborted-included` —— 包含 aborted 场次

### 卡壳点引用格式（**带层次标注**）

每条卡壳原话必须标注**来源 + 层次**，格式：

```
[{date} {公司缩写} Q{n} L{layer}] > "{原话}"
```

其中 `L{layer}` 为 `L1` / `L2` / `L3`，对应该卡壳发生的层次。**层次越浅越严重**——L1 卡说明认知层缺口，L3 卡说明边界思考不足。

例如：

- `[2026-05-08 字节 Q3 L1] > "呃……我一般直接 kubectl logs，没怎么看过 events"`（L1 卡，认知层）
- `[2026-05-10 阿里 Q7 L2] > "影子表那块我大概知道思路，但实际没操作过"`（L2 卡，实操层）

这样聚合产出可以追溯到具体记录文件的具体题目和层次，未来人工核对或自动 link 都方便。聚合时建议按维度归类后，**末尾补一行 `· 层次分布：L1 ×{n} / L2 ×{n} / L3 ×{n}`** 揭示该维度卡壳的层次集中度。

---

## 第三部分 · 写入协议（所有写方必须遵守）

本节是契约层约束。所有写 `interviews/` 的 skill 都必须遵循，**否则数据会被污染、聚合结果不可信**。

### W1 · 工具选择

- 记录文件实时追加题目：用 **Edit 工具**做末尾追加（mock-interview）
- 聚合文件首次创建：用 **Write 工具**一次性写入完整文件（interview-summary）
- 写入失败先 Read 整文件取实际内容重试一次；二次失败立即停止并告知用户

### W2 · Front Matter 字段写入

- 字段名严格按本 SCHEMA 定义，不要自创字段或改写已有字段名
- 修改字段值时用 Edit 替换该字段所在的完整行，不要影响相邻字段
- 信息不足无法填写的字段：基本元信息字段写 `null`，分析字段（如 dimension_scores 某维度全场未覆盖）写 `N/A`

### W3 · 文件边界

- **记录文件只由 mock-interview（未来还有 real-interview-import）写**
- **聚合文件只由 interview-summary 写**
- 任何 skill 都不得跨文件类型写入。聚合文件不再 append 到记录文件，记录文件不再被回填分析字段

### W4 · 记录文件冻结规则

- `status: completed` 或 `aborted` 之后，记录文件**不再被任何 skill 修改**
- 如发现需要修订（如题目记录错了），由用户手动编辑文件，不通过 skill

### W5 · 聚合文件版本号规则

- 同日同 `source_filter` 重新生成 → 加 `-v2` / `-v3` 后缀
- **不删除旧聚合文件**：版本号是叠加的，让用户能看见自己结论的演进
- `included_interviews` 字段必须如实记录本次聚合的来源；如包含了上一版的新增/减少，note 字段说明

### W6 · 信息不足处理

- 无法从输入推断的字段，**不要凭空生成**
- 匹配度评分 `match_breakdown.{维度}.note` 必须写明判定依据，不能空字符串
- 某维度全场未覆盖时，dimension_scores 写 `N/A`，dimension_coverage 写 `0`

---

## 第四部分 · 两个完整的极小示例

### 示例 A · 记录文件

```markdown
---
schema_version: v1
interview_id: 2026-05-08-bytedance-sre-p6
source: mock
date: 2026-05-08
jd_slug: bytedance-sre-p6
jd_company: 字节跳动
jd_role: SRE
jd_level: P6
jd_source: 用户口述
candidate_level: 高级
resume_refs:
  - Example/示例-简历_张三-技术视角.md
dimensions:
  - K8s 排障
  - Prometheus
  - 系统设计
  - 表达能力
match_score: 82
match_breakdown:
  hard_skill_hit:  {score: 22, weight: 25, note: "命中 K8s/Prom，缺 Go"}
  yoe_level_fit:   {score: 13, weight: 15, note: "5 年 SRE，对齐 P6"}
  scale_fit:       {score: 12, weight: 15, note: "金融科技中等规模"}
  business_fit:    {score: 12, weight: 15, note: "金融 → 短视频，部分迁移"}
  bonus_hit:       {score: 11, weight: 15, note: "加分项 5 项命中 3 项"}
  critical_gap:    {score: 12, weight: 15, note: "强必须项无空白"}
match_recommendation: 推荐
started_at: 2026-05-08T20:30:00+08:00
ended_at: 2026-05-08T21:25:00+08:00
status: completed
question_count: 8
---

# 字节跳动 SRE 模拟面试

## Q1 · K8s 排障 · CrashLoopBackOff 排查

**L1 · 基础认知**
- 提问：一个 Pod 反复 CrashLoopBackOff，你怎么定位？
- 回答要点：先 kubectl logs 看日志，再 describe pod
- 卡壳原话：> "呃……我一般直接 kubectl logs，没怎么看过 events"

**L2 · 深入细节**
- 追问：events 在排查里能告诉你什么 logs 看不到的信息？
- 回答要点：想了下能看到调度阶段错误、镜像拉取失败、挂卷失败这类
- 卡壳原话：> "events 这个我一般不看，今天想了下确实关键"

**L3 · 边界场景**
- 追问：如果 Pod 在调度或拉镜像阶段就挂了，logs 是空的，怎么诊断？
- 回答要点：那应该只能看 events 了，具体怎么定位说不上来
- 卡壳原话：> "Pod 还没启动 logs 是空的，这个我没想过"

**本题评分**：2/5（L1 给的工具对但顺序错；L2 提示后能补；L3 直接断）
```

### 示例 B · 聚合文件

```markdown
---
schema_version: v1
summary_id: 2026-05-11-summary
generated_at: 2026-05-11T22:00:00+08:00
version: v1
included_interviews:
  - 2026-05-08-bytedance-sre-p6
  - 2026-05-10-alibaba-sre-p7
time_range: 2026-05-08 ~ 2026-05-10
interview_count: 2
source_filter: all
overall_score: 3.1
dimension_scores:
  K8s 排障: 2.0
  Prometheus: 4.0
  系统设计: 2.5
  表达能力: 3.0
  混沌工程: N/A
dimension_coverage:
  K8s 排障: 2
  Prometheus: 1
  系统设计: 2
  表达能力: 2
  混沌工程: 1
layer_pass_rate:
  L1: {reached: 16, passed: 11, rate: 0.7}
  L2: {reached: 15, passed: 4,  rate: 0.3}
  L3: {reached: 4,  passed: 0,  rate: 0.0}
top_gaps:
  - K8s 故障排查链路不熟（2 场都暴露）
  - 系统设计缺容量预估
  - Go 实战经验空白
study_plan:
  - {priority: P0, topic: K8s 故障排查实战, reason: "致命短板，2/2 场暴露", action: "实操 5 个故障场景"}
  - {priority: P1, topic: 容量预估方法论, reason: "P7 必考", action: "DDIA 第 1 章 + 3 道题"}
tags: [k8s-weak, small-sample]
---

# 跨场面试聚合复盘 · 2026-05-08 ~ 2026-05-10

## 一、维度评分（跨场聚合）
...
```
