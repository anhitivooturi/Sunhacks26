// Flip VITE_USE_MOCK in web/.env to talk to the real server. ?mock=1 / ?mock=0 in the URL overrides it.
const params = new URLSearchParams(window.location.search);
export const USE_MOCK = params.has('mock') ? params.get('mock') !== '0' : import.meta.env.VITE_USE_MOCK !== 'false';
