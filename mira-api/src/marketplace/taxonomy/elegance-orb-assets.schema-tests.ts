/**
 * ACC: every write-enabled elegance leaf must have a dedicated orb+thumb asset
 * linked by taxonomy id. Fail on missing file, shared fallback reuse, or wrong id.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../../');
const taxPath = path.join(here, 'elegance-taxonomy.v1.json');
const assetsPath = path.join(here, 'elegance-orb-assets.v1.json');

type Node = {
  id: string;
  parentId: string | null;
  browseOnly?: boolean;
  writeEnabled?: boolean;
  imageKey?: string;
  labelAr?: string;
  children?: string[];
};

function main() {
  const tax = JSON.parse(fs.readFileSync(taxPath, 'utf8')) as { nodes: Node[] };
  const assets = JSON.parse(fs.readFileSync(assetsPath, 'utf8')) as {
    byNodeId: Record<string, { orb: string; thumb: string; file?: string; navOnly?: boolean }>;
  };

  const writeLeaves = tax.nodes.filter(
    (n) => !!n.parentId && !n.browseOnly && Array.isArray(n.children) && n.children.length === 0,
  );

  const failures: string[] = [];
  const usedOrb = new Map<string, string>();
  const usedThumb = new Map<string, string>();

  for (const leaf of writeLeaves) {
    const meta = assets.byNodeId[leaf.id];
    if (!meta) {
      failures.push(`missing asset map entry for ${leaf.id}`);
      continue;
    }
    const orbFile = path.join(repoRoot, 'partners-portal/web', meta.orb);
    const thumbFile = path.join(repoRoot, meta.thumb);
    if (!fs.existsSync(orbFile)) failures.push(`missing orb file for ${leaf.id}: ${orbFile}`);
    if (!fs.existsSync(thumbFile)) failures.push(`missing thumb file for ${leaf.id}: ${thumbFile}`);
    if (meta.orb.includes('sub-0') || meta.orb.includes('sub-1')) {
      failures.push(`fallback orb reused for ${leaf.id}`);
    }
    const prevOrb = usedOrb.get(meta.orb);
    if (prevOrb && prevOrb !== leaf.id) {
      failures.push(`orb ${meta.orb} shared by ${prevOrb} and ${leaf.id}`);
    }
    usedOrb.set(meta.orb, leaf.id);
    const prevThumb = usedThumb.get(meta.thumb);
    if (prevThumb && prevThumb !== leaf.id) {
      failures.push(`thumb ${meta.thumb} shared by ${prevThumb} and ${leaf.id}`);
    }
    usedThumb.set(meta.thumb, leaf.id);
    if (leaf.imageKey && leaf.imageKey !== `elegance.${leaf.id}`) {
      failures.push(`imageKey mismatch for ${leaf.id}: ${leaf.imageKey}`);
    }
  }

  for (const rootId of ['clothes', 'bags', 'shoes', 'face', 'body', 'hair', 'accessories']) {
    const allId = `${rootId}.all`;
    const meta = assets.byNodeId[allId];
    if (!meta) failures.push(`missing nav asset for ${allId}`);
  }

  const report = {
    writeLeaves: writeLeaves.length,
    failures,
    ok: failures.length === 0,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    console.error('ACC-ELEGANCE-ORB-ASSETS FAIL');
    process.exit(1);
  }
  console.log('ACC-ELEGANCE-ORB-ASSETS PASS');
}

main();
