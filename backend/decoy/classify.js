const PATTERNS = {
  SQLI: /(?:'|")\s*(?:--|#|;)|(?:'|")\s*\b(?:or|and)\b\s*(?:'|"|\d)|\bunion\b[\s\S]{0,40}\bselect\b|\b(?:select|insert|update|delete|drop|alter|exec|execute|having|waitfor|truncate)\b\s+[\w*`.,()\s]{0,60}\b(?:from|into|table|delay)\b|\b(?:sleep|benchmark|pg_sleep|extractvalue|updatexml|xp_cmdshell)\s*\(|\b\d+\s*=\s*\d+\b|0x[0-9a-f]{4,}|\/\*.{0,20}\*\//i,
 
  XSS: /<script\b|<\/script>|on\w{2,20}\s*=\s*['"]?\s*[\w(]|javascript\s*:|vbscript\s*:|data:text\/html|<svg\b|<iframe\b|<img\b[^>]{0,80}\bonerror\b|<body\b[^>]{0,80}\bon\w+\b|\b(?:alert|prompt|confirm|eval|document\.cookie|document\.write)\s*\(/i,
 
  PATH_TRAVERSAL: /(?:\.\.\/|\.\.\\|\.\.%2f|\.\.%5c|%2e%2e[\/\\]|\.\.;\/|\.{4,}\/)|\/etc\/(?:passwd|shadow|hosts)\b|\/proc\/self\/environ|\\windows\\win\.ini|\bweb\.config\b|\.env\b|id_rsa\b|\\\\[a-z0-9.\-]+\\[a-z$]/i,
 
  NOSQLI: /\$(?:ne|gt|lt|gte|lte|where|regex|exists|in|nin|or|and|not|expr|function|jsonschema|mod|all|elemmatch|size)\b/i,
 
  SSRF: /\b(?:https?|ftp|file|dict|gopher|ldap|tftp):\/\/|169\.254\.169\.254|100\.100\.100\.200|(?:^|[\s"'=])localhost(?:[\/:?]|$)|127\.0\.0\.1|0\.0\.0\.0|::1\b|::ffff:127|\[::1\]|metadata\.google\.internal|metadata\.azure\.com|\b(?:0x7f|017700000001|2130706433)\b|\.(?:nip|sslip|xip)\.io\b|\.internal\b/i,
 
  CMD_INJECTION: /\|\||&&|`|\$\(|\$\{ifs\}|\b(?:wget|curl|bash|\/bin\/sh|ping|nc|ncat|netcat|whoami|nslookup|dig|powershell|pwsh|cmd\.exe|python3?|perl|telnet)\b\s*[\-\/\w.]*|>\s*\/dev\/null|;\s*\w+\s*;/i,
 
  LDAP_INJECTION: /\*\)|\(\*|\)\*|\*\(|\(\|\(|\(&\(/i,
 
  SSTI: /\{\{[^{}]{1,200}\}\}|\$\{[^{}]{1,200}\}|<%[^%]{1,200}%>|#\{[^{}]{1,200}\}|\[%[^%]{1,200}%\]/i,
 
  OPEN_REDIRECT: /^\s*(?:https?:)?\/\/|^\s*\/\\|^\s*https?:\/\/[^\/?#@]+@/i,
 
  OAST: /(?:burpcollaborator\.net|oastify\.com|oast\.(?:pro|live|site|online|fun|me)|interact\.sh|webhook\.site|pingb\.in|requestbin\.net|canarytokens\.com|dnslog\.cn)/i,
};

const SCANNER_UA = {
  TOOLING: /\b(?:nmap|nikto|sqlmap|sqlninja|burp|zaproxy|owasp[\s_-]?zap|dirb|dirbuster|gobuster|feroxbuster|ffuf|wfuzz|w3af|acunetix|nessus|nuclei|wpscan|masscan|metasploit|hydra|medusa|skipfish|whatweb|commix)\b/i,
  GENERIC_CLIENT: /\b(?:curl|wget|postman|insomnia|httpie|python-requests|python-urllib|go-http-client|java\/|libwww-perl|okhttp)\b/i,
};

const DEFAULT_CREDS_REGEX = /\b(?:user(?:name)?|login|email)\s*[=:]\s*["']?(?:admin|root|test|guest|administrator|demo)["']?\b[\s\S]{0,80}\b(?:pass(?:word)?|pwd)\s*[=:]\s*["']?(?:admin|root|test|guest|password|12345|123456|toor|changeme)?["']?/i;

export function classify(req) {
  let score = 0;
  let severity = 'info';
  let classification = 'human';
  const tags = [];

  const inspectObject = {
    body: req.body,
    query: req.query,
    params: req.params,
    url: req.originalUrl || req.url,
    headers: { ...req.headers, cookie: undefined, authorization: undefined }
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

  if (SCANNER_UA.TOOLING.test(ua)) {
    score = Math.max(score, 0.95);
    severity = 'critical';
    classification = 'scripted-tool';
    tags.push('scanner');
  } else if (SCANNER_UA.GENERIC_CLIENT.test(ua)) {
    score = Math.max(score, 0.9);
    severity = 'suspicious';
    classification = 'scripted-tool';
    tags.push('scanner');
  }

  if (PATTERNS.OAST.test(bodyStr)) {
    score = Math.max(score, 0.95);
    severity = 'critical';
    classification = 'scripted-tool';
    tags.push('oast-probe');
  }

  if (PATTERNS.SQLI.test(bodyStr)) {
    score = Math.max(score, 0.95);
    severity = 'critical';
    classification = 'scripted-tool';
    tags.push('sqli');
  }

  if (PATTERNS.NOSQLI.test(bodyStr)) {
    score = Math.max(score, 0.95);
    severity = 'critical';
    classification = 'scripted-tool';
    tags.push('nosqli');
  }

  if (PATTERNS.CMD_INJECTION.test(bodyStr)) {
    score = Math.max(score, 0.95);
    severity = 'critical';
    classification = 'scripted-tool';
    tags.push('cmd-injection');
  }

  if (PATTERNS.SSRF.test(nonEmailBodyStr)) {
    score = Math.max(score, 0.85);
    severity = 'suspicious';
    classification = 'scripted-tool';
    tags.push('ssrf');
  }

  if (PATTERNS.XSS.test(bodyStr)) {
    score = Math.max(score, 0.9);
    severity = 'critical';
    classification = 'scripted-tool';
    tags.push('xss');
  }

  if (PATTERNS.SSTI.test(bodyStr)) {
    score = Math.max(score, 0.95);
    severity = 'critical';
    classification = 'scripted-tool';
    tags.push('ssti');
  }

  if (PATTERNS.LDAP_INJECTION.test(bodyStr)) {
    score = Math.max(score, 0.95);
    severity = 'critical';
    classification = 'scripted-tool';
    tags.push('ldap-injection');
  }

  if (PATTERNS.PATH_TRAVERSAL.test(bodyStr)) {
    score = Math.max(score, 0.95);
    severity = 'critical';
    classification = 'scripted-tool';
    tags.push('path-traversal');
  }

  if (DEFAULT_CREDS_REGEX.test(bodyStr) || (emailStr === 'admin' && passwordStr === 'admin')) {
    score = Math.max(score, 0.8);
    severity = 'suspicious';
    classification = 'scripted-tool';
    tags.push('auth-failure');
  }

  const suspiciousKeys = ['role', 'isadmin', 'permissions', 'group', 'account_type'];
  const bodyKeys = req.body ? Object.keys(req.body).map(k => k.toLowerCase()) : [];
  if (suspiciousKeys.some(k => bodyKeys.includes(k))) {
    score = Math.max(score, 0.95);
    severity = 'critical';
    classification = 'scripted-tool';
    tags.push('mass-assignment');
  }

  const redirectParam = req.query && req.query.redirect ? String(req.query.redirect) : '';
  if (PATTERNS.OPEN_REDIRECT.test(redirectParam)) {
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
