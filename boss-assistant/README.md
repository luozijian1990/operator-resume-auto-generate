<div align="center">

<img src="./icons/icon-128.png" alt="Boss 岗位助手图标" width="96">

# Boss 岗位助手

在浏览 Boss 直聘时记录岗位 JD，并结合 AI 与个人求职画像完成市场分析、投递排序和单岗位深度判断。

Chrome MV3 · Side Panel · Vanilla JavaScript

[快速开始](#快速开始) · [内置-skill](#内置-skill) · [导出会话](#导出会话) · [数据与隐私](#数据与隐私) · [开发与验证](#开发与验证)

</div>

## 功能概览

- 监听 Boss 直聘岗位详情请求，按当前标签页记录浏览过的岗位。
- 使用本地 JavaScript 和统一 Skill Registry 对岗位做可解释的预筛选，高匹配岗位默认勾选，其他岗位仍完整保留。
- 在 Side Panel 中查看匹配状态和分数，并搜索、勾选、全选或删除岗位。
- 支持 OpenAI Responses API 与 Anthropic Messages API 流式对话。
- 请求正文返回前显示“正在思考…”，收到首个正文 token 后切换为流式回答。
- 通过 `/` 斜杠菜单调用内置 Skill，并在请求 AI 前校验岗位数量和求职画像。
- 维护一份全局 Candidate Profile，避免每次分析都重复描述经历、技能和求职偏好。
- 对选中岗位生成 canonical Structured Skill Demand，并据此规划技能 Gap、学习优先级和真实项目 Evidence。
- 将当前 Side Panel 会话中的全部有效问答导出为 Markdown。
- 将当前标签页全部已记录的 JD 导出为 JSON，保留完整岗位描述。
- 所有运行时配置和记录均保存在 `chrome.storage.local`，不会写入源码。

> [!NOTE]
> 本项目只分析已记录的 JD，不会自动投递、联系招聘者、搜索公司资料或修改简历。

## 快速开始

### 前置条件

- 支持 Manifest V3 和 Side Panel 的 Chrome/Chromium 浏览器。
- 可用的 OpenAI 或 Anthropic API Key，或兼容相应接口的服务地址。
- 已登录 Boss 直聘网页端。

### 安装扩展

1. 打开 `chrome://extensions/`。
2. 开启右上角的「开发者模式」。
3. 点击「加载已解压的扩展程序」。
4. 选择本项目的 `boss-assistant` 目录。
5. 打开 Boss 直聘页面，点击扩展图标进入 Side Panel。

修改代码或 `manifest.json` 后，需要在扩展管理页点击「重新加载」。

### 配置 AI

1. 点击 Side Panel 右上角的设置按钮。
2. 在「AI 设置」中选择 Provider。
3. 填写 Base URL、Model 和 API Key。
4. 分别保存配置和 Key，然后点击「测试连接」。

默认配置如下，所有字段都可以修改：

| Provider | Base URL | 默认模型 | 接口 |
|---|---|---|---|
| OpenAI | `https://api.openai.com` | `gpt-4.1` | Responses API |
| Anthropic | `https://api.anthropic.com` | `claude-sonnet-4-6` | Messages API |

> [!TIP]
> 模型是否可用取决于你的 Provider 和账号权限。兼容服务还需要正确支持对应接口、鉴权方式与流式事件格式。

### 记录并分析岗位

1. 在 Boss 直聘标签页中打开 Side Panel。
2. 开启顶部的「记录」开关。
3. 正常浏览岗位详情，捕获到的岗位会自动出现在列表中。
4. 勾选要分析的岗位。
5. 在输入框输入 `/`，选择 Skill 并补充你的问题。
6. 点击「发送」，或按 `Enter` 开始分析；`Shift + Enter` 可换行。
7. 完成分析后，可点击聊天区顶部的「导出 Markdown」保存当前会话。

岗位列表属于当前 Boss 标签页。关闭该标签页后，对应岗位记录和录制状态会被清理。

## 求职画像

在「设置 → 求职画像」中填写并保存 Candidate Profile。画像包括：

- 当前岗位、工作年限、学历和主要工作经历；
- 核心技能、熟悉技能、基础技能和代表项目；
- 目标岗位、相邻方向、薪资与城市偏好；
- 异地、驻场、外包、倒班或长期 On-call 接受度；
- 希望加强的能力和明确不想从事的工作。

Skill 只会读取自己在 metadata 中声明的画像字段。画像不足时，前端会先提示完善，不会把一长串补充问题发送给模型。

本地岗位匹配要求「当前岗位、工作年限、主要工作经历、核心技能、期望方向」至少填写 3 项。信息不足时岗位只显示「待完善画像」，不会生成分数、匹配等级或自动选择结果。

## 内置 Skill

| Skill | 命令 | 岗位要求 | 是否使用求职画像 | 用途 |
|---|---|---:|:---:|---|
| 分析招聘市场 | `/analyze-job-market` | 至少 1 个 | 否 | 基于选中样本生成招聘需求样本画像，不受个人背景影响 |
| 投递决策 | `/application-ranker` | 至少 2 个 | 是 | 分离 Hard Gate 与评分，对多个岗位给出投递优先级 |
| 岗位深度分析 | `/job-deep-dive` | 恰好 1 个 | 是 | 分析真实匹配点、能力差距、风险和投入价值 |
| 学习路线 | `/learning-roadmap` | 至少 5 个 | 是 | 基于目标岗位技能需求、画像和 Registry 生成 Gap 与 Evidence 路线 |

斜杠菜单也支持中文名称。岗位数量和画像要求会在调用 AI 之前校验，失败时不会消耗 API Token。

### 分析招聘市场

分析岗位样本本身，不注入 Candidate Profile。为了获得完整报告，提问中还应提供目标岗位、地区和薪资范围；有效核心样本不足 10 个时，Skill 会提示补充样本或降低结论强度。

### 投递决策

结合职业方向、技能深度、工作经历、项目证据、薪资、地点和工作方式约束进行排序。明确的外包、驻场、地点或最低薪资冲突会作为 Hard Gate，不会简单折算成分数。

### 岗位深度分析

只分析一个岗位，重点回答岗位真实定位、Direct/Transferable/Adjacent/Gap、Hard Gate、JD 风险，以及是否值得投入时间准备和投递。

画像类 Skill 都要求模型只使用画像中已有的证据；缺失信息应标记为「未知」「需要确认」或「暂无直接证据」。

### 本地岗位匹配

Local Matcher 完全在扩展内运行，不调用 AI。只有求职画像达到最低信息量后，它才会处理明确的外包、长期驻场、倒班、城市和最低薪资冲突，再按职业方向 30、技能 35、经验 15、薪资 10、偏好 10 计算预筛分数：70 分以上默认勾选，50–69 分作为候选，其余为低匹配。Hard Stop 与分数独立，任何状态的岗位都不会被自动删除，用户可以随时手动改选。

画像为空或严重不足时不使用“中性分”凑出总分：Match Result 为 `profile_missing`，`score` 与各维度均为 `null`，岗位不自动勾选。保存足够画像后会重新评分；清空画像会清除界面上的旧分数。

本地分数只用于过滤、默认选择和解释，不会发送给投递决策或岗位深度分析，避免锚定 AI 的独立判断。

### 学习路线

学习路线至少需要 5 个用户筛选后的相关岗位。前端使用 `data/skill-registry.json` 统一 K8s/Kubernetes 等别名，并按岗位去重生成技能 `count` 和 `ratio`。模型只收到本次涉及的 Registry 元数据；画像没有明确 Level 时保持 `unknown`。路线分为必须补齐、职业增长和暂缓学习，并以可验证的项目或工作 Evidence 为终点。

仓库当前 Roadmap 数据提供阅读顺序，但没有可靠的技术依赖数据，因此学习路线 V1 的阶段顺序表示求职优先级，不代表严格技术依赖。

## 导出 JD

点击岗位列表工具栏的「导出 JD JSON」，即可下载当前标签页全部已记录岗位，无需配置 AI。没有记录时按钮不可用；搜索条件和勾选状态不影响导出范围。

文件名为 `boss-jds-<导出时间>.json`，内容是 JSON 数组，每个元素包含采集到的岗位字段，包括 `job_hash`、岗位名称、薪资、城市、经验、学历、公司信息、技能、福利、完整 `description`、首次采集时间 `captured_at` 和最近浏览时间 `last_viewed_at`。按最近浏览时间倒序排列，不包含本地 `match` 评分、求职画像或 API Key。

请在关闭 Boss 标签页或清空记录前导出；已经删除的记录不会包含在文件中。

## 导出会话

「导出 Markdown」会保存当前 Side Panel 生命周期内的全部有效问答。导出记录独立于发送给模型的聊天上下文，因此不会受到 AI 上下文只保留最近 20 条消息的限制。

每轮导出内容包括：

- 使用的 Skill、时间、Provider 和 Model；
- 发送请求时所选岗位的名称、公司、薪资和城市；
- 用户问题与 AI 返回的 Markdown 正文。

默认文件名使用本次会话第一次成功使用的 Skill，并允许在下载前修改。导出内容不包含完整 JD、Candidate Profile、System Prompt、前端校验提示或模型思考内容。

> [!NOTE]
> AI 生成期间导出按钮不可用。若用户主动停止已经开始输出的回答，已生成部分可以导出，并会标记“本次生成被用户中止”；请求失败不会进入正式导出记录。

## 数据与隐私

| Storage key | 内容 | 生命周期 |
|---|---|---|
| `jobs:{tabId}` | 当前标签页捕获的岗位记录及本地 `match` 结果 | 标签页关闭时删除 |
| `recording:{tabId}` | 当前标签页录制状态 | 标签页关闭时删除 |
| `candidateProfile` | 全局求职画像 | 手动清空前持续保存 |
| `settings` | Provider、Base URL、Model、API Key | 手动修改或清除前持续保存 |

> [!IMPORTANT]
> API Key、求职画像和岗位记录保存在当前浏览器配置的 `chrome.storage.local` 中。发起分析时，选中的 JD、用户消息以及该 Skill 声明的画像字段会直接发送到你配置的 AI Provider。请只使用你信任的 Base URL，并遵循相应服务的数据处理政策。

扩展的 content script 只注入 `https://www.zhipin.com/*`。`<all_urls>` host permission 用于让 Side Panel 向用户配置的 AI Base URL 发起请求；AI 请求不经过项目自建服务器。

## 工作原理

```text
Boss detail.json
       │
       ▼
content.js ── saveJob ──► background.js ──► chrome.storage.local
                                                   │
                                                   ▼
                                      Registry + Local Matcher
                                                   │
                                      默认选择 + Skill Demand
                                                   ▼
                           Candidate Profile ──► AI Skills
```

| 文件 | 职责 |
|---|---|
| `content.js` | 观察岗位详情资源请求、重新读取 JSON 并清洗岗位字段 |
| `background.js` | 根据标签页录制状态保存、更新和清理岗位数据 |
| `sidepanel.js` | 列表、设置、画像、Skill 校验、上下文组装、流式聊天和会话导出 |
| `skillRegistry.js` | 加载并校验扩展内的 canonical Skill Registry 快照 |
| `localMatcher.js` | Skill 提取、Hard Stop、五维评分和 Structured Skill Demand |
| `data/skill-registry.json` | 扩展运行时使用的统一 Skill identity、alias、目标等级和 Level 定义 |
| `skills.js` | 注册 Skill metadata 与 system prompt |
| `aiProvider.js` | 适配 OpenAI Responses 和 Anthropic Messages 流式接口 |
| `sidepanel.html` / `sidepanel.css` | Side Panel 结构和样式 |

项目使用 Vanilla JavaScript，不需要安装 npm 依赖或执行构建步骤。Markdown 渲染器已包含在 `lib/marked.min.js` 中。

## 扩展 Skill

在 `skills.js` 的 `window.SKILLS` 中新增定义即可复用斜杠菜单、岗位数量校验和画像注入：

```js
{
  id: 'my-skill',
  name: '我的 Skill',
  description: '一句话说明用途',
  minJobs: 1,
  maxJobs: null,
  profileFields: [],
  systemPrompt: `...`,
}
```

- `maxJobs: null` 表示不限制上限。
- `profileFields: []` 表示不读取 Candidate Profile。
- 可通过 `emptyMessage`、`minJobsMessage`、`maxJobsMessage` 自定义前端提示。
- 不要在 `sidepanel.js` 中按 Skill ID 添加分支；行为应优先由 metadata 描述。

## 开发与验证

检查所有 JavaScript 文件：

```bash
for file in skills.js skillRegistry.js localMatcher.js sidepanel.js aiProvider.js background.js content.js; do
  node --check "$file"
done
```

运行 Skill 数量校验、思考状态和会话导出回归测试：

```bash
node tests/local-matcher.test.js
node tests/ai-provider-streaming.test.js
node tests/sidepanel-skill-validation.test.js
```

校验 manifest：

```bash
node -e "JSON.parse(require('fs').readFileSync('manifest.json', 'utf8'))"
```

## 常见问题

### 浏览岗位后列表仍为空

- 确认 Side Panel 是从 Boss 直聘标签页打开的。
- 确认顶部录制开关显示「记录中」。
- 进入具体岗位详情，而不是只停留在列表页。
- 重新加载扩展后刷新 Boss 页面，再重新开启记录。

### AI 连接测试失败

- 检查 Provider、Base URL、Model 和 API Key 是否匹配。
- 确认 Base URL 不包含重复的 `/v1/responses` 或 `/v1/messages` 路径；扩展会自行补充接口路径。
- 如果使用兼容服务，确认其支持浏览器扩展请求以及相应的 SSE 流式事件格式。

### AI 回答突然结束或显示不完整

- 0.4.1 起支持 LF/CRLF SSE 分隔、跨网络分块和 EOF 剩余事件，不再静默丢失最后一段正文。
- Provider 明确返回输出上限、incomplete、failed，或连接缺少 completed/`[DONE]` 就提前结束时，已收到正文会保留，并在末尾显示明确错误，而不是伪装成完整回答。
- Anthropic 单次输出预算为 8192 tokens；达到上限时可缩小选中岗位范围，或基于当前部分结果继续提问。

### Skill 没有开始分析

- 确认岗位选择数量符合 Skill 要求。
- 「投递决策」和「岗位深度分析」还需要先完善求职画像。
- 保留输入框开头的斜杠命令；删除命令会回到普通岗位问答模式。

### 岗位显示“待完善画像”而没有分数

这是预期行为。请在「设置 → 求职画像」中，至少填写当前岗位、工作年限、主要工作经历、核心技能、期望方向中的 3 项并保存。画像不足时，插件不会用默认中性值生成看似精确的匹配分数。

## 当前边界

- 岗位采集依赖 Boss 直聘当前的 `detail.json` 数据结构，网站接口变化可能导致字段缺失或采集失效。
- 岗位记录按标签页隔离，不提供跨标签页的全局岗位库。
- 聊天历史与导出记录只保留在当前 Side Panel 运行内存中，不会持久化；关闭或重新加载面板后无法再导出之前的会话。
- AI 输出用于辅助判断，不代表招聘方结论，也不应替代用户自己的事实核验和决策。
