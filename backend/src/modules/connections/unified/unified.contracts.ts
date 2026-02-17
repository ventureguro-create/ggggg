export type UnifiedKind =
  | "TWITTER"
  | "BACKER"
  | "PROJECT";

export type UnifiedAccount = {
  id: string;              // tw:123 | backer:a16z | project:arbitrum
  kind: UnifiedKind;

  title: string;
  handle?: string;
  avatar?: string;

  categories: string[];    // VC, DEFI, NFT, MEDIA, INFRA
  tags: string[];          // smart, whale, early, trader

  // Core scores (0..1)
  smart?: number;
  influence?: number;
  early?: number;
  authority?: number;

  // Network
  handshake?: number;
  networkSize?: number;

  // Meta
  followers?: number;
  engagement?: number;

  confidence: number;      // global confidence gate
  searchScore?: number;    // for MOST_SEARCHED facet
};
