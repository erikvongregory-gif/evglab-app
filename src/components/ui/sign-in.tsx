"use client";

import Link from "next/link";
import React, { useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff } from "lucide-react";

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 48 48" aria-hidden>
    <path
      fill="#FFC107"
      d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s12-5.373 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z"
    />
    <path
      fill="#FF3D00"
      d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
    />
    <path
      fill="#4CAF50"
      d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
    />
    <path
      fill="#1976D2"
      d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z"
    />
  </svg>
);

export interface Testimonial {
  avatarSrc: string;
  name: string;
  handle: string;
  text: string;
}

export interface SignInPageProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  heroImageSrc?: string;
  testimonials?: Testimonial[];
  /** POST-Ziel für E-Mail/Passwort (Standard `/auth/signin`). Wird ignoriert, wenn `onSignIn` gesetzt ist. */
  authPostAction?: string;
  /** Wert für verstecktes Feld `next` */
  nextPath?: string;
  showGoogle?: boolean;
  googleNextPath?: string;
  registerHref?: string;
  resetPasswordHref?: string;
  feedbackNotice?: React.ReactNode;
  feedbackError?: React.ReactNode;
  onSignIn?: (event: React.FormEvent<HTMLFormElement>) => void;
  onGoogleSignIn?: () => void;
  onResetPassword?: () => void;
  onCreateAccount?: () => void;
}

function GlassInputWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-sm transition-colors focus-within:border-[#c65a20]/55 focus-within:bg-[#c65a20]/[0.07] dark:focus-within:border-[#e07a40]/50">
      {children}
    </div>
  );
}

function TestimonialCard({ testimonial, delay }: { testimonial: Testimonial; delay: string }) {
  return (
    <div
      className={`animate-testimonial ${delay} flex w-64 items-start gap-3 rounded-3xl border border-white/10 bg-card/40 p-5 backdrop-blur-xl dark:bg-zinc-800/40`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- externe Demo-Avatare */}
      <img src={testimonial.avatarSrc} className="h-10 w-10 rounded-2xl object-cover" alt="" />
      <div className="text-sm leading-snug">
        <p className="flex items-center gap-1 font-medium">{testimonial.name}</p>
        <p className="text-muted-foreground">{testimonial.handle}</p>
        <p className="mt-1 text-foreground/80">{testimonial.text}</p>
      </div>
    </div>
  );
}

function SignInSubmitInner({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="animate-element animate-delay-600 w-full rounded-2xl bg-[#c65a20] py-4 font-medium text-white transition-colors hover:bg-[#b14f1c] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Wird angemeldet …" : label}
    </button>
  );
}

const DEFAULT_HERO =
  "https://images.unsplash.com/photo-1642615835477-d303d7dc9ee9?w=2160&q=80&auto=format&fit=crop";

const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    avatarSrc: "https://randomuser.me/api/portraits/women/57.jpg",
    name: "Anna M.",
    handle: "Brauhaus Süd",
    text: "KI-Bilder und Posts sparen uns jede Woche Stunden – alles aus einem Dashboard.",
  },
  {
    avatarSrc: "https://randomuser.me/api/portraits/men/64.jpg",
    name: "Jonas K.",
    handle: "@wildbräu",
    text: "Sauberes Onboarding, klare Oberfläche. Genau das, was wir als kleine Brauerei brauchen.",
  },
  {
    avatarSrc: "https://randomuser.me/api/portraits/men/32.jpg",
    name: "Lea T.",
    handle: "Gasthaus am Markt",
    text: "Bewertungen und Social laufen stabiler seit wir mit EvGlab arbeiten.",
  },
];

export const SignInPage: React.FC<SignInPageProps> = ({
  title = <span className="font-light tracking-tighter text-foreground">Willkommen zurück</span>,
  description = "Melde dich an und weiter im Dashboard mit KI-Content für deine Brauerei.",
  heroImageSrc = DEFAULT_HERO,
  testimonials = DEFAULT_TESTIMONIALS,
  authPostAction,
  nextPath = "/dashboard",
  showGoogle = true,
  googleNextPath,
  registerHref = "/registrieren",
  resetPasswordHref = "/registrieren",
  feedbackNotice,
  feedbackError,
  onSignIn,
  onGoogleSignIn,
  onResetPassword,
  onCreateAccount,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const googleHref = `/auth/google?next=${encodeURIComponent(googleNextPath ?? nextPath)}`;
  const postTarget = authPostAction ?? "/auth/signin";

  const formProps = onSignIn
    ? { onSubmit: onSignIn }
    : {
        action: postTarget,
        method: "post" as const,
      };

  return (
    <div className="flex h-[100dvh] w-[100dvw] flex-col font-sans md:flex-row">
      <section className="flex flex-1 items-center justify-center overflow-y-auto p-8">
        <div className="w-full max-w-md">
          <div className="flex flex-col gap-6">
            <h1 className="animate-element animate-delay-100 text-4xl font-semibold leading-tight md:text-5xl">{title}</h1>
            <p className="animate-element animate-delay-200 text-muted-foreground">{description}</p>

            {feedbackNotice ? (
              <div
                className="animate-element animate-delay-240 rounded-2xl border border-emerald-200/80 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-900/25 dark:text-emerald-100"
                role="status"
              >
                {feedbackNotice}
              </div>
            ) : null}

            {feedbackError ? (
              <div
                className="animate-element animate-delay-240 rounded-2xl border border-red-200/90 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
                role="alert"
              >
                {feedbackError}
              </div>
            ) : null}

            <form className="space-y-5" {...formProps}>
              <input type="hidden" name="next" value={nextPath} />
              <div className="animate-element animate-delay-300">
                <label className="text-sm font-medium text-muted-foreground">E-Mail</label>
                <GlassInputWrapper>
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="name@brauerei.de"
                    className="w-full rounded-2xl bg-transparent p-4 text-sm focus:outline-none"
                  />
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-400">
                <label className="text-sm font-medium text-muted-foreground">Passwort</label>
                <GlassInputWrapper>
                  <div className="relative">
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      placeholder="Dein Passwort"
                      className="w-full rounded-2xl bg-transparent p-4 pr-12 text-sm focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-3 flex items-center"
                      aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 text-muted-foreground transition-colors hover:text-foreground" />
                      ) : (
                        <Eye className="h-5 w-5 text-muted-foreground transition-colors hover:text-foreground" />
                      )}
                    </button>
                  </div>
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-500 flex flex-wrap items-center justify-between gap-2 text-sm">
                <label className="flex cursor-pointer items-center gap-3">
                  <input type="checkbox" name="rememberMe" className="size-4 rounded border border-input accent-[#c65a20]" />
                  <span className="text-foreground/90">Angemeldet bleiben</span>
                </label>
                {onResetPassword ? (
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      onResetPassword?.();
                    }}
                    className="text-[#c65a20] transition-colors hover:underline"
                  >
                    Passwort vergessen?
                  </a>
                ) : (
                  <Link href={resetPasswordHref} className="text-[#c65a20] transition-colors hover:underline">
                    Passwort vergessen?
                  </Link>
                )}
              </div>

              <SignInSubmitInner label="Anmelden" />
            </form>

            {showGoogle ? (
              <>
                <div className="animate-element animate-delay-700 relative flex items-center justify-center">
                  <span className="w-full border-t border-border" />
                  <span className="absolute bg-background px-4 text-sm text-muted-foreground">Oder weiter mit</span>
                </div>

                {onGoogleSignIn ? (
                  <button
                    type="button"
                    onClick={onGoogleSignIn}
                    className="animate-element animate-delay-800 flex w-full items-center justify-center gap-3 rounded-2xl border border-border py-4 transition-colors hover:bg-secondary"
                  >
                    <GoogleIcon />
                    Google
                  </button>
                ) : (
                  <Link
                    href={googleHref}
                    className="animate-element animate-delay-800 flex w-full items-center justify-center gap-3 rounded-2xl border border-border py-4 transition-colors hover:bg-secondary"
                  >
                    <GoogleIcon />
                    Mit Google anmelden
                  </Link>
                )}
              </>
            ) : null}

            <p className="animate-element animate-delay-900 text-center text-sm text-muted-foreground">
              Neu bei EvGlab?{" "}
              {onCreateAccount ? (
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onCreateAccount?.();
                  }}
                  className="text-[#c65a20] transition-colors hover:underline"
                >
                  Registrierung (Einladung)
                </a>
              ) : (
                <Link href={registerHref} className="text-[#c65a20] transition-colors hover:underline">
                  Registrierung (Einladung)
                </Link>
              )}
            </p>
          </div>
        </div>
      </section>

      {heroImageSrc ? (
        <section className="relative hidden flex-1 p-4 md:block">
          <div
            className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl bg-cover bg-center shadow-inner dark:shadow-black/40"
            style={{ backgroundImage: `url(${heroImageSrc})` }}
          />
          {testimonials.length > 0 ? (
            <div className="absolute bottom-8 left-1/2 flex w-full -translate-x-1/2 justify-center gap-4 px-8">
              <TestimonialCard testimonial={testimonials[0]!} delay="animate-delay-1000" />
              {testimonials[1] ? (
                <div className="hidden xl:flex">
                  <TestimonialCard testimonial={testimonials[1]} delay="animate-delay-1200" />
                </div>
              ) : null}
              {testimonials[2] ? (
                <div className="hidden 2xl:flex">
                  <TestimonialCard testimonial={testimonials[2]} delay="animate-delay-1400" />
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
};
