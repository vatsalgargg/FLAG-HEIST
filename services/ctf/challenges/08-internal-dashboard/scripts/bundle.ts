/**
 * Challenge 08 — Frontend Bundler & Production Artifact Packaging Script
 *
 * Runs esbuild to genuinely bundle and minify the frontend client code into
 * /artifacts/bundle.min.js, then packages the release zip archive.
 */

import * as esbuild from 'esbuild';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const artifactsDir = path.join(rootDir, 'artifacts');
  const entryPoint = path.join(rootDir, 'src', 'frontend', 'index.ts');
  const outputFile = path.join(artifactsDir, 'bundle.min.js');

  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  console.log('[BUILD] Running esbuild production bundling & minification...');
  await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    minify: true,
    sourcemap: false,
    format: 'iife',
    globalName: 'VeyraPortal',
    target: ['es2020'],
    outfile: outputFile,
  });

  const stats = fs.statSync(outputFile);
  console.log(`[BUILD] Generated bundle.min.js (${stats.size} bytes)`);

  // Package the downloadable source bundle zip
  console.log('[BUILD] Packaging veyra-frontend-portal-release.zip...');
  const zipPath = path.join(artifactsDir, 'veyra-frontend-portal-release.zip');

  // Copy backend route files and client assets into a staging directory for the zip
  const stagingDir = path.join(artifactsDir, 'staging');
  if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
  fs.mkdirSync(stagingDir, { recursive: true });

  fs.copyFileSync(outputFile, path.join(stagingDir, 'bundle.min.js'));

  const portalHtml = path.join(rootDir, '..', '07-invoice-trail', 'public', 'index.html');
  if (fs.existsSync(portalHtml)) {
    fs.copyFileSync(portalHtml, path.join(stagingDir, 'index.html'));
  }

  // Copy backend route files
  const routesDir = path.join(stagingDir, 'routes');
  fs.mkdirSync(routesDir, { recursive: true });
  const backendSrcRoutes = path.join(rootDir, '..', '07-invoice-trail', 'src', 'routes');
  for (const f of ['dashboard.ts', 'invoices.ts', 'auth.ts', 'audit.ts', 'reset.ts']) {
    const srcF = path.join(backendSrcRoutes, f);
    if (fs.existsSync(srcF)) {
      fs.copyFileSync(srcF, path.join(routesDir, f));
    }
  }

  // Write manifest
  fs.writeFileSync(
    path.join(stagingDir, 'MANIFEST.json'),
    JSON.stringify(
      {
        package: 'veyra-frontend-portal-release',
        version: '2.4.1-rc3',
        environment: 'production',
        buildDate: new Date().toISOString(),
        bundler: 'esbuild/0.25',
      },
      null,
      2
    )
  );

  // Write a dedicated python script to do the zipping cleanly
  const pyScriptPath = path.join(artifactsDir, 'make_zip.py');
  fs.writeFileSync(
    pyScriptPath,
    `import zipfile, os
staging = r"""${stagingDir}"""
out_zip = r"""${zipPath}"""
with zipfile.ZipFile(out_zip, "w", zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(staging):
        for f in files:
            full_p = os.path.join(root, f)
            rel_p = os.path.relpath(full_p, staging)
            z.write(full_p, rel_p)
`
  );

  execSync(`python3 "${pyScriptPath}"`);
  fs.unlinkSync(pyScriptPath);

  // Clean up staging directory
  fs.rmSync(stagingDir, { recursive: true, force: true });

  const zipStats = fs.statSync(zipPath);
  console.log(`[BUILD] Created ${zipPath} (${zipStats.size} bytes)`);
  console.log('[BUILD] Artifact generation complete.');
}

main().catch(err => {
  console.error('[BUILD ERROR]', err);
  process.exit(1);
});
