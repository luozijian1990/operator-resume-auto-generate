# 简历-JD 匹配度评分契约

本文件是 `mock-interview` 与 `resume-optimizer` 共用的 6 维匹配度评分来源。任何 skill 需要计算简历和 JD 的匹配度时，都引用本文件，不复制另一套规则。

## 输入

- 简历正文或简历文件路径
- 完整 JD 文本
- 可选：目标岗位公司、岗位、级别

只给"公司名 + 岗位 / 级别"不算完整 JD。无法读取链接正文时，要求用户粘贴 JD。

## 输出结构

```yaml
match_score: 82
match_breakdown:
  hard_skill_hit:  {score: 22, weight: 25, note: "..."}
  yoe_level_fit:   {score: 13, weight: 15, note: "..."}
  scale_fit:       {score: 12, weight: 15, note: "..."}
  business_fit:    {score: 12, weight: 15, note: "..."}
  bonus_hit:       {score: 11, weight: 15, note: "..."}
  critical_gap:    {score: 12, weight: 15, note: "..."}
match_recommendation: 推荐
```

`match_score` 等于 6 个 `score` 之和。每个 `score` 必须在 `[0, weight]` 范围内，每个 `note` 必须写清判定依据。

## 评分维度

| 维度 | 权重 | 判定方式 |
|---|---:|---|
| `hard_skill_hit` | 25 | JD 必备技术栈命中率。命中 >=80% 接近满分；只出现"了解/学习中"不算完整命中 |
| `yoe_level_fit` | 15 | JD 年限/级别 vs 简历年限、主导范围、跨团队影响力 |
| `scale_fit` | 15 | JD 业务体量、系统规模、复杂度 vs 简历中的节点数、QPS、服务数、团队规模、可用性要求 |
| `business_fit` | 15 | JD 业务场景 vs 简历背景。金融、交易、内容、广告、ToB 平台等迁移难度不同 |
| `bonus_hit` | 15 | JD 加分项命中比例。加分项不是必备项，不能和 `critical_gap` 重复扣分 |
| `critical_gap` | 15 | JD 强必须项是否完全空白。每个强必须空白都应扣分，并在 note 中列出 |

## 阈值

- `match_score >= 75`：`match_recommendation = "推荐"`
- `60 <= match_score < 75`：`match_recommendation = "可面试-需补强"`
- `match_score < 60`：`match_recommendation = "不建议-偏差过大"`

## 信息不足

JD 或简历缺少某维度证据时，不要猜测：

- 该维度默认取 `weight * 0.5`
- `note` 写明"信息不足"以及缺少什么证据
- 如果缺少的是 JD 强必须项证据，优先体现在 `critical_gap`

## 伦理边界

- 不能把零经验包装成生产实战。
- 可以把真实相邻经验迁移表达为"相关经验"，但必须说明边界。
- 可以建议补强路径，但不能把计划写成已完成成果。
- 不编造量化指标；只能使用用户提供数据，或列出需要用户补充的数据口径。
