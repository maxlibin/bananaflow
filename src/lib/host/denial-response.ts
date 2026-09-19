import { NextResponse } from "next/server";
import { denialBody } from "./denial";
import type { Denial } from "./types";

export function denialResponse(denial: Denial): NextResponse {
  return NextResponse.json(denialBody(denial), { status: denial.status });
}
