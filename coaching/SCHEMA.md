# Coaching 数据契约

`coaching/` 保存单题表达训练结果，与 `interviews/` 原始记录分离。文件可重做，不回写或覆盖已冻结的面试记录。

## 命名

- 即时输入：`{YYYY-MM-DD}-{topic-slug}.md`
- 面试 replay：`{YYYY-MM-DD}-{interview_id}-q{n}.md`

项目自查沿用即时输入命名，可在 topic-slug 中包含项目、视角和题序。文件重名时追加 `-v2`、`-v3`，不覆盖旧结果。

## Front matter

```yaml
schema_version: v1
source: ad-hoc # ad-hoc / mock / real
source_interview: null
source_question: null
gap_types: []
generated_at: 2026-09-05T00:00:00+08:00
```

`source_interview` 和 `source_question` 仅在有记录来源时填写；不能猜测。`gap_types` 只能使用 `knowledge-gap`、`lack-hands-on`、`lack-edge-thinking`、`expression-gap`、`compressed-reasoning`。正文使用 answer-coach 的输出模板，并保留原始回答或明确标注为摘要。

项目自查使用 `source: ad-hoc`，上述两个来源字段均为 `null`；在“原问题”中记录原题单路径、项目名、视角、该视角第 N 题，以及可用的评估报告、原简历路径。题单序号不能填成面试 Q 编号。辅导报告不作为用户补答、模拟面试记录或跨场聚合输入。
