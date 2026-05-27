/**
 * @param {string | null} text
 * @param {'success' | 'error' | null} type
 */
export default function Message({ text, type }) {
  if (!text) return null;

  return (
    <div className={`lp-msg${type ? ` ${type}` : ''} show`}>
      {text}
    </div>
  );
}