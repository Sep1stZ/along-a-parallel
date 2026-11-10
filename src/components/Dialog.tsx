'use client';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
export default function Dialog({
  children,
  title,
  onClose,
  wide = false,
}: {
  children: React.ReactNode;
  title: string;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    const cancel = (e: Event) => {
      e.preventDefault();
      closeRef.current();
    };
    dialog?.addEventListener('cancel', cancel);
    return () => {
      dialog?.removeEventListener('cancel', cancel);
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? 'dialog-wide' : ''}`}
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-head">
        <span className="eyebrow">{title}</span>
        <button className="icon-button" aria-label="关闭面板" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
