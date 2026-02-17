export function buildUnifiedQuery(facet: any, limit: number = 100) {
  const match: any = {};

  // Add source filter for REAL_TWITTER
  if (facet.filter?.source) {
    match.source = facet.filter.source;
  }

  if (facet.filter?.kind) {
    match.kind = facet.filter.kind;
  }

  if (facet.filter?.categories) {
    match.categories = { $in: facet.filter.categories };
  }

  if (facet.filter?.tags) {
    match.tags = { $in: facet.filter.tags };
  }

  if (facet.filter?.min) {
    for (const [k, v] of Object.entries(facet.filter.min)) {
      match[k] = { $gte: v };
    }
  }

  return [
    { $match: match },
    {
      $addFields: {
        _sort: `$${facet.sort.by}`
      }
    },
    { $sort: { _sort: facet.sort.dir } },
    { $limit: limit }
  ];
}
