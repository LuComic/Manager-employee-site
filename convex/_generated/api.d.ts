/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as content from "../content.js";
import type * as documents from "../documents.js";
import type * as employees from "../employees.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as hubs from "../hubs.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_hubStorage from "../lib/hubStorage.js";
import type * as lib_notifications from "../lib/notifications.js";
import type * as lib_snapshot from "../lib/snapshot.js";
import type * as notifications from "../notifications.js";
import type * as search from "../search.js";
import type * as workerNotes from "../workerNotes.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  content: typeof content;
  documents: typeof documents;
  employees: typeof employees;
  files: typeof files;
  http: typeof http;
  hubs: typeof hubs;
  "lib/access": typeof lib_access;
  "lib/hubStorage": typeof lib_hubStorage;
  "lib/notifications": typeof lib_notifications;
  "lib/snapshot": typeof lib_snapshot;
  notifications: typeof notifications;
  search: typeof search;
  workerNotes: typeof workerNotes;
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
