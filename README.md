# 运维简历自动生成器

基于运维技能等级白皮书，自动生成符合 STAR 法则的简历项目描述，并进行深度模拟面试演练。

## 项目简介

本项目旨在帮助运维/SRE工程师快速生成高质量的简历项目描述。通过结合 DevOps 能力分级模型，展示从低级到高级的能力演进过程（如 Level 1 → Level 3）。

### 核心功能

- **简历生成**：基于 STAR 法则生成专业简历，包含技术视角和业务痛点视角
- **PDCA 拆解**：使用 Mermaid 流程图展示项目实施过程
- **模拟面试**：钻孔式三层递进提问，涵盖技术深度与软技能
- **个性化定制**：根据求职者的技能和技术栈生成定制化内容

## 项目结构

```
operation-resume-auto-generate/
├── README.md                 # 项目说明（本文件）
├── Example.md                # 项目模板（10个运维项目）
├── Project-Skills/           # 能力模型（44个文件）
│   ├── 部署流水线.md
│   ├── 监控可视化及通知.md
│   ├── 变更管理.md
│   └── ...
├── Example/                  # 示例输出
│   ├── 持续交付简历_技术视角.md
│   ├── 持续交付简历_业务痛点视角.md
│   ├── 面试问答_持续交付平台_Part1.md
│   └── ...
├── resume-prompt.md          # 简历优化顾问提示词
├── interview-prompt.md       # 技术面试官提示词
├── .agents/skills/           # Canonical Skill 目录
│   └── resume-generator/
│       ├── SKILL.md
│       ├── references/
│       └── Example -> ../../../Example
├── .agent/                   # 兼容目录
│   └── skills/
│       └── resume-generator -> ../../.agents/skills/resume-generator
└── .claude/                  # 兼容目录
    └── skills/
        └── resume-generator -> ../../.agents/skills/resume-generator
```

## AI 工具 Skill 目录说明

不同的 AI 工具使用不同的 Skill 目录结构：

| AI 工具 | Skill 目录 | 说明 |
| ------- | ---------- | ---- |
| Gemini / Antigravity | `.agent/skills/` | 已配置，通过 link 复用 `.agents/skills/resume-generator` |
| Claude | `.claude/skills/` | 已配置，通过 link 复用 `.agents/skills/resume-generator` |
| Cursor / Codex 风格 | `.agents/skills/` | 已配置，`resume-generator` 采用标准 skill 结构并带 `references/` |
| GitHub Copilot | `.github/copilot-instructions.md` | 可使用 `resume-prompt.md` 内容 |
| 其他 AI 工具 | - | 可直接使用 `resume-prompt.md` 和 `interview-prompt.md` |

如需为其他 AI 工具添加 Skill，可参考 `.agents/skills/resume-generator/SKILL.md` 的结构进行适配；根目录资源通过 skill 内的 link 暴露给 `references/` 和 `Example/`。

## 项目模板

共包含 **10个核心项目**，覆盖运维各细分领域：

| 项目   | 领域                      | 演进等级   |
| ------ | ------------------------- | ---------- |
| 项目一 | 监控告警智能化平台建设    | 1级 → 3级 |
| 项目二 | 自动化运维平台建设        | 1级 → 3级 |
| 项目三 | CI/CD流水线与发布策略建设 | 1级 → 3级 |
| 项目四 | 事件管理体系建设          | 1级 → 3级 |
| 项目五 | 变更管理规范化建设        | 1级 → 3级 |
| 项目六 | 容量管理与成本优化        | 1级 → 3级 |
| 项目七 | 高可用架构与灾备体系建设  | 1级 → 3级 |
| 项目八 | 运维度量体系建设          | 1级 → 3级 |
| 项目九 | CMDB与配置管理中心建设    | 2级 → 3级 |
| 项目十 | 日志分析与故障定位平台    | 1级 → 3级 |

详细内容请查看 [Example.md](Example.md)

## 能力模型

`Project-Skills/` 目录包含 44 个能力等级文件，每个文件定义了该能力从 1-5 级的详细标准。

### 能力模型文件汇总

| 能力模型            | 涉及项目               |
| ------------------- | ---------------------- |
| 监控可视化及通知.md | 项目一                 |
| 异常识别.md         | 项目一                 |
| 监控数据处理.md     | 项目一、项目十         |
| 运维场景能力.md     | 项目二                 |
| 部署流水线.md       | 项目三                 |
| 事件管理.md         | 项目四                 |
| 变更管理.md         | 项目三、项目五、项目九 |
| 容量管理.md         | 项目六                 |
| 可用性管理.md       | 项目七                 |
| 度量指标.md         | 项目八                 |

## 使用指南

### 方式一：使用 AI Skill（推荐）

如果你使用支持 Skill 的 AI 助手，直接在对话中描述你的需求：

```
我是一名5年经验的运维工程师，熟悉 Kubernetes、Prometheus、Jenkins，
想生成 CI/CD 相关的简历项目，并进行模拟面试练习。
```

AI 助手会自动：

1. 采集你的详细技能信息
2. 推荐适合的项目模板
3. 生成个性化简历（技术视角 + 业务痛点视角）
4. 进行模拟面试演练

### 方式二：手动参考

1. 查看 [Example.md](Example.md) 选择 2-4 个项目
2. 阅读对应的 `Project-Skills/` 能力模型文件
3. 参考 `Example/` 目录中的示例输出
4. 使用 `resume-prompt.md` 或 `interview-prompt.md` 配合 AI 工具生成

## 输出规范

### 简历要求

- 严格遵循 **STAR 法则**（Situation, Task, Action, Result）
- 使用 **PDCA 循环** + Mermaid 流程图
- 包含**量化成果指标**
- **禁止包含代码片段**

### 面试题库

- 技术深度与软技能各占 **50%**
- 每个维度**三层递进提问**
- 参考回答可使用 Mermaid 流程图辅助说明

## 项目方向推荐

| 运维方向 | 推荐项目               |
| -------- | ---------------------- |
| 监控运维 | 项目一、项目十         |
| 发布运维 | 项目三、项目五         |
| 平台运维 | 项目二、项目九         |
| SRE方向  | 项目四、项目七、项目八 |
| 成本运维 | 项目六                 |

## License

MIT
