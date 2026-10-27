import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

test.describe('Hallmark Depth 1 & 2 Design System & Token Integrity Suite', () => {

  test('test case 1: verifies tokens.css defines required OKLCH color tokens, spacing scale, and radius system', async () => {
    const tokensPath = path.resolve(__dirname, '../src/app/tokens.css');
    expect(fs.existsSync(tokensPath)).toBe(true);

    const tokensContent = fs.readFileSync(tokensPath, 'utf8');

    // Check essential Hallmark semantic tokens
    expect(tokensContent).toContain('--color-paper');
    expect(tokensContent).toContain('--color-ink');
    expect(tokensContent).toContain('--color-accent');
    expect(tokensContent).toContain('--color-accent-ink');
    expect(tokensContent).toContain('--color-muted');
    expect(tokensContent).toContain('--color-rule');
    expect(tokensContent).toContain('--color-line');

    // Check spacing and radius tokens
    expect(tokensContent).toContain('--space-');
    expect(tokensContent).toContain('--radius-');

    // Check OKLCH format usage
    expect(tokensContent).toMatch(/oklch\(\s*\d+%/);
  });

  test('test case 2: verifies base.css and globals.css include motion safety, focus rings, and Hallmark metadata stamp', async () => {
    const basePath = path.resolve(__dirname, '../src/app/base.css');
    const globalsPath = path.resolve(__dirname, '../src/app/globals.css');

    expect(fs.existsSync(basePath)).toBe(true);
    expect(fs.existsSync(globalsPath)).toBe(true);

    const baseContent = fs.readFileSync(basePath, 'utf8');
    const globalsContent = fs.readFileSync(globalsPath, 'utf8');

    // Hallmark header stamp in globals.css
    expect(globalsContent).toContain('Hallmark');
    expect(globalsContent).toContain('@import url("./tokens.css");');
    expect(globalsContent).toContain('@import url("./base.css");');

    // Essential reset gates in base.css
    expect(baseContent).toContain('overflow-x: clip');
    expect(baseContent).toContain(':focus-visible');
    expect(baseContent).toContain('prefers-reduced-motion');
    expect(baseContent).toContain('white-space: nowrap');
  });

  test('test case 3: verifies zero Hallmark Floor FAIL violations across application pages', async () => {
    const sloplintScript = path.resolve(
      'C:/Users/Lenovo/.gemini/config/skills/hallmark/scripts/sloplint.mjs'
    );
    expect(fs.existsSync(sloplintScript)).toBe(true);

    const appPath = path.resolve(__dirname, '../src/app');
    let stdout = '';
    try {
      stdout = execSync(
        `node "${sloplintScript}" "${appPath}" --genre modern-minimal --scope app --json`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
    } catch (err: any) {
      // sloplint exits with code 1 if any FAIL or REFLEX exists
      if (err.stdout) {
        stdout = typeof err.stdout === 'string' ? err.stdout : err.stdout.toString('utf8');
      }
    }

    expect(stdout.length).toBeGreaterThan(0);
    const parsed = JSON.parse(stdout);

    // Filter floor failures
    const floorFails = (parsed.findings || []).filter(
      (f: any) => f.grade === 'FAIL'
    );

    expect(floorFails).toEqual([]);
    expect(parsed.summary.fails).toBe(0);
  });

});
