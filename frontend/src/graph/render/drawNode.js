/**
 * Node Renderer - ЕДИНЫЙ для Influence и Routers
 * 
 * ЖЁСТКИЕ ПРАВИЛА:
 * - Лейбл формат: 0xABCD…1234 (4+…+4)
 * - Текст ВНУТРИ круга, если не влезает — уменьшаем font-size
 * - State halo: ACCUMULATION = зелёный, DISTRIBUTION = красный
 * 
 * FOR CONNECTIONS GRAPH:
 * - All nodes SAME SIZE (no scaling by influence)
 * - Color by profile/early_signal
 */

import { getNodeLabel } from '../core/formatLabel.js';

// ============ ЦВЕТА ============
const COLORS = {
  nodeFill: '#20242c',
  nodeStroke: '#3a3f4b',
  nodeStrokeSelected: '#ffffff',
  textColor: '#e7e9ee',
  accumulation: '#30A46C',  // green
  distribution: '#E5484D',  // red
  router: '#6b7280',        // gray (dashed)
  // Connections-specific colors
  breakout: '#22c55e',      // green - breakout
  rising: '#eab308',        // yellow - rising
  whale: '#8b5cf6',         // purple - whale
  influencer: '#3b82f6',    // blue - influencer
  retail: '#64748b',        // gray - retail
};

// ============ РАЗМЕРЫ ============
const MIN_RADIUS = 16;
const MAX_RADIUS = 40;
const DEFAULT_RADIUS = 22;
const FIXED_RADIUS = 20; // FIXED size for Connections graph

/**
 * Получить радиус узла
 * FOR CONNECTIONS: Always return FIXED_RADIUS for uniform nodes
 */
export function getNodeRadius(node) {
  if (!node) return DEFAULT_RADIUS;
  
  // Connections graph mode: uniform size
  if (node.profile || node.early_signal !== undefined) {
    return FIXED_RADIUS;
  }
  
  // Legacy mode: Используем size если есть
  if (node.size && typeof node.size === 'number') {
    return Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, node.size));
  }
  
  // Используем influenceScore для масштабирования
  const influence = node.influenceScore || node.sizeWeight || 0.3;
  return MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * Math.min(1, Math.max(0, influence));
}

/**
 * Получить цвет узла для Connections graph
 */
function getConnectionsNodeColor(node) {
  // By early_signal
  if (node.early_signal === 'breakout') return COLORS.breakout;
  if (node.early_signal === 'rising') return COLORS.rising;
  
  // By profile
  if (node.profile === 'whale') return COLORS.whale;
  if (node.profile === 'influencer') return COLORS.influencer;
  if (node.profile === 'retail') return COLORS.retail;
  
  return COLORS.nodeFill;
}

/**
 * Подобрать размер шрифта чтобы текст влез в круг
 */
function fitTextToCircle(ctx, text, maxWidth, baseFontSize = 12) {
  let size = baseFontSize;
  ctx.font = `600 ${size}px Inter, system-ui, sans-serif`;
  
  while (ctx.measureText(text).width > maxWidth && size > 6) {
    size -= 0.5;
    ctx.font = `600 ${size}px Inter, system-ui, sans-serif`;
  }
  
  return size;
}

/**
 * Отрисовка узла на canvas
 * 
 * @param {Object} node - данные узла
 * @param {CanvasRenderingContext2D} ctx - canvas context
 * @param {number} globalScale - текущий zoom scale
 * @param {Object} opts - { selected, hovered, dimmed }
 */
export function drawNode(node, ctx, globalScale, opts = {}) {
  const { selected = false, hovered = false, dimmed = false } = opts;
  
  const x = node.x;
  const y = node.y;
  
  if (x === undefined || y === undefined) return;
  
  const r = getNodeRadius(node);
  const isConnectionsMode = node.profile || node.early_signal !== undefined;
  
  ctx.save();
  
  // Dimmed mode (для Active Path)
  if (dimmed) {
    ctx.globalAlpha = 0.15;
  }
  
  // ============ ОСНОВНОЙ КРУГ ============
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  
  // Connections mode: use profile/signal color for nodes
  if (isConnectionsMode) {
    ctx.fillStyle = getConnectionsNodeColor(node);
  } else {
    ctx.fillStyle = COLORS.nodeFill;
  }
  ctx.fill();
  
  // Граница
  ctx.lineWidth = Math.max(1, 2 / globalScale);
  ctx.strokeStyle = selected ? COLORS.nodeStrokeSelected : COLORS.nodeStroke;
  ctx.stroke();
  
  // ============ STATE HALO ============
  const state = node.state;
  
  if (state === 'ACCUMULATION') {
    ctx.beginPath();
    ctx.arc(x, y, r + 3 / globalScale, 0, Math.PI * 2);
    ctx.lineWidth = 3 / globalScale;
    ctx.strokeStyle = COLORS.accumulation;
    ctx.stroke();
  } else if (state === 'DISTRIBUTION') {
    ctx.beginPath();
    ctx.arc(x, y, r + 3 / globalScale, 0, Math.PI * 2);
    ctx.lineWidth = 3 / globalScale;
    ctx.strokeStyle = COLORS.distribution;
    ctx.stroke();
  } else if (state === 'ROUTER') {
    ctx.beginPath();
    ctx.arc(x, y, r + 2 / globalScale, 0, Math.PI * 2);
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5 / globalScale;
    ctx.strokeStyle = COLORS.router;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  
  // ============ ЛЕЙБЛ ВНУТРИ КРУГА ============
  const label = getNodeLabel(node);
  
  // Maximum text width = 85% диаметра
  const maxTextWidth = r * 1.7;
  
  // Подбираем размер шрифта — начинаем с большего
  const baseFontSize = Math.max(10, Math.min(16, 14 / globalScale));
  const fontSize = fitTextToCircle(ctx, label, maxTextWidth, baseFontSize);
  
  ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.textColor;
  ctx.fillText(label, x, y);
  
  // ============ SELECTION RING ============
  if (selected || hovered) {
    ctx.beginPath();
    ctx.arc(x, y, r + 6 / globalScale, 0, Math.PI * 2);
    ctx.lineWidth = 2 / globalScale;
    ctx.strokeStyle = selected ? '#ffffff' : 'rgba(255,255,255,0.5)';
    ctx.stroke();
  }
  
  ctx.restore();
}

/**
 * Проверка попадания точки в узел (для hover/click)
 */
export function nodeContainsPoint(node, px, py) {
  if (!node || node.x === undefined || node.y === undefined) return false;
  
  const r = getNodeRadius(node);
  const dx = px - node.x;
  const dy = py - node.y;
  
  return (dx * dx + dy * dy) <= (r * r);
}

export default { drawNode, getNodeRadius, nodeContainsPoint };
