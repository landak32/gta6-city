// Perfil persistence: money, story progress and the statistics page survive a reload through
// localStorage. Everything is wrapped, because a browser with storage disabled must still play.

const KEY = 'vice-harbor-save-v1';

export function loadProgress() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch {
    return null;
  }
}

export function saveProgress(profile) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

export function clearProgress() {
  try {
    window.localStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}

export function hasProgress() {
  const data = loadProgress();
  return Boolean(data && typeof data.missionsDone === 'number');
}
