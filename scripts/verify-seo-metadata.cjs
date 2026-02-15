#!/usr/bin/env node

/**
 * Simple verification script to check SEO metadata implementation
 * Tests that all required metadata is properly configured
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 SEO Metadata Verification\n');
console.log('=' .repeat(60));

const errors = [];
const warnings = [];
const successes = [];

// Check layout.tsx for required meta tags
const layoutPath = path.join(__dirname, '..', 'src', 'app', '(frontend)', 'layout.tsx');
const layoutContent = fs.readFileSync(layoutPath, 'utf8');

// Check viewport
if (layoutContent.includes("viewport: 'width=device-width, initial-scale=1'")) {
  successes.push('✅ viewport meta tag configured');
} else {
  errors.push('❌ viewport meta tag missing');
}

// Check theme color
if (layoutContent.includes("themeColor: '#0f172a'")) {
  successes.push('✅ themeColor (#0f172a) configured');
} else {
  errors.push('❌ themeColor missing or incorrect');
}

// Check apple touch icon
if (layoutContent.includes("apple: '/apple-touch-icon.png'")) {
  successes.push('✅ Apple touch icon declared');
} else {
  errors.push('❌ Apple touch icon not declared');
}

// Check hreflang alternates
if (layoutContent.includes('alternates:') && 
    layoutContent.includes('languages:') &&
    layoutContent.includes("'he-IL':") &&
    layoutContent.includes("en:")) {
  successes.push('✅ hreflang alternates configured (he-IL, en)');
} else {
  errors.push('❌ hreflang alternates missing or incomplete');
}

// Check for removal of Payload branding
if (layoutContent.includes('@payloadcms') || layoutContent.includes('creator: ')) {
  errors.push('❌ Twitter creator @payloadcms still present');
} else {
  successes.push('✅ Twitter creator @payloadcms removed');
}

// Check mergeOpenGraph.ts
const mergeOGPath = path.join(__dirname, '..', 'src', 'infra', 'utils', 'mergeOpenGraph.ts');
const mergeOGContent = fs.readFileSync(mergeOGPath, 'utf8');

if (mergeOGContent.includes('A-Guy') && !mergeOGContent.includes('Payload Website Template')) {
  successes.push('✅ mergeOpenGraph updated with A-Guy branding');
} else {
  errors.push('❌ mergeOpenGraph still has Payload branding or missing A-Guy');
}

if (mergeOGContent.includes('telescope.4ee60378.svg')) {
  successes.push('✅ Default OG image set to telescope logo');
} else {
  errors.push('❌ Default OG image incorrect');
}

// Check generateMeta.ts
const genMetaPath = path.join(__dirname, '..', 'src', 'infra', 'utils', 'generateMeta.ts');
const genMetaContent = fs.readFileSync(genMetaPath, 'utf8');

if (genMetaContent.includes("' | A-Guy'") && !genMetaContent.includes('Payload Website Template')) {
  successes.push('✅ generateMeta title template updated');
} else {
  errors.push('❌ generateMeta title template incorrect');
}

if (genMetaContent.includes('telescope.4ee60378.svg')) {
  successes.push('✅ generateMeta fallback image set correctly');
} else {
  errors.push('❌ generateMeta fallback image incorrect');
}

// Check apple-touch-icon.png exists
const appleTouchIconPath = path.join(__dirname, '..', 'public', 'apple-touch-icon.png');
if (fs.existsSync(appleTouchIconPath)) {
  const stats = fs.statSync(appleTouchIconPath);
  if (stats.size > 1000) { // Should be at least 1KB for a proper icon
    successes.push('✅ apple-touch-icon.png exists and has content');
  } else {
    warnings.push('⚠️  apple-touch-icon.png exists but seems too small');
  }
} else {
  errors.push('❌ apple-touch-icon.png not found in public/');
}

// Check i18n files
const heJsonPath = path.join(__dirname, '..', 'src', 'i18n', 'he.json');
const heContent = fs.readFileSync(heJsonPath, 'utf8');

if (heContent.includes('תרגול מתמטיקה אינטראקטיבי')) {
  successes.push('✅ Hebrew i18n updated with correct metadata');
} else {
  errors.push('❌ Hebrew i18n metadata incorrect');
}

const enJsonPath = path.join(__dirname, '..', 'src', 'i18n', 'en.json');
const enContent = fs.readFileSync(enJsonPath, 'utf8');

if (enContent.includes('Interactive Math Practice')) {
  successes.push('✅ English i18n updated with correct metadata');
} else {
  errors.push('❌ English i18n metadata incorrect');
}

// Print results
console.log('\n📊 Results:\n');

successes.forEach(msg => console.log(msg));
if (warnings.length > 0) {
  console.log('');
  warnings.forEach(msg => console.log(msg));
}
if (errors.length > 0) {
  console.log('');
  errors.forEach(msg => console.log(msg));
}

console.log('\n' + '='.repeat(60));
console.log(`\n✅ Passed: ${successes.length}`);
console.log(`⚠️  Warnings: ${warnings.length}`);
console.log(`❌ Failed: ${errors.length}`);

if (errors.length > 0) {
  console.log('\n❌ Verification FAILED - please fix the errors above\n');
  process.exit(1);
} else if (warnings.length > 0) {
  console.log('\n⚠️  Verification passed with warnings\n');
  process.exit(0);
} else {
  console.log('\n✅ All checks PASSED\n');
  process.exit(0);
}
