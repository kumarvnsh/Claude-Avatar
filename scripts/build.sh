#!/bin/bash
# Build script for Claude Avatars

set -e

echo "🧹 Cleaning dist..."
rm -rf dist

echo "📦 Compiling main process (TypeScript)..."
npx tsc

echo "📦 Bundling preload (esbuild)..."
npx esbuild src/preload/index.ts \
  --bundle \
  --outfile=dist/preload/index.js \
  --platform=node \
  --format=cjs \
  --target=es2022 \
  --external:electron \
  --sourcemap

echo "📦 Bundling renderer (esbuild)..."
npx esbuild src/renderer/index.ts \
  --bundle \
  --outfile=dist/renderer/index.js \
  --platform=browser \
  --format=iife \
  --target=es2022 \
  --sourcemap

echo "📋 Copying static assets..."
cp src/renderer/index.html dist/renderer/
cp src/renderer/styles.css dist/renderer/

echo "✅ Build complete!"
echo ""
echo "Run with: npx electron ."
echo "Or package: npm run package"
