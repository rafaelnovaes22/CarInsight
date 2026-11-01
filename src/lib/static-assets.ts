import fs from 'fs';
import path from 'path';

const publicDirCandidates = [
  path.resolve(process.cwd(), 'dist', 'public'),
  path.resolve(process.cwd(), 'src', 'public'),
  path.resolve(__dirname, '..', 'public'),
];

function firstExistingPath(candidates: string[]): string {
  const existingPath = candidates.find(candidate => fs.existsSync(candidate));
  return existingPath || candidates[candidates.length - 1];
}

export function getPublicDir(): string {
  return firstExistingPath(publicDirCandidates);
}

export function getPublicFilePath(fileName: string): string {
  return path.join(getPublicDir(), fileName);
}
