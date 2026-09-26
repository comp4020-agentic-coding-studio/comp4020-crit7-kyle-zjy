import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";
import { ROUTES } from "./routes";

// Every image a page shows must actually load. The README screenshot once
// rendered as an /_image URL that 500'd in production (no `sharp`); the
// invariants only check alt text, so nothing caught it until the deploy's
// link check did.
const baseUrl = inject("baseUrl");

describe("images", () => {
  for (const route of ROUTES) {
    it(`every image on ${route} loads`, async () => {
      const html = await (await fetch(new URL(route, baseUrl))).text();
      const doc = new JSDOM(html).window.document;
      for (const img of doc.querySelectorAll("img")) {
        const src = img.getAttribute("src") ?? "";
        const res = await fetch(new URL(src, new URL(route, baseUrl)));
        expect(res.status, `${src} on ${route}`).toBe(200);
        expect(res.headers.get("content-type") ?? "", src).toMatch(/^image\/(png|jpeg|webp|gif|avif|svg\+xml)/);
      }
    });
  }
});
