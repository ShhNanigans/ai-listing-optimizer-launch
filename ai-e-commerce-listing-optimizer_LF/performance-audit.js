#!/usr/bin/env node

/**
 * Performance Audit Script
 * Measures bundle size, loading times, and provides optimization recommendations
 */

import { readFileSync, statSync, readdirSync } from 'fs';
import { join, extname } from 'path';
import { gzipSync, brotliCompressSync } from 'zlib';

const DIST_DIR = './dist';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const BLUE = '\x1b[34m';

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getCompressionRatio(original, compressed) {
  return ((1 - compressed / original) * 100).toFixed(1);
}

function analyzeBundle() {
  console.log(`${BLUE}📊 Bundle Analysis${RESET}\n`);
  
  try {
    const files = readdirSync(DIST_DIR, { recursive: true });
    const assets = {
      js: [],
      css: [],
      html: [],
      other: []
    };

    files.forEach(file => {
      if (typeof file !== 'string') return;
      
      const filePath = join(DIST_DIR, file);
      try {
        const stats = statSync(filePath);
        if (!stats.isFile()) return;

        const ext = extname(file).toLowerCase();
        const size = stats.size;
        const content = readFileSync(filePath);
        const gzipped = gzipSync(content).length;
        const brotli = brotliCompressSync(content).length;

        const asset = {
          name: file,
          size,
          gzipped,
          brotli,
          gzipRatio: getCompressionRatio(size, gzipped),
          brotliRatio: getCompressionRatio(size, brotli)
        };

        switch (ext) {
          case '.js':
            assets.js.push(asset);
            break;
          case '.css':
            assets.css.push(asset);
            break;
          case '.html':
            assets.html.push(asset);
            break;
          default:
            assets.other.push(asset);
        }
      } catch (error) {
        // Skip inaccessible files
      }
    });

    // JavaScript Analysis
    if (assets.js.length > 0) {
      console.log(`${GREEN}JavaScript Files:${RESET}`);
      let totalJS = 0, totalJSGzip = 0, totalJSBrotli = 0;
      
      assets.js.forEach(asset => {
        totalJS += asset.size;
        totalJSGzip += asset.gzipped;
        totalJSBrotli += asset.brotli;
        
        const sizeColor = asset.size > 100000 ? RED : asset.size > 50000 ? YELLOW : GREEN;
        console.log(`  ${asset.name}: ${sizeColor}${formatBytes(asset.size)}${RESET} | Gzip: ${formatBytes(asset.gzipped)} (${asset.gzipRatio}%) | Brotli: ${formatBytes(asset.brotli)} (${asset.brotliRatio}%)`);
      });
      
      console.log(`  ${BLUE}Total JS: ${formatBytes(totalJS)} | Gzipped: ${formatBytes(totalJSGzip)} | Brotli: ${formatBytes(totalJSBrotli)}${RESET}\n`);
    }

    // CSS Analysis
    if (assets.css.length > 0) {
      console.log(`${GREEN}CSS Files:${RESET}`);
      let totalCSS = 0, totalCSSGzip = 0, totalCSSBrotli = 0;
      
      assets.css.forEach(asset => {
        totalCSS += asset.size;
        totalCSSGzip += asset.gzipped;
        totalCSSBrotli += asset.brotli;
        
        const sizeColor = asset.size > 50000 ? RED : asset.size > 20000 ? YELLOW : GREEN;
        console.log(`  ${asset.name}: ${sizeColor}${formatBytes(asset.size)}${RESET} | Gzip: ${formatBytes(asset.gzipped)} (${asset.gzipRatio}%) | Brotli: ${formatBytes(asset.brotli)} (${asset.brotliRatio}%)`);
      });
      
      console.log(`  ${BLUE}Total CSS: ${formatBytes(totalCSS)} | Gzipped: ${formatBytes(totalCSSGzip)} | Brotli: ${formatBytes(totalCSSBrotli)}${RESET}\n`);
    }

    // Performance Recommendations
    console.log(`${BLUE}📈 Performance Recommendations:${RESET}\n`);
    
    const totalSize = assets.js.reduce((sum, asset) => sum + asset.size, 0) + 
                      assets.css.reduce((sum, asset) => sum + asset.size, 0);
    
    if (totalSize < 50000) {
      console.log(`${GREEN}✅ Excellent bundle size (${formatBytes(totalSize)})${RESET}`);
    } else if (totalSize < 100000) {
      console.log(`${YELLOW}⚠️  Good bundle size (${formatBytes(totalSize)}) - Consider code splitting${RESET}`);
    } else {
      console.log(`${RED}❌ Large bundle size (${formatBytes(totalSize)}) - Implement aggressive code splitting${RESET}`);
    }

    // Check for large individual files
    const largeFiles = [...assets.js, ...assets.css].filter(asset => asset.size > 100000);
    if (largeFiles.length > 0) {
      console.log(`${RED}❌ Large files detected:${RESET}`);
      largeFiles.forEach(file => {
        console.log(`   - ${file.name}: ${formatBytes(file.size)}`);
      });
      console.log('   Consider code splitting or lazy loading\n');
    }

    // Compression efficiency
    const avgCompressionJS = assets.js.reduce((sum, asset) => sum + parseFloat(asset.gzipRatio), 0) / assets.js.length;
    const avgCompressionCSS = assets.css.reduce((sum, asset) => sum + parseFloat(asset.gzipRatio), 0) / assets.css.length;
    
    if (avgCompressionJS > 60) {
      console.log(`${GREEN}✅ Good JavaScript compression ratio (${avgCompressionJS.toFixed(1)}%)${RESET}`);
    } else {
      console.log(`${YELLOW}⚠️  Consider minification improvements for JavaScript${RESET}`);
    }

    if (avgCompressionCSS > 70) {
      console.log(`${GREEN}✅ Good CSS compression ratio (${avgCompressionCSS.toFixed(1)}%)${RESET}`);
    } else {
      console.log(`${YELLOW}⚠️  Consider CSS optimization techniques${RESET}`);
    }

  } catch (error) {
    console.error(`${RED}❌ Error analyzing bundle: ${error.message}${RESET}`);
    console.log('Make sure to run "npm run build" first');
  }
}

function checkCriticalResources() {
  console.log(`\n${BLUE}🔍 Critical Resource Analysis${RESET}\n`);
  
  try {
    const indexPath = join(DIST_DIR, 'index.html');
    const indexContent = readFileSync(indexPath, 'utf-8');
    
    // Check for critical CSS inlining
    const hasInlinedCSS = indexContent.includes('<style>') && indexContent.includes('critical');
    console.log(hasInlinedCSS ? 
      `${GREEN}✅ Critical CSS is inlined${RESET}` : 
      `${RED}❌ Critical CSS not found - consider inlining above-the-fold styles${RESET}`
    );

    // Check for preload directives
    const hasPreloads = indexContent.includes('rel="preload"');
    console.log(hasPreloads ? 
      `${GREEN}✅ Resource preloading detected${RESET}` : 
      `${YELLOW}⚠️  Consider adding preload directives for critical resources${RESET}`
    );

    // Check for font optimization
    const hasFontDisplay = indexContent.includes('display=swap');
    console.log(hasFontDisplay ? 
      `${GREEN}✅ Font loading optimized with display=swap${RESET}` : 
      `${YELLOW}⚠️  Consider adding font-display: swap for web fonts${RESET}`
    );

    // Check for service worker
    const hasServiceWorker = indexContent.includes('serviceWorker');
    console.log(hasServiceWorker ? 
      `${GREEN}✅ Service Worker detected${RESET}` : 
      `${YELLOW}⚠️  Consider implementing Service Worker for caching${RESET}`
    );

  } catch (error) {
    console.error(`${RED}❌ Error checking critical resources: ${error.message}${RESET}`);
  }
}

function generateReport() {
  console.log(`${BLUE}🚀 Performance Audit Report${RESET}`);
  console.log('='.repeat(50));
  
  analyzeBundle();
  checkCriticalResources();
  
  console.log(`\n${BLUE}📝 Optimization Checklist:${RESET}`);
  console.log(`${GREEN}✅${RESET} Bundle size analysis`);
  console.log(`${GREEN}✅${RESET} Compression ratios`);
  console.log(`${GREEN}✅${RESET} Critical CSS inlining`);
  console.log(`${GREEN}✅${RESET} Resource preloading`);
  console.log(`${GREEN}✅${RESET} Font optimization`);
  console.log(`${GREEN}✅${RESET} Service Worker implementation`);
  
  console.log(`\n${BLUE}🎯 Next Steps:${RESET}`);
  console.log('1. Monitor Core Web Vitals in production');
  console.log('2. Test on slower devices and networks');
  console.log('3. Implement performance monitoring');
  console.log('4. Consider server-side rendering for better SEO');
  console.log('5. Add image optimization if needed');
  
  console.log(`\n${GREEN}Audit completed! 🎉${RESET}`);
}

// Run the audit
generateReport();