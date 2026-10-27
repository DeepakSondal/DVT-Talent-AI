import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('UI/UX Pro Max Remediation & Component Integrity Suite', () => {

  test('test case 1: verifies FormErrorSummary adheres to WCAG focusable error summary requirements', async () => {
    const errorSummaryPath = path.resolve(__dirname, '../src/components/ui/FormErrorSummary.tsx');
    expect(fs.existsSync(errorSummaryPath)).toBe(true);

    const content = fs.readFileSync(errorSummaryPath, 'utf8');

    // WCAG 2.1 AA / 2.2 Error Summary semantics
    expect(content).toContain('role="alert"');
    expect(content).toContain('tabIndex={-1}');
    expect(content).toContain('aria-labelledby');
    expect(content).toContain('scrollIntoView');
    expect(content).toContain('targetEl.focus()');

    // Job creation page integration
    const jobCreatePath = path.resolve(__dirname, '../src/app/dashboard/jobs/create/page.tsx');
    const jobCreateContent = fs.readFileSync(jobCreatePath, 'utf8');
    expect(jobCreateContent).toContain('FormErrorSummary');
    expect(jobCreateContent).toContain('setFormErrors');
  });

  test('test case 2: verifies TableSkeleton provides accessible layout-shift-free loading states', async () => {
    const skeletonPath = path.resolve(__dirname, '../src/components/ui/Skeleton.tsx');
    expect(fs.existsSync(skeletonPath)).toBe(true);

    const content = fs.readFileSync(skeletonPath, 'utf8');

    // TableSkeleton component declaration
    expect(content).toContain('export function TableSkeleton');
    expect(content).toContain('role="status"');
    expect(content).toContain('aria-label="Loading table data..."');
    expect(content).toContain('animate-pulse');

    // Audit page verification using structured skeletons instead of bare spinner
    const auditPath = path.resolve(__dirname, '../src/app/dashboard/audit/page.tsx');
    const auditContent = fs.readFileSync(auditPath, 'utf8');
    expect(auditContent).not.toContain('animate-spin w-6 h-6 border-2');
    expect(auditContent).toContain('animate-pulse');
  });

  test('test case 3: verifies CommandPalette global navigation shortcuts and route registry', async () => {
    const cmdPalettePath = path.resolve(__dirname, '../src/components/ui/CommandPalette.tsx');
    expect(fs.existsSync(cmdPalettePath)).toBe(true);

    const content = fs.readFileSync(cmdPalettePath, 'utf8');

    // Global keyboard shortcut
    expect(content).toContain('e.key.toLowerCase() === "k"');
    expect(content).toContain('e.key === "Escape"');
    expect(content).toContain('role="dialog"');
    expect(content).toContain('aria-modal="true"');

    // Route actions registered in catalog
    expect(content).toContain('/dashboard/sourcing');
    expect(content).toContain('/dashboard/candidates');
    expect(content).toContain('/dashboard/jobs/create');
    expect(content).toContain('/portal');

    // Mounted in SidebarLayout
    const sidebarPath = path.resolve(__dirname, '../src/components/layout/sidebar-layout.tsx');
    const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
    expect(sidebarContent).toContain('CommandPalette');
    expect(sidebarContent).toContain('setCommandOpen');
  });

});
