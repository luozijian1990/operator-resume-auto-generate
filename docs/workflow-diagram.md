# 求职工作流图维护

[job-search-workflow.workflow.json](job-search-workflow.workflow.json) 是 Archify workflow v2 源文件。README 使用 `job-search-workflow-light.svg` 和 `job-search-workflow-dark.svg`；`job-search-workflow.svg` 保留自适应主题版本。三者具有相同节点与关系，只在主题固定方式上不同。

## 语义边界

- 简历生成、优化可独立使用；去模板化和项目自查均可跳过，图中串联表示一种使用顺序，不表示强制准入。
- 项目自查对应 `resume-project-questions`，包含出题、用户填写、回答评估，不结合 JD。
- 模拟面试对应 `mock-interview`，需要简历和完整 JD；由用户选择进入，自查分数不能替代 JD 匹配分。
- 单题回答辅导对应 `interview-answer-coach`，跨场聚合对应 `interview-summary`。二者分别读取原始面试记录，没有辅导报告到聚合复盘的输入关系。
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
5. 检查三份 SVG 可独立渲染，浅色和深色主题下节点、文字、箭头清楚；确认 README 的两条图片地址对应正确文件。

交互 HTML 和浏览器截图用于校验，可保留在临时目录。仓库维护 JSON 与三份 SVG。README 的图片地址指向 GitHub `main`，本地改动需发布到该分支后才会反映在远端页面。
