export function createJoinUrl(code, baseUrl) {
  if (!/^[A-HJKMNP-Z]{4}$/.test(code)) throw new Error('The server returned an invalid class code. Try starting the class again.');
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('Invalid public join URL configuration.');
  return new URL(`/j/${code}`, base.origin).href;
}
