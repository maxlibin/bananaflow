import type { LimitNotice } from "../../components/canvas-host/context";
import type { Denial } from "./types";

// Turns a host Denial returned by a server action into the notice the
// canvas host's limit UI shows.
export function limitNotice(denial: Denial): LimitNotice {
  return {
    feature: denial.feature,
    kind:
      denial.status === 402 ? "out_of_credits" : denial.status === 429 ? "rate_limit" : "plan",
    severity: "warning",
    message: denial.message,
    plan: denial.plan,
  };
}
