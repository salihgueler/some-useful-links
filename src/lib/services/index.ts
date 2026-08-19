import { LocalAnalyticsStore } from "./local/analytics-store.local";
import { BlocksLinkStore } from "./blocks/link-store.blocks";
import { BlocksVisitTracker } from "./blocks/visit-tracker.blocks";

// SWAP POINT: one constructor per provider.
// Pages and visit events are owner-isolated via AWS Blocks. Analytics is still
// the local JSON mock and is NOT yet owner-scoped -- that is the next slice.
export const analyticsStore = new LocalAnalyticsStore();
export const linkStore = new BlocksLinkStore();
export const visitTracker = new BlocksVisitTracker();

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
