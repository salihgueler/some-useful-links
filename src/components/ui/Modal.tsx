"use client";

import { useEffect, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  titleId: string;
  children: ReactNode;
  onClose: () => void;
}

export function Modal({ open, titleId, children, onClose }: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.classList.add("modal-open");
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("modal-open");
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-scrim" role="presentation" onMouseDown={onClose}>
      <section
        className="share-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </section>
    </div>
  );
}
