const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const registry = require(path.join(root, 'data/skill-registry.json'));

function fakeElement() {
  return {
    value: '',
    checked: false,
    textContent: '',
    innerHTML: '',
    style: {},
    dataset: {},
    className: '',
    disabled: false,
    open: false,
    children: [],
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {},
    append(...nodes) { this.children.push(...nodes); },
    appendChild(node) { this.children.push(node); },
    focus() {},
    select() {},
    showModal() { this.open = true; },
    close() { this.open = false; },
    click() {},
    remove() {},
    querySelectorAll() { return []; },
  };
}

function createHarness({
  command,
  jobs,
  selectedHashes,
  responseText = '',
  streamOutcome = 'success',
  candidateProfileData,
}) {
  const elements = new Map();
  const getElement = (id) => {
    if (!elements.has(id)) elements.set(id, fakeElement());
    return elements.get(id);
  };
  getElement('chatInput').value = command;

  let aiCalls = 0;
  let thinkingSeen = false;
  let exportDisabledDuringStream = false;
  let lastRequest = null;
  const context = vm.createContext({
    console,
    AbortController,
    document: {
      getElementById: getElement,
      createElement: fakeElement,
      body: fakeElement(),
      querySelector() { return { value: 'openai', checked: true }; },
      querySelectorAll() { return []; },
    },
    chrome: {
      storage: {
        local: {
          async get() { return {}; },
          async set() {},
          async remove() {},
        },
        onChanged: { addListener() {} },
      },
      tabs: {
        query(_query, callback) { callback([]); },
        onActivated: { addListener() {} },
        onUpdated: { addListener() {} },
      },
    },
    window: {
      marked: null,
      SkillRegistry: { async load() { return registry; } },
      AIProvider: {
        async stream(request, onDelta) {
          aiCalls += 1;
          lastRequest = request;
          const bubbles = getElement('chatMessages').children;
          thinkingSeen = Boolean(bubbles.at(-1).innerHTML.includes('正在思考'));
          exportDisabledDuringStream = getElement('exportChat').disabled;
          if (responseText) onDelta(responseText);
          if (streamOutcome === 'abort') {
            const error = new Error('aborted');
            error.name = 'AbortError';
            throw error;
          }
          if (streamOutcome === 'error') throw new Error('provider failed');
        },
      },
    },
    marked: { parse: (text) => text },
  });

  vm.runInContext(fs.readFileSync(path.join(root, 'skills.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'localMatcher.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'sidepanel.js'), 'utf8'), context);
  vm.runInContext(`
    jobs = ${JSON.stringify(jobs)};
    selected = new Set(${JSON.stringify(selectedHashes)});
    settings = {
      provider: 'openai',
      apiKey: 'test-key',
      providers: { openai: { baseUrl: 'https://example.test', model: 'test-model' } }
    };
    candidateProfile = ${JSON.stringify(candidateProfileData || {
      current_role: 'SRE',
      years_experience: '5',
      work_experience: '生产环境运维',
      core_skills: 'Kubernetes',
      target_roles: 'SRE'
    })};
    skillRegistry = ${JSON.stringify(registry)};
  `, context);

  return {
    async send() {
      await vm.runInContext('sendChat()', context);
      return {
        aiCalls,
        thinkingSeen,
        exportDisabledDuringStream,
        exportEnabled: !getElement('exportChat').disabled,
        exportTurnCount: vm.runInContext('exportTurns.length', context),
        output: getElement('chatMessages').innerHTML,
        lastAssistantHtml: getElement('chatMessages').children.at(-1)
          ? getElement('chatMessages').children.at(-1).innerHTML : '',
        lastRequest,
      };
    },
    evaluate(code) {
      return vm.runInContext(code, context);
    },
    element(id) {
      return getElement(id);
    },
  };
}

function job(hash) {
  return { job_hash: hash, job_name: `岗位 ${hash}`, captured_at: hash };
}

async function main() {
  const twoJobs = { a: job('a'), b: job('b') };

  const jdExport = createHarness({ command: '', jobs: twoJobs, selectedHashes: ['a'] });
  jdExport.evaluate(`
    jobs.a.description = '完整 JD\\n包含 "引号" 与中文';
    jobs.a.skills = ['Kubernetes'];
    jobs.a.match = { score: 90, reason: '个人画像匹配' };
    jobs.a.last_viewed_at = 'z';
    searchText = '没有任何匹配结果';
    renderStats();
  `);
  const exportedJobs = JSON.parse(jdExport.evaluate('buildJobsExportJson()'));
  assert.equal(exportedJobs.length, 2, 'JD 导出不受搜索或勾选影响');
  assert.equal(exportedJobs[0].job_hash, 'a', '按最近浏览时间倒序导出');
  assert.equal(exportedJobs[0].description, '完整 JD\n包含 "引号" 与中文');
  assert.deepEqual(exportedJobs[0].skills, ['Kubernetes']);
  assert.equal('match' in exportedJobs[0], false, '不导出个人匹配结果');
  assert.equal(jdExport.evaluate('jobs.a.match.score'), 90, '导出不修改原始记录');
  assert.equal(jdExport.element('exportJobs').disabled, false);
  jdExport.evaluate('jobs = {}; renderStats(); downloadJobs();');
  assert.equal(jdExport.element('exportJobs').disabled, true);
  assert.deepEqual(JSON.parse(jdExport.evaluate('buildJobsExportJson()')), []);

  const deepDive = createHarness({
    command: '/job-deep-dive 请分析',
    jobs: twoJobs,
    selectedHashes: ['a', 'b'],
  });
  assert.equal((await deepDive.send()).aiCalls, 0, '岗位深度分析选择多个岗位时不得请求 AI');

  for (const command of ['/分析招聘市场 请分析', '/投递决策 请排序']) {
    const harness = createHarness({ command, jobs: twoJobs, selectedHashes: [] });
    assert.equal((await harness.send()).aiCalls, 0, `${command} 未选择岗位时不得请求 AI`);
  }

  const valid = createHarness({
    command: '/岗位深度分析 请分析',
    jobs: { a: job('a') },
    selectedHashes: ['a'],
    responseText: '# 分析结果',
  });
  const validResult = await valid.send();
  assert.equal(validResult.aiCalls, 1, '岗位深度分析选择一个岗位时应请求 AI');
  assert.equal(validResult.thinkingSeen, true, '请求等待首个正文 token 时应显示正在思考');
  assert.equal(validResult.exportDisabledDuringStream, true, 'AI 生成期间应禁用导出');
  assert.equal(validResult.exportEnabled, true, '完成有效问答后应允许导出');

  const marketHarness = createHarness({
    command: '/分析招聘市场 目标岗位 SRE，广州，20-30K',
    jobs: { a: { ...job('a'), skills: ['K8s'], description: 'Kubernetes 集群运维' } },
    selectedHashes: ['a'],
    responseText: '完成',
  });
  const marketResult = await marketHarness.send();
  const marketContent = marketResult.lastRequest.messages.at(-1).content;
  assert.match(marketContent, /Structured Skill Demand/);
  assert.match(marketContent, /"id": "kubernetes"/);
  assert.doesNotMatch(marketContent, /【求职画像】|当前岗位：SRE/, '市场分析不得注入 Candidate Profile');

  const autoSelectHarness = createHarness({
    command: '/岗位深度分析 请分析',
    jobs: {
      a: {
        ...job('a'),
        job_name: 'SRE 工程师',
        skills: ['Kubernetes'],
        description: '负责 Kubernetes 生产环境运维',
        experience: '3年',
      },
    },
    selectedHashes: [],
  });
  await autoSelectHarness.evaluate('refreshJobMatches({ resetSelection: true })');
  assert.equal(autoSelectHarness.evaluate('selected.has("a")'), true, 'High Match 应默认勾选');
  assert.equal(autoSelectHarness.evaluate('jobs.a.match.version'), 2, '岗位应保存带版本的独立 Match Result');

  const emptyProfileHarness = createHarness({
    command: '/岗位深度分析 请分析',
    jobs: {
      a: {
        ...job('a'),
        match: { version: 1, score: 99, status: 'high_match', autoSelected: true },
      },
    },
    selectedHashes: ['a'],
    candidateProfileData: {},
  });
  await emptyProfileHarness.evaluate('refreshJobMatches({ resetSelection: true })');
  assert.equal(emptyProfileHarness.evaluate('jobs.a.match.status'), 'profile_missing', '空画像应替换旧匹配等级');
  assert.equal(emptyProfileHarness.evaluate('jobs.a.match.score'), null, '空画像应清除旧分数');
  assert.equal(emptyProfileHarness.evaluate('selected.has("a")'), false, '空画像不得自动勾选岗位');
  const emptyProfileItem = emptyProfileHarness.element('jobList').children.at(-1);
  const emptyProfileBadge = emptyProfileItem.children[1].children[1];
  assert.equal(emptyProfileBadge.textContent, '待完善画像', '空画像 UI 不得显示伪评分');
  assert.doesNotMatch(emptyProfileHarness.element('stats').textContent, /高匹配 0/);

  const fourJobs = Object.fromEntries(['a', 'b', 'c', 'd'].map((hash) => [hash, job(hash)]));
  const shortRoadmap = createHarness({
    command: '/学习路线 请规划',
    jobs: fourJobs,
    selectedHashes: Object.keys(fourJobs),
  });
  assert.equal((await shortRoadmap.send()).aiCalls, 0, '学习路线少于 5 个岗位时不得请求 AI');

  const fiveJobs = Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((hash) => [hash, {
    ...job(hash),
    skills: hash === 'e' ? ['Linux'] : ['K8s', 'Prometheus'],
    description: '负责 Kubernetes 和 Prometheus',
  }]));
  const roadmapHarness = createHarness({
    command: '/learning-roadmap 请规划',
    jobs: fiveJobs,
    selectedHashes: Object.keys(fiveJobs),
    responseText: '# 学习路线',
  });
  const roadmapResult = await roadmapHarness.send();
  assert.equal(roadmapResult.aiCalls, 1, '学习路线选择 5 个岗位时应请求 AI');
  const roadmapContent = roadmapResult.lastRequest.messages.at(-1).content;
  assert.match(roadmapContent, /Structured Skill Demand/);
  assert.match(roadmapContent, /"sampleCount": 5/);
  assert.match(roadmapContent, /"id": "kubernetes"/);
  assert.match(roadmapContent, /"demand_count": 5/);
  assert.match(roadmapContent, /"candidate_level": "unknown"/);
  assert.match(roadmapContent, /technicalDependencyDataAvailable/);

  const unanchoredJobs = {
    a: { ...job('a'), match: { version: 1, score: 99, status: 'high_match' } },
    b: { ...job('b'), match: { version: 1, score: 1, status: 'low_match' } },
  };
  const unanchored = createHarness({
    command: '/投递决策 请排序',
    jobs: unanchoredJobs,
    selectedHashes: ['a', 'b'],
    responseText: '完成',
  });
  const unanchoredResult = await unanchored.send();
  const aiContent = unanchoredResult.lastRequest.messages.at(-1).content;
  assert.doesNotMatch(aiContent, /"match"|"score": 99|high_match|low_match/, 'Local Match 不得进入 AI 上下文');

  const markdown = valid.evaluate('buildExportMarkdown(new Date("2026-08-18T06:30:00Z"))');
  assert.match(markdown, /首次使用 Skill：岗位深度分析/);
  assert.match(markdown, /\| 岗位 a \|  \|  \|  \|/);
  assert.match(markdown, /### 我的问题\n\n> 请分析/);
  assert.match(markdown, /### AI 分析\n\n# 分析结果/);
  assert.doesNotMatch(markdown, /job_hash|description|求职画像/);

  const filename = valid.evaluate('defaultExportFilename(new Date("2026-08-18T14:30:00"))');
  assert.equal(filename, 'Boss岗位助手-岗位深度分析-岗位 a-20260818-1430.md');
  assert.equal(valid.evaluate('sanitizeFilename("自定义:报告?.MD")'), '自定义-报告-.MD');

  const stopped = createHarness({
    command: '/岗位深度分析 请分析',
    jobs: { a: job('a') },
    selectedHashes: ['a'],
    responseText: '已生成部分',
    streamOutcome: 'abort',
  });
  const stoppedResult = await stopped.send();
  assert.equal(stoppedResult.exportTurnCount, 1, '用户停止后应保留已经生成的部分');
  assert.match(stopped.evaluate('buildExportMarkdown(new Date())'), /本次生成被用户中止/);

  const failed = createHarness({
    command: '/岗位深度分析 请分析',
    jobs: { a: job('a') },
    selectedHashes: ['a'],
    streamOutcome: 'error',
  });
  const failedResult = await failed.send();
  assert.equal(failedResult.exportTurnCount, 0, '请求失败不应进入正式导出记录');
  assert.equal(failedResult.exportEnabled, false, '只有失败消息时导出按钮应保持禁用');

  const truncated = createHarness({
    command: '/岗位深度分析 请分析',
    jobs: { a: job('a') },
    selectedHashes: ['a'],
    responseText: '已生成但不完整的正文',
    streamOutcome: 'error',
  });
  const truncatedResult = await truncated.send();
  assert.match(truncatedResult.lastAssistantHtml, /已生成但不完整的正文/);
  assert.match(truncatedResult.lastAssistantHtml, /错误.*provider failed/s, '部分正文后必须展示不完整错误');
  assert.equal(truncatedResult.exportTurnCount, 0, '不完整回答不得作为成功会话导出');

  valid.evaluate(`
    exportTurns = [];
    firstExportSkillName = '';
    const snapshot = (name, index) => ({
      startedAt: '2026-08-18T06:00:00Z',
      skill: { id: 'skill-' + index, name },
      provider: 'openai',
      model: 'test-model',
      jobs: [],
      userMessage: '问题 ' + index
    });
    recordExportTurn(snapshot('投递决策', 0), '回答 0', false);
    for (let i = 1; i < 25; i += 1) {
      recordExportTurn(snapshot('岗位深度分析', i), '回答 ' + i, false);
    }
  `);
  assert.equal(valid.evaluate('exportTurns.length'), 25, '完整导出记录不应受 AI 上下文 20 条限制');
  assert.equal(valid.evaluate('firstExportSkillName'), '投递决策', '文件名应使用本次会话首次使用的 Skill');
  assert.match(valid.evaluate('defaultExportFilename(new Date("2026-08-18T14:30:00"))'), /投递决策/);
  assert.match(valid.evaluate('buildExportMarkdown(new Date())'), /## 第 25 轮：岗位深度分析/);

  console.log('sidepanel skill and export: PASS');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
