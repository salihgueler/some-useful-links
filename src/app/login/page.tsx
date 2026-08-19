import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/SignInForm";
import { LogoMark } from "@/components/layout/LogoMark";
// The allowlist is imported from the module that ENFORCES it, so the copy shown
// to users cannot drift from the copy that gates sign-up. eligibility.ts is
// dependency-free, so this pulls no backend code into the page bundle.
import { ALLOWED_EMAIL_DOMAINS } from "@blocks/eligibility";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  if (await getSession()) redirect("/admin");

  return (
    <main className="status-page">
      <section className="status-card motion-safe:animate-fade-up">
        <LogoMark size="large" />
      <p className="status-eyebrow">Some Useful Links</p>
      <SignInForm domains={ALLOWED_EMAIL_DOMAINS} />
      </section>
    </main>
  );
}
