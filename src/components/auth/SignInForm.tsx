"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { rpc } from "@/lib/auth/rpc";

type Mode = "signIn" | "signUp" | "confirm";

export function SignInForm({ domains }: { domains: readonly string[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const heading =
    mode === "signUp" ? "Create an account" : mode === "confirm" ? "Confirm your email" : "Sign in";
  const description =
    mode === "confirm"
      ? `Enter the code sent to ${email}.`
      : `Accounts are limited to Amazon corporate email addresses (${domains.join(", ")}). Public link pages stay readable by everyone.`;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signUp") {
        await rpc("signUp", [email, password]);
        setMode("confirm");
      } else if (mode === "confirm") {
        await rpc("confirmSignUp", [email, code]);
        setMode("signIn");
      } else {
        const result = await rpc<{ status?: string }>("signIn", [email, password]);
        if (result?.status === "signedIn") {
          router.replace("/admin");
          router.refresh();
        } else {
          // A challenge (for example TOTP) needs a dedicated step; surface it
          // rather than pretending the sign-in succeeded.
          setError("Additional verification is required for this account.");
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1>{heading}</h1>
      <p className="status-description">{description}</p>
      <form className="auth-form" onSubmit={submit}>
      <label className="field">
        <span>Work email</span>
        <input
          autoComplete="username"
          disabled={busy}
          onChange={(e) => setEmail(e.target.value)}
          required
          type="email"
          value={email}
        />
      </label>

      {mode === "confirm" ? (
        <label className="field">
          <span>Confirmation code</span>
          <input
            autoComplete="one-time-code"
            disabled={busy}
            inputMode="numeric"
            onChange={(e) => setCode(e.target.value)}
            required
            value={code}
          />
        </label>
      ) : (
        <label className="field">
          <span>Password</span>
          <input
            autoComplete={mode === "signUp" ? "new-password" : "current-password"}
            disabled={busy}
            minLength={12}
            onChange={(e) => setPassword(e.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
      )}

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <button className="status-action" disabled={busy} type="submit">
        {busy
          ? "Working..."
          : mode === "signUp"
            ? "Create account"
            : mode === "confirm"
              ? "Confirm email"
              : "Sign in"}
      </button>

      <button
        className="auth-switch"
        onClick={() => {
          setError(null);
          setMode(mode === "signIn" ? "signUp" : "signIn");
        }}
        type="button"
      >
        {mode === "signIn" ? "Create an account" : "I already have an account"}
      </button>
    </form>
    </>
  );
}
