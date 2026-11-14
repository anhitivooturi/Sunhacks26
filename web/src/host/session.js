// Remember session info (code, join URL, QR) per session id so a refresh doesn't lose it.
export const saveSession = (s) => {
  try {
    sessionStorage.setItem(`pulse-session-${s.id}`, JSON.stringify(s));
    localStorage.setItem(`pulse-session-${s.id}`, JSON.stringify(s));
  } catch { /* ignore */ }
};
export const loadSession = (id) => {
  try {
    return JSON.parse(sessionStorage.getItem(`pulse-session-${id}`) || localStorage.getItem(`pulse-session-${id}`) || 'null');
  } catch {
    return null;
  }
};
