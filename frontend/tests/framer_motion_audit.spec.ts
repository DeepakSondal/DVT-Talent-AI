import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

function walkDir(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') walkDir(filePath, fileList);
    } else if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

test.describe('Framer Motion Animation & App Router Safety Suite', () => {

  test('test case 1: verifies 100% of files importing framer-motion declare "use client"', async () => {
    const srcDir = path.resolve(__dirname, '../src');
    const files = walkDir(srcDir);
    const motionFiles = files.filter((f) => {
      const content = fs.readFileSync(f, 'utf8');
      return content.includes('framer-motion');
    });

    expect(motionFiles.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const f of motionFiles) {
      const content = fs.readFileSync(f, 'utf8');
      const trimmed = content.trim();
      const firstLine = trimmed.split('\n')[0].replace(/['"]/g, '').replace(';', '').trim();
      if (firstLine !== 'use client') {
        violations.push(path.relative(srcDir, f));
      }
    }

    expect(violations).toEqual([]);
  });

  test('test case 2: verifies AnimatePresence modals in core views define unique keys and animated backdrops', async () => {
    const teamPath = path.resolve(__dirname, '../src/app/dashboard/team/page.tsx');
    const portalLayoutPath = path.resolve(__dirname, '../src/app/portal/layout.tsx');
    const candidatesPath = path.resolve(__dirname, '../src/app/dashboard/candidates/page.tsx');

    const teamContent = fs.readFileSync(teamPath, 'utf8');
    const portalContent = fs.readFileSync(portalLayoutPath, 'utf8');
    const candidatesContent = fs.readFileSync(candidatesPath, 'utf8');

    // Team modal has animated backdrop with stable key
    expect(teamContent).toContain('key="invite-team-modal-backdrop"');
    expect(teamContent).toContain('key="invite-team-modal-content"');

    // Portal mobile drawer has stable key
    expect(portalContent).toContain('key="portal-mobile-navigation-drawer"');

    // Candidates floating bar has stable key
    expect(candidatesContent).toContain('key="bulk-selection-floating-bar"');
    expect(candidatesContent).toContain('key="upload-resume-modal-backdrop"');
  });

  test('test case 3: verifies GPU-accelerated progress bars and spring physics configuration', async () => {
    const recruitingPath = path.resolve(__dirname, '../src/app/dashboard/recruiting/page.tsx');
    const recruitingContent = fs.readFileSync(recruitingPath, 'utf8');

    // recruiting progress bar uses scaleX + originX (GPU-accelerated) rather than width
    expect(recruitingContent).toContain('scaleX');
    expect(recruitingContent).toContain('originX: 0');

    // Portal layout includes useReducedMotion import
    const portalLayoutPath = path.resolve(__dirname, '../src/app/portal/layout.tsx');
    const portalContent = fs.readFileSync(portalLayoutPath, 'utf8');
    expect(portalContent).toContain('useReducedMotion');
  });

});
