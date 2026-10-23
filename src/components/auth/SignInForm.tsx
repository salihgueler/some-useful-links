"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { rpc } from "@/lib/auth/rpc";

type Mode = "signIn" | "signUp" | "confirm" | "reset" | "resetConfirm";

const HEADINGS: Record<Mode, string> = {
  signIn: "Sign in",
  signUp: "Create an account",
  confirm: "Confirm your email",
  reset: "Reset your password",
  resetConfirm: "Choose a new password",
};

const ACTIONS: Record<Mode, string> = {
  signIn: "Sign in",
  signUp: "Create account",
  confirm: "Confirm email",
  reset: "Send reset code",
  resetConfirm: "Set new password",
};

export function SignInForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const showCode = mode === "confirm" || mode === "resetConfirm";
  // No password field while confirming a sign-up: the one just chosen is still
  // in state and is used to open the session automatically.
  const showPassword = mode === "signIn" || mode === "signUp" || mode === "resetConfirm";

  const description = () => {
    switch (mode) {
      case "confirm":
        return `Enter the code sent to ${email}.`;
      case "reset":
        return "We will email you a code to set a new password.";
      case "resetConfirm":
        return `Enter the code sent to ${email} and choose a new password.`;
      default:
        return "Anyone with an email address can create an account. Public link pages stay readable by everyone.";
    }
  };

  const go = (next: Mode) => {
    setError(null);
    setNotice(null);
    setCode("");
    setMode(next);
  };

  /**
   * Exchanges credentials for a session and lands the owner in the admin area.
   *
   * Shared by sign-in, sign-up confirmation and password reset, so an account
   * that has just been confirmed or recovered follows exactly the same path as
   * a returning one instead of being bounced back to a form.
   */
  const startSession = async (secret: string) => {
    const result = await rpc<{ status?: string }>("signIn", [email, secret]);
    if (result?.status !== "signedIn") {
      // A challenge (for example TOTP) needs a dedicated step; surface it
      // rather than pretending the sign-in succeeded.
      setError("Additional verification is required for this account.");
      return;
    }
    router.replace("/admin");
    router.refresh();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "signUp") {
        await rpc("signUp", [email, password]);
        setMode("confirm");
        setNotice(`We sent a confirmation code to ${email}.`);
      } else if (mode === "confirm") {
        await rpc("confirmSignUp", [email, code]);
        if (password) {
          await startSession(password);
        } else {
          // The page was reloaded mid-flow, so the chosen password is gone.
          // The account IS confirmed; ask for it rather than failing opaquely.
          go("signIn");
          setNotice("Your email is confirmed. Sign in to continue.");
        }
      } else if (mode === "reset") {
        await rpc("resetPassword", [email]);
        setMode("resetConfirm");
        // Unconditional by design: the backend does not disclose whether the
        // address has an account, and this copy must not either.
        setNotice(`If ${email} has an account, a reset code is on its way.`);
      } else if (mode === "resetConfirm") {
        await rpc("confirmResetPassword", [email, code, password]);
        await startSession(password);
      } else {
        await startSession(password);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1>{HEADINGS[mode]}</h1>
      <p className="status-description">{description()}</p>
      <form className="auth-form" onSubmit={submit}>
        <label className="field">
          <span>Email</span>
          <input
            autoComplete="username"
            disabled={busy || showCode}
            onChange={(e) => setEmail(e.target.value)}
            required
            type="email"
            value={email}
          />
        </label>

        {showCode ? (
          <label className="field">
            <span>{mode === "confirm" ? "Confirmation code" : "Reset code"}</span>
            <input
              autoComplete="one-time-code"
              disabled={busy}
              inputMode="numeric"
              onChange={(e) => setCode(e.target.value)}
              required
              value={code}
            />
          </label>
        ) : null}

        {showPassword ? (
          <label className="field">
            <span>{mode === "resetConfirm" ? "New password" : "Password"}</span>
            <input
              autoComplete={mode === "signIn" ? "current-password" : "new-password"}
              disabled={busy}
              minLength={12}
              onChange={(e) => setPassword(e.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
        ) : null}

        {notice ? <p className="form-notice">{notice}</p> : null}

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <button className="status-action" disabled={busy} type="submit">
          {busy ? "Working..." : ACTIONS[mode]}
        </button>

        {mode === "signIn" ? (
          <button className="auth-switch" onClick={() => go("reset")} type="button">
            Forgot your password?
          </button>
        ) : null}

        <button
          className="auth-switch"
          onClick={() => go(mode === "signIn" ? "signUp" : "signIn")}
          type="button"
        >
          {mode === "signIn" ? "Create an account" : "Back to sign in"}
        </button>
      </form>
    </>
  );
}
