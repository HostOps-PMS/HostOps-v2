const SQLI_REGEX = /(?:'|")\s*(?:--|#|;|\b(?:OR|AND)\b)|(--)|(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|EXEC|EXECUTE)\b)/i;
const XSS_REGEX = /(<script>)|(%3Cscript%3E)|(javascript:)|(onerror=)|(onload=)/i;
const PATH_TRAVERSAL_REGEX = /(\.\.\/)|(\.\.\\)/;
const NOSQLI_REGEX = /(\$ne|\$gt|\$lt|\$gte|\$lte|\$where|\$regex|\$exists)/i;
const SSRF_REGEX = /(https?:\/\/|file:\/\/|dict:\/\/|gopher:\/\/|169\.254\.169\.254|(?:^|[\s"'=])localhost(?:[/:?]|$)|127\.0\.0\.1)/i;
const CMD_INJECTION_REGEX = /(\|\||&&|`|\$\(|\b(wget|curl|bash|sh|ping|nc|whoami|cat \/etc)\b)/i;
const SCANNER_UA_REGEX = /(nmap|nikto|sqlmap|burp|zaproxy|dirb|gobuster|w3af|acunetix|nessus|curl|wget|postman|insomnia|httpie|python|java|go-http-client)/i;
const DEFAULT_CREDS_REGEX = /^(admin|root|test|guest|user)@(admin|root|test|guest|user|localhost)\./i;

const OPEN_REDIRECT_REGEX = /^(https?:\/\/|\/\/)/i;
const OAST_REGEX = /(burpcollaborator\.net|oastify\.com|oast\.pro|oast\.live|oast\.site|oast\.online|oast\.fun|oast\.me|interact\.sh|webhook\.site|pingb\.in|requestbin\.net)/i;

export function classify(req) {
  let score = 0;
  let severity = 'info';
  let classification = 'human';
  const tags = [];

  // Build a giant string of all inputs to catch payloads anywhere (Headers, Query, Body, Path)
  const inspectObject = {
    body: req.body,
    query: req.query,
    params: req.params,
    url: req.originalUrl || req.url,
    headers: { ...req.headers, cookie: undefined, authorization: undefined } // skip auth to prevent false positives
  };
  const bodyStr = JSON.stringify(inspectObject);
  
  const nonEmailInspectObject = {
    ...inspectObject,
    body: typeof req.body === 'object' ? { ...req.body, email: undefined } : req.body
  };
  const nonEmailBodyStr = JSON.stringify(nonEmailInspectObject);
  const emailStr = (req.body && req.body.email) ? String(req.body.email) : '';
  const passwordStr = (req.body && req.body.password) ? String(req.body.password) : '';
  const ua = req.headers['user-agent'] || '';

  if (SCANNER_UA_REGEX.test(ua)) {
    score = Math.max(score, 0.9);
    severity = 'critical';
    classification = 'scripted-tool';
    tags.push('scanner');
  }

  // 0. OAST (Out-Of-Band Application Security Testing) / Burp Suite
  if (OAST_REGEX.test(bodyStr)) {
    score = Math.max(score, 0.95);
    severity = 'critical';
    classification = 'scripted-tool';
    tags.push('oast-probe');
  }

  // 1. Injection (SQLi, NoSQLi, Command Injection)
  if (SQLI_REGEX.test(bodyStr)) {
    score = Math.max(score, 0.9);
    severity = 'critical';
    classification = 'scripted-tool';
    tags.push('sqli');
  }

  if (NOSQLI_REGEX.test(bodyStr)) {
    score = Math.max(score, 0.9);
    severity = 'critical';
    classification = 'scripted-tool';
    tags.push('nosqli');
  }

  if (CMD_INJECTION_REGEX.test(bodyStr)) {
    score = Math.max(score, 0.95);
    severity = 'critical';
    classification = 'scripted-tool';
    tags.push('cmd-injection');
  }

  // 2. SSRF (Server-Side Request Forgery) — test against body WITHOUT email to avoid false positives
  if (SSRF_REGEX.test(nonEmailBodyStr)) {
    score = Math.max(score, 0.85);
    severity = 'suspicious';
    classification = 'scripted-tool';
    tags.push('ssrf');
  }

  // 3. XSS
  if (XSS_REGEX.test(bodyStr)) {
    score = Math.max(score, 0.85);
    severity = 'suspicious';
    classification = 'scripted-tool';
    tags.push('xss');
  }

  if (PATH_TRAVERSAL_REGEX.test(bodyStr)) {
    score = Math.max(score, 0.9);
    severity = 'critical';
    classification = 'scripted-tool';
    tags.push('path-traversal');
  }

  // 4. Identification and Authentication Failures (Default Creds)
  if (DEFAULT_CREDS_REGEX.test(emailStr) || (emailStr === 'admin' && passwordStr === 'admin')) {
    score = Math.max(score, 0.8);
    severity = 'suspicious';
    classification = 'scripted-tool';
    tags.push('auth-failure');
  }

  // 5. Mass Assignment / API Abuse
  // A standard login should only contain email, password, and optionally deviceId/rememberMe.
  // If an attacker injects fields like "role", "isAdmin", "permissions", it's a Mass Assignment probe.
  const suspiciousKeys = ['role', 'isadmin', 'permissions', 'group', 'account_type'];
  const bodyKeys = req.body ? Object.keys(req.body).map(k => k.toLowerCase()) : [];
  if (suspiciousKeys.some(k => bodyKeys.includes(k))) {
    score = Math.max(score, 0.95);
    severity = 'critical';
    classification = 'scripted-tool';
    tags.push('mass-assignment');
  }

  // 6. Open Redirect Probes
  // If they pass a malicious ?redirect=http://evil.com parameter to the login route
  const redirectParam = req.query && req.query.redirect ? String(req.query.redirect) : '';
  if (OPEN_REDIRECT_REGEX.test(redirectParam)) {
    score = Math.max(score, 0.85);
    severity = 'suspicious';
    classification = 'scripted-tool';
    tags.push('open-redirect');
  }

  return {
    confidence: score,
    severity,
    classification,
    tags,
    activityType: 'login_attempt'
  };
}
