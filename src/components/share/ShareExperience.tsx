"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Share2, Upload, X } from "lucide-react";
import type { PageConfiguration } from "@/lib/config/links.types";
import { Modal } from "@/components/ui/Modal";
import { ShareCardPanel } from "./ShareCardPanel";

export function ShareExperience({
  page,
  children,
}: {
  page: PageConfiguration;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  const showModal = () => {
    setOpen(true);
  };

  return (
    <>
      <button
        className="share-icon-button"
        type="button"
        aria-label="Share this page"
        onClick={showModal}
      >
        <Upload size={21} strokeWidth={2} />
      </button>
      {children}
      <button className="share-primary" type="button" onClick={showModal}>
        <Share2 size={21} strokeWidth={2.2} />
        <span>Share this page</span>
      </button>

      <Modal open={open} titleId="share-modal-title" onClose={close}>
        <header className="share-modal-header">
          <div>
            <p className="eyebrow">Share card</p>
            <h2 id="share-modal-title">Send some good finds</h2>
          </div>
          <button type="button" onClick={close} aria-label="Close share dialog">
            <X size={20} />
          </button>
        </header>
        <ShareCardPanel page={page} />
      </Modal>
    </>
  );
}
