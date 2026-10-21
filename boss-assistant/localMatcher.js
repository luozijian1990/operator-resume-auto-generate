(function initLocalJobMatcher(global) {
  const MATCH_VERSION = 2;
  const MATCH_THRESHOLDS = Object.freeze({ autoSelect: 70, candidate: 50 });
  const DIMENSION_MAX = Object.freeze({ direction: 30, skills: 35, experience: 15, salary: 10, preference: 10 });
  const SOURCE_WEIGHTS = Object.freeze({ skills: 1.4, description: 1, job_name: 0.6 });
  const CANDIDATE_WEIGHTS = Object.freeze({ core_skills: 1, familiar_skills: 0.75, basic_skills: 0.5 });
  const PROFILE_REQUIRED_FIELDS = Object.freeze([
    'current_role', 'years_experience', 'work_experience', 'core_skills', 'target_roles',
  ]);
  const PROFILE_REQUIRED_COUNT = 3;
  const NEGATIVE_PREFIX_RE = /(?:非|不是|不属于|无需|不要求)\s*$/i;

  function normalizeText(value) {
    return String(value == null ? '' : value).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function hasSufficientCandidateProfile(profile) {
    if (!profile) return false;
    const filled = PROFILE_REQUIRED_FIELDS.filter((field) => normalizeText(profile[field]) !== '');
    return filled.length >= PROFILE_REQUIRED_COUNT;
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function aliasAppears(text, alias) {
    const haystack = normalizeText(text);
    const needle = normalizeText(alias);
    if (!haystack || !needle) return false;
    if (/^[a-z0-9+#. -]+$/i.test(needle)) {
      const pattern = '(^|[^a-z0-9])' + escapeRegExp(needle).replace(/\s+/g, '\\s+') + '(?=$|[^a-z0-9])';
      return new RegExp(pattern, 'i').test(haystack);
    }
    return haystack.includes(needle);
  }

  function registrySkills(registry) {
    return registry && Array.isArray(registry.skills) ? registry.skills : [];
  }

  function aliasesFor(skill) {
    return Array.from(new Set([skill.id, skill.name].concat(skill.aliases || []).map(normalizeText).filter(Boolean)))
      .sort((a, b) => b.length - a.length);
  }

  function matchSkillIds(text, registry) {
    const ids = [];
    registrySkills(registry).forEach((skill) => {
      if (aliasesFor(skill).some((alias) => aliasAppears(text, alias))) ids.push(skill.id);
    });
    return ids;
  }

  function extractJobSkills(job, registry) {
    const sourceValues = {
      skills: Array.isArray(job && job.skills) ? job.skills.join(' \n ') : (job && job.skills) || '',
      description: job && job.description || '',
      job_name: job && job.job_name || '',
    };
    const found = new Map();
    Object.keys(sourceValues).forEach((source) => {
      matchSkillIds(sourceValues[source], registry).forEach((id) => {
        if (!found.has(id)) found.set(id, new Set());
        found.get(id).add(source);
      });
    });
    return Array.from(found.entries()).map(([id, sources]) => ({
      id,
      sources: Array.from(sources).sort((a, b) => SOURCE_WEIGHTS[b] - SOURCE_WEIGHTS[a]),
    }));
  }

  function normalizeCandidateSkills(profile, registry) {
    const found = new Map();
    Object.keys(CANDIDATE_WEIGHTS).forEach((field) => {
      matchSkillIds(profile && profile[field], registry).forEach((id) => {
        const current = found.get(id);
        const candidate = { id, field, weight: CANDIDATE_WEIGHTS[field] };
        if (!current || candidate.weight > current.weight) found.set(id, candidate);
      });
    });
    return Array.from(found.values());
  }

  function splitProfileTerms(value) {
    return normalizeText(value).split(/[、,，;；/|\n]+/).map((term) => term.trim()).filter((term) => term.length >= 2);
  }

  function textContainsTerm(text, term) {
    return aliasAppears(text, term) || normalizeText(text).includes(normalizeText(term));
  }

  function isOpsTarget(profile) {
    return /(?:sre|devops|运维|平台工程|云原生|可靠性|基础设施)/i.test(
      [profile && profile.target_roles, profile && profile.adjacent_roles].filter(Boolean).join(' ')
    );
  }

  function scoreDirection(job, profile, extracted) {
    const title = job && job.job_name || '';
    const allText = [title, job && job.description, Array.isArray(job && job.skills) ? job.skills.join(' ') : job && job.skills].join(' ');
    const targets = splitProfileTerms(profile && profile.target_roles);
    const adjacent = splitProfileTerms(profile && profile.adjacent_roles);
    const avoids = splitProfileTerms(profile && profile.avoid_work);
    let score = targets.length ? 8 : 15;
    const reasons = [];
    if (targets.some((term) => textContainsTerm(title, term))) {
      score = 30;
      reasons.push('职位名称明确属于目标方向');
    } else if (targets.some((term) => textContainsTerm(allText, term))) {
      score = 27;
      reasons.push('岗位职责明确包含目标方向');
    } else if (adjacent.some((term) => textContainsTerm(title, term))) {
      score = 23;
      reasons.push('职位属于可接受的相邻方向');
    } else if (adjacent.some((term) => textContainsTerm(allText, term))) {
      score = 20;
      reasons.push('岗位职责与相邻方向相关');
    } else if (isOpsTarget(profile)) {
      const ids = new Set(extracted.map((item) => item.id));
      const opsSignals = ['linux', 'shell-bash', 'docker', 'kubernetes', 'prometheus', 'grafana', 'jenkins', 'gitlab-ci', 'ansible', 'terraform', 'argo-cd', 'open-telemetry'];
      const signalCount = opsSignals.filter((id) => ids.has(id)).length;
      const responsibilitySignal = /(?:平台建设|自动化|持续集成|持续交付|ci\s*\/\s*cd|可靠性|稳定性|可观测性|容器编排)/i.test(allText);
      if (signalCount >= 3 && responsibilitySignal) {
        score = 24;
        reasons.push('标题不同，但职责与目标方向高度相关');
      } else if (signalCount >= 2) {
        score = 18;
        reasons.push('技术职责与目标方向存在关联');
      }
    }
    const avoidInTitle = avoids.some((term) => textContainsTerm(title, term));
    const avoidInBody = avoids.some((term) => textContainsTerm(allText, term));
    if (avoidInTitle || avoidInBody) {
      score -= avoidInTitle ? 18 : 10;
      reasons.push('岗位职责命中明确不想从事的工作');
    }
    return { score: Math.max(0, Math.min(DIMENSION_MAX.direction, score)), reasons };
  }

  function scoreSkills(extracted, candidateSkills) {
    if (!extracted.length) return { score: 12, matched: [], unmatched: [], reasons: ['JD 未识别到 Registry 中的明确技能，技能相关性证据有限'] };
    const candidate = new Map(candidateSkills.map((item) => [item.id, item.weight]));
    let total = 0;
    let covered = 0;
    const matched = [];
    const unmatched = [];
    extracted.forEach((item) => {
      const demandWeight = Math.max(...item.sources.map((source) => SOURCE_WEIGHTS[source] || 0));
      total += demandWeight;
      if (candidate.has(item.id)) {
        covered += demandWeight * candidate.get(item.id);
        matched.push(item.id);
      } else {
        unmatched.push(item.id);
      }
    });
    const score = total ? Math.round(DIMENSION_MAX.skills * covered / total) : 18;
    const ratio = total ? covered / total : 0;
    const reasons = [ratio >= 0.7 ? 'Candidate Profile 对 JD 技能覆盖较高'
      : ratio >= 0.4 ? 'Candidate Profile 对 JD 技能有部分覆盖'
        : 'Candidate Profile 中可确认的 JD 技能覆盖较低'];
    return { score, matched, unmatched, reasons };
  }

  function parseYears(value) {
    const text = normalizeText(value);
    if (!text) return null;
    if (/(?:应届|在校|经验不限|不限经验)/.test(text)) return 0;
    const range = text.match(/(\d+(?:\.\d+)?)\s*(?:-|~|至|到)\s*(\d+(?:\.\d+)?)\s*年/);
    if (range) return Math.min(Number(range[1]), Number(range[2]));
    const matches = Array.from(text.matchAll(/(\d+(?:\.\d+)?)\s*年/g)).map((match) => Number(match[1]));
    if (matches.length) return Math.min(...matches);
    const number = text.match(/\d+(?:\.\d+)?/);
    return number ? Number(number[0]) : null;
  }

  function scoreExperience(job, profile) {
    const candidateYears = parseYears(profile && profile.years_experience);
    const requiredYears = parseYears(job && job.experience);
    if (candidateYears == null || requiredYears == null) return { score: 8, reasons: ['工作年限无法可靠比较，按中性处理'] };
    const gap = requiredYears - candidateYears;
    if (gap <= 0) return { score: 15, reasons: ['工作年限达到 JD 明确要求'] };
    if (gap <= 1) return { score: 11, reasons: ['工作年限比 JD 要求少约 1 年'] };
    if (gap <= 2) return { score: 7, reasons: ['工作年限比 JD 要求少约 2 年'] };
    return { score: 3, reasons: ['工作年限与 JD 明确要求存在较大差距'] };
  }

  function parseSalary(value) {
    const text = normalizeText(value).replace(/,/g, '');
    if (!text || /面议|薪资不限/.test(text)) return null;
    const numbers = Array.from(text.matchAll(/(\d+(?:\.\d+)?)\s*([kw万千]?)/gi)).map((match) => {
      const unit = match[2].toLowerCase();
      const n = Number(match[1]);
      if (unit === 'w' || unit === '万') return n * 10;
      if (unit === '千') return n;
      return n >= 1000 ? n / 1000 : n;
    });
    if (!numbers.length) return null;
    return { min: numbers[0], max: numbers.length > 1 ? numbers[1] : numbers[0] };
  }

  function scoreSalary(jobSalary, profile) {
    const jd = parseSalary(jobSalary);
    const expected = parseSalary(profile && profile.expected_salary);
    const minimum = parseSalary(profile && profile.minimum_salary);
    if (!jd) return { score: 5, reasons: ['JD 薪资无法可靠解析，按中性处理'] };
    const expectedFloor = expected && expected.min;
    const minimumFloor = minimum && minimum.min;
    if (expectedFloor != null && jd.max >= expectedFloor) return { score: 10, reasons: ['JD 薪资覆盖期望范围'] };
    if (minimumFloor != null && jd.max >= minimumFloor * 1.15) return { score: 7, reasons: ['JD 薪资低于期望但高于最低接受范围'] };
    if (minimumFloor != null && jd.max >= minimumFloor) return { score: 4, reasons: ['JD 薪资接近最低接受范围'] };
    return { score: expectedFloor == null && minimumFloor == null ? 5 : 2, reasons: ['JD 薪资低于画像中的期望范围'] };
  }

  function explicitlyRejects(value) {
    return /^(?:不接受|否|no|false)$/i.test(normalizeText(value));
  }

  function positiveEvidence(text, regex) {
    const normalized = normalizeText(text);
    const match = regex.exec(normalized);
    if (!match) return false;
    return !NEGATIVE_PREFIX_RE.test(normalized.slice(Math.max(0, match.index - 5), match.index));
  }

  function hardStops(job, profile) {
    const text = [job && job.job_name, job && job.description, job && job.address].filter(Boolean).join(' ');
    const reasons = [];
    if (explicitlyRejects(profile && profile.accept_outsource) && positiveEvidence(text, /(?:外包岗位|外包项目|外包人员|人力外包|劳务外包|第三方外包|外派)/i)) {
      reasons.push('画像明确不接受外包，JD 明确为外包或外派');
    }
    if (explicitlyRejects(profile && profile.accept_onsite) && positiveEvidence(text, /(?:长期驻场|需驻场|驻场办公|客户现场驻场)/i)) {
      reasons.push('画像明确不接受驻场，JD 明确要求长期或固定驻场');
    }
    if (explicitlyRejects(profile && profile.accept_shift_or_oncall)
      && positiveEvidence(text, /(?:倒班|轮班|夜班|三班倒|长期\s*on[ -]?call|长期值班)/i)) {
      reasons.push('画像明确不接受倒班或长期 On-call，JD 有明确要求');
    }
    const targets = splitProfileTerms(profile && profile.target_cities);
    const city = normalizeText(job && job.city);
    if (targets.length && city && explicitlyRejects(profile && profile.accept_relocation)
      && !targets.some((target) => city.includes(target) || target.includes(city))) {
      reasons.push('画像不接受异地，JD 城市不在目标城市中');
    }
    const jdSalary = parseSalary(job && job.salary);
    const minimum = parseSalary(profile && profile.minimum_salary);
    if (jdSalary && minimum && jdSalary.max < minimum.min) {
      reasons.push('JD 最高薪资低于最低可接受薪资');
    }
    return reasons;
  }

  function scorePreference(job, profile) {
    let score = 5;
    const reasons = [];
    const targets = splitProfileTerms(profile && profile.target_cities);
    const city = normalizeText(job && job.city);
    if (targets.length && city && targets.some((target) => city.includes(target) || target.includes(city))) {
      score += 3;
      reasons.push('岗位城市符合目标城市');
    } else if (targets.length && city) {
      score -= 2;
      reasons.push('岗位城市不在目标城市中');
    }
    const text = [job && job.job_name, job && job.description].filter(Boolean).join(' ');
    if (explicitlyRejects(profile && profile.accept_outsource) && /外包|外派/i.test(text)) score -= 1;
    if (explicitlyRejects(profile && profile.accept_onsite) && /驻场/i.test(text)) score -= 1;
    if (explicitlyRejects(profile && profile.accept_shift_or_oncall) && /值班|on[ -]?call/i.test(text)) score -= 1;
    if (!reasons.length) reasons.push('工作方式信息不完整，偏好维度按中性处理');
    return { score: Math.max(0, Math.min(DIMENSION_MAX.preference, score)), reasons };
  }

  function statusFor(score, hardStop) {
    if (hardStop) return 'rejected';
    if (score >= MATCH_THRESHOLDS.autoSelect) return 'high_match';
    if (score >= MATCH_THRESHOLDS.candidate) return 'candidate';
    return 'low_match';
  }

  function matchJob(job, profile, registry) {
    const extracted = extractJobSkills(job || {}, registry);
    if (!hasSufficientCandidateProfile(profile)) {
      return {
        version: MATCH_VERSION,
        score: null,
        status: 'profile_missing',
        hardStop: false,
        hardStopReasons: [],
        dimensions: {
          direction: null,
          skills: null,
          experience: null,
          salary: null,
          preference: null,
        },
        skillEvidence: extracted,
        matchedSkills: [],
        unmatchedDemandSkills: [],
        reasons: ['求职画像信息不足，未进行本地匹配评分'],
        autoSelected: false,
      };
    }
    const candidateSkills = normalizeCandidateSkills(profile || {}, registry);
    const stops = hardStops(job || {}, profile || {});
    const direction = scoreDirection(job || {}, profile || {}, extracted);
    const skills = scoreSkills(extracted, candidateSkills);
    const experience = scoreExperience(job || {}, profile || {});
    const salary = scoreSalary(job && job.salary, profile || {});
    const preference = scorePreference(job || {}, profile || {});
    const dimensions = {
      direction: direction.score,
      skills: skills.score,
      experience: experience.score,
      salary: salary.score,
      preference: preference.score,
    };
    const score = Object.values(dimensions).reduce((sum, value) => sum + value, 0);
    const hardStop = stops.length > 0;
    const status = statusFor(score, hardStop);
    return {
      version: MATCH_VERSION,
      score,
      status,
      hardStop,
      hardStopReasons: stops,
      dimensions,
      skillEvidence: extracted,
      matchedSkills: skills.matched,
      unmatchedDemandSkills: skills.unmatched,
      reasons: direction.reasons.concat(skills.reasons, experience.reasons, salary.reasons, preference.reasons).slice(0, 8),
      autoSelected: !hardStop && score >= MATCH_THRESHOLDS.autoSelect,
    };
  }

  function buildStructuredSkillDemand(jobs, registry) {
    const list = Array.isArray(jobs) ? jobs : [];
    const counts = new Map();
    list.forEach((job) => {
      const ids = new Set(extractJobSkills(job, registry).map((item) => item.id));
      ids.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
    });
    const byId = new Map(registrySkills(registry).map((skill) => [skill.id, skill]));
    return {
      version: 1,
      sampleCount: list.length,
      skills: Array.from(counts.entries()).map(([id, count]) => ({
        id,
        name: byId.has(id) ? byId.get(id).name : id,
        count,
        ratio: list.length ? Number((count / list.length).toFixed(3)) : 0,
      })).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id)),
    };
  }

  function buildRoadmapSkillContext(demand, profile, registry) {
    const byId = new Map(registrySkills(registry).map((skill) => [skill.id, skill]));
    const candidate = new Map(normalizeCandidateSkills(profile || {}, registry).map((item) => [item.id, item.field]));
    function explicitLevelFor(id) {
      const values = Object.keys(CANDIDATE_WEIGHTS).map((field) => profile && profile[field]).filter(Boolean);
      for (const value of values) {
        const fragments = String(value).split(/[、,，;；|\n]+/);
        for (const fragment of fragments) {
          if (matchSkillIds(fragment, registry).includes(id)) {
            const match = fragment.match(/(?:^|[^a-z0-9])(L[0-4])(?=$|[^a-z0-9])/i);
            if (match) return match[1].toUpperCase();
          }
        }
      }
      return 'unknown';
    }
    return (demand && demand.skills || []).map((item) => {
      const skill = byId.get(item.id) || {};
      return {
        id: item.id,
        name: skill.name || item.name || item.id,
        demand_count: item.count,
        demand_ratio: item.ratio,
        candidate_profile_bucket: candidate.get(item.id) || 'not_listed',
        candidate_level: explicitLevelFor(item.id),
        entry_target: skill.entry_target || registry.defaults && registry.defaults.entry_target || 'L2',
        growth_target: skill.growth_target || registry.defaults && registry.defaults.growth_target || 'L2',
        baseline_candidate: Boolean(skill.baseline_candidate),
        category: skill.category || 'unknown',
        entity_kind: skill.entity_kind || 'unknown',
        roadmap_ref: skill.roadmap_ref || null,
      };
    });
  }

  const api = {
    MATCH_VERSION,
    MATCH_THRESHOLDS,
    DIMENSION_MAX,
    normalizeText,
    hasSufficientCandidateProfile,
    matchSkillIds,
    extractJobSkills,
    normalizeCandidateSkills,
    parseYears,
    parseSalary,
    matchJob,
    buildStructuredSkillDemand,
    buildRoadmapSkillContext,
  };
  global.LocalJobMatcher = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
