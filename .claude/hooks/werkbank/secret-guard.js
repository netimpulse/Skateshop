#!/usr/bin/env node
// secret-guard.js – Teil des Werkbank-Plugins.
// Blockt Schreibzugriffe und Commits, die nach Secrets aussehen.
//
// Drei Betriebsarten:
//   1. Als Claude-Code-PreToolUse-Hook (`--claude-hook`): liest das Tool-Ereignis als JSON
//      von stdin, prüft den zu schreibenden Inhalt, Exit-Code 2 = blockieren.
//   2. Als Git-Pre-Commit-Hook (`--staged`): prüft alle gestagten Änderungen (git diff --cached).
//   3. `--self-test`: prüft die eigenen Muster, Ausgabe OK/FEHLER.
//
// Keine Abhängigkeiten. Läuft mit Node 18+ unter Windows, macOS, Linux.

'use strict';
const { execSync } = require('child_process');

// Muster: [Name, RegExp]. Bewusst auf hohe Trefferwahrscheinlichkeit ausgelegt;
// Platzhalter werden unten separat herausgefiltert.
const PATTERNS = [
  ['AWS Access Key', /\bAKIA[0-9A-Z]{16}\b/],
  ['OpenAI/Anthropic-Key', /\bsk-(?:ant-|proj-)?[A-Za-z0-9_\-]{20,}\b/],
  ['GitHub Token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/],
  ['GitHub Fine-grained Token', /\bgithub_pat_[A-Za-z0-9_]{60,}\b/],
  ['Shopify Token', /\bshp(?:at|ca|pa|ss)_[a-fA-F0-9]{32}\b/],
  ['Slack Token', /\bxox[baprs]-[A-Za-z0-9\-]{10,}\b/],
  ['Stripe Key', /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}\b/],
  ['Google API Key', /\bAIza[0-9A-Za-z\-_]{35}\b/],
  ['Private Key Block', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/],
  ['JWT', /\beyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b/],
  ['Verbindungsstring mit Passwort', /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s:\/]+:[^\s@\/]{4,}@/i],
  ['Zugewiesenes Secret', /\b(?:api[_-]?key|secret|token|password|passwd|pwd|client[_-]?secret|access[_-]?key)\b["']?\s*[:=]>?\s*["'`]([^"'`\s]{12,})["'`]/i],
];

// Werte, die offensichtlich Platzhalter sind, lösen keinen Alarm aus.
const PLACEHOLDER = /(example|sample|placeholder|changeme|change-me|your[_-]|xxx|<[^>]+>|\$\{|process\.env|env\(|dummy|todo|redacted|\.\.\.)/i;

function findSecrets(text, fileOfLine) {
  const hits = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const [name, re] of PATTERNS) {
      const m = line.match(re);
      if (!m) continue;
      const value = m[1] || m[0];
      if (PLACEHOLDER.test(value) || PLACEHOLDER.test(line)) continue;
      const where = fileOfLine ? fileOfLine[i] : null;
      hits.push({ line: where ? where.line : i + 1, file: where ? where.file : null, name, preview: line.trim().slice(0, 80) });
      break; // ein Treffer pro Zeile reicht
    }
  });
  return hits;
}

function report(hits, where, action = 'Schreibzugriff blockiert') {
  const msg = [
    `secret-guard: ${hits.length} mögliche(s) Secret(s) in ${where} gefunden – ${action}.`,
    ...hits.map(h => `  ${h.file ? h.file + ':' : 'Zeile '}${h.line}: ${h.name} – ${h.preview}`),
    'Secrets gehören in Umgebungsvariablen (.env, nicht committet) oder einen Secret-Store,',
    'nie in Dateien. Falls es ein Platzhalter ist: als solchen erkennbar machen (z. B. "your-api-key-here").',
  ].join('\n');
  process.stderr.write(msg + '\n');
}

function readStdin() {
  return new Promise(resolve => {
    let data = '';
    if (process.stdin.isTTY) return resolve('');
    const timer = setTimeout(() => resolve(data), 5000);
    timer.unref();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', c => (data += c));
    process.stdin.on('end', () => { clearTimeout(timer); resolve(data); });
    process.stdin.on('error', () => { clearTimeout(timer); resolve(data); });
  });
}

async function runAsClaudeHook() {
  const raw = await readStdin();
  if (!raw.trim()) process.exit(0);
  let event;
  try { event = JSON.parse(raw); } catch { process.exit(0); }
  const input = (event && event.tool_input) || {};
  const file = input.file_path || '(unbekannte Datei)';
  // Inhalte je nach Werkzeug: Write → content, Edit → new_string, MultiEdit → edits[].new_string
  const pieces = [];
  if (typeof input.content === 'string') pieces.push(input.content);
  if (typeof input.new_string === 'string') pieces.push(input.new_string);
  if (Array.isArray(input.edits)) for (const e of input.edits) if (e && typeof e.new_string === 'string') pieces.push(e.new_string);
  const hits = findSecrets(pieces.join('\n'));
  if (hits.length) { report(hits, file); process.exit(2); }
  process.exit(0);
}

function runAsGitHook() {
  let diff = '';
  try {
    diff = execSync('git diff --cached --unified=0 --no-color', { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  } catch (e) {
    process.stderr.write('secret-guard: konnte git diff --cached nicht lesen: ' + e.message + '\n');
    process.exit(1);
  }
  // Nur hinzugefügte Zeilen prüfen; Datei und Zeilennummer aus den Diff-Köpfen mitführen.
  const added = [];
  const where = [];
  let file = null;
  let lineNo = 0;
  for (const l of diff.split(/\r?\n/)) {
    if (l.startsWith('+++ ')) { file = l.slice(4).replace(/^b\//, ''); continue; }
    const hunk = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (hunk) { lineNo = parseInt(hunk[1], 10); continue; }
    if (l.startsWith('+')) { added.push(l.slice(1)); where.push({ file, line: lineNo }); lineNo++; }
  }
  const hits = findSecrets(added.join('\n'), where);
  if (hits.length) { report(hits, 'den gestagten Änderungen', 'Commit blockiert'); process.exit(1); }
  process.exit(0);
}

const args = process.argv.slice(2).map(a => a.trim()); // trim: CRLF-Zeilenenden in Hook-Skripten
if (args.includes('--staged')) runAsGitHook();
else if (args.includes('--self-test')) {
  // Teststrings werden zusammengesetzt, damit dieses Skript selbst nicht als Treffer zählt.
  const bad = findSecrets('const key = "' + ['sk', 'abcdefghijklmnopqrstuvwxyz123456'].join('-') + '";\n' + 'AKIA' + 'ABCDEFGHIJKLMNOP' + '\n' + '"client_' + 'secret": "' + 'q8Zr2LmVx0Tn4Pw7Ks9J' + '"');
  const good = findSecrets('const key = process.env.API_KEY;\napi_key = "<your-api-key-here>"');
  const ok = bad.length === 3 && good.length === 0;
  console.log(`self-test: ${ok ? 'OK' : 'FEHLER'} (bad=${bad.length}, good=${good.length})`);
  process.exit(ok ? 0 : 1);
}
else if (args.includes('--claude-hook')) runAsClaudeHook();
else {
  process.stderr.write('secret-guard: unbekannter Aufruf. Nutzung: --claude-hook | --staged | --self-test\n');
  process.exit(1);
}
