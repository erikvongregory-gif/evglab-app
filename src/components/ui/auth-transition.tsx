import { EvglabMark } from "@/components/studio/evglab-mark";
import { authTransitionCss } from "@/lib/auth/transition-design";

export function AuthTransition({ message = "Dein Studio wird vorbereitet …" }: { message?: string }) {
  return (
    <main className="auth-transition">
      <style>{authTransitionCss}</style>
      <div>
        <div className="auth-transition-brand"><EvglabMark size={44} /><span>BrewAI</span></div>
        <p className="auth-transition-message" role="status">{message}</p>
        <div className="auth-transition-track" aria-hidden="true" />
      </div>
    </main>
  );
}
