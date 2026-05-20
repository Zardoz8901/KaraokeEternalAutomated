export const defaultMiddlewareOptions = {
  immutableCheck: {
    // redux-optimistic-ui mutates its private history wrapper during resolution.
    // Keep current state checked while excluding only the wrapper bookkeeping.
    ignoredPaths: ['queue.history', 'userStars.history'],
  },
} as const
