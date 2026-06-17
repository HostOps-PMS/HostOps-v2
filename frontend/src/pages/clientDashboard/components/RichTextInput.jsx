import { useRef, useCallback } from 'react';

const BTN = [
  { cmd: 'bold',          icon: 'B',  style: { fontWeight: 700 } },
  { cmd: 'italic',        icon: 'I',  style: { fontStyle: 'italic' } },
  { cmd: 'underline',     icon: 'U',  style: { textDecoration: 'underline' } },
  { cmd: 'insertUnorderedList', icon: '•', style: { fontSize: 16 } },
];

export default function RichTextInput({ value, onChange, placeholder, dark, disabled, minLength = 10, maxLength = 2000 }) {
  const editorRef = useRef(null);
  const border  = dark ? '#1e3a2a' : '#e3ede8';
  const text    = dark ? '#eaf5f0' : '#0c1c14';
  const muted   = dark ? '#7ab89a' : '#6b7280';
  const inputBg = dark ? '#0d2619' : '#f8fbf9';

  const exec = useCallback((cmd) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, null);
    if (onChange) {
      const html = editorRef.current?.innerHTML || '';
      onChange(html);
    }
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (onChange) onChange(editorRef.current?.innerHTML || '');
  }, [onChange]);

  const textLen = (editorRef.current?.innerText || '').trim().length;

  return (
    <div>
      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 2, padding: '4px 6px',
        border: `1.5px solid ${border}`, borderBottom: 'none',
        borderRadius: '10px 10px 0 0', background: dark ? '#0a1a10' : '#f3f6f4',
      }}>
        {BTN.map(b => (
          <button key={b.cmd} type="button" onMouseDown={e => { e.preventDefault(); exec(b.cmd); }} disabled={disabled}
            style={{
              width: 28, height: 28, border: 'none', borderRadius: 6,
              background: 'transparent', cursor: disabled ? 'not-allowed' : 'pointer',
              color: muted, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontFamily: 'inherit', ...b.style,
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = dark ? '#1e3a2a' : '#e3ede8'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            title={b.cmd}
          >{b.icon}</button>
        ))}
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        onInput={handleInput}
        onFocus={e => { e.currentTarget.parentElement.style.outline = '2px solid #26a676'; }}
        onBlur={e => { e.currentTarget.parentElement.style.outline = 'none'; }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
        style={{
          minHeight: 120, maxHeight: 240, overflowY: 'auto',
          padding: '10px 14px', fontSize: 14, color: text,
          background: inputBg, lineHeight: 1.6, fontFamily: 'inherit',
          border: `1.5px solid ${border}`, borderTop: `1px solid ${border}`,
          borderRadius: '0 0 10px 10px', outline: 'none',
          wordBreak: 'break-word',
        }}
        dangerouslySetInnerHTML={value ? undefined : { __html: '' }}
      />

      <style>{`
        [data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: ${dark ? '#4d8a6a' : '#9ab8a9'};
          pointer-events: none;
        }
        [contenteditable] ul, [contenteditable] ol {
          padding-left: 20px; margin: 4px 0;
        }
        [contenteditable] li { margin-bottom: 2px; }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: muted }}>
        <span>{textLen < minLength ? `At least ${minLength} characters required` : ''}</span>
        <span>{textLen}/{maxLength}</span>
      </div>
    </div>
  );
}
