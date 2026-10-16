import assert from "node:assert/strict";
import { test } from "node:test";
import { drain, enqueue, MAX_TRIES, type Pending, type QueueStore } from "../src/queue.ts";

const memStore = (): QueueStore & { items: Pending[] } => {
  const s = { items: [] as Pending[], load: async () => s.items, save: async (i: Pending[]) => void (s.items = i) };
  return s;
};

test("sube todo en orden y vacía la cola", async () => {
  const s = memStore();
  await enqueue(s, [{ uri: "a" }, { uri: "b" }, { uri: "c" }]);
  const seen: string[] = [];
  const r = await drain(s, async (p) => void seen.push(p.uri));
  assert.deepEqual(seen, ["a", "b", "c"]);
  assert.deepEqual(r, { done: 3, dropped: 0, left: 0 });
  assert.equal(s.items.length, 0);
});

test("sin red: se detiene al primer fallo y conserva el resto, y luego se reanuda", async () => {
  const s = memStore();
  await enqueue(s, [{ uri: "a" }, { uri: "b" }]);
  let calls = 0;
  const r = await drain(s, async () => {
    calls++;
    throw new Error("offline");
  });
  assert.equal(calls, 1); // no insiste con las demás
  assert.deepEqual([r.done, r.left], [0, 2]);
  assert.equal(s.items[0].tries, 1);
  const again = await drain(s, async () => undefined);
  assert.deepEqual(again, { done: 2, dropped: 0, left: 0 });
});

test("un archivo que falla siempre se descarta tras MAX_TRIES y no bloquea a los demás", async () => {
  const s = memStore();
  await enqueue(s, [{ uri: "malo" }, { uri: "bueno" }]);
  const up = async (p: Pending) => {
    if (p.uri === "malo") throw new Error("corrupto");
  };
  let last = { done: 0, dropped: 0, left: 2 };
  for (let i = 0; i < MAX_TRIES; i++) last = await drain(s, up);
  assert.deepEqual(last, { done: 1, dropped: 1, left: 0 }); // en el último intento descarta el malo y sube el bueno
  assert.equal(s.items.length, 0);
  assert.ok(!s.items.some((p) => p.uri === "malo"));
});
