export default function OtpInput({ digits, inputRefs, onChange, onKeyDown, onPaste, hasError, disabled }) {
  return (
    <div className="am-otp-row" style={{ justifyContent: 'center' }}>
      {digits.map((digit, i) => (
        <div key={i} style={{ display: 'contents' }}>
          {/* visual dash separator between digit 3 and 4 */}
          {i === 3 && (
            <span className="am-otp-sep">–</span>
          )}

          <input
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
            disabled={disabled}
          />
        </div>
      ))}
    </div>
  );
}
