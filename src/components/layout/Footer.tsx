/**
 * Visitor-facing footer.
 *
 * The attribution is a real link rather than plain text: "salih.dev" reads as a
 * destination, so making it non-clickable would be a small broken promise.
 */
export function Footer() {
  return (
    <footer className="visitor-footer">
      <p>
        Built by Salih Güler — find him over{" "}
        <a href="https://salih.dev" rel="noreferrer me" target="_blank">
          salih.dev
        </a>
      </p>
    </footer>
  );
}
