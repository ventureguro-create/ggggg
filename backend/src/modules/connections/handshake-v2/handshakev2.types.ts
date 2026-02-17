export interface HandshakeParams {
  fromId: string;
  toId: string;
  layer?: string;
}

export interface HandshakeResult {
  ok: boolean;
  hops?: number;
  strength?: number;
  pathIds?: string[];
  reason?: string;
}
