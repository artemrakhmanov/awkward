// The two humans, played in a real browser (Playwright, headless Chromium) on their private /r pages,
// plus screenshots of the projector board. Locators use labels and roles, like a person or a browser agent.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { type Browser, chromium, type Page } from "playwright";
import { BASE } from "./env";

export type Shot = { name: string; file: string; t: number; url: string; text?: string };
export type Contact = { first_name: string; channel: "whatsapp" | "telegram" | "email" | "instagram" | "other"; handle: string };

const CHANNEL_LABEL = { whatsapp: "WhatsApp", telegram: "Telegram", email: "Email", instagram: "Instagram", other: "Other" };

let browser: Browser | null = null;
async function getBrowser() {
  browser ??= await chromium.launch();
  return browser;
}
export async function closeBrowser() {
  await browser?.close();
  browser = null;
}

export class Screens {
  shots: Shot[] = [];
  constructor(
    private dir: string,
    private since: () => number,
  ) {
    mkdirSync(dir, { recursive: true });
  }

  async capture(page: Page, name: string): Promise<Shot> {
    const file = `${String(this.shots.length + 1).padStart(2, "0")}-${name}.png`;
    await page.screenshot({ path: join(this.dir, file), fullPage: true });
    const text = (await page.locator("body").innerText().catch(() => "")).slice(0, 4000);
    const shot = { name, file: `shots/${file}`, t: this.since(), url: page.url().replace(/\/r\/[^/?#]+/, "/r/<token>"), text };
    this.shots.push(shot);
    return shot;
  }

  // The projector board, as the room sees it.
  async board(slug: string, name: string) {
    const page = await (await getBrowser()).newPage({ viewport: { width: 1600, height: 900 } });
    try {
      await page.goto(`${BASE}/e/${slug}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      return await this.capture(page, name);
    } finally {
      await page.close();
    }
  }

  // Raw HTML of /r as a link-preview bot sees it (no JavaScript).
  async rawPrivatePage(token: string) {
    const res = await fetch(`${BASE}/r/${token}`, { headers: { "user-agent": "facebookexternalhit/1.1" } });
    return { status: res.status, html: await res.text() };
  }

  async openInbox(token: string, name: string) {
    const page = await (await getBrowser()).newPage({ viewport: { width: 430, height: 932 } });
    await page.goto(`${BASE}/r/${token}`, { waitUntil: "networkidle" });
    await page.getByText(/Matches/).first().waitFor({ timeout: 20_000 });
    await page.waitForTimeout(500);
    await this.capture(page, name);
    return page;
  }

  // Accepts the first pending intro on the human's page. Returns what the page showed afterwards.
  async accept(token: string, who: string, c: Contact): Promise<"waiting" | "introduced" | "no_match" | "error"> {
    const page = await this.openInbox(token, `${who}-inbox`);
    try {
      const accept = page.getByRole("button", { name: "Accept", exact: true }).first();
      if (!(await accept.isVisible().catch(() => false))) {
        await this.capture(page, `${who}-no-match`);
        return "no_match";
      }
      await accept.click();
      await page.getByLabel("First name").fill(c.first_name);
      await page.getByRole("radio", { name: CHANNEL_LABEL[c.channel] }).check({ force: true });
      await page.locator('input[name="handle"]').fill(c.handle);
      await this.capture(page, `${who}-form`);
      await page.getByRole("button", { name: "Accept and share" }).click();
      const done = await Promise.race([
        page.getByText("Waiting for the other side.").waitFor({ timeout: 20_000 }).then(() => "waiting" as const),
        page.getByText("You both said yes.").waitFor({ timeout: 20_000 }).then(() => "introduced" as const),
      ]).catch(() => "error" as const);
      let state: "waiting" | "introduced" | "error" = done;
      if (state === "error") {
        // The page may have reloaded mid-wait (e.g. straight to introduced). Look again before calling it an error.
        await page.reload({ waitUntil: "networkidle" });
        const body = await page.locator("body").innerText();
        state = body.includes("You both said yes.") ? "introduced" : body.includes("Waiting for the other side.") ? "waiting" : "error";
      }
      await page.waitForTimeout(500);
      await this.capture(page, `${who}-after-accept`);
      return state;
    } finally {
      await page.close();
    }
  }

  async decline(token: string, who: string): Promise<"declined" | "no_match" | "error"> {
    const page = await this.openInbox(token, `${who}-inbox`);
    try {
      const btn = page.getByRole("button", { name: "Decline", exact: true }).first();
      if (!(await btn.isVisible().catch(() => false))) return "no_match";
      await btn.click();
      const ok = await page.getByText("Declined.").waitFor({ timeout: 15_000 }).then(() => true).catch(() => false);
      await this.capture(page, `${who}-after-decline`);
      return ok ? "declined" : "error";
    } finally {
      await page.close();
    }
  }

  // Reloads the human's page and screenshots it (e.g. to see the final introduced state).
  async look(token: string, name: string) {
    const page = await this.openInbox(token, name);
    await page.close();
  }
}
