// src/utils.ts
var skipToken = /* @__PURE__ */ Symbol.for("tuyau-pinia-colada.skipToken");
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function toSnakeCase(str) {
  return str.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
}
function segmentsToRouteName(segments) {
  return segments.map(toSnakeCase).join(".");
}
function splitSegments(segments) {
  return segments.flatMap((part) => part.split("."));
}
function buildKey(opts) {
  const { segments, type } = opts;
  const request = opts.request === skipToken ? void 0 : opts.request;
  const path = splitSegments(segments);
  if (request === void 0 && type === "any") {
    return [path];
  }
  let cleanRequest = request;
  if (type === "infinite" && isObject(request)) {
    cleanRequest = { ...request };
    for (const field of ["query", "body"]) {
      const value = request[field];
      if (isObject(value) && ("cursor" in value || "direction" in value)) {
        const { cursor: _c, direction: _d, ...rest } = value;
        cleanRequest[field] = rest;
      }
    }
  }
  const meta = {};
  if (cleanRequest !== void 0) meta.request = cleanRequest;
  if (type !== "any") meta.type = type;
  return [path, meta];
}
function buildMutationKey(segments) {
  return [splitSegments(segments)];
}
function extractKyOptions(options) {
  if (!options) return {};
  const { abortOnUnmount: _, ...ky } = options;
  return ky;
}

// src/main.ts
function rejectSkipped() {
  return Promise.reject(
    new Error("[tuyau-pinia-colada] A query called with skipToken was refetched manually.")
  );
}
function createTuyauPiniaColadaClient(options) {
  const { client, globalOptions } = options;
  function send(routeName, request, local, signal) {
    const abort = local?.abortOnUnmount ?? globalOptions?.abortOnUnmount ?? false;
    return client.request(routeName, {
      ...extractKyOptions(globalOptions),
      ...request ?? {},
      ...extractKyOptions(local),
      // Pinia Colada owns retries
      retry: 0,
      ...abort && signal ? { signal } : {}
    });
  }
  function makeNode(segments) {
    const routeName = segmentsToRouteName(segments);
    const node = {
      queryOptions(input, opts) {
        const { tuyau, enabled, ...rest } = opts ?? {};
        const skipped = input === skipToken;
        const request = skipped ? void 0 : input;
        return {
          ...rest,
          key: buildKey({ segments, request, type: "query" }),
          query: skipped ? rejectSkipped : ({ signal }) => send(routeName, request, tuyau, signal),
          ...skipped ? { enabled: false } : enabled !== void 0 ? { enabled } : {}
        };
      },
      queryKey: (input) => buildKey({ segments, request: input, type: "query" }),
      queryFilter: (input, filters) => ({
        ...filters,
        key: buildKey({ segments, request: input, type: "query" })
      }),
      infiniteQueryOptions(input, opts) {
        const { tuyau, enabled, pageParamKey = "page", ...rest } = opts ?? {};
        const skipped = input === skipToken;
        const request = skipped ? void 0 : input;
        return {
          initialPageParam: 1,
          getNextPageParam: () => null,
          ...rest,
          key: buildKey({ segments, request, type: "infinite" }),
          query: skipped ? rejectSkipped : ({ signal, pageParam }) => {
            const base = isObject(request) ? request : {};
            const withPage = pageParam === void 0 ? base : { ...base, query: { ...base.query, [pageParamKey]: pageParam } };
            return send(routeName, withPage, tuyau, signal);
          },
          ...skipped ? { enabled: false } : enabled !== void 0 ? { enabled } : {}
        };
      },
      infiniteQueryKey: (input) => buildKey({ segments, request: input, type: "infinite" }),
      infiniteQueryFilter: (input, filters) => ({
        ...filters,
        key: buildKey({ segments, request: input, type: "infinite" })
      }),
      mutationOptions(opts) {
        const { tuyau, ...rest } = opts ?? {};
        return {
          ...rest,
          key: buildMutationKey(segments),
          mutation: (vars) => send(routeName, vars ?? void 0, tuyau)
        };
      },
      mutationKey: () => buildMutationKey(segments),
      pathKey: () => buildKey({ segments, type: "any" }),
      pathFilter: (filters) => ({ ...filters, key: buildKey({ segments, type: "any" }) })
    };
    return new Proxy(node, {
      get(target, prop) {
        if (typeof prop === "symbol") return void 0;
        if (prop in target) return target[prop];
        return makeNode([...segments, prop]);
      }
    });
  }
  return makeNode([]);
}

// src/error_bag.ts
function issuesOf(error) {
  if (!error || typeof error !== "object") return void 0;
  const { status, response } = error;
  if (status !== 422) return void 0;
  const errors = response?.errors;
  return Array.isArray(errors) ? errors : void 0;
}
function toErrorBag(error) {
  const bag = {};
  for (const issue of issuesOf(error) ?? []) {
    ;
    (bag[issue.field] ??= []).push(issue.message);
  }
  return bag;
}
function firstErrors(error) {
  const first = {};
  for (const issue of issuesOf(error) ?? []) {
    first[issue.field] ??= issue.message;
  }
  return first;
}
export {
  buildKey,
  createTuyauPiniaColadaClient,
  firstErrors,
  segmentsToRouteName,
  skipToken,
  toErrorBag
};
