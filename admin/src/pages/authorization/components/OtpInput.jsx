/**
 * authorization/components/OtpInput.jsx
 * ─────────────────────────────────────────────────────
 * Renders 6 individual digit boxes with:
 *   • auto-advance on digit entry
 *   • backspace moves focus to previous box
 *   • paste fills all boxes at once
 *   • visual separator between box 3 and 4
 *
 * Props:
 *   digits      string[]        array of 6 single-char strings
 *   inputRefs   React.MutableRefObject
 *   onChange    (index, value) => void
 *   onKeyDown   (index, KeyboardEvent) => void
 *   onPaste     (ClipboardEvent) => void
 *   hasError    boolean
 */

export default function OtpInput({ digits, inputRefs, onChange, onKeyDown, onPaste, hasError }) {
  return (
    <div className="am-otp-row">
      {digits.map((digit, i) => (
        <>
          {/* visual dash separator between digit 3 and 4 */}
          {i === 3 && (
            <span key="sep" className="am-otp-sep">–</span>
          )}

          <input
            key={i}
            ref={(el) => (inputRefs.current[i] = el)}
            className={[
              'am-otp-box',
              digit         ? 'am-otp-box--filled' : '',
              hasError      ? 'am-otp-box--error'  : '',
            ].join(' ').trim()}
            type="number"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            autoFocus={i === 0}
            autoComplete="one-time-code"
            onChange={(e) => onChange(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onPaste={onPaste}
          />
        </>
      ))}
    </div>
  );
}
