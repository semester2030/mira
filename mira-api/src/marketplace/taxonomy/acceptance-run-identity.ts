import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';

/** Shared E2ج/E3 identity. Hash inputs, never logs/reports or an archive containing itself. */
export function captureAcceptanceRun(repoRoot: string) {
  const required = ['mira-api/package.json', 'pubspec.yaml'];
  for (const file of required) {
    if (!fs.existsSync(path.join(repoRoot, file))) throw new Error(`Incomplete project: ${file} missing`);
  }
  const scope = ['mira-api/src', 'mira-api/prisma', 'partners-portal/web', 'lib', 'test'];
  const fixed = ['mira-api/package.json', 'mira-api/package-lock.json', 'pubspec.yaml', 'pubspec.lock'];
  const paths: string[] = [];
  const walk = (rel: string) => {
    const absolute = path.join(repoRoot, rel);
    if (!fs.existsSync(absolute)) return;
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`Symlink is outside acceptance hashing policy: ${rel}`);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(absolute).sort()) {
        if (!['node_modules', '.git', '.dart_tool', 'build'].includes(name)) walk(`${rel}/${name}`);
      }
    } else if (stat.isFile()) paths.push(rel);
  };
  for (const entry of [...scope, ...fixed]) walk(entry);
  const files = Object.fromEntries([...new Set(paths)].sort().map((rel) => {
    const bytes = fs.readFileSync(path.join(repoRoot, rel));
    return [rel, { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length }];
  }));
  return {
    runId: randomUUID(), startedAt: new Date().toISOString(),
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(),
    contentSha256: createHash('sha256').update(JSON.stringify(files)).digest('hex'), files,
  };
}

export function assertAcceptanceContentUnchanged(before: ReturnType<typeof captureAcceptanceRun>, repoRoot: string) {
  const after = captureAcceptanceRun(repoRoot);
  if (before.commit !== after.commit || before.contentSha256 !== after.contentSha256) {
    throw new Error('Source changed during acceptance; rerun against the final content');
  }
}
