import { useEffect, useRef, useState } from 'react';

export default function JoinLink({ url }) {
  const [status, setStatus] = useState('');
  const link = useRef(null);
  const reset = useRef();
  useEffect(() => () => clearTimeout(reset.current), []);

  const copy = async () => {
    clearTimeout(reset.current);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      setStatus('copied');
      reset.current = setTimeout(() => setStatus(''), 2500);
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(link.current);
      selection?.removeAllRanges();
      selection?.addRange(range);
      setStatus('manual');
    }
  };

  return (
    <div className="mt-3 max-w-xl">
      <div className="card flex min-w-0 items-center gap-3 !p-3 sm:!p-4">
        <a ref={link} href={url} target="_blank" rel="noreferrer" translate="no"
          className="min-w-0 flex-1 select-all break-all text-lg font-semibold underline-offset-4 hover:underline sm:text-2xl">
          {url}
        </a>
        <button type="button" onClick={copy} className="btn-ghost min-h-11 min-w-11 shrink-0 !p-2.5"
          aria-label={status === 'copied' ? 'Student join link copied' : 'Copy student join link'}
          title={status === 'copied' ? 'Link copied' : 'Copy join link'}>
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {status === 'copied' ? <path d="m5 12 4 4L19 6" /> : <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>}
          </svg>
        </button>
      </div>
      <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm text-slate-500 dark:text-slate-400">
        {status === 'copied' ? 'Link copied' : status === 'manual' ? 'Select the link and copy it to share.' : ''}
      </p>
    </div>
  );
}
