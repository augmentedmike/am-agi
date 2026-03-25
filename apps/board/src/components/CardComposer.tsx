'use client';

import { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';

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
  submitting?: boolean;
  error?: string | null;
  onSubmit: (text: string, files: File[]) => void;
  onCancel?: () => void;
  children?: React.ReactNode;
}

export const CardComposer = forwardRef<CardComposerHandle, CardComposerProps>(function CardComposer(
  {
    placeholder = 'Describe what needs to be done…',
    submitLabel = 'Submit',
    submitting = false,
    error,
    onSubmit,
    onCancel,
    children,
  },
  ref,
) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(text, files);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <textarea
        rows={3}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full bg-zinc-900/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 resize-none focus:outline-none focus:ring-1 focus:ring-pink-500"
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
          title="Attach files (or drag anywhere)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
          </svg>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*,.pdf,.txt,.md,.csv,.json" multiple className="hidden" onChange={handleFileInput} />

        <div className="flex-1" />

        {onCancel && (
          <button type="button" onClick={onCancel} className="text-xs px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors">
            Cancel
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
          {submitting ? 'Working…' : submitLabel}
        </button>
      </div>
    </div>
  );
});
