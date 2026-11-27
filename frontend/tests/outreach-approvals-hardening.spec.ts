import { test, expect } from "@playwright/test";

function makeRecruiterJwt() {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: "rec-1",
      role: "recruiter",
      tenant_id: "tenant-1",
      is_superadmin: false,
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  ).toString("base64url");
  return `${header}.${payload}.sig`;
}

test.describe("Outreach Approvals Editing, Retry & Unsubscribe Page", () => {
  test("Approvals allows inline draft editing and sends edited subject/body on Approve", async ({ page }) => {
    let capturedPayload: any = null;
    await page.context().addCookies([
      { name: "dvt_token", value: `Bearer ${makeRecruiterJwt()}`, domain: "localhost", path: "/" },
    ]);

    await page.route("**/api/v1/tenants/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "tenant-1", name: "Acme Talent", onboarded: true }),
      });
    });

    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "rec-1",
          email: "recruiter@acme.com",
          full_name: "Recruiter Alpha",
          role: "recruiter",
          tenant_id: "tenant-1",
          is_active: true,
        }),
      });
    });

    await page.route("**/api/v1/compliance/ledgers**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              id: "ledger-1",
              job_id: "job-1",
              job_title: "Principal Platform Engineer",
              candidate_id: "cand-1",
              candidate_name: "Nadia Portal",
              candidate_email: "nadia@proton.me",
              candidate_title: "Staff Engineer",
              has_verified_email: true,
              pii_erased: false,
              decision_type: "outreach_approval",
              action_type: "outreach_approval",
              confidence_score: 0.91,
              draft_subject: "Original AI Subject",
              draft_body: "Original AI body copy.",
              email_dispatch_status: "draft",
              reasoning: "High architectural match.",
              reviewer_override: "PENDING",
              sanitized: true,
              created_at: new Date().toISOString(),
            },
          ]),
        });
        return;
      }

      if (route.request().url().includes("/override")) {
        capturedPayload = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            status: "SUCCESS",
            human_action: "APPROVED",
            outreach_dispatch_status: "sent",
          }),
        });
      }
    });

    await page.goto("/dashboard/approvals");
    await expect(page.getByText("Nadia Portal")).toBeVisible();
    await page.getByRole("button", { name: /Edit Draft/i }).click();

    await page.getByLabel("Edit outreach subject").fill("Edited Subject Line");
    await page.getByLabel("Edit outreach body").fill("Edited body with transparent comp range.");
    await page.getByRole("button", { name: /Approve & Send Email/i }).click();

    await expect(page.getByText("Approved & Sent")).toBeVisible();
    expect(capturedPayload?.draft_subject).toBe("Edited Subject Line");
    expect(capturedPayload?.draft_body).toBe("Edited body with transparent comp range.");
  });

  test("Approvals keeps failed outreach draft retryable with Retry Send Email button", async ({ page }) => {
    await page.context().addCookies([
      { name: "dvt_token", value: `Bearer ${makeRecruiterJwt()}`, domain: "localhost", path: "/" },
    ]);

    await page.route("**/api/v1/tenants/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "tenant-1", name: "Acme Talent", onboarded: true }),
      });
    });

    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "rec-1",
          email: "recruiter@acme.com",
          full_name: "Recruiter Alpha",
          role: "recruiter",
          tenant_id: "tenant-1",
          is_active: true,
        }),
      });
    });

    await page.route("**/api/v1/compliance/ledgers**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              id: "ledger-2",
              job_id: "job-1",
              job_title: "Principal Platform Engineer",
              candidate_id: "cand-2",
              candidate_name: "Sam Retry",
              candidate_email: "sam@example.org",
              has_verified_email: true,
              pii_erased: false,
              decision_type: "outreach_approval",
              action_type: "outreach_approval",
              confidence_score: 0.88,
              draft_subject: "Retryable Subject",
              draft_body: "Retryable body.",
              email_dispatch_status: "draft",
              reasoning: "Strong fit.",
              reviewer_override: "PENDING",
              sanitized: true,
              created_at: new Date().toISOString(),
            },
          ]),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "SUCCESS",
          human_action: "PENDING_REVIEW",
          outreach_dispatch_status: "failed",
        }),
      });
    });

    await page.goto("/dashboard/approvals");
    await page.getByRole("button", { name: /Approve & Send Email/i }).click();
    await expect(page.getByRole("button", { name: /Retry Send Email/i })).toBeVisible();
  });

  test("Public /unsubscribe page processes signed token and renders confirmation", async ({ page }) => {
    await page.route("**/api/v1/email-sender/unsubscribe", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "unsubscribed",
          email: "nadia@proton.me",
          message: "You have been unsubscribed from future recruiting outreach from this organization.",
        }),
      });
    });

    await page.goto("/unsubscribe?token=signed-test-token-12345");
    await expect(page.getByText("Unsubscribed Successfully")).toBeVisible();
    await expect(page.getByText("nadia@proton.me")).toBeVisible();
  });
});
