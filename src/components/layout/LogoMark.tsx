interface LogoMarkProps {
  size?: "small" | "large";
}

export function LogoMark({ size = "small" }: LogoMarkProps) {
  return (
    <span
      className={`logo-mark ${size === "large" ? "logo-mark-large" : ""}`}
      aria-hidden="true"
    >
      <span className="logo-eye logo-eye-left" />
      <span className="logo-eye logo-eye-right" />
      <span className="logo-smile" />
    </span>
  );
}
