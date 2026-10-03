import assert from "node:assert/strict";
import { test } from "node:test";
import { LocusResponseTimer } from "./locus-response-timer";

const completed = { unsuccessful: false, continues: false };

test("measures each turn separately from Send to completion", () => {
  const timer = new LocusResponseTimer();
  timer.start(100);
  assert.equal(timer.finish(completed, 4300), 4.2);
  assert.equal(timer.finish(completed, 5000), null);
  timer.start(6000);
  assert.equal(timer.finish(completed, 7500), 1.5);
});

test("tool continuations retain the original Send time", () => {
  const timer = new LocusResponseTimer();
  timer.start(100);
  assert.equal(
    timer.finish({ unsuccessful: false, continues: true }, 2100),
    null,
  );
  assert.equal(timer.finish(completed, 5100), 5);
});

test("stopped, disconnected and failed turns do not get a done duration", () => {
  const timer = new LocusResponseTimer();
  timer.start(100);
  assert.equal(
    timer.finish({ unsuccessful: true, continues: false }, 2100),
    null,
  );
  assert.equal(timer.finish(completed, 3000), null);
});

test("clearing chat discards the in-flight measurement", () => {
  const timer = new LocusResponseTimer();
  timer.start(100);
  timer.reset();
  assert.equal(timer.finish(completed, 2100), null);
});
