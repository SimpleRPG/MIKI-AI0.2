import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import JSZip from 'jszip';

const root = process.cwd();
const outputDir = path.join(root, 'public');
const outputFile = path.join(outputDir, 'self-code-seed.zip');

const excludedPrefixes = ['.git/', 'node_modules/', 'dist/', 'android/.gradle/', 'android/app/build/'];
const isIncluded = file => !excludedPrefixes.some(prefix => file.startsWith(prefix)) && file !== 'public/self-code-seed.zip';
const hasGitRepository = fs.existsSync(path.join(root, '.git'));
let commitSha = 'ARCHIVE_WITHOUT_GIT_METADATA';
let files = [];
const blobShaByPath = new Map();

if (hasGitRepository) {
  commitSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean).filter(isIncluded);
  const treeOutput = execFileSync('git', ['ls-tree', '-r', '-z', 'HEAD', '--full-tree'], { cwd: root, encoding: 'utf8' });
  for (const record of treeOutput.split('\0')) {
    if (!record) continue;
    const tab = record.indexOf('\t');
    if (tab < 0) continue;
    const header = record.slice(0, tab).trim().split(/\s+/);
    const relativePath = record.slice(tab + 1);
    if (header[1] === 'blob' && header[2] && relativePath) blobShaByPath.set(relativePath, header[2]);
  }
} else {
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      if (entry.isDirectory()) {
        if (!excludedPrefixes.some(prefix => `${relative}/`.startsWith(prefix))) visit(absolute);
      } else if (entry.isFile() && isIncluded(relative)) {
        files.push(relative);
      }
    }
  };
  visit(root);
  files.sort((left, right) => left.localeCompare(right));
  for (const relative of files) {
    const buffer = fs.readFileSync(path.join(root, relative));
    const header = Buffer.from(`blob ${buffer.length}\0`, 'utf8');
    blobShaByPath.set(relative, crypto.createHash('sha1').update(header).update(buffer).digest('hex'));
  }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const zip = new JSZip();
const manifestFiles = [];
const ZIP_DATE = new Date(0);

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

  zip.file(relativePath, content, {
    date: ZIP_DATE,
    createFolders: false,
  });

  manifestFiles.push({
    path: relativePath,
    sha256,
    blobSha,
  });
}

manifestFiles.sort((a, b) => a.path.localeCompare(b.path));

const revisionFiles = manifestFiles.map(({ path, sha256 }) => ({
  path,
  sha256,
}));

const canonicalize = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, item]) =>
          `${JSON.stringify(key)}:${canonicalize(item)}`
      )
      .join(',')}}`;
  }

  return JSON.stringify(value);
};

const seedRevision = crypto
  .createHash('sha256')
  .update(canonicalize(revisionFiles))
  .digest('hex');

const manifest = {
  schemaVersion: 1,
  appVersion: String(packageJson.version || ''),
  commitSha,
  seedRevision,
  fileCount: manifestFiles.length,
  files: manifestFiles
};

zip.file(
  'self-code-seed.manifest.json',
  JSON.stringify(manifest, null, 2),
  {
    date: ZIP_DATE,
    createFolders: false,
  }
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
