// Privacy-threshold aggregation: never surface a company/role statistic
// derived from too few independent contributors — small numbers are
// re-identifying. Pure so the threshold logic is directly testable.

export const DEFAULT_MIN_INDEPENDENT_CONTRIBUTORS = 3;

export function canShowAggregateStats(
  independentContributorCount: number,
  minContributors: number = DEFAULT_MIN_INDEPENDENT_CONTRIBUTORS,
): boolean {
  return independentContributorCount >= minContributors;
}

export interface TopicCount {
  tagId: string;
  labelHe: string;
  count: number;
}

/** Only topics mentioned by enough distinct contributors are considered "recurring" — avoids re-identifying from one person's phrasing. */
export function recurringTopics(
  topicContributorCounts: TopicCount[],
  minContributors: number = DEFAULT_MIN_INDEPENDENT_CONTRIBUTORS,
): TopicCount[] {
  return topicContributorCounts
    .filter((t) => t.count >= minContributors)
    .sort((a, b) => b.count - a.count);
}
