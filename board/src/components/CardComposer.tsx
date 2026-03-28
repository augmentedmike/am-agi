'use client';

import { useRef, useState, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';
import { useLocale } from '@/contexts/LocaleContext';

export function FilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const isImage = file.type.startsWith('image/');

  useEffect(() => {
    if (!isImage) return;
    const url = URL.createObjectURL(file);
    setThumbnail(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);

  const ext = file.name.split('.').pop()?.toUpperCase() ?? 'FILE';

  return (
    <div className="relative group w-16 shrink-0">
      {isImage && thumbnail ? (
        <img
          src={thumbnail}
          alt={file.name}
          className="w-16 h-16 object-cover rounded-lg border border-white/10 bg-zinc-800"
          title={file.name}
        />
      ) : (
        <div
          className="w-16 h-16 rounded-lg border border-white/10 bg-zinc-800 flex flex-col items-center justify-center gap-1"
          title={file.name}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider leading-none">{ext}</span>
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove file ${file.name}`}
        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-zinc-700 border border-white/10 text-zinc-400 hover:text-red-400 hover:bg-zinc-600 flex items-center justify-center text-[10px] leading-none opacity-0 group-hover:opacity-100 transition-opacity"
      >
        ✕
      </button>
    </div>
  );
}

export interface CardComposerHandle {
  /** Push files into the composer's internal file list (called by parent on drop) */
  addFiles: (files: File[]) => void;
}

interface CardComposerProps {
  placeholder?: string;
  submitLabel?: string;
  cancelLabel?: string;
  submitting?: boolean;
  error?: string | null;
  onSubmit: (text: string, files: File[]) => void;
  onCancel?: () => void;
  children?: React.ReactNode;
  initialText?: string;
  initialFiles?: Array<{ name: string; type: string; dataUrl: string }>;
  onTextChange?: (text: string) => void;
  onFilesChange?: (files: Array<{ name: string; type: string; dataUrl: string }>) => void;
}

export const CardComposer = forwardRef<CardComposerHandle, CardComposerProps>(function CardComposer(
  {
    placeholder,
    submitLabel,
    cancelLabel,
    submitting = false,
    error,
    onSubmit,
    onCancel,
    children,
    initialText = '',
    initialFiles = [],
    onTextChange,
    onFilesChange,
  },
  ref,
) {
  const { t } = useLocale();
  const effectivePlaceholder = placeholder ?? t('chatPlaceholder');
  const effectiveSubmitLabel = submitLabel ?? t('send');
  const effectiveCancelLabel = cancelLabel ?? t('cancel');
  const [text, setText] = useState(initialText);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  // Restore files from serialized initialFiles on first mount
  useEffect(() => {
    if (!initialFiles.length) return;
    let cancelled = false;
    Promise.all(
      initialFiles.map(({ name, type, dataUrl }) =>
        fetch(dataUrl)
          .then(r => r.blob())
          .then(b => new File([b], name, { type }))
          .catch(() => null),
      ),
    ).then(results => {
      if (cancelled) return;
      const valid = results.filter((f): f is File => f !== null);
      if (valid.length > 0) setFiles(valid);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Notify parent of text changes for persistence
  useEffect(() => {
    onTextChange?.(text);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  // Serialize files to base64 and notify parent for persistence
  useEffect(() => {
    if (!onFilesChange) return;
    if (files.length === 0) { onFilesChange([]); return; }
    let cancelled = false;
    Promise.all(
      files.map(
        file =>
          new Promise<{ name: string; type: string; dataUrl: string } | null>(resolve => {
            const reader = new FileReader();
            reader.onload = () => resolve({ name: file.name, type: file.type, dataUrl: reader.result as string });
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
          }),
      ),
    ).then(results => {
      if (cancelled) return;
      onFilesChange(results.filter((r): r is { name: string; type: string; dataUrl: string } => r !== null));
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  function addFiles(incoming: File[] | FileList) {
    const accepted = Array.from(incoming).filter(f => !f.type.startsWith('video/'));
    if (accepted.length > 0) setFiles(prev => [...prev, ...accepted]);
  }

  // Expose addFiles to parent via ref
  useImperativeHandle(ref, () => ({ addFiles }));

  function removeFile(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }
  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = '';
  }
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      onSubmit(text, files);
    }
    // plain Enter = new line (default textarea behavior)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-[10px] text-zinc-600">
        <span><kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-white/10 font-mono">Enter</kbd> {t('newLine')}</span>
        <span><kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-white/10 font-mono">Shift ⏎</kbd> {t('shiftEnterSend')}</span>
      </div>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={e => { setText(e.target.value); autoResize(); }}
        onInput={autoResize}
        onKeyDown={handleKeyDown}
        placeholder={effectivePlaceholder}
        className="w-full bg-zinc-900/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 resize-none focus:outline-none focus:ring-1 focus:ring-pink-500"
        style={{ minHeight: '4.5rem', overflowY: 'hidden' }}
        autoFocus
      />

      {children}

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <FilePreview key={i} file={f} onRemove={() => removeFile(i)} />
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-zinc-600 hover:text-zinc-400 transition-colors p-1 rounded"
          title={t('attachFiles')}
          aria-label="Attach files"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
          </svg>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*,.pdf,.txt,.md,.csv,.json" multiple className="hidden" onChange={handleFileInput} />

        <div className="flex-1" />

        {onCancel && (
          <button type="button" onClick={onCancel} className="text-xs px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors">
            {effectiveCancelLabel}
          </button>
        )}
        <button
          type="button"
          onClick={() => onSubmit(text, files)}
          disabled={submitting}
          className="text-xs px-3 py-1.5 rounded-lg bg-pink-500 hover:bg-pink-400 text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {submitting && (
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
            </svg>
          )}
          {submitting ? t('working') : effectiveSubmitLabel}
        </button>
      </div>
    </div>
  );
});
