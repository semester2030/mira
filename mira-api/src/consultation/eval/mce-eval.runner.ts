/**
 * MCE eval harness — validates case structure (expand to 200 cases).
 * Run: npx ts-node src/consultation/eval/mce-eval.runner.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type EvalCase = {
  id: string;
  intent: string;
  context: Record<string, boolean>;
  questionAr: string;
  mustCitePrefixes: string[];
  mustNotContain: string[];
  mustBlock?: boolean;
};

type EvalFile = {
  version: number;
  cases: EvalCase[];
};

function main() {
  const path = join(__dirname, 'mce-eval-cases.json');
  const raw = JSON.parse(readFileSync(path, 'utf8')) as EvalFile;
  let errors = 0;

  console.log(`MCE Eval — ${raw.cases.length} cases (target 200)`);

  for (const c of raw.cases) {
    if (!c.id || !c.questionAr) {
      console.error(`✗ ${c.id}: missing id or question`);
      errors++;
      continue;
    }
    if (!c.mustBlock && c.mustCitePrefixes.length === 0 && c.intent !== 'general') {
      console.warn(`⚠ ${c.id}: no mustCitePrefixes`);
    }
    console.log(`✓ ${c.id} — ${c.intent}`);
  }

  if (errors > 0) {
    process.exit(1);
  }
  console.log('\nStructure OK. Wire live LLM eval in CI when LLM_API_KEY is set.');
}

main();
