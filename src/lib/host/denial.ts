import type { Denial } from "./types";
import type { GenerationFeature } from "./features";

export type DenialBody = {
  success: false;
  error: string;
  upgradeRequired: boolean;
  feature: GenerationFeature;
  code?: string;
  plan?: string;
  retryAfterMs?: number;
};

export function denialBody(denial: Denial): DenialBody {
  const body: DenialBody = {
    success: false,
    error: denial.message,
    upgradeRequired: denial.upgradeRequired,
    feature: denial.feature,
  };
  if (denial.code !== null) body.code = denial.code;
  if (denial.plan !== null) body.plan = denial.plan;
  if (denial.retryAfterMs !== null) body.retryAfterMs = denial.retryAfterMs;
  return body;
}

export type DenialActionResult = {
  success: false;
  error: string;
  upgradeRequired: boolean;
  feature: GenerationFeature;
};

export function denialActionResult(denial: Denial): DenialActionResult {
  return {
    success: false,
    error: denial.message,
    upgradeRequired: denial.upgradeRequired,
    feature: denial.feature,
  };
}
