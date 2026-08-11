/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auditLogs from "../auditLogs.js";
import type * as content from "../content.js";
import type * as crons from "../crons.js";
import type * as deputy from "../deputy.js";
import type * as deputySync from "../deputySync.js";
import type * as documents from "../documents.js";
import type * as employees from "../employees.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as hubs from "../hubs.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_auditLogs from "../lib/auditLogs.js";
import type * as lib_credentialEncryption from "../lib/credentialEncryption.js";
import type * as lib_deputyCredentials from "../lib/deputyCredentials.js";
import type * as lib_events from "../lib/events.js";
import type * as lib_guideLinks from "../lib/guideLinks.js";
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
  auditLogs: typeof auditLogs;
  content: typeof content;
  crons: typeof crons;
  deputy: typeof deputy;
  deputySync: typeof deputySync;
  documents: typeof documents;
  employees: typeof employees;
  files: typeof files;
  http: typeof http;
  hubs: typeof hubs;
  "lib/access": typeof lib_access;
  "lib/auditLogs": typeof lib_auditLogs;
  "lib/credentialEncryption": typeof lib_credentialEncryption;
  "lib/deputyCredentials": typeof lib_deputyCredentials;
  "lib/events": typeof lib_events;
  "lib/guideLinks": typeof lib_guideLinks;
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
