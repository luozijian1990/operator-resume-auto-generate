---
schema_version: v1
interview_id: 2026-05-08-bytedance-sre-p6
source: mock
date: 2026-05-08
jd_slug: bytedance-sre-p6
jd_company: 字节跳动
jd_role: SRE
jd_level: P6
jd_source: 用户口述（短视频业务方向 SRE，要求 K8s/Prometheus/Go，加分项混沌工程）
candidate_level: 高级
resume_refs:
  - Example/示例-简历_张三-技术视角.md
  - Example/示例-简历_张三-业务痛点视角.md
dimensions:
  - K8s 排障
  - Prometheus
  - 系统设计
  - 表达能力
match_score: 82
match_breakdown:
  hard_skill_hit:  {score: 19, weight: 25, note: "命中 K8s/Prometheus，Go 实战缺失（简历自评初学）"}
  yoe_level_fit:   {score: 13, weight: 15, note: "5 年 SRE，对齐 P6 要求"}
  scale_fit:       {score: 11, weight: 15, note: "金融科技 150w 笔/天 → 短视频量级，规模有差距但相近"}
  business_fit:    {score: 10, weight: 15, note: "金融 → 短视频，业务场景跨度大，部分迁移成本"}
  bonus_hit:       {score: 11, weight: 15, note: "加分项混沌工程未涉及；OpenTelemetry/Loki 等加分项命中"}
  critical_gap:    {score: 18, weight: 15, note: "强必须项 K8s/Prometheus 简历经验充分；Go 简历明确说初学，不算空白"}
match_recommendation: 推荐
started_at: 2026-05-08T20:00:00+08:00
ended_at: 2026-05-08T21:10:00+08:00
status: completed
question_count: 8
---

# 字节跳动 SRE 模拟面试

## Q1 · K8s 排障 · Pod CrashLoopBackOff 排查链路

**L1 · 基础认知**
- 提问：线上一个 Java 微服务 Pod 反复 CrashLoopBackOff，已经重启 7 次。你按什么顺序排查？为什么是这个顺序？
- 回答要点：先 kubectl logs 看应用日志找异常堆栈，再 describe pod 看一下状态，没头绪就进容器看进程
- 卡壳原话：> "呃……我一般先 logs 看异常堆栈，events 那个……说实话不太常看"

**L2 · 深入细节**
- 追问：events 在排查里能告诉你什么 logs 看不到的信息？为什么应该排在 logs 之前看？
- 回答要点：events 能看到调度阶段错误、镜像拉取失败、挂卷失败这些；想了下确实应该放前面，logs 只能看应用启动后的输出
- 卡壳原话：> "events 这个我一般不看，今天想了下确实关键"

**L3 · 边界场景**
- 追问：如果 Pod 在调度或拉镜像阶段就挂了，logs 根本没产生，你怎么诊断？另外 `kubectl logs --previous` 跟普通 logs 的区别是什么？
- 回答要点：那只能看 events 和 describe；`--previous` 第一次听说，应该是看上一次崩溃容器的日志？
- 卡壳原话：> "Pod 还没启动 logs 是空的这个我没想过，--previous 也不太熟"

**本题评分**：2/5（L1 工具对但顺序错；L2 提示后能补；L3 直接断，--previous 这种排查 CrashLoopBackOff 的常用 flag 不熟）

## Q2 · K8s 排障 · 节点 NotReady 故障处置

**L1 · 基础认知**
- 提问：监控告警一个 Worker 节点变 NotReady，影响其上 30 个 Pod。你怎么处理？先恢复还是先排查？
- 回答要点：先 cordon 防止新 Pod 调度过来；同时看 kubelet 状态和节点资源；短时间恢复无望就 drain 把 Pod 迁走

**L2 · 深入细节**
- 追问：drain 时遇到 PodDisruptionBudget 阻塞怎么办？eviction API 失败的话有哪些应对？
- 回答要点：PDB 限制下 drain 会卡住，要么协调业务方临时放宽 PDB，要么手动 `kubectl delete pod --force`（有数据丢失风险）；eviction 失败一般也是 PDB 触发
- 卡壳原话：> "force delete 我们之前线上没干过，理论上知道但担心副作用"

**本题评分**：3/5（L1 流程对，L2 知道 PDB 但实战经验不足，没追问 L3）

## Q3 · Prometheus · rate / irate / increase 函数选型

**L1 · 基础认知**
- 提问：rate / irate / increase 三个函数都是统计 Counter 在时间区间内的增长，区别是什么？什么场景该用哪个？
- 回答要点：rate 是区间内平均增长率（最常用、趋势平滑，适合告警和大盘）；irate 用最后两个点算瞬时（突发场景敏感，但容易抖），适合短期 debug；increase 是区间绝对增量（不除以时间），用于"5 分钟新增多少错误"这种语义

**L2 · 深入细节**
- 追问：rate 函数对 Counter 重置（如服务重启）是怎么处理的？为什么不会算出负数？
- 回答要点：Prometheus 检测到 Counter 下跌就认为是重置，把重置前后两段当作连续增长处理；具体实现是 extrapolated 估算

**本题评分**：4/5（L1 答得很扎实分清场景，L2 重置处理也答到点，没必要钻 L3）

## Q4 · Prometheus · 高基数 label 治理

**L1 · 基础认知**
- 提问：业务方想给一个 API 指标打 user_id 维度的 label，你怎么回应？
- 回答要点：拒绝。user_id 是高基数 label（百万级），会让时序数量爆炸，存储和查询都崩；应该用日志或 Trace 跟踪个体行为，监控只看聚合维度（如按用户类型/会员等级分桶）

**L2 · 深入细节**
- 追问：如果业务方坚持要看个体级别，有没有折衷方案？
- 回答要点：可以用 exemplar 把高基数信息挂到 Trace 上（Prometheus 2.26+ 支持）；或者业务侧自己做采样，只对部分用户打 label

**本题评分**：4/5（L1 拒绝得有理有据，L2 给出折衷方案，知识面广）

## Q5 · 系统设计 · 短视频上传服务监控埋点

**L1 · 基础认知**
- 提问：让你给短视频上传服务设计一套监控埋点方案，QPS 5 万级，你会埋哪些指标？怎么分层？
- 回答要点：按 RED 方法分三层——Rate（上传请求 QPS）、Errors（失败率按错误码细分）、Duration（P50/P95/P99）；业务层加上传成功转化率、文件大小分布；基础设施层加 CPU/内存/磁盘 IO

**L2 · 深入细节**
- 追问：P99 < 2s 这种 SLO 你怎么订？不是 1s 也不是 3s，依据是什么？
- 回答要点：呃……我们之前一般是看历史数据 P99 大概在哪，再往上松一档；具体方法论说不太上来
- 卡壳原话：> "呃……P99 那个我一般用 histogram，但是 SLO 怎么定我得想想"

**L3 · 边界场景**
- 追问：如果业务方说"P99 < 2s 太松了，我要 P99 < 500ms"，你怎么沟通？
- 回答要点：先看历史数据现实可达性，再算成本（追求 P99 500ms 可能要加缓存/CDN/带宽），让业务方看 trade-off
- 卡壳原话：> "成本怎么量化我能拍个数，但严谨的算法没用过"

**本题评分**：3/5（L1 埋点框架对，L2 SLO 方法论空白，L3 沟通思路有但缺工具）

## Q6 · 系统设计 · 跨地域 Prometheus 指标聚合

**L1 · 基础认知**
- 提问：你们有 3 个地域的集群都跑了 Prometheus，怎么把指标聚合到一个总控大盘？方案对比一下。
- 回答要点：方案 1 Federation——配置简单但实时性差，慢查询会拖垮主 Prom；方案 2 remote_write 到 VictoriaMetrics/Thanos——主流方案，水平扩展，我们公司就是这个；方案 3 直接联邦查询——只适合小规模

**L2 · 深入细节**
- 追问：你们用 VictoriaMetrics 写入 1.5TB/天是怎么扛住的？分片/副本怎么配置？查询合并怎么做？
- 回答要点：用了 vmcluster 模式，vminsert 3 实例做写入分片（按 hash），vmstorage 6 实例 + 副本因子 2，vmselect 做查询合并；具体调参我能看着配置回忆
- 卡壳原话：> "Thanos 我只读过文档，没实际部过；federation 跟 remote_write 在 push/pull、断网行为这些细节差异说不太清"

**本题评分**：3/5（L1 三方案对比正确，L2 VM 落地能讲但 Thanos 是空白，没钻 L3）

## Q7 · K8s 排障 · ImagePullBackOff 系统化排查

**L1 · 基础认知**
- 提问：一个新部署的 Pod 一直 ImagePullBackOff，你的排查清单是什么？
- 回答要点：describe 看具体错误（401 无权限 / not found 镜像不存在 / 网络问题）；docker pull 手工验证；imagePullSecrets 是否配；私有仓库证书是否过期；网络层是否能访问 registry

**L2 · 深入细节**
- 追问：如果是私有镜像仓库的证书自动续期失败导致全集群 ImagePullBackOff，你怎么发现？怎么从机制上避免？
- 回答要点：发现一般靠告警，证书剩余天数监控 + ImagePullBackOff 总数监控；机制上是证书自动续期工具（cert-manager 或类似）+ 续期失败告警 + 每月手动 review
- 卡壳原话：> "证书续期告警的具体阈值我们没定过，一般是 30 天前提醒一下"

**本题评分**：3/5（L1 清单完整，L2 防御机制有概念但实操细节不到位）

## Q8 · 表达能力 · 项目总结

**L1 · 基础认知**
- 提问：用 **3 分钟**讲一下你最得意的项目。注意时间。
- 回答要点：讲了持续交付平台项目——Situation 部署慢业务投诉、Task 30 分钟内单次发布、Action 三层重建（容器化/流水线/渐进发布）、Result 部署频率 50x；中途有 1 次回头补充背景，整体超时讲了 4 分 30 秒
- 卡壳原话：> "呃，我可能讲得有点细，先讲 Situation 还是先讲 Result 比较好？"

**本题评分**：3/5（结构 STAR 完整但严重超时；表达起手填充词偏多；本题不适合钻孔，单层定分）
