(function initSkillRegistry(global) {
  let registryPromise = null;

  function validateRegistry(registry) {
    if (!registry || registry.schema !== 'skill-registry' || !Array.isArray(registry.skills)) {
      throw new Error('Skill Registry 格式无效');
    }
    return registry;
  }

  function load() {
    if (!registryPromise) {
      const url = global.chrome && global.chrome.runtime && global.chrome.runtime.getURL
        ? global.chrome.runtime.getURL('data/skill-registry.json')
        : 'data/skill-registry.json';
      registryPromise = fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error('无法加载 Skill Registry：HTTP ' + response.status);
          return response.json();
        })
        .then(validateRegistry)
        .catch((error) => {
          registryPromise = null;
          throw error;
        });
    }
    return registryPromise;
  }

  const api = { load, validateRegistry };
  global.SkillRegistry = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
