# 运维简历自动生成器

> 五个 AI Skill 串起来：**生成/优化简历 → 可选终稿去 AI 化 → 模拟面试 → 复盘补课**，覆盖运维/SRE 求职的完整链路。

写简历卡壳、面试完只记得"答得不太好但不知道差在哪"、想刷题没方向——本项目就是为这三件事造的。

核心差异不是又一个简历模板，而是**用工程化方式把面试当一场实验**：每场模拟面试是一个按 schema 结构化的数据点，累积几场后跑 `interview-summary` 横向聚合，**反复出现 2+ 次的卡壳点才是真问题**，单次状态波动会被自动过滤。

### 全链路流程图

```mermaid
flowchart LR
    subgraph 入口[入口二选一]
        A[resume-generator<br>冷启动生成简历]
        B[resume-optimizer<br>已有简历诊断优化]
    end

    subgraph 数据契约[共享契约]
        T1[Example.md<br>10 项目模板]
        T2[Project-Skills/<br>44 能力等级]
        T3[shared/match-scoring.md<br>6 维匹配评分]
        T4[interviews/SCHEMA.md<br>字段契约]
    end

    A --> C[/简历/]
    B --> C
    C --> D{需要去 AI 化?}
    D -- 否 --> F
    D -- 是 --> E[resume-humanizer<br>终稿可信度检查]
    E --> F[mock-interview<br>模拟面试 循环 N 场]
    F --> G[/N 份记录文件/<br>interviews/*.md]
    G --> H{累计 ≥2 场?}
    H -- 否 --> F
    H -- 是 --> I[interview-summary<br>跨场聚合复盘]
    I --> J[/1 份聚合文件/<br>interviews/*-summary.md]
    J --> K{发现短板}
    K -- 补课后 --> F
    K --> L[P0/P1/P2 补课清单]

    T1 --> A
    T2 --> A
    T3 --> B
    T3 --> F
    T4 --> F
    T4 --> I
```

关键点：

- **入口二选一**：`resume-generator`（没有简历）或 `resume-optimizer`（已有简历）
- **`resume-humanizer` 是可选项**：只有用户明确提出"去 AI 化"才触发
- **`mock-interview` 可循环 N 场**，每场落盘一份符合 SCHEMA 的记录文件
- **`interview-summary` 强制 ≥2 场**才允许聚合，产出 P0/P1/P2 补课清单后闭环回到面试
- **共享契约层**：评分口径（match-scoring）和字段契约（SCHEMA）贯穿多个 skill

---

## 它能做什么

### 1. `resume-generator` — 写简历

基于 STAR 法则 + PDCA 思维工具，针对 10 个运维项目模板和 44 个能力等级文件，为你生成"技术演进视角"和"业务痛点视角"两份叙事。

**输出片段示例**（来自 [`Example/示例-简历_张三-技术视角.md`](Example/示例-简历_张三-技术视角.md)）：

```markdown
**项目名称**: 企业级持续交付平台建设
**技术栈**: Jenkins, Docker, Kubernetes, Harbor, GitLab, Helm, Prometheus, Grafana
**能力等级**: DevOps Level 1 → Level 3

### Situation
公司核心业务系统 32 个微服务，日均交易量 150 万笔。
交付体系停留在 Level 1：SSH + SCP + Shell 手工启动...

| 指标 | 现状 | 行业基准 |
|---|---|---|
| 部署频率 | 2-3 次/月 | 日级 |
| 单次部署耗时 | 4-6 小时 | <30 分钟 |
| 部署成功率 | 65% | >95% |
```

完整两份简历：[技术视角](Example/示例-简历_张三-技术视角.md) · [业务痛点视角](Example/示例-简历_张三-业务痛点视角.md)

### 2. `resume-optimizer` — 优化已有简历

接受用户已有的 SRE/DevOps/运维简历，不强行套 10 个项目模板。先按 STAR、PDCA、44 个能力模型做诊断，再根据是否提供完整 JD 自动进入通用优化或 JD 对齐优化。

JD 对齐模式会复用 [`shared/match-scoring.md`](shared/match-scoring.md) 的 6 维评分契约，输出优化前匹配度与保守预测目标分。真实简历默认写入 `resumes/`（gitignored），避免个人信息进入示例目录。

适合这种场景：

```markdown
我已经有一份运维简历，想投字节 SRE P6。帮我先看哪里虚、哪里弱，
再按这个 JD 改一版，后面我要拿它跑模拟面试。
```

### 3. `resume-humanizer` — 简历终稿去 AI 化

处理中文运维、SRE、DevOps 和平台工程简历中的模板化 STAR、空泛包装与职责失真风险。它先冻结公司、时间线、技术栈、数字、职责等级和已真实命中的 JD/ATS 关键词，再输出五维风险诊断；只有用户确认改写范围后，才生成不覆盖原件的新版本。

它不会计算“AI 生成概率”，也不会为了增加所谓人味编造踩坑、指标或方案取舍。缺少真实细节时会追问；无法补证的强表述只能保留、降级或删除。

适合这种场景：

```markdown
这份简历是 AI 帮我整理的，STAR 痕迹太重，面试官一眼就能看出模板感。
请先检查哪些地方虚、哪些事实要补，不要直接改，也不要动 JD 关键词。
```

### 4. `mock-interview` — 实战化模拟面试

扮演资深 SRE 面试官，**面试前先做 6 维加权匹配度评分**（0-100，<60 强警告偏差过大），通过后按钻孔式三层递进出题、追问、评分。每问完一题立刻落盘——**卡壳原话逐字保留，禁止改写**。

**输出片段示例**（实时落盘到 `interviews/2026-05-08-bytedance-sre-p6.md`，**按 L1/L2/L3 分层落盘**）：

```markdown
---
schema_version: v1
source: mock
jd_company: 字节跳动
jd_role: SRE
match_score: 82
match_recommendation: 推荐
dimensions: [K8s 排障, Prometheus, 系统设计, 表达能力]
status: completed
question_count: 8
---

## Q1 · K8s 排障 · Pod CrashLoopBackOff 排查链路

**L1 · 基础认知**
- 提问：线上一个 Java 微服务 Pod 反复 CrashLoopBackOff，已重启 7 次。你按什么顺序排查？
- 回答要点：先 kubectl logs 看异常堆栈，再 describe pod 看事件
- 卡壳原话：> "呃……我一般先 logs 看异常堆栈，events 那个……说实话不太常看"

**L2 · 深入细节**
- 追问：events 在排查里能告诉你什么 logs 看不到的信息？为什么应该排在 logs 之前？
- 回答要点：想了下能看到调度阶段错误、镜像拉取失败、挂卷失败这些；确实应该放前面
- 卡壳原话：> "events 这个我一般不看，今天想了下确实关键"

**L3 · 边界场景**
- 追问：如果 Pod 在调度或拉镜像阶段就挂了，logs 是空的，怎么诊断？`kubectl logs --previous` 你用过吗？
- 回答要点：那只能看 events；--previous 第一次听说
- 卡壳原话：> "Pod 还没启动 logs 是空的这个我没想过"

**本题评分**：2/5（L1 工具对但顺序错；L2 提示后能补；L3 直接断）
```

> 钻孔式分层的价值：聚合时能算出"L1 通过率 / L2 通过率 / L3 通过率"，比单 score 多一个能力深度维度。同一维度的多场题目对比，更能看出"撑得到几层"这种细粒度信号。

完整记录文件：[字节场](Example/示例-面试记录_字节-sre-p6.md) · [阿里场](Example/示例-面试记录_阿里-sre-p7.md)

### 5. `interview-summary` — **跨场聚合**复盘

**积累 2+ 场面试**后跑一次，把多场记录文件横向打通：聚合维度评分、识别 Top Gaps（出现 ≥2 次的卡壳才是真问题）、对照面试前匹配度 vs 实际表现识别简历水分、生成 P0/P1/P2 补课优先级。

输出到独立的聚合文件 `interviews/{YYYY-MM-DD}-summary.md`，**不修改任何记录文件**（记录文件 status: completed 后冻结）。同日重新跑加 `-v2`/`-v3` 后缀保留版本。

**输出片段示例**（来自 [`Example/示例-面试总结_张三.md`](Example/示例-面试总结_张三.md)，聚合了字节 + 阿里两场）：

```markdown
---
included_interviews:
  - 2026-05-08-bytedance-sre-p6
  - 2026-05-10-alibaba-sre-p7
time_range: 2026-05-08 ~ 2026-05-10
interview_count: 2
overall_score: 2.8
dimension_scores: {系统设计: 2.5, 混沌工程: 1.0, K8s 排障: 2.7, ...}
tags: [system-design-weak, chaos-engineering-weak, overestimated, small-sample]
---

## 一、维度评分（跨场聚合）
| 维度 | 得分 | 出现场数 | 简评 |
|---|---|---|---|
| 系统设计 | 2.5/5 | **2/2** | 系统性短板。容量预估和异地多活两条都断 |
| 混沌工程 | 1.0/5 | 1/2 | 零经验，仅停留在名词级了解 |

## 四、卡壳点回顾（按维度归类，原话保留 + 来源标注）
- **系统设计**
  - [2026-05-08 字节 Q6] > "Thanos 我只读过文档，没实际部过"
  - [2026-05-10 阿里 Q7] > "影子表那块我大概知道思路，但实际没操作过"

## 六、补课优先级（按 ROI 排序）
| 优先级 | 主题 | 为什么优先 | 建议动作 |
|---|---|---|---|
| P0 | 系统设计方法论体系化 | 跨 2 场维度 2.5，P6/P7 通杀项 | DDIA 第 1/5/9 章 + System Design Vol.1 精读 5 道大题 |
| P0 | 混沌工程从 0 到 1 | 阿里 P7 加分项 1/5，简历空白 | ChaosBlade 跑通 5 个故障注入场景 |
```

---

## 快速开始

如果你在用 Claude Code / Cursor / Gemini 等支持 Skill 的 AI 助手，对话里直接描述：

```
我是 5 年经验的运维工程师，熟悉 Kubernetes、Prometheus、Jenkins，
想生成 CI/CD 相关的简历项目，投递前检查一下模板化风险，
再针对字节跳动 SRE P6 的 JD 做一场模拟面试。
```

AI 助手会自动按场景选择简历入口，再串到面试和复盘（注意 interview-summary 不是每场跑、是累积几场再跑）：

```
resume-generator / resume-optimizer  →  [resume-humanizer]  →  mock-interview  →  ... →  interview-summary
        生成或优化简历                       可选终稿门             面 N 场               跨场聚合复盘
                                         → 1 份去 AI 版       → N 份记录文件          → 1 份聚合文件
```

方括号表示可选步骤；用户明确提出“去 AI 化、太像 AI、太模板化、写得像机器”等需求时再运行。每一步可独立使用。`interview-summary` 强制要求 ≥2 场记录才能跑——单场不足以聚合，结论会有偏差。

---

## 设计哲学

这套设计有几个非显然的决策，是它跟"又一个简历模板"的本质区别。

### 为什么拆多个 Skill 而不是一个大 prompt

- **职责单一**：`resume-generator` 负责冷启动生成简历，`resume-optimizer` 负责已有简历诊断优化，`resume-humanizer` 负责可选终稿可信度检查，`mock-interview` 只写记录，`interview-summary` 只做跨场聚合。任何一步坏了不影响其他步骤
- **可离线复用**：写完简历几个月后想再面试，单独跑 `mock-interview` 就行；面试完一阵子再回头复盘，独立跑 `interview-summary` 即可
- **数据时间不对称**：单场面试是"事件"（立刻产生），但跨场聚合是"事实回顾"（积累后才有意义）——拆开后两件事的时间节奏可以各自顺其自然
- **未来可扩展**：后续计划增加 `real-interview-import`（接真实面试的录音/转写），输出同样符合 SCHEMA 的记录文件，`interview-summary` 一行不用改就能把"真实场 + 模拟场"一起聚合

### 为什么有一份 SCHEMA.md 作为契约

`interviews/SCHEMA.md` 定义了所有 front matter 字段的名字、类型、写入协议。写入 `interviews/` 的 skill 都必须以此文件为唯一真相。

这样做的好处是：未来想加新字段、改聚合逻辑、甚至换一个 AI 工具实现 skill，**字段契约不变就不会破坏历史数据**。

### 为什么有共享匹配度评分契约

`mock-interview` 和 `resume-optimizer` 都需要评估"简历看起来是否匹配目标 JD"。评分口径统一放在 [`shared/match-scoring.md`](shared/match-scoring.md)，避免一个 skill 说 82 分、另一个 skill 按另一套口径说 70 分。

### 为什么卡壳原话必须逐字保留

事后回忆会自动美化——你会把"呃……那个 federation 我只听过没用过"记成"federation 不太熟"。但前者才是真实的能力短板信号，后者是已经被你大脑过滤过的版本。

模拟面试这个场景的最大价值不是"今天得了几分"，而是**拿到事后无法重建的原始数据**。所以本项目把这条写成 mock-interview 的硬约束。

### 为什么面试前要做匹配度评分

省时间。如果简历跟目标 JD 偏差过大（<60 分），跑完一场面试只会得到"啥都不会"的结论，没价值。匹配度评分相当于面试前的"准入门槛"，让你把时间花在真正能转化的机会上。

---

## 项目结构

```
operation-resume-auto-generate/
├── README.md
├── Example.md                # 10 个运维项目模板（skill 内部参考数据）
├── Project-Skills/           # 44 个能力等级文件（skill 内部参考数据）
├── Example/                  # 5 份示例文件（虚构候选人「张三」端到端样例）
│   ├── 示例-简历_张三-技术视角.md
│   ├── 示例-简历_张三-业务痛点视角.md
│   ├── 示例-面试记录_字节-sre-p6.md      # mock-interview 产出形态
│   ├── 示例-面试记录_阿里-sre-p7.md
│   └── 示例-面试总结_张三.md             # interview-summary 跨场聚合产出
├── interviews/               # 真实面试数据（gitignored，含卡壳原话）
│   └── SCHEMA.md             # 字段契约（入库；记录文件 + 聚合文件两种 schema）
├── resumes/                  # 真实简历与优化产出（gitignored，不入库）
├── shared/
│   └── match-scoring.md      # 简历-JD 6 维匹配度评分契约
├── skills/                   # Canonical Skill 目录（非隐藏）
│   ├── resume-generator/SKILL.md
│   ├── resume-optimizer/SKILL.md
│   ├── resume-humanizer/SKILL.md
│   ├── mock-interview/SKILL.md
│   └── interview-summary/SKILL.md
├── .agents/skills/           # symlink → ../../skills/* （Cursor / Codex）
├── .agent/skills/            # symlink → ../../skills/* （Gemini / Antigravity）
└── .claude/skills/           # symlink → ../../skills/* （Claude）
```

Canonical 位置统一在 `skills/`（非隐藏），3 个隐藏目录通过 symlink 复用同一份内容，避免多副本漂移。如需为其他 AI 工具新增入口，建对应目录的 symlink 指向 `skills/` 即可。

---

## AI 工具适配

| AI 工具 | Skill 目录 | 状态 |
|---|---|---|
| Claude Code / Claude.ai | `.claude/skills/` | symlink 已配置 |
| Cursor / Codex 风格 | `.agents/skills/` | symlink 已配置 |
| Gemini / Antigravity | `.agent/skills/` | symlink 已配置 |
| GitHub Copilot | `.github/copilot-instructions.md` | 可手动引用 `resume-prompt.md` |
| 其他 | — | 直接读 `skills/*/SKILL.md` 作为系统提示词 |

> `resume-prompt.md` 和 `interview-prompt.md` 是项目早期的单文件提示词版本，已被 `skills/` 取代，仅作为不支持 Skill 协议的工具的兼容回退。新用户请优先使用 `skills/`。

---

## 参考资料

<details>
<summary><b>10 个运维项目模板</b>（点击展开）</summary>

| 项目 | 领域 | 演进等级 |
|---|---|---|
| 项目一 | 监控告警智能化平台建设 | 1级 → 3级 |
| 项目二 | 自动化运维平台建设 | 1级 → 3级 |
| 项目三 | CI/CD 流水线与发布策略建设 | 1级 → 3级 |
| 项目四 | 事件管理体系建设 | 1级 → 3级 |
| 项目五 | 变更管理规范化建设 | 1级 → 3级 |
| 项目六 | 容量管理与成本优化 | 1级 → 3级 |
| 项目七 | 高可用架构与灾备体系建设 | 1级 → 3级 |
| 项目八 | 运维度量体系建设 | 1级 → 3级 |
| 项目九 | CMDB 与配置管理中心建设 | 2级 → 3级 |
| 项目十 | 日志分析与故障定位平台 | 1级 → 3级 |

详细模板见 [`Example.md`](Example.md)。

</details>

<details>
<summary><b>项目方向与推荐模板</b>（点击展开）</summary>

| 运维方向 | 推荐项目 |
|---|---|
| 监控运维 | 项目一、项目十 |
| 发布运维 | 项目三、项目五 |
| 平台运维 | 项目二、项目九 |
| SRE 方向 | 项目四、项目七、项目八 |
| 成本运维 | 项目六 |

</details>

<details>
<summary><b>能力模型与项目映射</b>（点击展开）</summary>

`Project-Skills/` 目录含 44 个能力等级文件，每个文件定义该能力 1-5 级的标准。

| 能力模型 | 涉及项目 |
|---|---|
| 监控可视化及通知 | 项目一 |
| 异常识别 | 项目一 |
| 监控数据处理 | 项目一、项目十 |
| 运维场景能力 | 项目二 |
| 部署流水线 | 项目三 |
| 事件管理 | 项目四 |
| 变更管理 | 项目三、项目五、项目九 |
| 容量管理 | 项目六 |
| 可用性管理 | 项目七 |
| 度量指标 | 项目八 |

</details>

<details>
<summary><b>字段契约 SCHEMA</b>（点击展开）</summary>

两种文件 schema 与写入协议（W1-W6）统一在 [`interviews/SCHEMA.md`](interviews/SCHEMA.md)：

- **记录文件**（`{date}-{jd-slug}.md`）：mock-interview 写，含 front matter + 每题 Q&A
- **聚合文件**（`{date}-summary.md`）：interview-summary 写，含跨场聚合分析；同日重跑加 `-v2`/`-v3`

关键约束：
- 工具选择（W1）：记录文件用 Edit 追加，聚合文件用 Write 一次性写
- 文件边界（W3）：mock-interview 只写记录、interview-summary 只写聚合，不互相跨写
- 记录冻结（W4）：`status: completed` 后记录文件永不被任何 skill 修改
- 聚合版本（W5）：旧聚合文件不删，靠 `-v2`/`-v3` 叠加，保留结论演进
- 信息不足（W6）：不凭空生成，写 `null` / `N/A` 占位

</details>

---

## License

MIT
