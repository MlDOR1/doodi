// Manual browser smoke test: `node tests/e2e-smoke.mjs` against a running server (needs playwright-core + Edge/Chrome).
import { chromium } from "playwright-core";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const exe = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(fs.existsSync);
const shots = process.env.SHOTS ?? "shots";
fs.mkdirSync(shots, { recursive: true });

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
};

const browser = await chromium.launch({ executablePath: exe, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 }, locale: "th-TH" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));

// Guest: browse + search + read
await page.goto(BASE);
await page.screenshot({ path: `${shots}/home-desktop.png` });
await page.getByRole("link", { name: "เลือกดูหนัง" }).click();
await page.waitForURL("**/movies");
await page.locator("article").first().waitFor();
check("guest sees catalog", (await page.locator("article").count()) > 5);
await page.getByLabel("ชื่อหนัง").fill("หลานม่า");
await page.getByRole("button", { name: "ค้นหา" }).click();
await page.waitForURL(/q=/);
check("search narrows results", (await page.locator("article").count()) === 1);
await page.locator("article a").first().click();
await page.waitForURL(/\/movies\/\d+/);
check("detail shows community rating label", await page.getByText("คะแนนจากสมาชิก DOODI").first().isVisible());
check("guest sees login prompt to review", await page.getByRole("link", { name: "เข้าสู่ระบบเพื่อรีวิว" }).isVisible());
const detailUrl = page.url();
await page.screenshot({ path: `${shots}/detail-desktop.png`, fullPage: true });

// Guest tries to save -> login -> returns to movie
await page.getByRole("button", { name: /เพิ่มในรายการอยากดู/ }).click();
await page.waitForURL(/\/login\?next=/);
check("login preserves destination", decodeURIComponent(page.url()).includes(new URL(detailUrl).pathname));

// Register new user (lands back on movie)
await page.getByRole("link", { name: "สมัครสมาชิก" }).last().click();
const email = `e2e${Date.now()}@example.com`;
await page.getByRole("button", { name: "สมัครสมาชิก" }).click();
check("empty register shows Thai errors", (await page.locator("[role=alert]").count()) >= 3);
await page.getByLabel("ชื่อที่แสดง").fill("ทดสอบ E2E");
await page.getByLabel("อีเมล").fill(email);
await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password123");
await page.getByLabel("ยืนยันรหัสผ่าน").fill("password123");
await page.getByRole("button", { name: "สมัครสมาชิก" }).click();
await page.waitForURL(detailUrl);
check("register returns to intended movie", true);

// Save to watchlist, persist across reload
await page.getByRole("button", { name: /เพิ่มในรายการอยากดู/ }).click();
await page.getByRole("button", { name: /อยู่ในรายการอยากดู/ }).waitFor();
await page.reload();
check("watchlist state persists after reload", await page.getByRole("button", { name: /อยู่ในรายการอยากดู/ }).isVisible());
await page.goto(`${BASE}/watchlist`);
check("watchlist page lists the movie", (await page.locator("article").count()) === 1);

// Review: create, edit, delete
await page.goto(detailUrl);
const before = await page.locator("#reviews-h").innerText();
await page.getByRole("button", { name: "โพสต์รีวิว" }).click();
check("review needs rating", await page.getByText("กรุณาเลือกคะแนน 1 ถึง 5 ดาว").isVisible());
await page.getByLabel("4 ดาว").check({ force: true });
await page.getByLabel("รีวิวของคุณ").fill("ทดสอบรีวิวผ่านเบราว์เซอร์ <b>ไม่ควรเป็นตัวหนา</b>");
await page.getByText("รีวิวนี้มีสปอยล์").click();
await page.getByRole("button", { name: "โพสต์รีวิว" }).click();
await page.getByText("คุณรีวิวเรื่องนี้แล้ว").waitFor();
const mineItem = page.locator("li", { hasText: "รีวิวของคุณ" }).first();
check("review count increased", before !== (await page.locator("#reviews-h").innerText()));
check("own spoiler review is hidden until revealed", !(await mineItem.innerText()).includes("ไม่ควรเป็นตัวหนา"));
await mineItem.getByRole("button", { name: "แสดงรีวิวที่มีสปอยล์" }).click();
check("HTML in review rendered as plain text", (await mineItem.locator("b").count()) === 0 && (await mineItem.innerText()).includes("<b>"));
await mineItem.getByRole("button", { name: "แก้ไข" }).click();
await mineItem.getByLabel("5 ดาว").check({ force: true });
await mineItem.getByRole("button", { name: "บันทึกการแก้ไข" }).click();
await page.getByText("บันทึกการแก้ไขรีวิวแล้ว").waitFor();
const fiveStars = page.locator("li", { hasText: "รีวิวของคุณ" }).first().locator('[aria-label="ให้คะแนน 5 จาก 5"]');
await fiveStars.waitFor({ timeout: 8000 }).catch(() => {});
check("edit saved (5 stars)", await fiveStars.isVisible());
await page.locator("li", { hasText: "รีวิวของคุณ" }).first().getByRole("button", { name: "ลบ" }).click();
await page.getByRole("dialog").getByRole("button", { name: "ลบรีวิว" }).click();
await page.getByText("ลบรีวิวแล้ว").waitFor();
await page.getByRole("button", { name: "โพสต์รีวิว" }).waitFor({ timeout: 8000 }).catch(() => {});
check("delete review works, form returns", await page.getByRole("button", { name: "โพสต์รีวิว" }).isVisible());

// Member cannot reach admin
await page.goto(`${BASE}/admin`);
check("member bounced from /admin", new URL(page.url()).pathname === "/");
check("member sees no admin link", (await page.getByRole("link", { name: "จัดการระบบ" }).count()) === 0);

// Logout
await page.getByRole("button", { name: "ออกจากระบบ" }).click();
await page.getByRole("link", { name: "เข้าสู่ระบบ" }).first().waitFor();
check("logout shows guest header", true);

// Admin
await page.goto(`${BASE}/login`);
await page.getByLabel("อีเมล").fill("admin@doodi.test");
await page.getByLabel("รหัสผ่าน").fill("wrong-password");
await page.getByRole("button", { name: "เข้าสู่ระบบ" }).last().click();
await page.getByText("อีเมลหรือรหัสผ่านไม่ถูกต้อง").waitFor({ timeout: 8000 }).catch(() => {});
check("wrong password shows error", await page.getByText("อีเมลหรือรหัสผ่านไม่ถูกต้อง").isVisible());
await page.getByLabel("รหัสผ่าน").fill("Doodi!2345");
await page.getByRole("button", { name: "เข้าสู่ระบบ" }).last().click();
await page.waitForURL(BASE + "/");
await page.goto(`${BASE}/admin`);
check("admin reaches dashboard", await page.getByRole("heading", { name: "จัดการระบบ DOODI" }).isVisible());

const title = `E2E หนังใหม่ ${Date.now() % 100000}`;
await page.getByRole("button", { name: "+ เพิ่มหนังเอง" }).click();
await page.getByLabel("ชื่อหนัง *").fill(title);
await page.getByLabel("ปีที่ออกฉาย").fill("2025");
await page.getByLabel(/ประเภท/).fill("ดราม่า, ทดสอบ");
await page.getByRole("dialog").getByRole("button", { name: "บันทึก" }).click();
await page.getByText("เพิ่มหนังเรียบร้อย").waitFor();
await page.getByLabel("ค้นหาชื่อหนัง").fill(title);
await page.getByRole("button", { name: "ค้นหา" }).click();
await page.waitForURL(/q=/);
const row = page.locator("tbody tr").first();
check("admin created movie appears in table", (await row.innerText()).includes(title));
await row.getByRole("button", { name: /แก้ไข/ }).click();
await page.getByRole("dialog").getByLabel("ชื่อหนัง *").fill(title + " (แก้)");
await page.getByRole("dialog").getByRole("button", { name: "บันทึก" }).click();
await page.getByText("บันทึกข้อมูลหนังแล้ว").waitFor();
check("admin edit saved", (await page.locator("tbody tr").first().innerText()).includes("(แก้)"));
await page.locator("tbody tr").first().getByRole("button", { name: /ลบ/ }).click();
check("delete confirmation dialog appears", await page.getByRole("dialog").getByText("soft delete").isVisible());
await page.getByRole("dialog").getByRole("button", { name: "ยืนยันลบ" }).click();
await page.getByText(/ลบ “.*” แล้ว/).waitFor();
await page.goto(`${BASE}/movies?q=${encodeURIComponent(title)}`);
check("soft-deleted movie gone from public catalog", (await page.locator("article").count()) === 0);

await page.goto(`${BASE}/admin/tmdb`);
check("TMDB tab explains missing config", await page.getByText("ยังไม่ได้ตั้งค่า TMDB").isVisible());
await page.goto(`${BASE}/admin/reviews`);
check("admin review moderation lists reviews", (await page.locator("main li li").count()) > 3);

// Responsive overflow + screenshots
for (const [name, w, h] of [["mobile", 390, 844], ["tablet", 820, 1100]]) {
  await page.setViewportSize({ width: w, height: h });
  for (const path of ["/", "/movies", "/movies/1", "/login", "/admin"]) {
    await page.goto(BASE + path);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`no horizontal overflow ${name} ${path}`, over <= 0, over > 0 ? `(+${over}px)` : "");
    if (path === "/" || path === "/movies/1") await page.screenshot({ path: `${shots}/${path === "/" ? "home" : "detail"}-${name}.png` });
  }
}

check("no browser console/page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
