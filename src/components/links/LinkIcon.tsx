interface LinkIconProps {
  value: string;
  backgroundColor?: string;
}

export function LinkIcon({ value, backgroundColor }: LinkIconProps) {
  return (
    <span
      className="link-icon"
      style={{ backgroundColor: backgroundColor ?? "#E8E4FB" }}
      aria-hidden="true"
    >
      {value}
    </span>
  );
}
