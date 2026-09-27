import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import JSZip from 'jszip';

const root = process.cwd();
const outputDir = path.join(root, 'public');
const outputFile = path.join(outputDir, 'self-code-seed.zip');

const commitSha = execFileSync(
  'git',
  ['rev-parse', 'HEAD'],
  { cwd: root, encoding: 'utf8' }
).trim();

const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, 'package.json'), 'utf8')
);

const files = execFileSync(
  'git',
  ['ls-files', '-z'],
  { cwd: root, encoding: 'utf8' }
)
  .split('\0')
  .filter(Boolean)
  .filter(file =>
    !file.startsWith('.git/') &&
    !file.startsWith('node_modules/') &&
    !file.startsWith('dist/') &&
    !file.startsWith('android/.gradle/') &&
    !file.startsWith('android/app/build/') &&
    file !== 'public/self-code-seed.zip'
  );

const treeOutput = execFileSync(
  'git',
  ['ls-tree', '-r', '-z', 'HEAD', '--full-tree'],
  { cwd: root, encoding: 'utf8' }
);

const blobShaByPath = new Map();

for (const record of treeOutput.split('\0')) {
  if (!record) continue;

  const tab = record.indexOf('\t');
  if (tab < 0) continue;

  const header = record
    .slice(0, tab)
    .trim()
    .split(/\s+/);

  const relativePath = record.slice(tab + 1);

  if (
    header[1] === 'blob' &&
    header[2] &&
    relativePath
  ) {
    blobShaByPath.set(
      relativePath,
      header[2]
    );
  }
}

const zip = new JSZip();
const manifestFiles = [];

for (const relativePath of files) {
  const absolutePath = path.join(root, relativePath);

  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    continue;
  }

  const buffer = fs.readFileSync(absolutePath);

  // SelfCodeWorkspaceはテキストソースとして扱うため、
  // バイナリはseedから除外する。
  if (buffer.includes(0)) {
    continue;
  }

  let content;
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    continue;
  }

  const sha256 = crypto
    .createHash('sha256')
    .update(buffer)
    .digest('hex');

  const blobSha = blobShaByPath.get(relativePath);

  if (!blobSha) {
    throw new Error(
      `SELF_CODE_SEED_BLOB_SHA_MISSING:${relativePath}`
    );
  }

  zip.file(relativePath, content);

  manifestFiles.push({
    path: relativePath,
    sha256,
    blobSha,
  });
}

manifestFiles.sort((a, b) => a.path.localeCompare(b.path));

const seedRevision = crypto
  .createHash('sha256')
  .update(JSON.stringify(manifestFiles))
  .digest('hex');

const manifest = {
  schemaVersion: 1,
  appVersion: String(packageJson.version || ''),
  commitSha,
  seedRevision,
  generatedAt: new Date().toISOString(),
  fileCount: manifestFiles.length,
  files: manifestFiles
};

zip.file(
  'self-code-seed.manifest.json',
  JSON.stringify(manifest, null, 2)
);

fs.mkdirSync(outputDir, { recursive: true });

const bytes = await zip.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 6 }
});

fs.writeFileSync(outputFile, bytes);

console.log(JSON.stringify({
  ok: true,
  output: path.relative(root, outputFile),
  appVersion: manifest.appVersion,
  commitSha,
  seedRevision,
  fileCount: manifest.fileCount,
  bytes: bytes.length
}, null, 2));
