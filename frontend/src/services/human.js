// Holds the answer to the current "I am not a robot" question. api.js attaches it to the
// requests that need it (login, register, certificate verification) and then clears it.
let state = { token: '', answer: '' };
export const setHuman = (token, answer) => { state = { token, answer }; };
export const takeHuman = () => {
  const s = state;
  state = { token: '', answer: '' };
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('human:used'));
  return s;
};
export const HUMAN_URLS = ['/auth/login', '/auth/register', '/certificates/verify/'];
