# 运维 / SRE 求职工作流

> 面向运维、DevOps、SRE 和平台工程岗位的 AI Skill 工作流：从简历生成与优化、项目自查，到 JD 模拟面试，再到单题表达训练、跨场复盘和补课计划。

用真实经历写简历，通过项目自查梳理自己的业务理解和技术实践，再用目标 JD 检验匹配度、用结构化面试记录发现反复出现的短板，形成可以重复运行的训练流程。

## 你可以用它做什么

- 没有现成简历：从真实经历中整理出可用于求职的项目描述
- 已有简历：诊断 STAR、技术深度、量化结果及目标 JD 匹配度
- 简历模板感太强：降低 AI 腔，同时保护事实、职责边界和 ATS 关键词
- 简历已完成：不结合 JD，生成项目自查题，填写回答后评估项目熟悉程度
- 准备面试：针对简历和目标 JD 进行递进式模拟面试
- 面试过几轮：聚合多场表现，识别反复出现的短板并生成补课优先级

> [!IMPORTANT]
> 项目不会替你编造技术栈、项目规模、量化指标或职责。缺少事实时，Skill 会追问、保守表达或标记缺口，而不是自动补齐一个“更好看”的故事。

## 工作流

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/luozijian1990/operator-resume-auto-generate/main/docs/job-search-workflow-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/luozijian1990/operator-resume-auto-generate/main/docs/job-search-workflow-light.svg">
  <img alt="运维 / SRE 求职训练闭环" src="https://raw.githubusercontent.com/luozijian1990/operator-resume-auto-generate/main/docs/job-search-workflow-light.svg">
</picture>

图中的项目自查和单题辅导均为可选环节。单题辅导可读取自查题单中的原回答，也可读取原始面试记录；跨场复盘只聚合原始面试记录，辅导报告不作为其输入。自查辅导后由用户重新作答，再生成新版评估。

流程图维护：[Archify 源文件](docs/job-search-workflow.workflow.json) · [自适应主题 SVG](docs/job-search-workflow.svg) · [更新说明](docs/workflow-diagram.md)。README 使用浅色、深色两份 SVG，更新时需一起导出。

七个 Skill 可以独立使用，也可以串成完整流程：

| Skill | 什么时候用 | 主要产出 |
| --- | --- | --- |
| `resume-generator` | 没有简历，需要从经历开始整理 | 技术演进、业务痛点两种视角的项目描述 |
| `resume-optimizer` | 已有简历，需要通用诊断或 JD 对齐 | 诊断报告、用户确认后的优化版简历 |
| `resume-humanizer` | 简历太模板化、太像 AI | 风险诊断、用户确认后的去 AI 版简历 |
| `resume-project-questions` | 简历完成后自查项目，或已填好自查回答 | 四级 Markdown 双视角题单、逐题评分与准备度建议；不涉及 JD |
| `mock-interview` | 准备某个具体岗位的面试 | 匹配度评分、逐题追问和单场面试记录 |
| `interview-answer-coach` | 某道回答讲不清、项目自查后需要训练，或复盘已有面试题 | 已覆盖/合理展开/真正缺失、30/90 秒表达版本、面试口语去模板化 |
| `interview-summary` | 已积累至少 2 场面试记录 | 跨场能力画像、Top Gaps、补课优先级 |

## 快速开始

本项目以 Markdown Skill 和参考资料为主，无需启动应用服务。使用支持 Skill 的 AI 编程助手打开仓库，然后直接描述你的任务。PDF 输入需要可用的文本提取或 OCR 工具；题单结构校验脚本使用 Python 3。

### 1. 选择起点

没有简历时：

```text
我有 5 年运维经验，准备投递 SRE 岗位。
请先收集我的技术栈和真实项目经历，再帮我生成简历项目描述。
```

已有简历和完整 JD 时：

```text
请使用 resumes/my-resume.md 和下面这份 JD 做匹配度诊断。
先告诉我问题和建议改动范围，不要直接修改文件。
```

想先检查自己能否讲清简历项目时：

```text
使用 resume-project-questions，基于 resumes/my-resume.md 的项目明细出题，不结合 JD。
每个项目业务、技术视角各 15 题，输出四级 Markdown，留出回答位置。
```

填写后继续：

```text
使用 resume-project-questions，评估我填写的 resumes/project-prep/项目问题.md。
原简历是 resumes/my-resume.md。请逐题评分，生成独立报告，建议我是否可以进入 JD 模拟面试。
```

某题需要帮助时：

```text
使用 interview-answer-coach，辅导 resumes/project-prep/项目问题.md 中
“项目原名 / 技术视角 / 第 3 题”，原简历是 resumes/my-resume.md。
读取题目和我的完整回答，判断是没讲清、需要补课还是事实待澄清，再给训练建议。
```

训练后用自己的话重新回答，保留旧回答，并将新版题单交给 `resume-project-questions` 重新评估。coach 的推荐版本不会直接计入评分。

想直接练面试时：

```text
请基于我的简历和目标 JD 做一场 SRE 模拟面试。
按真实面试节奏逐题提问，并把回答和卡壳点记录下来。
```

### 2. 按检查点确认

几个 Skill 都有明确的人工确认点：

- 生成简历前，先确认经历、技术栈与所选项目
- 优化或去 AI 化前，先看诊断并确认改写范围
- 简历与 JD 匹配度偏低时，由你决定是否继续面试
- 跨场总结前，由你选择需要纳入的面试记录

这些检查点用于避免模型擅自改动事实或拿错文件。

### 3. 继续下一环

```text
resume-generator / resume-optimizer
                 ↓
       [resume-humanizer]
                 ↓
   [resume-project-questions]
      出题 → 填写 → 回答评估
                 ↔ [interview-answer-coach]
                    选题诊断与训练；用户重答后回到自查评估
                 ↓
          mock-interview × N
                 ↓
       ┌─────────┴─────────┐
       ↓                   ↓
[interview-answer-coach]  interview-summary
       ↓                   ↓
   表达训练              能力补课
       └─────────┬─────────┘
                 ↓
        补课后再次模拟面试
```

`resume-project-questions` 是可选的项目自查环节，不要求 JD；准备度建议不构成模拟面试的强制门槛，也不替代 JD 匹配度评分。题单、用户回答及独立评估报告保存在 `resumes/project-prep/`，不会写入模拟面试记录。

`interview-answer-coach` 是可选的单题纵向复盘，也可以接在项目自查评估之后，按核心问题和具体缺口选题。它从原题单读取完整回答，评估报告只辅助定位；表达压缩可展开，知识或实操缺口需补课练习，事实矛盾先核实。内置的面试口语检查减少客套开场、空泛总结和机械三段式，保留技术细节、职责边界和事实证据。它不是 `interview-summary` 的前置条件；两者都可以直接读取 `interviews/`。`interview-summary` 至少需要两场已完成的面试记录。

## 产出示例

仓库中的示例均使用虚构候选人“张三”，可以先看结果，再决定从哪个 Skill 开始：

| 产出 | 示例 |
| --- | --- |
| 技术演进视角简历 | [示例-简历_张三-技术视角.md](Example/示例-简历_张三-技术视角.md) |
| 业务痛点视角简历 | [示例-简历_张三-业务痛点视角.md](Example/示例-简历_张三-业务痛点视角.md) |
| 字节 SRE 模拟面试记录 | [示例-面试记录_字节-sre-p6.md](Example/示例-面试记录_字节-sre-p6.md) |
| 阿里 SRE 模拟面试记录 | [示例-面试记录_阿里-sre-p7.md](Example/示例-面试记录_阿里-sre-p7.md) |
| 两场面试聚合复盘 | [示例-面试总结_张三.md](Example/示例-面试总结_张三.md) |

项目还提供 [10 个运维项目模板](Example.md)，覆盖监控告警、自动化运维、CI/CD、事件管理、变更管理、容量优化、高可用、度量体系、配置管理和日志分析。模板中的数字仅用于展示可采集的指标口径，不能复制到真实简历中。

<details>
<summary><strong>查看项目方向与推荐模板</strong></summary>

| 方向 | 推荐项目 |
| --- | --- |
| 监控运维 | 监控告警智能化平台、日志分析与故障定位平台 |
| 发布运维 | CI/CD 流水线与发布策略、变更管理规范化 |
| 平台运维 | 自动化运维平台、CMDB 与配置管理中心 |
| SRE | 事件管理体系、高可用与灾备、运维度量体系 |
| 成本运维 | 容量管理与成本优化 |

</details>

## 核心设计

### 先检查能否讲清自己的项目

`resume-project-questions` 不引入 JD，依据项目背景、职责、实施和成果生成业务、技术双视角问题。仅列在技术栈中、项目明细没有展开的工具不单独出题；默认每视角 15 题，材料不足时补充信息或减少题数。

题单使用“清单 → 项目 → 视角 → 问题”四级 Markdown，每题下方留出回答位置。填写后生成独立评估报告，区分已评分、未回答、待澄清和题目不适用，并结合核心问题给出准备度建议。该建议不等于 JD 匹配度，也不会自动启动或阻止模拟面试。
如果回答主要是表达压缩或模板化，可以把指定题目交给 `interview-answer-coach`；它只重排和展开已有内容，不补造经历。

### 用多场数据识别真正的短板

每场模拟面试都会形成一份结构化记录。只有某个卡壳点在不同面试中反复出现，它才更可能是稳定问题，而不是一次状态波动。因此，单场记录负责保存事实，跨场总结负责形成结论。

### 用 L1 / L2 / L3 判断能力深度

`mock-interview` 按三层逐步追问：

| 层级 | 关注点 | 判断内容 |
| --- | --- | --- |
| L1 · 基础认知 | 整体理解 | 是否建立了完整的技术认知地图 |
| L2 · 深入细节 | 实践经验 | 是否真的落地过，能否说明工具、参数与踩坑 |
| L3 · 边界场景 | 技术边界 | 能否处理异常场景、性能极限和方案权衡 |

聚合复盘会计算各层的穿透率，比单一总分更容易看出“知道概念”和“能够处理生产问题”之间的差距。

### 保留事后无法还原的原始信息

面试记录会保留用户的卡壳原话，不把它改写成笼统的“不熟悉 Kubernetes”。这是定位知识缺口、表达问题和简历承接风险的重要证据。已经标记为 `completed` 的记录会被冻结，聚合分析只生成新文件，不回写历史记录。

### 统一匹配度与数据契约

`resume-optimizer` 和 `mock-interview` 共用 [简历-JD 匹配度评分契约](shared/match-scoring.md)，避免不同 Skill 使用不同口径。面试记录与跨场总结则统一遵循 [面试数据契约](interviews/SCHEMA.md)，确保历史数据可以持续聚合。

## 真实性与隐私边界

- 所有项目、工具、规模、指标和结果都应来自用户提供的事实
- `参与`、`协助`、`负责`、`主导` 等职责等级不会被擅自升级
- 没有量化数据时先追问统计口径，不使用模板里的示例数字
- 去 AI 化的目标是恢复自然、可信、可追问的表达，不是规避检测
- 已命中且有事实支撑的 JD / ATS 关键词会受到保护
- 真实简历默认写入 `resumes/`，项目自查题单、回答及评估报告写入 `resumes/project-prep/`；面试记录写入 `interviews/`，单题辅导结果写入 `coaching/`
- 上述三个数据目录中的个人产出已通过 `.gitignore` 排除，默认不入库；`interviews/SCHEMA.md` 和 `coaching/SCHEMA.md` 等公共契约仍纳入版本管理

> [!WARNING]
> 简历和面试记录可能包含姓名、公司经历、联系方式及卡壳原话。分享文件或修改 `.gitignore` 前，请先检查并脱敏。

## 项目结构

```text
operation-resume-auto-generate/
├── skills/                    # 七个 Skill 的唯一维护目录
│   ├── resume-generator/
│   ├── resume-optimizer/
│   ├── resume-humanizer/
│   ├── resume-project-questions/
│   ├── mock-interview/
│   ├── interview-answer-coach/
│   └── interview-summary/
├── Project-Skills/            # 44 个运维能力分级模型
├── Example/                   # 虚构候选人的端到端产出示例
├── Example.md                 # 10 个运维项目模板
├── shared/
│   └── match-scoring.md       # 简历-JD 统一评分口径
├── coaching/                  # 单题 coaching 产出
├── interviews/
│   └── SCHEMA.md              # 面试记录与聚合总结的数据契约
├── resumes/                   # 真实简历与改写产出，默认不入库
│   └── project-prep/          # 项目题单、用户回答与独立评估报告
├── docs/                     # 流程图 Archify 源文件、SVG 与更新说明
├── .agents/skills/            # Cursor / Codex 入口
├── .agent/skills/             # Gemini / Antigravity 入口
└── .claude/skills/            # Claude 入口
```

`skills/` 是唯一维护位置，三个隐藏目录通过符号链接复用同一份内容，避免不同 AI 工具间的 Skill 副本发生漂移。

## AI 工具适配

| AI 工具 | Skill 入口 |
| --- | --- |
| Claude Code / Claude.ai | `.claude/skills/` |
| Cursor / Codex 风格工具 | `.agents/skills/` |
| Gemini / Antigravity | `.agent/skills/` |
| 不支持 Skill 协议的工具 | 直接将 `skills/*/SKILL.md` 作为提示词使用 |

仓库根目录中的 `resume-prompt.md` 和 `interview-prompt.md` 是早期单文件提示词，主要用于兼容不支持 Skill 协议的工具。新流程以 `skills/` 中的版本为准。

## 详细文档

- [求职闭环流程](求职闭环流程.md)：从 JD 研究、简历改写到模拟面试和补课的完整思路
- [项目模板](Example.md)：10 类运维项目及其指标口径
- [能力模型](Project-Skills/)：44 个能力方向的 1–5 级描述
- [匹配度评分契约](shared/match-scoring.md)：简历与 JD 的 6 维评分规则
- [面试数据契约](interviews/SCHEMA.md)：记录文件、聚合文件及写入约束
- [Skill 源码](skills/)：各流程的完整触发条件、检查点和输出规范
