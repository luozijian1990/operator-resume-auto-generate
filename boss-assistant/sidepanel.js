let currentTabId = null;
let jobs = {};
let selected = new Set();
let recording = false;
let searchText = '';

let settings = null;
let candidateProfile = null;
let chatHistory = [];
let exportTurns = [];
let firstExportSkillName = '';
let activeSkill = null;
let streaming = false;
let abortController = null;
let skillRegistry = null;
let autoSelectionApplied = new Set();
let matchingWriteInProgress = false;

const PROVIDER_DEFAULTS = {
  openai: { baseUrl: 'https://api.openai.com', model: 'gpt-4.1' },
  anthropic: { baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-6' },
};

const PROFILE_FIELDS = [
  { key: 'current_role', label: '当前岗位', type: 'input' },
  { key: 'years_experience', label: '工作年限', type: 'input' },
  { key: 'education', label: '学历', type: 'input' },
  { key: 'work_experience', label: '主要工作经历/职责', type: 'textarea' },
  { key: 'core_skills', label: '核心技能', type: 'input' },
  { key: 'familiar_skills', label: '比较熟悉', type: 'input' },
  { key: 'basic_skills', label: '了解但经验较少', type: 'input' },
  { key: 'projects', label: '代表项目/成果', type: 'textarea' },
  { key: 'target_roles', label: '期望方向', type: 'input' },
  { key: 'adjacent_roles', label: '可接受的相邻方向', type: 'input' },
  { key: 'expected_salary', label: '期望薪资', type: 'input' },
  { key: 'minimum_salary', label: '最低可接受薪资', type: 'input' },
  { key: 'target_cities', label: '期望城市', type: 'input' },
  { key: 'accept_relocation', label: '是否接受异地', type: 'select' },
  { key: 'accept_onsite', label: '是否接受驻场', type: 'select' },
  { key: 'accept_outsource', label: '是否接受外包', type: 'select' },
  { key: 'accept_shift_or_oncall', label: '是否接受倒班/长期 On-call', type: 'select' },
  { key: 'growth_skills', label: '希望未来加强的能力', type: 'input' },
  { key: 'avoid_work', label: '明确不想做的工作', type: 'input' },
];

const PROFILE_LABELS = {};
PROFILE_FIELDS.forEach((f) => { PROFILE_LABELS[f.key] = f.label; });

const EMPTY_PROFILE = {};
PROFILE_FIELDS.forEach((f) => { EMPTY_PROFILE[f.key] = ''; });

const PROFILE_REQUIRED_FIELDS = ['current_role', 'years_experience', 'work_experience', 'core_skills', 'target_roles'];

const DEFAULT_SYSTEM_PROMPT =
  '你是岗位求职助手，帮助用户分析浏览过的 BOSS 招聘岗位。根据提供的岗位上下文回答用户问题，使用 Markdown 格式输出。';

const $ = (id) => document.getElementById(id);
const els = {
  hint: $('hint'),
  recToggle: $('recToggle'),
  recLabel: $('recLabel'),
  stats: $('stats'),
  search: $('search'),
  selectAll: $('selectAll'),
  selectedCount: $('selectedCount'),
  clearAll: $('clearAll'),
  exportJobs: $('exportJobs'),
  jobList: $('jobList'),
  exportChat: $('exportChat'),
  chatMessages: $('chatMessages'),
  chatInput: $('chatInput'),
  sendBtn: $('sendBtn'),
  slashMenu: $('slashMenu'),
  skillChip: $('skillChip'),
  skillChipName: $('skillChipName'),
  skillChipClear: $('skillChipClear'),
  settingsToggle: $('settingsToggle'),
  settingsPanel: $('settingsPanel'),
  tabAi: $('tabAi'),
  tabProfile: $('tabProfile'),
  aiSection: $('aiSection'),
  profileSection: $('profileSection'),
  profileForm: $('profileForm'),
  saveProfile: $('saveProfile'),
  clearProfile: $('clearProfile'),
  profileStatus: $('profileStatus'),
  baseUrl: $('baseUrl'),
  model: $('model'),
  apiKey: $('apiKey'),
  saveApiKey: $('saveApiKey'),
  clearApiKey: $('clearApiKey'),
  saveSettings: $('saveSettings'),
  testConnection: $('testConnection'),
  settingsStatus: $('settingsStatus'),
  exportDialog: $('exportDialog'),
  exportFilename: $('exportFilename'),
  cancelExport: $('cancelExport'),
  confirmExport: $('confirmExport'),
};

// ---------- markdown ----------
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

if (window.marked) {
  marked.use({
    renderer: {
      html(text) {
        return escapeHtml(text);
      },
    },
  });
}

// ---------- jobs ----------
function sortedJobs() {
  return Object.values(jobs).sort((a, b) =>
    (b.last_viewed_at || b.captured_at || '').localeCompare(a.last_viewed_at || a.captured_at || ''));
}

function filteredJobs() {
  const q = searchText.trim().toLowerCase();
  const list = sortedJobs();
  if (!q) return list;
  return list.filter((j) =>
    [j.job_name, j.company_name, j.salary, j.city].join(' ').toLowerCase().includes(q));
}

function buildJobsExportJson() {
  // 导出全部记录；本地 match 包含个人匹配判断，不属于原始 JD。
  return JSON.stringify(sortedJobs().map(({ match, ...job }) => job), null, 2);
}

function downloadJobs() {
  if (Object.keys(jobs).length === 0) return;
  const blob = new Blob([buildJobsExportJson()], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'boss-jds-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function brief(j) {
  return [j.job_name, j.company_name, j.salary, j.city].filter(Boolean).join(' · ');
}

const MATCH_STATUS_LABELS = {
  profile_missing: '待完善画像',
  high_match: '高匹配',
  candidate: '候选',
  low_match: '低匹配',
  rejected: 'Hard Stop',
};

function renderList() {
  const list = filteredJobs();
  els.jobList.innerHTML = '';
  list.forEach((j) => {
    const li = document.createElement('li');
    li.className = 'job-item';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = selected.has(j.job_hash);
    cb.addEventListener('change', () => {
      if (cb.checked) selected.add(j.job_hash);
      else selected.delete(j.job_hash);
      renderSelection();
    });

    const label = document.createElement('label');
    label.className = 'job-info';
    const main = document.createElement('span');
    main.className = 'job-brief';
    main.textContent = brief(j);
    label.appendChild(main);
    if (j.match) {
      const meta = document.createElement('span');
      meta.className = 'job-match job-match-' + j.match.status;
      const scoreText = Number.isFinite(j.match.score) ? ' · ' + j.match.score + ' 分' : '';
      meta.textContent = (MATCH_STATUS_LABELS[j.match.status] || '未分类') + scoreText;
      label.appendChild(meta);
      label.title = brief(j) + '\n' + (j.match.hardStopReasons || []).concat(j.match.reasons || []).join('\n');
    } else {
      label.title = brief(j);
    }

    const del = document.createElement('button');
    del.className = 'job-del';
    del.textContent = '×';
    del.title = '删除';
    del.addEventListener('click', () => deleteJob(j.job_hash));

    li.append(cb, label, del);
    els.jobList.appendChild(li);
  });

  if (list.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = searchText ? '无匹配岗位' : '还没有记录，开启记录后浏览岗位';
    els.jobList.appendChild(empty);
  }

  renderStats();
  renderSelection();
}

function renderStats() {
  const list = Object.values(jobs);
  els.exportJobs.disabled = list.length === 0;
  const highCount = list.filter((job) => job.match && job.match.status === 'high_match').length;
  const hardStopCount = list.filter((job) => job.match && job.match.hardStop).length;
  const profileMissingCount = list.filter((job) => job.match && job.match.status === 'profile_missing').length;
  els.stats.textContent = '已记录 ' + list.length + ' 个岗位'
    + (skillRegistry
      ? (profileMissingCount
        ? ' · 待完善画像 ' + profileMissingCount
        : ' · 高匹配 ' + highCount + (hardStopCount ? ' · Hard Stop ' + hardStopCount : ''))
      : '');
}

function renderSelection() {
  const visible = filteredJobs();
  els.selectedCount.textContent = '已选 ' + selected.size + ' 个';
  els.selectAll.checked = visible.length > 0 && visible.every((j) => selected.has(j.job_hash));
}

function renderToggle() {
  els.recToggle.checked = recording;
  els.recLabel.textContent = recording ? '记录中' : '已停止';
}

function showHint(text) {
  els.hint.textContent = text;
  els.hint.classList.remove('hidden');
}

function hideHint() {
  els.hint.classList.add('hidden');
}

async function deleteJob(hash) {
  selected.delete(hash);
  delete jobs[hash];
  await chrome.storage.local.set({ ['jobs:' + currentTabId]: jobs });
  renderList();
}

async function clearAll() {
  selected.clear();
  jobs = {};
  await chrome.storage.local.remove('jobs:' + currentTabId);
  renderList();
}

async function setRecording(enabled) {
  recording = enabled;
  if (currentTabId != null) {
    await chrome.storage.local.set({ ['recording:' + currentTabId]: enabled });
  }
  renderToggle();
}

function resolveActiveTab() {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab) {
      showHint('未找到活动标签页');
      return;
    }
    const isZhipin = (tab.url || '').toLowerCase().includes('zhipin.com');
    if (!isZhipin) {
      if (currentTabId !== null) {
        currentTabId = null;
        jobs = {};
        selected.clear();
        recording = false;
        renderToggle();
        renderList();
      }
      showHint('请在 Boss 直聘页面使用');
      return;
    }
    const changed = tab.id !== currentTabId;
    currentTabId = tab.id;
    if (changed) {
      selected.clear();
      autoSelectionApplied.clear();
    }
    hideHint();
    loadData();
  });
}

async function loadData() {
  if (currentTabId == null) return;
  const keys = ['jobs:' + currentTabId, 'recording:' + currentTabId];
  const data = await chrome.storage.local.get(keys);
  jobs = data['jobs:' + currentTabId] || {};
  recording = data['recording:' + currentTabId] === true;
  renderToggle();
  await refreshJobMatches();
}

function onStorageChanged(changes, area) {
  if (area !== 'local' || currentTabId == null) return;
  const jobsKey = 'jobs:' + currentTabId;
  const recKey = 'recording:' + currentTabId;
  if (changes[jobsKey]) {
    jobs = changes[jobsKey].newValue || {};
    if (matchingWriteInProgress) renderList();
    else refreshJobMatches();
  }
  if (changes[recKey]) {
    recording = changes[recKey].newValue === true;
    renderToggle();
  }
}

async function loadSkillRegistry() {
  try {
    skillRegistry = await window.SkillRegistry.load();
  } catch (error) {
    skillRegistry = null;
    console.warn('Skill Registry 加载失败，本地岗位匹配已停用：', error);
  }
}

async function refreshJobMatches(options) {
  const resetSelection = options && options.resetSelection;
  if (resetSelection) {
    selected.clear();
    autoSelectionApplied.clear();
  }
  if (!skillRegistry || !window.LocalJobMatcher) {
    renderList();
    return;
  }
  let changed = false;
  Object.keys(jobs).forEach((hash) => {
    const job = jobs[hash];
    const match = window.LocalJobMatcher.matchJob(job, candidateProfile || {}, skillRegistry);
    if (JSON.stringify(job.match) !== JSON.stringify(match)) {
      jobs[hash] = { ...job, match };
      changed = true;
    }
    if (!autoSelectionApplied.has(hash)) {
      if (match.autoSelected) selected.add(hash);
      else selected.delete(hash);
      autoSelectionApplied.add(hash);
    }
  });
  Array.from(autoSelectionApplied).forEach((hash) => {
    if (!jobs[hash]) autoSelectionApplied.delete(hash);
  });
  renderList();
  if (changed && currentTabId != null) {
    matchingWriteInProgress = true;
    try {
      await chrome.storage.local.set({ ['jobs:' + currentTabId]: jobs });
    } finally {
      matchingWriteInProgress = false;
    }
  }
}

// ---------- settings ----------
async function loadSettings() {
  const data = await chrome.storage.local.get('settings');
  const s = data.settings || {};
  settings = {
    provider: s.provider || 'openai',
    apiKey: s.apiKey || '',
    providers: {
      openai: { ...PROVIDER_DEFAULTS.openai, ...((s.providers || {}).openai || {}) },
      anthropic: { ...PROVIDER_DEFAULTS.anthropic, ...((s.providers || {}).anthropic || {}) },
    },
  };
  applySettingsToForm();
}

function applySettingsToForm() {
  const provider = settings.provider;
  const radio = document.querySelector('input[name="provider"][value="' + provider + '"]');
  if (radio) radio.checked = true;
  els.baseUrl.value = settings.providers[provider].baseUrl || '';
  els.model.value = settings.providers[provider].model || '';
  els.apiKey.value = settings.apiKey || '';
}

function onProviderChange() {
  const prev = settings.provider;
  settings.providers[prev].baseUrl = els.baseUrl.value.trim();
  settings.providers[prev].model = els.model.value.trim();
  settings.provider = document.querySelector('input[name="provider"]:checked').value;
  els.baseUrl.value = settings.providers[settings.provider].baseUrl || '';
  els.model.value = settings.providers[settings.provider].model || '';
}

async function persistSettings() {
  await chrome.storage.local.set({
    settings: { provider: settings.provider, apiKey: settings.apiKey, providers: settings.providers },
  });
}

async function saveSettings() {
  const provider = settings.provider;
  settings.providers[provider].baseUrl = els.baseUrl.value.trim();
  settings.providers[provider].model = els.model.value.trim();
  await persistSettings();
  setSettingsStatus('配置已保存');
}

async function saveApiKey() {
  if (!els.apiKey.value.trim()) {
    setSettingsStatus('API Key 为空', true);
    return;
  }
  settings.apiKey = els.apiKey.value.trim();
  await persistSettings();
  setSettingsStatus('API Key 已保存');
}

async function clearApiKey() {
  settings.apiKey = '';
  els.apiKey.value = '';
  await persistSettings();
  setSettingsStatus('API Key 已清除');
}

async function testConnection() {
  if (!settings) await loadSettings();
  const provider = settings.provider;
  settings.providers[provider].baseUrl = els.baseUrl.value.trim();
  settings.providers[provider].model = els.model.value.trim();
  settings.apiKey = els.apiKey.value.trim();
  setSettingsStatus('测试中…');
  try {
    let acc = '';
    await window.AIProvider.stream(
      {
        provider,
        baseUrl: settings.providers[provider].baseUrl,
        model: settings.providers[provider].model,
        apiKey: settings.apiKey,
        systemPrompt: '你是连接测试助手，只回复 OK。',
        messages: [{ role: 'user', content: '连接测试，请只回复 OK' }],
      },
      (d) => { acc += d; },
      null
    );
    setSettingsStatus('测试通过：' + acc.slice(0, 60));
  } catch (e) {
    setSettingsStatus('测试失败：' + (e && e.message ? e.message : '请求失败'), true);
  }
}

function setSettingsStatus(msg, isError) {
  els.settingsStatus.textContent = msg || '';
  els.settingsStatus.classList.toggle('error', Boolean(isError));
}

function toggleSettings(forceOpen) {
  if (forceOpen === true) els.settingsPanel.classList.remove('hidden');
  else els.settingsPanel.classList.toggle('hidden');
}

function switchSettingsTab(tab) {
  const isAi = tab === 'ai';
  els.tabAi.classList.toggle('active', isAi);
  els.tabProfile.classList.toggle('active', !isAi);
  els.aiSection.classList.toggle('hidden', !isAi);
  els.profileSection.classList.toggle('hidden', isAi);
}

// ---------- candidate profile ----------
async function loadProfile() {
  const data = await chrome.storage.local.get('candidateProfile');
  candidateProfile = { ...EMPTY_PROFILE, ...(data.candidateProfile || {}) };
  renderProfileForm();
}

function renderProfileForm() {
  els.profileForm.innerHTML = '';
  PROFILE_FIELDS.forEach((f) => {
    const wrap = document.createElement('div');
    wrap.className = 'settings-field';
    const label = document.createElement('label');
    label.textContent = f.label;
    let input;
    if (f.type === 'textarea') {
      input = document.createElement('textarea');
      input.rows = 3;
    } else if (f.type === 'select') {
      input = document.createElement('select');
      ['', '接受', '不接受', '可接受'].forEach((opt) => {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt || '—';
        input.appendChild(o);
      });
    } else {
      input = document.createElement('input');
      input.type = 'text';
    }
    input.dataset.key = f.key;
    input.value = candidateProfile[f.key] || '';
    wrap.append(label, input);
    els.profileForm.appendChild(wrap);
  });
}

function collectProfile() {
  const p = { version: 1 };
  els.profileForm.querySelectorAll('[data-key]').forEach((el) => {
    p[el.dataset.key] = el.value.trim();
  });
  return p;
}

async function saveProfile() {
  candidateProfile = collectProfile();
  await chrome.storage.local.set({ candidateProfile });
  await refreshJobMatches({ resetSelection: true });
  setProfileStatus('求职画像已保存');
}

async function clearProfile() {
  candidateProfile = { ...EMPTY_PROFILE };
  renderProfileForm();
  await chrome.storage.local.remove('candidateProfile');
  await refreshJobMatches({ resetSelection: true });
  setProfileStatus('求职画像已清空');
}

function setProfileStatus(msg, isError) {
  els.profileStatus.textContent = msg || '';
  els.profileStatus.classList.toggle('error', Boolean(isError));
}

function profileSufficient() {
  if (window.LocalJobMatcher && window.LocalJobMatcher.hasSufficientCandidateProfile) {
    return window.LocalJobMatcher.hasSufficientCandidateProfile(candidateProfile);
  }
  const p = candidateProfile;
  if (!p) return false;
  const filled = PROFILE_REQUIRED_FIELDS.filter((f) => p[f] && String(p[f]).trim() !== '');
  return filled.length >= 3;
}

function buildProfileText(skill) {
  if (!candidateProfile || !skill.profileFields || skill.profileFields.length === 0) return '';
  const lines = [];
  skill.profileFields.forEach((f) => {
    const val = candidateProfile[f];
    if (val != null && String(val).trim() !== '') {
      lines.push(PROFILE_LABELS[f] + '：' + String(val).trim());
    }
  });
  if (!lines.length) return '';
  return '【求职画像】\n' + lines.join('\n');
}

// ---------- chat ----------
function scrollChat() {
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

function appendUserMessage(text) {
  const div = document.createElement('div');
  div.className = 'msg user';
  div.textContent = text;
  els.chatMessages.appendChild(div);
  scrollChat();
}

function appendAssistantBubble() {
  const div = document.createElement('div');
  div.className = 'msg assistant md';
  els.chatMessages.appendChild(div);
  scrollChat();
  return div;
}

function showThinking(bubble) {
  bubble.classList.add('thinking');
  bubble.innerHTML = '<div class="thinking-indicator" role="status"><span class="thinking-dots"><i></i><i></i><i></i></span>正在思考…</div>';
  scrollChat();
}

function summarizeJobs(contextJobs) {
  return contextJobs.map((job) => ({
    job_name: job.job_name || '',
    company_name: job.company_name || '',
    salary: job.salary || '',
    city: job.city || '',
  }));
}

function recordExportTurn(snapshot, assistantMarkdown, stopped) {
  const skillName = snapshot.skill ? snapshot.skill.name : '';
  if (!firstExportSkillName && skillName) firstExportSkillName = skillName;
  exportTurns.push({
    ...snapshot,
    assistantMarkdown,
    stopped: Boolean(stopped),
    completedAt: new Date().toISOString(),
  });
  updateExportButton();
}

function formatDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
    + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
}

function formatFilenameDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return String(date.getFullYear()) + pad(date.getMonth() + 1) + pad(date.getDate())
    + '-' + pad(date.getHours()) + pad(date.getMinutes());
}

function markdownTableCell(value) {
  return String(value || '').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
}

function markdownQuote(value) {
  return String(value || '').split(/\r?\n/).map((line) => '> ' + line).join('\n');
}

function buildExportMarkdown(exportedAt) {
  const providers = Array.from(new Set(exportTurns.map((turn) => turn.provider).filter(Boolean)));
  const models = Array.from(new Set(exportTurns.map((turn) => turn.model).filter(Boolean)));
  const lines = [
    '# Boss 岗位助手会话导出',
    '',
    '- 导出时间：' + formatDateTime(exportedAt || new Date()),
    '- 首次使用 Skill：' + (firstExportSkillName || '岗位问答'),
    '- Provider：' + (providers.join('、') || '未知'),
    '- Model：' + (models.join('、') || '未知'),
    '- 问答轮数：' + exportTurns.length,
    '',
  ];

  exportTurns.forEach((turn, index) => {
    lines.push('## 第 ' + (index + 1) + ' 轮：' + (turn.skill ? turn.skill.name : '岗位问答'));
    lines.push('');
    lines.push('- 时间：' + formatDateTime(turn.startedAt));
    lines.push('');
    lines.push('### 分析岗位');
    lines.push('');
    if (turn.jobs.length) {
      lines.push('| 岗位 | 公司 | 薪资 | 城市 |');
      lines.push('|---|---|---|---|');
      turn.jobs.forEach((job) => {
        lines.push('| ' + [job.job_name, job.company_name, job.salary, job.city]
          .map(markdownTableCell).join(' | ') + ' |');
      });
    } else {
      lines.push('无。');
    }
    lines.push('');
    lines.push('### 我的问题');
    lines.push('');
    lines.push(markdownQuote(turn.userMessage));
    lines.push('');
    lines.push('### AI 分析');
    lines.push('');
    lines.push(String(turn.assistantMarkdown || '').trim());
    lines.push('');
  });

  return lines.join('\n').trimEnd() + '\n';
}

function sanitizeFilename(value) {
  const cleaned = String(value || '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .slice(0, 120);
  const base = cleaned || 'Boss岗位助手-会话导出';
  return base.toLowerCase().endsWith('.md') ? base : base + '.md';
}

function defaultExportFilename(now) {
  const skillName = firstExportSkillName || '岗位问答';
  const namingTurn = exportTurns.find((turn) => turn.skill && turn.skill.name === firstExportSkillName)
    || exportTurns[0];
  let jobsPart = '';
  if (namingTurn && namingTurn.jobs.length === 1) jobsPart = namingTurn.jobs[0].job_name;
  else if (namingTurn && namingTurn.jobs.length > 1) jobsPart = namingTurn.jobs.length + '个岗位';
  return sanitizeFilename([
    'Boss岗位助手',
    skillName,
    jobsPart,
    formatFilenameDate(now || new Date()),
  ].filter(Boolean).join('-'));
}

function updateExportButton() {
  els.exportChat.disabled = streaming || exportTurns.length === 0;
}

function openExportDialog() {
  if (streaming || exportTurns.length === 0) return;
  els.exportFilename.value = defaultExportFilename(new Date());
  if (!els.exportDialog.open) els.exportDialog.showModal();
  els.exportFilename.focus();
  els.exportFilename.select();
}

function downloadConversation() {
  if (streaming || exportTurns.length === 0) return;
  const filename = sanitizeFilename(els.exportFilename.value);
  const blob = new Blob([buildExportMarkdown(new Date())], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  els.exportDialog.close();
}

function buildContextJobs() {
  return sortedJobs()
    .filter((j) => selected.has(j.job_hash))
    .map((j) => {
      // Local Match 只负责筛选和默认选择，不进入 AI 上下文，避免分数锚定模型判断。
      const { job_hash, boss_title, match, ...rest } = j;
      return rest;
    });
}

function buildStructuredSkillContext(skill, contextJobs) {
  if (!skill || !skill.includeStructuredSkillDemand || !skillRegistry || !window.LocalJobMatcher) return '';
  const demand = window.LocalJobMatcher.buildStructuredSkillDemand(contextJobs, skillRegistry);
  if (skill.includeStructuredSkillDemand === 'demand-only') {
    return '【Structured Skill Demand（本地 canonical 技能统计）】\n```json\n'
      + JSON.stringify(demand, null, 2) + '\n```\n'
      + '本统计只代表用户筛选后的相关岗位样本；不得描述为完整市场总体统计。';
  }
  const skills = window.LocalJobMatcher.buildRoadmapSkillContext(demand, candidateProfile || {}, skillRegistry);
  return '【Structured Skill Demand（本地确定性统计）】\n```json\n' + JSON.stringify({
    sampleCount: demand.sampleCount,
    skills,
    levelDefinitions: skillRegistry.level_definitions || {},
    orderingNote: '当前阶段按求职优先级排序，不代表严格技术依赖顺序。',
    technicalDependencyDataAvailable: false,
  }, null, 2) + '\n```';
}

function buildUserContent(userMessage, contextJobs, profileText, structuredSkillContext) {
  const parts = [];
  if (profileText) parts.push(profileText);
  if (structuredSkillContext) parts.push(structuredSkillContext);
  if (contextJobs.length) {
    parts.push('以下是用户筛选后的相关目标岗位样本（JSON）：\n```json\n' + JSON.stringify(contextJobs, null, 2) + '\n```');
  }
  parts.push(userMessage);
  return parts.join('\n\n');
}

function validateJobCount(skill) {
  const count = buildContextJobs().length;
  const min = skill.minJobs != null ? skill.minJobs : 0;
  const max = skill.maxJobs != null ? skill.maxJobs : Infinity;
  if (count === 0) return skill.emptyMessage || '请先选择岗位后再进行分析。';
  if (count < min) return skill.minJobsMessage || ('请至少选择 ' + min + ' 个岗位，才能进行分析。');
  if (count > max) return skill.maxJobsMessage || ('该分析仅支持最多 ' + max + ' 个岗位，请取消多余选择后重试。');
  return null;
}

function resolveSkillInvocation(raw) {
  const skills = window.SKILLS || [];
  const invocation = skills
    .flatMap((skill) => [skill.id, skill.name].map((command) => ({ skill, command })))
    .sort((a, b) => b.command.length - a.command.length)
    .find(({ command }) => {
      const prefix = '/' + command;
      return raw.startsWith(prefix)
        && (raw.length === prefix.length || /\s/.test(raw.charAt(prefix.length)));
    });

  if (!invocation) return { skill: null, userMessage: raw };
  return {
    skill: invocation.skill,
    userMessage: raw.slice(invocation.command.length + 1).trim(),
  };
}

function appendProfilePrompt() {
  const bubble = document.createElement('div');
  bubble.className = 'msg assistant';
  const text = document.createElement('div');
  text.innerHTML = '<strong>还没有完善求职画像</strong><br>这个 Skill 需要结合你的工作经历、技能、职业方向和求职偏好进行分析，请先完善「求职画像」。';
  const btn = document.createElement('button');
  btn.className = 'mini-btn primary profile-go-btn';
  btn.textContent = '去填写求职画像';
  btn.addEventListener('click', () => {
    toggleSettings(true);
    switchSettingsTab('profile');
  });
  bubble.append(text, btn);
  els.chatMessages.appendChild(bubble);
  scrollChat();
}

function buildRequest(systemPrompt, messages) {
  const provider = settings.provider;
  const cfg = settings.providers[provider] || {};
  return {
    provider,
    baseUrl: cfg.baseUrl,
    model: cfg.model,
    apiKey: settings.apiKey,
    systemPrompt,
    messages,
  };
}

function setStreaming(v) {
  streaming = v;
  els.sendBtn.textContent = v ? '停止' : '发送';
  els.sendBtn.classList.toggle('stop', v);
  updateExportButton();
}

async function sendChat() {
  if (streaming) return;
  if (!settings) await loadSettings();
  if (!candidateProfile) await loadProfile();
  const raw = els.chatInput.value.trim();
  if (!raw) return;

  const invocation = resolveSkillInvocation(raw);
  const requestedSkill = invocation.skill;
  const contextJobs = buildContextJobs();
  const systemPrompt = requestedSkill ? requestedSkill.systemPrompt : DEFAULT_SYSTEM_PROMPT;
  const userMessage = invocation.userMessage;
  if (!userMessage) {
    appendUserMessage(raw);
    appendAssistantBubble().innerHTML = '<p>请输入内容。</p>';
    return;
  }

  if (requestedSkill) {
    const err = validateJobCount(requestedSkill);
    if (err) {
      appendAssistantBubble().innerHTML = '<p>' + escapeHtml(err) + '</p>';
      return;
    }
    const needsProfile = requestedSkill.profileFields && requestedSkill.profileFields.length > 0;
    if (needsProfile && !profileSufficient()) {
      appendProfilePrompt();
      return;
    }
  }

  els.chatInput.value = '';
  hideSlashMenu();
  appendUserMessage(userMessage);

  const profileText = requestedSkill ? buildProfileText(requestedSkill) : '';
  const structuredSkillContext = buildStructuredSkillContext(requestedSkill, contextJobs);
  const content = buildUserContent(userMessage, contextJobs, profileText, structuredSkillContext);
  const messages = chatHistory.slice().concat([{ role: 'user', content }]);

  const bubble = appendAssistantBubble();
  showThinking(bubble);

  chatHistory.push({ role: 'user', content: userMessage });

  const exportSnapshot = {
    startedAt: new Date().toISOString(),
    skill: requestedSkill ? { id: requestedSkill.id, name: requestedSkill.name } : null,
    provider: settings.provider,
    model: (settings.providers[settings.provider] || {}).model || '',
    jobs: summarizeJobs(contextJobs),
    userMessage,
  };

  let acc = '';
  let failed = false;
  let stopped = false;
  let hadContentBeforeStop = false;
  abortController = new AbortController();
  setStreaming(true);
  try {
    await window.AIProvider.stream(
      buildRequest(systemPrompt, messages),
      (delta) => {
        bubble.classList.remove('thinking');
        acc += delta;
        bubble.innerHTML = marked.parse(acc) || '';
        scrollChat();
      },
      abortController.signal
    );
    if (!acc) {
      failed = true;
      bubble.classList.remove('thinking');
      bubble.innerHTML = '<p>模型未返回可显示内容。</p>';
    }
  } catch (e) {
    bubble.classList.remove('thinking');
    if (e && e.name === 'AbortError') {
      stopped = true;
      hadContentBeforeStop = Boolean(acc);
      acc += acc ? '\n\n_（本次生成被用户中止）_' : '_（已在生成正文前停止）_';
    } else {
      failed = true;
      acc += '\n\n**错误**：' + escapeHtml(e && e.message ? e.message : '请求失败');
    }
    bubble.innerHTML = marked.parse(acc) || '';
  } finally {
    setStreaming(false);
    abortController = null;
  }

  if (acc) chatHistory.push({ role: 'assistant', content: acc });
  if (!failed && acc && (!stopped || hadContentBeforeStop)) {
    recordExportTurn(exportSnapshot, acc, stopped);
  }
  if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
  scrollChat();
}

function hideSlashMenu() {
  els.slashMenu.style.display = 'none';
}

function renderSlashMenu() {
  const v = els.chatInput.value;
  if (activeSkill !== null || !v.startsWith('/')) {
    hideSlashMenu();
    return;
  }
  const q = v.slice(1).toLowerCase();
  const matches = (window.SKILLS || []).filter((s) =>
    s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
  els.slashMenu.innerHTML = '';
  matches.forEach((s) => {
    const item = document.createElement('div');
    item.className = 'slash-item';
    const name = document.createElement('span');
    name.className = 'slash-name';
    name.textContent = '/' + s.name;
    const desc = document.createElement('span');
    desc.className = 'slash-desc';
    desc.textContent = s.description;
    item.append(name, desc);
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectSkill(s);
    });
    els.slashMenu.appendChild(item);
  });
  els.slashMenu.style.display = matches.length ? 'block' : 'none';
}

function selectSkill(skill) {
  activeSkill = skill;
  els.chatInput.value = '/' + skill.name + ' ';
  hideSlashMenu();
  renderActiveSkillChip();
  els.chatInput.focus();
}

function renderActiveSkillChip() {
  if (activeSkill) {
    els.skillChip.classList.remove('hidden');
    els.skillChipName.textContent = '/' + activeSkill.name;
  } else {
    els.skillChip.classList.add('hidden');
  }
}

// ---------- events ----------
function bindEvents() {
  els.recToggle.addEventListener('change', () => setRecording(els.recToggle.checked));
  els.search.addEventListener('input', () => {
    searchText = els.search.value;
    renderList();
  });
  els.selectAll.addEventListener('change', () => {
    const visible = filteredJobs();
    if (els.selectAll.checked) visible.forEach((j) => selected.add(j.job_hash));
    else visible.forEach((j) => selected.delete(j.job_hash));
    renderList();
  });
  els.clearAll.addEventListener('click', clearAll);
  els.exportJobs.addEventListener('click', downloadJobs);

  els.settingsToggle.addEventListener('click', toggleSettings);
  els.tabAi.addEventListener('click', () => switchSettingsTab('ai'));
  els.tabProfile.addEventListener('click', () => switchSettingsTab('profile'));
  document.querySelectorAll('input[name="provider"]').forEach((radio) => {
    radio.addEventListener('change', onProviderChange);
  });
  els.saveSettings.addEventListener('click', saveSettings);
  els.saveApiKey.addEventListener('click', saveApiKey);
  els.clearApiKey.addEventListener('click', clearApiKey);
  els.testConnection.addEventListener('click', testConnection);
  els.saveProfile.addEventListener('click', saveProfile);
  els.clearProfile.addEventListener('click', clearProfile);
  els.exportChat.addEventListener('click', openExportDialog);
  els.cancelExport.addEventListener('click', () => els.exportDialog.close());
  els.confirmExport.addEventListener('click', downloadConversation);
  els.exportFilename.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      downloadConversation();
    }
  });

  els.sendBtn.addEventListener('click', () => {
    if (streaming) {
      if (abortController) abortController.abort();
      return;
    }
    sendChat();
  });
  els.chatInput.addEventListener('input', () => {
    renderSlashMenu();
    if (activeSkill && !els.chatInput.value.startsWith('/' + activeSkill.name)) {
      activeSkill = null;
      renderActiveSkillChip();
    }
  });
  els.chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (streaming) return;
      sendChat();
    }
  });
  els.skillChipClear.addEventListener('click', () => {
    activeSkill = null;
    els.chatInput.value = '';
    renderActiveSkillChip();
    els.chatInput.focus();
  });
}

async function init() {
  bindEvents();
  updateExportButton();
  await Promise.all([loadSettings(), loadProfile(), loadSkillRegistry()]);
  chrome.tabs.onActivated.addListener(resolveActiveTab);
  chrome.tabs.onUpdated.addListener((tabId, info) => {
    if (info.status === 'complete') resolveActiveTab();
  });
  chrome.storage.onChanged.addListener(onStorageChanged);
  resolveActiveTab();
}

init().catch((error) => {
  console.error('Side Panel 初始化失败：', error);
  showHint('初始化失败，请重新加载扩展');
});
