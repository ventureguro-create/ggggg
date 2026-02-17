export type GraphLayer =
  | "CO_ENGAGEMENT"
  | "FOLLOW"
  | "CO_INVEST"
  | "ONCHAIN"
  | "MEDIA"
  | "BLENDED";

export interface GraphV2Params {
  layer: GraphLayer;
  anchors: boolean;
  minConfidence: number;
  minWeight: number;
  handle?: string; // Target handle for search
}

export interface GraphNode {
  id: string;
  kind: "TWITTER" | "BACKER" | "PROJECT";
  label: string;
  handle?: string;
  confidence: number;
  seedAuthority?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  layer: GraphLayer;
  weight: number;
  confidence: number;
  overlay?: {
    source: string;
    status: "ok" | "divergent";
    [key: string]: any;
  };
}

export interface GraphV2Result {
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta: {
    layer: GraphLayer;
    anchors: boolean;
    searchHandle?: string;
  };
}
