import { LocalAnalyticsStore } from "./local/analytics-store.local";
import { LocalLinkStore } from "./local/link-store.local";
import { LocalVisitTracker } from "./local/visit-tracker.local";

// SWAP POINT: Replace these constructors with cloud implementations.
export const analyticsStore = new LocalAnalyticsStore();
export const linkStore = new LocalLinkStore();
export const visitTracker = new LocalVisitTracker();

export type {
  AnalyticsQuery,
  AnalyticsSummary,
} from "./interfaces/analytics-store.interface";
export type { LinkStoreSnapshot } from "./interfaces/link-store.interface";
export type {
  TrackVisitInput,
  VisitMetrics,
} from "./interfaces/visit-tracker.interface";
