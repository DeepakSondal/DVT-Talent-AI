import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

function walkSrc(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      if (entry !== 'node_modules' && entry !== '.next') walkSrc(full, files);
    } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
      files.push(full);
    }
  }
  return files;
}

test.describe('HttpOnly Auth & Same-Origin Proxy Hardening', () => {
  test('1. no frontend source file writes dvt_token to localStorage or document.cookie', () => {
    const srcDir = path.resolve(__dirname, '../src');
    const violations: string[] = [];

    for (const filePath of walkSrc(srcDir)) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('localStorage.setItem("dvt_token"') || content.includes("localStorage.setItem('dvt_token'")) {
        violations.push(`localStorage.setItem(dvt_token) in ${path.relative(srcDir, filePath)}`);
      }
      if (/document\.cookie\s*=\s*[`'"]dvt_token=/.test(content)) {
        violations.push(`document.cookie(dvt_token) in ${path.relative(srcDir, filePath)}`);
      }
    }

    expect(violations).toEqual([]);
  });

  test('2. http.ts uses withCredentials + X-Requested-With and never reads dvt_token from localStorage', () => {
    const httpContent = fs.readFileSync(path.resolve(__dirname, '../src/lib/http.ts'), 'utf8');
    expect(httpContent).toContain('withCredentials: true');
    expect(httpContent).toContain('"X-Requested-With": "XMLHttpRequest"');
    expect(httpContent).not.toContain('localStorage.getItem("dvt_token")');
  });

  test('3. next.config.js defines same-origin /api/v1 rewrite and defaults NEXT_PUBLIC_API_URL to /api/v1', () => {
    const nextConfig = fs.readFileSync(path.resolve(__dirname, '../next.config.js'), 'utf8');
    expect(nextConfig).toContain('source: "/api/v1/:path*"');
    expect(nextConfig).toContain('NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "/api/v1"');
  });
});
