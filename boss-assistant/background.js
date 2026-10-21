const KEY_PREFIX = 'jobs:';
const REC_PREFIX = 'recording:';

function enableSidePanelOnActionClick() {
  try {
    const p = chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (e) {}
}

chrome.runtime.onInstalled.addListener(enableSidePanelOnActionClick);
enableSidePanelOnActionClick();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveJob') {
    const tabId = sender.tab ? sender.tab.id : null;
    if (tabId == null || !request.record) {
      sendResponse({ ok: false });
      return;
    }
    saveJob(tabId, request.record).then((result) => sendResponse(result));
    return true;
  }
});

async function saveJob(tabId, record) {
  const jobsKey = KEY_PREFIX + tabId;
  const recKey = REC_PREFIX + tabId;
  const data = await chrome.storage.local.get([jobsKey, recKey]);
  const recording = data[recKey] === true;
  if (!recording) {
    return { ok: true, skipped: true };
  }
  const jobs = data[jobsKey] || {};
  const existing = jobs[record.job_hash];
  const now = record.captured_at || new Date().toISOString();
  if (existing) {
    jobs[record.job_hash] = {
      ...existing,
      ...record,
      captured_at: existing.captured_at || now,
      last_viewed_at: now,
    };
  } else {
    jobs[record.job_hash] = { ...record, last_viewed_at: now };
  }
  await chrome.storage.local.set({ [jobsKey]: jobs });
  return { ok: true, saved: true };
}

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove([KEY_PREFIX + tabId, REC_PREFIX + tabId]);
});
