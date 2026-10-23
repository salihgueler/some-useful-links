import { BlocksAnalyticsStore } from "./blocks/analytics-store.blocks";
import { BlocksLinkStore } from "./blocks/link-store.blocks";
import { BlocksVisitTracker } from "./blocks/visit-tracker.blocks";

// SWAP POINT: one constructor per provider.
// All three stores are owner-isolated via AWS Blocks. The local JSON
// implementations are kept as reference for the contracts they satisfy.
export const analyticsStore = new BlocksAnalyticsStore();
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
