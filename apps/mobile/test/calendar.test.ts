import assert from "node:assert/strict";
import { test } from "node:test";
import { monthGrid, shiftMonth } from "../src/calendar.ts";

test("febrero 2024 (bisiesto) empieza en jueves con semana lunes", () => {
  const g = monthGrid(2024, 2, 1);
  assert.equal(g.length % 7, 0);
  assert.equal(g.indexOf("2024-02-01"), 3);
  assert.equal(g.filter(Boolean).length, 29);
});

test("semana domingo desplaza el relleno", () => {
  assert.equal(monthGrid(2024, 2, 0).indexOf("2024-02-01"), 4);
});

test("shiftMonth cruza años", () => {
  assert.equal(shiftMonth("2024-12", 1), "2025-01");
  assert.equal(shiftMonth("2024-01", -1), "2023-12");
});
