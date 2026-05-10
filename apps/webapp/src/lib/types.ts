export type UsageBucket = {
  timestamp: string;
  count: number;
};

export type UsageHistory = {
  buckets: UsageBucket[];
  total: number;
};
