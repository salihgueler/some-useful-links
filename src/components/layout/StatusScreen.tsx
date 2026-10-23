import type { ReactNode } from "react";
import { LogoMark } from "@/components/layout/LogoMark";

interface StatusScreenProps {
  /** Short status label, for example "404". Announced as "Error 404". */
  code: string;
  title: string;
  description: string;
  /** Optional actions such as a retry button or a link home. */
  children?: ReactNode;
  /**
   * Opaque support reference (Next.js error digest). Safe to display: it
   * carries no message text, stack, or server path.
   */
  reference?: string;
}

/**
 * Full-screen status surface shared by the 404 and error boundaries so every
 * failure state keeps the visitor page's visual language.
 */
export function StatusScreen({
  code,
  title,
  description,
  children,
  reference,
}: StatusScreenProps) {
  return (
    <main className="status-page">
      <section className="status-card motion-safe:animate-fade-up">
        <LogoMark size="large" />
        <p className="status-eyebrow">Some Useful Links</p>
        <p className="status-code">
          <span className="sr-only">Error </span>
          {code}
        </p>
        <h1>{title}</h1>
        <p className="status-description">{description}</p>
        {children ? <div className="status-actions">{children}</div> : null}
        {reference ? (
          <p className="status-reference">
            Support reference <code>{reference}</code>
          </p>
        ) : null}
      </section>
    </main>
  );
}
