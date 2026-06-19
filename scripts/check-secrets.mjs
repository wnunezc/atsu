import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const trackedFiles = execFileSync('git', ['ls-files', '-z'], {
  encoding: 'utf8'
}).split('\0').filter(Boolean);
const ignoredTrackedFiles = execFileSync('git', ['ls-files', '-ci', '--exclude-standard', '-z'], {
  encoding: 'utf8'
}).split('\0').filter(Boolean);

const forbiddenNames = [
  /^\.env(?:\.|$)/i,
  /(^|\/)\.auth(\/|$)/i,
  /(^|\/)chrome-profile(\/|$)/i,
  /\.(?:pem|key|p12|pfx)$/i
];

const secretPatterns = [
  { name: 'GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g },
  { name: 'Private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'Generic secret assignment', pattern: /\b(?:api[_-]?key|client[_-]?secret|access[_-]?token|auth[_-]?token)\s*[:=]\s*["'][^"'\r\n]{12,}["']/gi }
];

const findings = [];

ignoredTrackedFiles.forEach((file) => {
  findings.push(`${file}: ignored file is tracked`);
});

for (const file of trackedFiles) {
  if (forbiddenNames.some((pattern) => pattern.test(file))) {
    findings.push(`${file}: forbidden secret-bearing filename`);
    continue;
  }

  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  for (const { name, pattern } of secretPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) {
      findings.push(`${file}: ${name}`);
    }
  }
}

if (findings.length > 0) {
  console.error('Secret scan failed:');
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log(`Secret scan passed (${trackedFiles.length} tracked files).`);
