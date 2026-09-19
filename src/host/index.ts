import { db } from "../db";
import type { HostAdapter } from "../lib/host/types";
import { localAuth } from "./local/auth";
import { localCallbacks } from "./local/callbacks";
import { createLocalKeys } from "./local/keys";
import { localLimits } from "./local/limits";
import { localPolicy } from "./local/policy";
import { LOCAL_IMAGE_MODELS, LOCAL_PROVIDERS, LOCAL_VIDEO_MODELS } from "./local/providers";
import { createLocalStorage } from "./local/storage";

const appOrigin = process.env.APP_ORIGIN;
if (!appOrigin) {
  throw new Error("APP_ORIGIN is not set (e.g. http://localhost:3000)");
}

export const host: HostAdapter = {
  db,
  auth: localAuth,
  providers: { list: LOCAL_PROVIDERS },
  models: { image: LOCAL_IMAGE_MODELS, video: LOCAL_VIDEO_MODELS },
  keys: createLocalKeys(db, LOCAL_PROVIDERS),
  policy: localPolicy,
  limits: localLimits,
  storage: createLocalStorage(appOrigin),
  callbacks: localCallbacks,
};
