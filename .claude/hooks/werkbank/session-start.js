#!/usr/bin/env node
// session-start.js – Teil des Werkbank-Plugins.
// Gibt beim Sitzungsstart einen kurzen Hinweis aus, wenn das Projekt ein Werkbank-Gedächtnis
// (docs/werkbank/INDEX.md) hat. Die Ausgabe landet als Kontext bei Claude.
// Tut in allen anderen Projekten nichts. Darf nie fehlschlagen.
'use strict';
const fs = require('fs');
const path = require('path');

function latest(dir, filter) {
  try {
    return fs.readdirSync(dir).filter(filter).sort().pop() || null;
  } catch { return null; }
}

function main(raw) {
  let cwd = process.cwd();
  try { const ev = JSON.parse(raw || '{}'); if (ev.cwd) cwd = ev.cwd; } catch {}
  const codexOff = /^(aus|off|0|false|nein)$/i.test(String(process.env.WERKBANK_CODEX || '').trim());
  const codexLine = 'Werkbank: Codex ist ausgeschaltet (WERKBANK_CODEX=aus) – Gegenproben übernimmt der Agent gegenpruefer, keine Codex-Aufrufe.';
  const base = path.join(cwd, 'docs', 'werkbank');
  if (!fs.existsSync(path.join(base, 'INDEX.md'))) {
    if (codexOff) process.stdout.write(codexLine + '\n');
    return;
  }

  const isMd = f => f.endsWith('.md');
  const log = latest(path.join(base, 'log'), isMd);
  const research = latest(path.join(base, 'recherche'), f => /^\d{4}-\d{2}-\d{2}/.test(f));
  let age = null;
  if (research) {
    const d = new Date(research.slice(0, 10) + 'T00:00:00Z');
    if (!isNaN(d)) age = Math.floor((Date.now() - d.getTime()) / 86400000);
  }

  const lines = [
    'Werkbank-Projekt: Vor der ersten Aufgabe docs/werkbank/INDEX.md und docs/werkbank/projekt-regeln.md lesen' +
      (log ? ` sowie den letzten Log docs/werkbank/log/${log}.` : '.'),
    'Für nicht-triviale Softwareaufgaben den Skill werkbank-start befolgen (sofern CLAUDE.md keinen eigenen Ablauf vorgibt).',
  ];
  if (codexOff) lines.push(codexLine);
  if (research && age !== null && age > 30) {
    lines.push(`Neueste Recherche (${research}) ist ${age} Tage alt – beim nächsten passenden Vorhaben den researcher zur Auffrischung starten.`);
  }
  process.stdout.write(lines.join('\n') + '\n');
}

let data = '';
if (process.stdin.isTTY) { try { main(''); } catch {} process.exit(0); }
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => (data += c));
process.stdin.on('end', () => { try { main(data); } catch {} process.exit(0); });
setTimeout(() => { try { main(data); } catch {} process.exit(0); }, 3000).unref();
