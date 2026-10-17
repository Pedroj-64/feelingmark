import assert from "node:assert/strict";
import { test } from "node:test";
import { isNew, mimeFromName, wallClock } from "../src/gallery.ts";

test("wallClock da la hora local sin zona", () => {
  assert.equal(wallClock(new Date(2021, 2, 4, 5, 6, 7).getTime()), "2021-03-04T05:06:07");
});

test("mimeFromName acepta fotos y videos soportados y rechaza el resto", () => {
  assert.equal(mimeFromName("IMG_1.JPG"), "image/jpeg");
  assert.equal(mimeFromName("a.b.mov"), "video/quicktime");
  assert.equal(mimeFromName("clip.3gp"), "video/3gpp");
  assert.equal(mimeFromName("anim.gif"), null);
  assert.equal(mimeFromName("sin_extension"), null);
});

test("isNew compara con la marca y no descarta lo que no tiene fecha", () => {
  assert.equal(isNew(200, 100), true);
  assert.equal(isNew(100, 100), false);
  assert.equal(isNew(null, 100), true);
});
