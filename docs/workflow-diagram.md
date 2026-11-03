# 求职工作流图维护

[job-search-workflow.workflow.json](job-search-workflow.workflow.json) 是 Archify workflow v2 源文件。README 使用 `job-search-workflow-light.svg` 和 `job-search-workflow-dark.svg`；`job-search-workflow.svg` 保留自适应主题版本。三者具有相同节点与关系，只在主题固定方式上不同。

## 语义边界

- 简历分析对应 `resume-analyzer`，独立读取已有简历，无需 JD。输出有原文依据的优点、不足和补充方向后可以结束，不自动改写。报告到简历生成/优化节点的虚线仅表示用户选择使用其中的优化能力；生成仍可独立开始。
- 分析到报告不加标签：两端已表达输入处理与产出关系。独立报告是完整交付物，并非强制进入优化的等待点。

- 简历生成、优化可独立使用；去模板化和项目自查均可跳过，图中串联表示一种使用顺序，不表示强制准入。
- 项目自查对应 `resume-project-questions`，包含出题、用户填写、回答评估，不结合 JD；评估后可按核心问题和具体缺口选题进入 `interview-answer-coach`，属于可选诊断与训练分支。辅导读取原题单完整回答，评估报告只辅助定位。
- 自查辅导后，用户重新作答再回到项目自查生成新版评估；不把辅导建议当成用户补答，不自动提分。图中返回边表示这一步。
- 模拟面试对应 `mock-interview`，需要简历和完整 JD；由用户选择进入，自查分数不能替代 JD 匹配分。
- 单题回答辅导对应 `interview-answer-coach`，跨场聚合对应 `interview-summary`。面试后的辅导与聚合分别读取原始面试记录，没有辅导报告到聚合复盘的输入关系。口语去模板化是辅导内置检查，不单设 skill 节点。
- 跨场聚合至少需要两场；补课或表达训练后，可再次面试并积累新记录。
- 简历生成/优化到去模板化、去模板化到项目自查、聚合复盘到补课、补课到再次面试的箭头不另加标签：两端已经表达顺序，其他有特定含义的关系保留标签。

## 生成与导出

1. 按项目实际 skill 更新 JSON，使用安装的 Archify 执行校验：

   ```sh
   node /path/to/archify/bin/archify.mjs validate workflow docs/job-search-workflow.workflow.json --quality showcase --json
   ```

2. 校验通过后生成临时交互页面，并检查浏览器展示：

   ```sh
   node /path/to/archify/bin/archify.mjs deliver workflow docs/job-search-workflow.workflow.json /tmp/job-search-workflow.html --quality showcase --json
   node /path/to/archify/bin/archify.mjs visual-check /tmp/job-search-workflow.html --json
   ```

3. 打开生成的 HTML，通过“导出 → SVG”保存为 `docs/job-search-workflow.svg`。使用官方导出功能保留独立 SVG 所需的样式、背景和箭头；不要只复制页面内的裸 `<svg>`。
4. 从这份 SVG 复制两个主题版本，仅在根 `<svg>` 添加 `data-theme="light"` 或 `data-theme="dark"`，分别保存为 `job-search-workflow-light.svg` 和 `job-search-workflow-dark.svg`。导出样式已支持显式主题覆盖，不修改几何和文字。
5. 检查三份 SVG 可独立渲染，浅色和深色主题下节点、文字、箭头清楚；尤其检查自查与辅导的往返线不穿过模拟面试节点，标签不遮挡节点或其他连线。确认 README 的两条图片地址对应正确文件。

关系变更始终从 JSON 重新生成、校验、导出，不在 SVG 末尾手工追加连线；否则会绕过自动布线，且绘制在节点上方造成遮挡。

交互 HTML 和浏览器截图用于校验，可保留在临时目录。仓库维护 JSON 与三份 SVG。README 的图片地址指向 GitHub `main`，本地改动需发布到该分支后才会反映在远端页面。

## 本次验证（2026-11-03）

新增独立分析入口及可结束的报告节点，保留既有自查、辅导、复评与多场面试关系。通过官方 SVG 导出生成三份主题文件，仅清理行尾空格并为固定主题设置根属性。

- diagram_type: workflow
- output: `/tmp/resume-analyzer-workflow.html`（临时交互预览）
- specification_sha256: `503b0f45e2fa8c35c8b1ffd05196e10c3351f6ff924987e956a87293083e4246`
- artifact_sha256: `a8315a90bbbdc315d6330a32fd4fda4c60322048c092fcf36ef700a94c850adf`
- validation: 9/9 showcase，0 errors，0 warnings
- browser_evidence: passed；1440×900、1600×1000、1920×1080、2048×1320，无页面溢出
- visual_review: passed；已检查浅色/深色截图及两份独立 SVG 的浏览器显示
- correction_rounds: 2

浏览器首次在沙箱内启动失败，随后在允许的本机浏览器环境重新执行成功；以上状态来自成功重跑的同一 HTML。源码哈希与 HTML 哈希用于确认本次产物，不代表未来重新生成的版本。README 远端图需推送后更新，本次未发布。
