/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as assistant from "../assistant.js";
import type * as assistantContext from "../assistantContext.js";
import type * as auth from "../auth.js";
import type * as businesses from "../businesses.js";
import type * as emailNode from "../emailNode.js";
import type * as embedKeys from "../embedKeys.js";
import type * as http from "../http.js";
import type * as knowledge from "../knowledge.js";
import type * as lib_authz from "../lib/authz.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_keys from "../lib/keys.js";
import type * as lib_leoPrompt from "../lib/leoPrompt.js";
import type * as passwordReset from "../passwordReset.js";
import type * as platform from "../platform.js";
import type * as staff from "../staff.js";
import type * as team from "../team.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  assistant: typeof assistant;
  assistantContext: typeof assistantContext;
  auth: typeof auth;
  businesses: typeof businesses;
  emailNode: typeof emailNode;
  embedKeys: typeof embedKeys;
  http: typeof http;
  knowledge: typeof knowledge;
  "lib/authz": typeof lib_authz;
  "lib/errors": typeof lib_errors;
  "lib/keys": typeof lib_keys;
  "lib/leoPrompt": typeof lib_leoPrompt;
  passwordReset: typeof passwordReset;
  platform: typeof platform;
  staff: typeof staff;
  team: typeof team;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
