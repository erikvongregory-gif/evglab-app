/** Shared by the React fallback and standalone OAuth response (no asset requests). */
export const authTransitionCss = `
.auth-transition{box-sizing:border-box;min-height:100vh;min-height:100dvh;display:grid;place-items:center;padding:32px;background:#131211;color:#f4f0eb;font-family:Arial,sans-serif;text-align:center}
.auth-transition-brand{display:flex;align-items:center;justify-content:center;gap:12px;font-size:28px;font-weight:600;letter-spacing:-1px}
.auth-transition-message{margin:28px 0 0;color:#c4bdb3;font-size:14px;line-height:1.6}
.auth-transition-track{width:96px;height:2px;margin:24px auto 0;background:#36302b;overflow:hidden;border-radius:2px}
.auth-transition-track:after{content:"";display:block;width:40%;height:100%;background:#e89259;animation:auth-transition-progress 1.6s ease-in-out infinite}
@keyframes auth-transition-progress{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}
@media(prefers-reduced-motion:reduce){.auth-transition-track:after{animation:none;width:100%;opacity:.65}}
`;

export const authTransitionBody = `<main class="auth-transition"><div><div class="auth-transition-brand"><svg width="44" height="44" viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M4 22 Q10 12 16 20 T24 16" stroke="#E89259" stroke-width="1.6" stroke-linecap="round" opacity=".55"/><path d="M2 18 Q7 6 14 14 T26 10" stroke="#C7691E" stroke-width="2.2" stroke-linecap="round"/></svg><span>BrewAI</span></div><p class="auth-transition-message" role="status">Dein Studio wird vorbereitet …</p><div class="auth-transition-track" aria-hidden="true"></div></div></main>`;
