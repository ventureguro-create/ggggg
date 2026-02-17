import { GraphEdge } from './graphv2.types.js';

export function filterEdges(
  edges: GraphEdge[],
  { minConfidence, minWeight }: { minConfidence: number; minWeight: number }
): GraphEdge[] {
  return edges.filter(
    (e) =>
      e.confidence >= minConfidence &&
      e.weight >= minWeight &&
      e.source !== e.target
  );
}
