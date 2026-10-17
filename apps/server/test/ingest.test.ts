import assert from "node:assert/strict";
import { test } from "node:test";
import { dateFromFilename, parseGiven, resolveTakenAt, wallClock } from "../src/ingest.ts";

test("fechas por nombre de archivo: formatos típicos de cámaras y mensajería", () => {
  assert.equal(dateFromFilename("IMG_20240315_101530.jpg"), "2024-03-15T10:15:30.000Z");
  assert.equal(dateFromFilename("PXL_20240315_213045123.jpg"), "2024-03-15T21:30:45.000Z");
  assert.equal(dateFromFilename("VID-20240315-WA0007.mp4"), "2024-03-15T12:00:00.000Z"); // sin hora → mediodía
  assert.equal(dateFromFilename("2024-03-15 10.15.30.png"), "2024-03-15T10:15:30.000Z");
  assert.equal(dateFromFilename("Screenshot_2023-12-01-08-05-09.png"), "2023-12-01T08:05:09.000Z");
});

test("fechas por nombre: rechaza lo que no es una fecha real", () => {
  assert.equal(dateFromFilename("IMG_20240231_100000.jpg"), undefined); // 31 de febrero
  assert.equal(dateFromFilename("foto.jpg"), undefined);
  assert.equal(dateFromFilename("IMG_1234567890123.jpg"), undefined); // número largo, no fecha
  assert.equal(dateFromFilename("DSC_00012345.jpg"), undefined);
});

test("fecha dada: sin zona = hora de reloj (no se desplaza); con zona se respeta el instante", () => {
  assert.equal(parseGiven("2026-10-16T21:05:00"), "2026-10-16T21:05:00.000Z");
  assert.equal(parseGiven("2026-10-16"), "2026-10-16T12:00:00.000Z");
  assert.equal(parseGiven("2026-10-16T21:05:00-05:00"), "2026-10-17T02:05:00.000Z");
  assert.equal(parseGiven("2026-02-30"), undefined);
  assert.equal(parseGiven("basura"), undefined);
  assert.equal(parseGiven(42), undefined);
});

test("la hora de reloj no depende de la zona del servidor", () => {
  const d = new Date(2026, 9, 16, 21, 5, 0); // 21:05 hora local, sea cual sea la zona
  assert.equal(wallClock(d), "2026-10-16T21:05:00.000Z");
});

test("orden de fuentes: usuario > video > nombre > archivo", async () => {
  const b = new Uint8Array([1, 2, 3]);
  const videoDate = async () => "2024-01-02T03:04:05.000Z";
  assert.deepEqual(await resolveTakenAt(b, "video/mp4", { given: "2020-05-05", name: "VID_20240315.mp4", videoDate }), {
    iso: "2020-05-05T12:00:00.000Z",
    source: "user",
  });
  assert.deepEqual(await resolveTakenAt(b, "video/mp4", { name: "VID_20240315.mp4", videoDate }), {
    iso: "2024-01-02T03:04:05.000Z",
    source: "video",
  });
  assert.deepEqual(await resolveTakenAt(b, "video/mp4", { name: "VID_20240315_101500.mp4", videoDate: async () => undefined }), {
    iso: "2024-03-15T10:15:00.000Z",
    source: "filename",
  });
  const f = await resolveTakenAt(b, "image/png", { name: "sin-fecha.png", lastModified: new Date(2022, 6, 4, 9, 30, 0).getTime() });
  assert.deepEqual(f, { iso: "2022-07-04T09:30:00.000Z", source: "file" });
});
