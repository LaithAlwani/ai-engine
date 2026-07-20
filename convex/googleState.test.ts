import { expect, test } from "vitest";
import { signState, verifyState } from "./lib/googleState";

const SECRET = "test-secret";

test("oauth state — round-trips businessId + staffId", async () => {
  const s = await signState(SECRET, "biz123", "staff456");
  expect(await verifyState(SECRET, s)).toEqual({
    businessId: "biz123",
    staffId: "staff456",
  });
});

test("oauth state — rejects tampering", async () => {
  const s = await signState(SECRET, "biz123", "staff456");
  const tampered = s.replace("staff456", "staff999");
  expect(await verifyState(SECRET, tampered)).toBeNull();
});

test("oauth state — rejects a forged signature (wrong secret)", async () => {
  const s = await signState(SECRET, "biz", "staff");
  expect(await verifyState("other-secret", s)).toBeNull();
});

test("oauth state — rejects expired", async () => {
  const s = await signState(SECRET, "biz", "staff", -1000);
  expect(await verifyState(SECRET, s)).toBeNull();
});
