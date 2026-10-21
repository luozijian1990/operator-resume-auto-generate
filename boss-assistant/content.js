(() => {
  const DETAIL_URL_RE = /\/detail\.json/i;
  const fetched = new Set();

  function send(action, extra) {
    try {
      chrome.runtime.sendMessage(Object.assign({ action }, extra || {}));
    } catch (e) {}
  }

  function isDetailUrl(url) {
    return typeof url === 'string' && DETAIL_URL_RE.test(url);
  }

  function sha256Hex(str) {
    const data = new TextEncoder().encode(str);
    return crypto.subtle.digest('SHA-256', data).then((buf) => {
      const bytes = Array.from(new Uint8Array(buf));
      return bytes.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 20);
    });
  }

  async function buildRecord(json) {
    const zp = json && json.zpData;
    if (!zp) return null;
    const job = zp.jobInfo || {};
    const brand = zp.brandComInfo || {};
    const boss = zp.bossInfo || {};
    const encryptId = job.encryptId || job.encryptJobId || '';
    if (!encryptId) return null;
    const job_hash = await sha256Hex('analyze-job-market:v1:' + encryptId);
    return {
      job_hash,
      job_name: job.jobName || '',
      city: job.locationName || job.cityName || '',
      district: job.areaDistrict || '',
      business_district: job.businessDistrict || '',
      salary: job.salaryDesc || '',
      experience: job.experienceName || job.jobExperience || '',
      degree: job.degreeName || job.jobDegree || '',
      industry: brand.industryName || brand.industry || '',
      company_name: brand.brandName || '',
      company_scale: brand.scaleName || '',
      company_stage: brand.stageName || '',
      skills: Array.isArray(job.showSkills) ? job.showSkills.slice()
        : (Array.isArray(job.skills) ? job.skills.slice() : []),
      welfare: Array.isArray(brand.labels) ? brand.labels.slice() : [],
      description: job.postDescription || '',
      has_detail: Boolean(job.postDescription),
      address: job.address || '',
      boss_title: boss.title || '',
      brand_introduce: brand.introduce || '',
      captured_at: new Date().toISOString(),
    };
  }

  function saveRecord(record) {
    try {
      send('saveJob', { record });
    } catch (e) {}
  }

  function handleDetail(json) {
    buildRecord(json).then((record) => {
      if (record) saveRecord(record);
    });
  }

  function maybeCapture(url) {
    if (!isDetailUrl(url)) return;
    if (fetched.has(url)) return;
    fetched.add(url);
    fetch(url, { credentials: 'include' })
      .then((r) => r.json())
      .then(handleDetail)
      .catch(() => {});
  }

  function scanResources() {
    try {
      const entries = performance.getEntriesByType('resource') || [];
      const recent = entries.slice(-30);
      for (const e of recent) maybeCapture(e.name);
    } catch (e) {}
  }

  const observer = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) maybeCapture(e.name);
  });
  try {
    observer.observe({ entryTypes: ['resource'] });
  } catch (e) {}

  scanResources();
  setInterval(scanResources, 1500);
})();
