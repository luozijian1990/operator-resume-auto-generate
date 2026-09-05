# Coaching 数据契约

`coaching/` 保存单题表达训练结果，与 `interviews/` 原始记录分离。文件可重做，不回写或覆盖已冻结的面试记录。

## 命名

- 即时输入：`{YYYY-MM-DD}-{topic-slug}.md`
- 面试 replay：`{YYYY-MM-DD}-{interview_id}-q{n}.md`

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
