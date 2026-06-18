import { useRef, useCallback } from 'react';

const BTN = [
  { cmd: 'bold',          icon: 'B',  style: { fontWeight: 700 }, title: 'Bold' },
  { cmd: 'italic',        icon: 'I',  style: { fontStyle: 'italic' }, title: 'Italic' },
  { cmd: 'underline',     icon: 'U',  style: { textDecoration: 'underline' }, title: 'Underline' },
  { cmd: 'insertUnorderedList', icon: '•', style: { fontSize: 15 }, title: 'Bullet list' },
];

export default function RichTextInput({ value, onChange, placeholder, dark, disabled, minLength = 10, maxLength = 2000 }) {
  const editorRef = useRef(null);
  const border  = dark ? '#1e3a2a' : '#e2ebe6';
  const text    = dark ? '#e8f3ee' : '#0c1c14';
  const muted   = dark ? '#6aaa8a' : '#7a8f84';
  const inputBg = dark ? '#0d2018' : '#f4f7f5';
  const toolBg  = dark ? '#0a1610' : '#f0f3f1';

  const exec = useCallback((cmd) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, null);
    if (onChange) onChange(editorRef.current?.innerHTML || '');
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (onChange) onChange(editorRef.current?.innerHTML || '');
  }, [onChange]);

  const textLen = (editorRef.current?.innerText || '').trim().length;

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: `1.5px solid ${border}`, transition: 'border-color 0.15s' }}
      onFocus={() => { editorRef.current?.parentElement?.parentElement && (editorRef.current.parentElement.parentElement.style.borderColor = '#22c55e'); }}
      onBlur={() => { editorRef.current?.parentElement?.parentElement && (editorRef.current.parentElement.parentElement.style.borderColor = border); }}
    >
      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 1, padding: '4px 6px',
        background: toolBg, borderBottom: `1px solid ${border}`,
      }}>
        {BTN.map(b => (
          <button key={b.cmd} type="button" onMouseDown={e => { e.preventDefault(); exec(b.cmd); }} disabled={disabled}
            title={b.title}
            style={{
              width: 30, height: 28, border: 'none', borderRadius: 6,
              background: 'transparent', cursor: disabled ? 'not-allowed' : 'pointer',
              color: muted, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontFamily: 'inherit', ...b.style,
              transition: 'background 0.1s, color 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = dark ? '#1e3a2a' : '#e2ebe6'; e.currentTarget.style.color = text; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = muted; }}
          >{b.icon}</button>
        ))}
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        onInput={handleInput}
        data-placeholder={placeholder}
        suppressContentEditableWarning
        style={{
          minHeight: 100, maxHeight: 200, overflowY: 'auto',
          padding: '10px 14px', fontSize: 13, color: text,
          background: inputBg, lineHeight: 1.65, fontFamily: 'inherit',
          outline: 'none', wordBreak: 'break-word',
        }}
        dangerouslySetInnerHTML={value ? undefined : { __html: '' }}
      />

      <style>{`
        [data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: ${dark ? '#3d7a5a' : '#aabfb2'};
          pointer-events: none;
        }
        [contenteditable] ul, [contenteditable] ol { padding-left: 20px; margin: 4px 0; }
        [contenteditable] li { margin-bottom: 2px; }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px 6px', background: toolBg, borderTop: `1px solid ${border}`, fontSize: 10, color: muted }}>
        <span>{textLen < minLength ? `${minLength - textLen} more characters needed` : ''}</span>
        <span>{textLen}/{maxLength}</span>
      </div>
    </div>
  );
}
