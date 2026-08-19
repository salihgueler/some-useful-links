import { LocalAnalyticsStore } from "./local/analytics-store.local";
import { BlocksLinkStore } from "./blocks/link-store.blocks";
import { LocalVisitTracker } from "./local/visit-tracker.local";

// SWAP POINT: one constructor per provider.
// Pages are owner-isolated via AWS Blocks. Analytics and visits are still the
// local JSON mocks and are NOT yet owner-scoped -- they are the next slice.
export const analyticsStore = new LocalAnalyticsStore();
export const linkStore = new BlocksLinkStore();
export const visitTracker = new LocalVisitTracker();

export type {
  AnalyticsQuery,
  AnalyticsSummary,
} from "./interfaces/analytics-store.interface";
export type { LinkStoreSnapshot } from "./interfaces/link-store.interface";
export type {
  TrackVisitInput,
  VisitEventType,
  VisitMetrics,
} from "./interfaces/visit-tracker.interface";
