"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, AtSign, Eye, EyeOff, LockKeyhole, Mail, MoveUpRight, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Logo } from "./loop-ui";

export default function AuthForm({ signup }: { signup: boolean }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const res = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, action: signup ? "signup" : "login" }) });
      const info = await res.json();
      if (!res.ok) throw new Error(info.error || "Couldn’t access your account.");
      // Reload the page to discard the guest router cache after the cookie changes.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    } catch (err) { setError(err instanceof Error ? err.message : "Please try again."); setBusy(false); }
  }
  return <main className="auth-shell">
    <section className="auth-art" aria-label="Loop community"><div className="auth-art-brand"><Logo /></div><div className="auth-art-content"><span className="auth-kicker"><span /> A little closer, every day</span><h2>Good things happen<br />in the <em>loop.</em></h2><p>Share the little moments, meet your people, and make the internet feel a little more human.</p><div className="auth-art-tag"><MoveUpRight size={16} /> The Dolomites <span>·</span> Shared on Loop</div></div></section>
    <section className="auth-side"><div className="auth-mobile-brand"><Logo /></div><div className="auth-content">
      <Link className="back-link" href="/"><ArrowLeft size={17} /> Back to feed</Link>
      <div className="auth-heading"><span className="auth-eyebrow">{signup ? "FIND YOUR PEOPLE" : "BACK IN THE LOOP"}</span><h1>{signup ? "Create your account" : "Welcome back"}</h1><p>{signup ? "A place for your people and your everyday moments." : "Sign in to pick up where you left off."}</p></div>
      <form onSubmit={submit} className="auth-form">
        {signup && <><label>Display name<span className="auth-input"><UserRound size={17}/><input name="name" autoComplete="name" placeholder="Alex Morgan" minLength={2} maxLength={48} required /></span></label><label>Username<span className="auth-input"><AtSign size={17}/><input name="handle" autoComplete="username" placeholder="alexmorgan" autoCapitalize="none" spellCheck={false} minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" required /></span></label></>}
        <label>Email address<span className="auth-input"><Mail size={17}/><input type="email" name="email" autoComplete="email" placeholder="you@example.com" maxLength={254} required /></span></label>
        <label>Password<span className="auth-input"><LockKeyhole size={17}/><input name="password" type={show ? "text" : "password"} placeholder={signup ? "At least 8 characters" : "Enter your password"} autoComplete={signup ? "new-password" : "current-password"} minLength={signup ? 8 : undefined} maxLength={128} required /><button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button full-button auth-submit" disabled={busy}>{busy ? "Just a moment…" : signup ? "Create account" : "Sign in"}<ArrowRight size={18} /></button>
      </form>
      <p className="auth-switch">{signup ? "Already on Loop?" : "New to Loop?"} <Link href={signup ? "/login" : "/signup"}>{signup ? "Sign in" : "Create an account"}</Link></p>
    </div><p className="auth-copyright">© {new Date().getFullYear()} Loop</p></section>
  </main>;
}
