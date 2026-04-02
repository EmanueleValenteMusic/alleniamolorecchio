import { build } from 'esbuild';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src');
const stylesDir = path.join(srcDir, 'styles');
const outDir = path.join(projectRoot, 'dist');

async function collectCssFiles(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      return collectCssFiles(fullPath);
    }

    if (entry.isFile() && entry.name.endsWith('.css')) {
      return [fullPath];
    }

    return [];
  }));

  return files.flat().sort();
}

async function readStyles() {
  const cssFiles = await collectCssFiles(stylesDir);
  const chunks = await Promise.all(cssFiles.map(async (filePath) => readFile(filePath, 'utf8')));
  return chunks.join('\n\n');
}

const [bundle, styles] = await Promise.all([
  build({
    absWorkingDir: projectRoot,
    entryPoints: [path.join(srcDir, 'main.ts')],
    bundle: true,
    write: false,
    format: 'iife',
    target: ['es2020'],
    minify: true,
    platform: 'browser'
  }),
  readStyles()
]);

const script = bundle.outputFiles[0].text;
const html = String.raw`<!DOCTYPE html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Progressioni Armoniche</title>
    <style>${styles}</style>
  </head>
  <body>
    <div id="app"></div>
    <script>${script}</script>
  </body>
</html>`;

await mkdir(outDir, { recursive: true });
await Promise.all([
  writeFile(path.join(outDir, 'index.html'), html, 'utf8'),
  writeFile(path.join(projectRoot, 'index.html'), html, 'utf8')
]);

console.log('Build completata: index.html e dist/index.html');