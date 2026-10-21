const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const registry = require(path.join(root, 'data/skill-registry.json'));
const matcher = require(path.join(root, 'localMatcher.js'));

const profile = {
  years_experience: '4 年',
  core_skills: 'Linux, Docker, Kubernetes, Prometheus',
  familiar_skills: 'Python, GitLabCI',
  basic_skills: 'Terraform',
  target_roles: 'SRE, DevOps',
  adjacent_roles: '平台工程师, 云原生工程师',
  expected_salary: '20-25K',
  minimum_salary: '18K',
  target_cities: '广州, 深圳',
  accept_relocation: '不接受',
  accept_onsite: '不接受',
  accept_outsource: '不接受',
  accept_shift_or_oncall: '不接受',
  avoid_work: '桌面 IT 支持',
};

function jd(overrides) {
  return {
    job_name: 'SRE 工程师',
    skills: ['Linux', 'K8s', 'Prometheus', 'Docker'],
    description: '负责 Kubernetes 平台建设、CI/CD 自动化和 Prometheus 可观测性。',
    experience: '3-5年',
    salary: '20-30K',
    city: '广州',
    ...overrides,
  };
}

const emptyProfile = matcher.matchJob(jd(), {}, registry);
assert.equal(emptyProfile.status, 'profile_missing', '空求职画像不得产生匹配等级');
assert.equal(emptyProfile.score, null, '空求职画像不得产生匹配分数');
assert.equal(emptyProfile.autoSelected, false, '空求职画像不得自动勾选岗位');
assert.equal(emptyProfile.hardStop, false, '空画像不得推断 Hard Stop');
assert.deepEqual(emptyProfile.dimensions, {
  direction: null,
  skills: null,
  experience: null,
  salary: null,
  preference: null,
});

const insufficientProfile = matcher.matchJob(jd(), { core_skills: 'Kubernetes' }, registry);
assert.equal(insufficientProfile.status, 'profile_missing', '画像信息严重不足时不得产生匹配等级');
assert.equal(insufficientProfile.score, null, '画像信息严重不足时不得产生匹配分数');

const aliases = matcher.extractJobSkills(jd({
  skills: ['K8s', 'Prom', 'GitLabCI'],
  description: '',
  job_name: '',
}), registry).map((item) => item.id);
assert.deepEqual(aliases.sort(), ['gitlab-ci', 'kubernetes', 'prometheus']);

const high = matcher.matchJob(jd(), profile, registry);
assert.equal(high.status, 'high_match');
assert.equal(high.autoSelected, true);
assert.equal(high.hardStop, false);
assert.equal(high.version, matcher.MATCH_VERSION);

const adjacent = matcher.matchJob(jd({
  job_name: '平台工程师',
  skills: ['Kubernetes', 'Prometheus', 'GitLab CI', 'Python'],
  description: '负责 Kubernetes 平台建设、Prometheus 监控、CI/CD 与自动化。',
}), profile, registry);
assert.ok(adjacent.dimensions.direction >= 20, '相邻岗位不能因 title 不同而失去方向分');
assert.notEqual(adjacent.status, 'low_match');

const unrelated = matcher.matchJob(jd({
  job_name: '桌面 IT 支持',
  skills: ['Windows'],
  description: '负责办公电脑、打印机和桌面软件支持。',
  salary: '20-25K',
}), profile, registry);
assert.equal(unrelated.status, 'low_match');
assert.equal(unrelated.autoSelected, false);

const salaryStop = matcher.matchJob(jd({ salary: '10-15K' }), profile, registry);
assert.equal(salaryStop.hardStop, true);
assert.equal(salaryStop.status, 'rejected');
assert.match(salaryStop.hardStopReasons.join(' '), /最高薪资/);
assert.deepEqual(matcher.parseSalary('18000-25000'), { min: 18, max: 25 });

const oneYearShort = matcher.matchJob(jd({ experience: '5年' }), profile, registry);
assert.equal(oneYearShort.hardStop, false);
assert.equal(oneYearShort.dimensions.experience, 11);
assert.equal(matcher.parseYears('3-5年'), 3);

const outsourceStop = matcher.matchJob(jd({ description: '本岗位为客户现场长期驻场的外包岗位。' }), profile, registry);
assert.equal(outsourceStop.hardStop, true);
assert.ok(outsourceStop.hardStopReasons.length >= 2);
assert.equal(outsourceStop.autoSelected, false);

const cityStop = matcher.matchJob(jd({ city: '上海' }), profile, registry);
assert.match(cityStop.hardStopReasons.join(' '), /不接受异地/);

const shiftStop = matcher.matchJob(jd({ description: '岗位实行夜班轮班制度。' }), profile, registry);
assert.match(shiftStop.hardStopReasons.join(' '), /倒班/);

const negatedOutsource = matcher.matchJob(jd({ description: '公司直招，非外包岗位。' }), profile, registry);
assert.equal(negatedOutsource.hardStopReasons.some((reason) => /外包/.test(reason)), false);

const demand = matcher.buildStructuredSkillDemand([
  jd({ skills: ['K8s', 'Kubernetes', 'Prom'], description: '', job_name: '' }),
  jd({ skills: ['Kubernetes', 'Linux'], description: '', job_name: '' }),
], registry);
assert.equal(demand.sampleCount, 2);
assert.deepEqual(demand.skills.find((skill) => skill.id === 'kubernetes'), {
  id: 'kubernetes', name: 'Kubernetes', count: 2, ratio: 1,
});
assert.equal(demand.skills.find((skill) => skill.id === 'prometheus').count, 1);

const roadmap = matcher.buildRoadmapSkillContext(demand, profile, registry);
const kubernetes = roadmap.find((skill) => skill.id === 'kubernetes');
assert.equal(kubernetes.candidate_level, 'unknown');
assert.equal(kubernetes.entry_target, 'L1');
assert.equal(kubernetes.growth_target, 'L3');
assert.equal(kubernetes.roadmap_ref, 'kubernetes');

const explicitLevelContext = matcher.buildRoadmapSkillContext(demand, {
  ...profile,
  core_skills: 'Kubernetes L2, Linux',
}, registry);
assert.equal(explicitLevelContext.find((skill) => skill.id === 'kubernetes').candidate_level, 'L2');
assert.equal(explicitLevelContext.find((skill) => skill.id === 'linux').candidate_level, 'unknown');

assert.deepEqual(registry.level_definitions, {
  L0: '未接触过',
  L1: '知道是什么，能解释用途和基本概念',
  L2: '能基础使用，能跟着文档或独立完成常见操作',
  L3: '能独立完成任务和基础排错，能真正用于项目或工作',
  L4: '能设计、优化和深入分析，理解内部机制并处理复杂问题',
});

console.log('local matcher: PASS');
