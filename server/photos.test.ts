import test from "node:test";
import assert from "node:assert/strict";
import { marketCheckPhotoUrl, toPublicImageUrl } from "./photos";

const MC = "https://api.marketcheck.com/v2/image/cache/car/1FTEW1CP7NKD21709-6422adf8-7e10/56a94c9b019aa1e0958ba0d40c732b72";

test("MarketCheck cached photos are served through the app's photo route", () => {
  const local = toPublicImageUrl(MC);
  assert.equal(local, "/api/photo/car/1FTEW1CP7NKD21709-6422adf8-7e10/56a94c9b019aa1e0958ba0d40c732b72");
  assert.equal(marketCheckPhotoUrl(local), MC);
});

test("other photo hosts pass through untouched", () => {
  const carvana = "https://vexgateway.fastly.carvana.io/3006408094/hero.jpg";
  assert.equal(toPublicImageUrl(carvana), carvana);
});

test("the photo route only proxies well-formed MarketCheck photo paths", () => {
  assert.equal(marketCheckPhotoUrl("/api/photo/car/../../v2/search/car/active/abcdef0123456789"), null);
  assert.equal(marketCheckPhotoUrl("/api/photo/car/abc/not-a-hash"), null);
  assert.equal(marketCheckPhotoUrl("/api/photo/other/abc/abcdef0123456789"), null);
});
