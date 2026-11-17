import React, { useEffect, useRef, useState } from 'react';
import {
  Armchair,
  Blocks,
  Coffee,
  Compass,
  DoorOpen,
  Droplets,
  Edit3,
  HeartHandshake,
  Home,
  RotateCw,
  Sparkles,
  Trash2,
  UserPlus,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  ROOM_THEMES,
  ROOMS_META,
  STARTER_PLOT_MAX_BLOCKS,
  createStarterPlotTiles,
  getCatalogItem,
} from '../shared/catalog.ts';
import type {
  ActionId,
  Direction,
  InventoryItem,
  PlacedFurniture,
  RoomId,
  RoomTheme,
  SpaceInfoPayload,
  WorldPlayer,
} from '../shared/types.ts';
import { drawPixelAvatar, type TurnaroundView } from '../utils/pixelAvatarRenderer.ts';
import { PixelAvatarPreview } from './PixelAvatarPreview.tsx';
import { ItemThumbnail } from './ItemThumbnail.tsx';
import { soundFX } from '../utils/sound.ts';

interface IsometricWorldProps {
  roomKey: string;
  currentPlayerId: string;
  players: WorldPlayer[];
  spaceInfo: SpaceInfoPayload | null;
  myInventory: InventoryItem[];
  myFriends: Array<{ id: string; name: string }>;
  onMove: (x: number, y: number, direction: Direction, action: ActionId, steps: number) => void;
  onChangeRoom: (targetRoomKey: string) => void;
  onFurnish: (
    op: 'place' | 'remove' | 'rotate' | 'theme',
    data: { instanceId?: string; x?: number; y?: number; rotation?: number; theme?: RoomTheme }
  ) => void;
  onBuildTile: (x: number, y: number) => void;
  onRoutineAction: (actionType: string) => void;
  onAddFriend: (friendId: string, friendName: string) => void;
  onStartTrade: (targetPlayer: WorldPlayer) => void;
  onOpenShop: () => void;
  onOpenMinigames: () => void;
}

const GRID_SIZE = 12;
const PRACA_W = 1240;
const PRACA_H = 816;
const PRACA_MAP_URL = '/assets/maps/praca_central_clean.png';
const PRACA_VIDEO_URL = '/assets/aistudio/Pixel_art_square_at_night_9ee6032c_a88eece1.mp4';
const PRACA_AVATAR_SCALE = 1.25;

// Unified indoor world units (zoom=1.0 reference) so character & furniture keep exact proportions at any viewport or browser zoom
const INDOOR_REF_W = 920;
const INDOOR_REF_H = 560;
const BASE_TILE_W = 72;
const BASE_TILE_H = 36;
const BASE_WALL_H = 88;
const FURN_BASE_SCALE = 0.58;
const CHAR_BASE_SCALE = 1.15;

const MIN_ZOOM = 0.7;
const MAX_ZOOM = 3.2;

interface InteractiveProp {
  x: number;
  y: number;
  kind: 'bench' | 'portal' | 'shop_kiosk' | 'job_kiosk' | 'food_kiosk';
  label: string;
  targetRoom?: RoomId;
  routineAction?: string;
}

interface PracaHotspot {
  id: string;
  kind: 'portal' | 'bench' | 'catalog';
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  label: string;
  targetRoom?: RoomId;
  sitPos?: { px: number; py: number; dir: Direction; view?: TurnaroundView };
}

const PRACA_HOTSPOTS: PracaHotspot[] = [
  // Building Entrances
  {
    id: 'portal_balada',
    kind: 'portal',
    x0: 15,
    y0: 215,
    x1: 235,
    y1: 525,
    label: 'Entrar na Balada Neon',
    targetRoom: 'balada',
  },
  {
    id: 'portal_shopping',
    kind: 'catalog',
    x0: 245,
    y0: 15,
    x1: 515,
    y1: 245,
    label: 'Abrir Catálogo OASIS',
  },
  {
    id: 'portal_cafeteria',
    kind: 'portal',
    x0: 625,
    y0: 5,
    x1: 830,
    y1: 215,
    label: 'Entrar na Cafeteria Aroma',
    targetRoom: 'cafeteria',
  },
  {
    id: 'portal_mercado',
    kind: 'portal',
    x0: 955,
    y0: 30,
    x1: 1195,
    y1: 310,
    label: 'Entrar no Mercado da Vila',
    targetRoom: 'mercado',
  },
  // Plaza Benches (calibrated to live 1240x816 Praça map/video coordinates & exact seat directions)
  {
    id: 'bench_tl',
    kind: 'bench',
    x0: 550,
    y0: 325,
    x1: 632,
    y1: 392,
    label: 'Sentar no banco da Fonte',
    sitPos: { px: 590, py: 368, dir: 'direita', view: '3/4' },
  },
  {
    id: 'bench_tr',
    kind: 'bench',
    x0: 762,
    y0: 315,
    x1: 842,
    y1: 382,
    label: 'Sentar no banco Nordeste',
    sitPos: { px: 806, py: 356, dir: 'esquerda', view: '3/4_esquerda' },
  },
  {
    id: 'bench_bot',
    kind: 'bench',
    x0: 600,
    y0: 515,
    x1: 695,
    y1: 588,
    label: 'Sentar no banco Sul',
    sitPos: { px: 650, py: 560, dir: 'esquerda', view: '3/4_esquerda' },
  },
  {
    id: 'bench_lower_left',
    kind: 'bench',
    x0: 460,
    y0: 530,
    x1: 575,
    y1: 605,
    label: 'Sentar no banco Oeste',
    sitPos: { px: 522, py: 566, dir: 'esquerda', view: '3/4_esquerda' },
  },
  {
    id: 'bench_street',
    kind: 'bench',
    x0: 845,
    y0: 660,
    x1: 965,
    y1: 745,
    label: 'Sentar no banco da Rua',
    sitPos: { px: 904, py: 716, dir: 'esquerda', view: '3/4_esquerda' },
  },
];

interface PracaDepthProp {
  id: string;
  url: string;
  x: number;
  y: number;
  w: number;
  h: number;
  baseY: number;
}

const PRACA_DEPTH_PROPS: PracaDepthProp[] = [
  { id: 'fountain_spire', url: '/assets/maps/praca_depth/fountain_spire.png', x: 678, y: 268, w: 66, h: 92, baseY: 404 },
  { id: 'tree_left', url: '/assets/maps/praca_depth/tree_left.png', x: 248, y: 200, w: 145, h: 206, baseY: 420 },
  { id: 'phone_booth', url: '/assets/maps/praca_depth/phone_booth.png', x: 1108, y: 366, w: 99, h: 201, baseY: 556 },
  { id: 'lamp_west', url: '/assets/maps/praca_depth/lamp_west.png', x: 318, y: 422, w: 47, h: 144, baseY: 562 },
  { id: 'hotdog_cart', url: '/assets/maps/praca_depth/hotdog_cart.png', x: 956, y: 512, w: 139, h: 169, baseY: 668 },
  { id: 'lamp_south', url: '/assets/maps/praca_depth/lamp_south.png', x: 712, y: 564, w: 65, h: 155, baseY: 716 },
  { id: 'bus_sign', url: '/assets/maps/praca_depth/bus_sign.png', x: 778, y: 612, w: 55, h: 125, baseY: 726 },
];

// Convert server world coords (0..11) <-> Praça artwork native pixels (0..1240, 0..816)
export function gridToPracaPx(gx: number, gy: number) {
  return {
    px: (gx / 11) * PRACA_W,
    py: (gy / 11) * PRACA_H,
  };
}

export function pracaPxToGrid(px: number, py: number) {
  return {
    x: Number(Math.max(0, Math.min(11, (px / PRACA_W) * 11)).toFixed(2)),
    y: Number(Math.max(0, Math.min(11, (py / PRACA_H) * 11)).toFixed(2)),
  };
}

const PRACA_OBSTACLE_BOXES: Array<[number, number, number, number]> = [
  [220, 355, 325, 480], // Balada right wall, brown boxes
  [295, 360, 408, 446], // Tree planter beside Shopping + upper lamp base
  [230, 505, 355, 610], // Lower-left Balada stairs curb, bush, trash, lamp
  [305, 588, 380, 656], // Lower-left corner yellow planter + upper trash can
  [378, 622, 416, 670], // Second trash can beside bottom stairs curb
  [575, 195, 700, 268], // Cafeteria umbrella table, chairs, potted bush
  [695, 168, 848, 255], // Cafeteria stalls + chalkboard
  [880, 145, 972, 232], // Big tree trunk, lamp base, blue potted bush
  [955, 195, 1020, 275], // Mercado barrel + potted bush
  [512, 348, 575, 412], // Top-left yellow planter + lamp beside fountain
  [548, 322, 634, 392], // Bench TL
  [652, 285, 750, 354], // Top-center pink flower planter above fountain
  [760, 312, 845, 384], // Bench TR
  [852, 325, 945, 422], // East trash can + lamps
  [908, 402, 1012, 496], // East pink/purple flower planter
  [418, 415, 548, 514], // Mid-left pink/purple flower planter
  [596, 514, 696, 578], // Bench South
  [424, 502, 564, 590], // Lower-left yellow planter + wooden bench
  [554, 614, 616, 666], // Lower-mid square bush
  [638, 616, 712, 676], // South square bush
  [578, 678, 712, 745], // Bottom-center glowing lantern + purple flower bed curb
  [704, 642, 772, 722], // South dual lamp post base
  [408, 658, 496, 730], // Bottom curb green bush
  [768, 645, 835, 732], // Bus stop sign base
  [838, 638, 965, 748], // Blue bench + narrow bush curb
  [865, 560, 955, 642], // Square bush behind blue bench
  [975, 602, 1095, 686], // Hotdog cart ground footprint (leaves walkway behind canopy open)
  [1092, 550, 1140, 625], // Trash can & metal fence right of hotdog cart
  [1056, 474, 1122, 532], // Bush behind/beside phone booth
  [1108, 472, 1212, 576], // Red phone booth ground footprint (leaves walkway behind booth open)
];

function isPracaPointRawBlocked(px: number, py: number): boolean {
  // 1. Outer walkable plaza cobblestone polygon (excludes walls, facades, stairs, asphalt road, right fence)
  if (px < 236 || px > 1135 || py < 185 || py > 745) return true;
  if (py < 395 - 0.65 * (px - 235)) return true;
  if (px >= 535 && px < 935 && py < 214) return true;
  if (px >= 935 && py < 215 + 0.60 * (px - 935)) return true;
  if (py > 545 + 0.53 * (px - 235)) return true;
  if (py > 745 - 0.49 * (px - 720)) return true;

  // 2. Central Fountain & Flower Ring (ellipse matching live 1240x816 map/video)
  const fx = (px - 710) / 152;
  const fy = (py - 442) / 104;
  if (fx * fx + fy * fy < 1) return true;

  // 3. Planters, trees, benches, lamp posts, trash cans, stalls, cart footprint, and booth footprint
  for (const [x0, y0, x1, y1] of PRACA_OBSTACLE_BOXES) {
    if (px >= x0 && px <= x1 && py >= y0 && py <= y1) return true;
  }
  return false;
}

export function isPointInsidePracaObstacle(px: number, py: number): boolean {
  // Check center + compact shoe/shadow clearance footprint so feet never touch planter edges
  return (
    isPracaPointRawBlocked(px, py) ||
    isPracaPointRawBlocked(px - 10, py) ||
    isPracaPointRawBlocked(px + 10, py) ||
    isPracaPointRawBlocked(px, py - 5) ||
    isPracaPointRawBlocked(px, py + 4)
  );
}

const PRACA_STEP_PX = 16;
const PRACA_GRID_COLS = Math.floor(PRACA_W / PRACA_STEP_PX);
const PRACA_GRID_ROWS = Math.floor(PRACA_H / PRACA_STEP_PX);

function isPracaCellWalkable(c: number, r: number): boolean {
  if (c < 0 || r < 0 || c >= PRACA_GRID_COLS || r >= PRACA_GRID_ROWS) return false;
  const cx = c * PRACA_STEP_PX + PRACA_STEP_PX / 2;
  const cy = r * PRACA_STEP_PX + PRACA_STEP_PX / 2;
  return !isPointInsidePracaObstacle(cx, cy);
}

function findNearestWalkablePraca(targetPx: number, targetPy: number): { px: number; py: number } {
  const sc = Math.max(0, Math.min(PRACA_GRID_COLS - 1, Math.floor(targetPx / PRACA_STEP_PX)));
  const sr = Math.max(0, Math.min(PRACA_GRID_ROWS - 1, Math.floor(targetPy / PRACA_STEP_PX)));
  if (isPracaCellWalkable(sc, sr)) {
    return {
      px: sc * PRACA_STEP_PX + PRACA_STEP_PX / 2,
      py: sr * PRACA_STEP_PX + PRACA_STEP_PX / 2,
    };
  }
  let bestDist = Infinity;
  let bestPx = 568;
  let bestPy = 520;
  for (let rad = 1; rad <= 16; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.abs(dr) !== rad && Math.abs(dc) !== rad) continue;
        const nc = sc + dc;
        const nr = sr + dr;
        if (!isPracaCellWalkable(nc, nr)) continue;
        const px = nc * PRACA_STEP_PX + PRACA_STEP_PX / 2;
        const py = nr * PRACA_STEP_PX + PRACA_STEP_PX / 2;
        const d = Math.hypot(px - targetPx, py - targetPy);
        if (d < bestDist) {
          bestDist = d;
          bestPx = px;
          bestPy = py;
        }
      }
    }
    if (bestDist < Infinity) return { px: bestPx, py: bestPy };
  }
  return { px: 568, py: 520 };
}

interface WalkStep {
  x: number;
  y: number;
  dir: Direction;
  view?: TurnaroundView;
  action?: ActionId;
}

function directionFromDelta(dx: number, dy: number, fallback: Direction = 'frente'): Direction {
  if (dx === 0 && dy === 0) return fallback;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? 'direita' : 'esquerda';
  }
  return dy > 0 ? 'frente' : 'costas';
}

function turnaroundViewFromDelta(dx: number, dy: number, fallback: TurnaroundView = 'frente'): TurnaroundView {
  if (dx === 0 && dy === 0) return fallback;
  const ang = Math.atan2(dy, dx); // radians: 0=right, PI/2=down(frente), PI=left, -PI/2=up(costas)
  const deg = ((ang * 180) / Math.PI + 360) % 360;
  // Centered sectors so due Left (180°), Right (0°), Down (90°), Up (270°) map accurately
  if (deg < 55 || deg >= 325) return '3/4';
  if (deg < 125) return 'frente';
  if (deg < 215) return '3/4_esquerda';
  if (deg < 250) return 'costas_esquerda';
  if (deg < 290) return 'costas';
  return 'costas_direita';
}

function indoorDeltaToView(dx: number, dy: number, fallback: TurnaroundView = '3/4'): TurnaroundView {
  if (dx === 0 && dy === 0) return fallback;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? '3/4' : 'costas_esquerda';
  }
  return dy > 0 ? '3/4_esquerda' : 'costas_direita';
}

function findPracaPath(
  startPx: number,
  startPy: number,
  destPx: number,
  destPy: number,
  finalDir?: Direction,
  finalAction: ActionId = 'parado',
  finalView?: TurnaroundView
): WalkStep[] {
  const toCol = (px: number) =>
    Math.max(0, Math.min(PRACA_GRID_COLS - 1, Math.floor(px / PRACA_STEP_PX)));
  const toRow = (py: number) =>
    Math.max(0, Math.min(PRACA_GRID_ROWS - 1, Math.floor(py / PRACA_STEP_PX)));
  const cellCenter = (c: number, r: number) => ({
    px: c * PRACA_STEP_PX + PRACA_STEP_PX / 2,
    py: r * PRACA_STEP_PX + PRACA_STEP_PX / 2,
  });

  // Snap start to nearest walkable cell if currently touching an edge
  const startWalkable = findNearestWalkablePraca(startPx, startPy);
  const sc = toCol(startWalkable.px);
  const sr = toRow(startWalkable.py);

  // For bench seating, pathfind to the closest walkable cell near the seat, then step onto sitPos
  const goalWalkable = findNearestWalkablePraca(destPx, destPy);
  const dc = toCol(goalWalkable.px);
  const dr = toRow(goalWalkable.py);

  const key = (c: number, r: number) => `${c},${r}`;
  const startKey = key(sc, sr);
  const goalKey = key(dc, dr);

  const queue: Array<{ c: number; r: number }> = [{ c: sc, r: sr }];
  const visited = new Set<string>([startKey]);
  const parent = new Map<string, { pc: number; pr: number; dir: Direction; view: TurnaroundView }>();
  let found = startKey === goalKey;

  const dirs: Array<{ dc: number; dr: number; dir: Direction; view: TurnaroundView }> = [
    { dc: 1, dr: 0, dir: 'direita', view: '3/4' },
    { dc: -1, dr: 0, dir: 'esquerda', view: '3/4_esquerda' },
    { dc: 0, dr: 1, dir: 'frente', view: 'frente' },
    { dc: 0, dr: -1, dir: 'costas', view: 'costas' },
    { dc: 1, dr: 1, dir: 'direita', view: '3/4' },
    { dc: -1, dr: 1, dir: 'esquerda', view: '3/4_esquerda' },
    { dc: 1, dr: -1, dir: 'direita', view: 'costas_direita' },
    { dc: -1, dr: -1, dir: 'esquerda', view: 'costas_esquerda' },
  ];

  while (queue.length > 0 && !found) {
    const cur = queue.shift()!;
    for (const d of dirs) {
      const nc = cur.c + d.dc;
      const nr = cur.r + d.dr;
      if (!isPracaCellWalkable(nc, nr)) continue;
      // Prevent corner cutting on diagonal steps
      if (d.dc !== 0 && d.dr !== 0) {
        if (!isPracaCellWalkable(cur.c + d.dc, cur.r) || !isPracaCellWalkable(cur.c, cur.r + d.dr)) {
          continue;
        }
      }
      const nk = key(nc, nr);
      if (visited.has(nk)) continue;
      visited.add(nk);
      parent.set(nk, { pc: cur.c, pr: cur.r, dir: d.dir, view: d.view });
      if (nk === goalKey) {
        found = true;
        break;
      }
      queue.push({ c: nc, r: nr });
    }
  }

  const steps: WalkStep[] = [];
  if (found && startKey !== goalKey) {
    const cells: Array<{ c: number; r: number; dir: Direction; view: TurnaroundView }> = [];
    let ck = goalKey;
    while (ck !== startKey) {
      const p = parent.get(ck);
      if (!p) break;
      const [cs, rs] = ck.split(',').map(Number);
      cells.push({ c: cs, r: rs, dir: p.dir, view: p.view });
      ck = key(p.pc, p.pr);
    }
    cells.reverse();

    for (let i = 0; i < cells.length; i++) {
      const center = cellCenter(cells[i].c, cells[i].r);
      const g = pracaPxToGrid(center.px, center.py);
      const isLast = i === cells.length - 1 && finalAction !== 'sentado';
      steps.push({
        x: g.x,
        y: g.y,
        dir: isLast && finalDir ? finalDir : cells[i].dir,
        view: isLast ? finalView || finalDir || cells[i].view : cells[i].view,
        action: isLast ? finalAction : 'andando',
      });
    }
  }

  // Only step onto an exact off-grid sitPos when intentionally sitting on a plaza bench
  if (finalAction === 'sentado') {
    const finalGrid = pracaPxToGrid(destPx, destPy);
    steps.push({
      x: finalGrid.x,
      y: finalGrid.y,
      dir: finalDir || 'frente',
      view: finalView || finalDir || 'frente',
      action: 'sentado',
    });
  } else if (steps.length === 0) {
    const g = pracaPxToGrid(goalWalkable.px, goalWalkable.py);
    steps.push({
      x: g.x,
      y: g.y,
      dir: finalDir || directionFromDelta(goalWalkable.px - startPx, goalWalkable.py - startPy, 'frente'),
      view: finalView || finalDir || turnaroundViewFromDelta(goalWalkable.px - startPx, goalWalkable.py - startPy, 'frente'),
      action: finalAction,
    });
  }

  return steps;
}

function findIndoorPath(
  startX: number,
  startY: number,
  goalX: number,
  goalY: number,
  isWalkable: (x: number, y: number) => boolean,
  finalDir?: Direction,
  finalAction: ActionId = 'parado',
  finalView?: TurnaroundView
): WalkStep[] {
  const sx = Math.max(0, Math.min(GRID_SIZE - 1, Math.round(startX)));
  const sy = Math.max(0, Math.min(GRID_SIZE - 1, Math.round(startY)));
  const gx = Math.max(0, Math.min(GRID_SIZE - 1, Math.round(goalX)));
  const gy = Math.max(0, Math.min(GRID_SIZE - 1, Math.round(goalY)));

  const key = (x: number, y: number) => `${x},${y}`;
  const startKey = key(sx, sy);
  const goalKey = key(gx, gy);

  if (startKey === goalKey) {
    return [
      {
        x: gx,
        y: gy,
        dir: finalDir || 'frente',
        view: finalView || finalDir || 'frente',
        action: finalAction,
      },
    ];
  }

  const queue: Array<{ x: number; y: number; depth: number }> = [{ x: sx, y: sy, depth: 0 }];
  const visited = new Set<string>([startKey]);
  const parent = new Map<string, { px: number; py: number; dir: Direction; view: TurnaroundView }>();
  let found = false;

  while (queue.length > 0 && !found) {
    const cur = queue.shift()!;
    const dirs: Array<{ dx: number; dy: number; dir: Direction; view: TurnaroundView }> =
      cur.depth % 2 === 0
        ? [
            { dx: 1, dy: 0, dir: 'direita', view: '3/4' },
            { dx: -1, dy: 0, dir: 'esquerda', view: 'costas_esquerda' },
            { dx: 0, dy: 1, dir: 'frente', view: '3/4_esquerda' },
            { dx: 0, dy: -1, dir: 'costas', view: 'costas_direita' },
          ]
        : [
            { dx: 0, dy: 1, dir: 'frente', view: '3/4_esquerda' },
            { dx: 0, dy: -1, dir: 'costas', view: 'costas_direita' },
            { dx: 1, dy: 0, dir: 'direita', view: '3/4' },
            { dx: -1, dy: 0, dir: 'esquerda', view: 'costas_esquerda' },
          ];

    for (const d of dirs) {
      const nx = cur.x + d.dx;
      const ny = cur.y + d.dy;
      if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) continue;
      const nk = key(nx, ny);
      if (visited.has(nk)) continue;
      if (nk !== goalKey && !isWalkable(nx, ny)) continue;
      visited.add(nk);
      parent.set(nk, { px: cur.x, py: cur.y, dir: d.dir, view: d.view });
      if (nk === goalKey) {
        found = true;
        break;
      }
      queue.push({ x: nx, y: ny, depth: cur.depth + 1 });
    }
  }

  if (!found) return [];

  const path: WalkStep[] = [];
  let ck = goalKey;
  while (ck !== startKey) {
    const p = parent.get(ck);
    if (!p) break;
    const [cx, cy] = ck.split(',').map(Number);
    const isLast = ck === goalKey;
    path.push({
      x: cx,
      y: cy,
      dir: isLast && finalDir ? finalDir : p.dir,
      view: isLast && finalView ? finalView : p.view,
      action: isLast ? finalAction : 'andando',
    });
    ck = key(p.px, p.py);
  }
  path.reverse();
  return path;
}

function getRoomProps(roomId: RoomId): InteractiveProp[] {
  if (roomId === 'balada') {
    return [
      { x: 5, y: 10, kind: 'portal', label: 'Voltar para Praça', targetRoom: 'praca' },
      { x: 2, y: 4, kind: 'bench', label: 'Sofá VIP' },
      { x: 9, y: 4, kind: 'bench', label: 'Sofá VIP' },
      { x: 5, y: 3, kind: 'job_kiosk', label: 'Trabalhar de DJ (F2P)' },
    ];
  }
  if (roomId === 'cafeteria') {
    return [
      { x: 5, y: 10, kind: 'portal', label: 'Voltar para Praça', targetRoom: 'praca' },
      { x: 3, y: 5, kind: 'bench', label: 'Mesa de Café' },
      { x: 8, y: 6, kind: 'bench', label: 'Mesa de Café' },
      { x: 5, y: 3, kind: 'job_kiosk', label: 'Trabalhar de Barista (F2P)' },
      { x: 7, y: 3, kind: 'food_kiosk', label: 'Tomar Café (-8m)', routineAction: 'lanche_cafeteria' },
    ];
  }
  if (roomId === 'mercado') {
    return [
      { x: 5, y: 10, kind: 'portal', label: 'Voltar para Praça', targetRoom: 'praca' },
      { x: 5, y: 3, kind: 'job_kiosk', label: 'Fazer Entregas (F2P)' },
      { x: 7, y: 3, kind: 'food_kiosk', label: 'Comer Frutas (-8m)', routineAction: 'frutas_mercado' },
    ];
  }
  return [{ x: 5, y: 10, kind: 'portal', label: 'Sair para Praça', targetRoom: 'praca' }];
}

function isBlockedTile(roomId: RoomId, x: number, y: number): boolean {
  if (x < 1 || y < 1 || x > 10 || y > 10) return true;
  if (roomId === 'praca') {
    const { px, py } = gridToPracaPx(x, y);
    return isPointInsidePracaObstacle(px, py);
  }
  return false;
}

export const IsometricWorld: React.FC<IsometricWorldProps> = ({
  roomKey,
  currentPlayerId,
  players,
  spaceInfo,
  myInventory,
  myFriends,
  onMove,
  onChangeRoom,
  onFurnish,
  onBuildTile,
  onRoutineAction,
  onAddFriend,
  onStartTrade,
  onOpenShop,
  onOpenMinigames,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pracaImgRef = useRef<HTMLImageElement | null>(null);
  const pracaVideoRef = useRef<HTMLVideoElement | null>(null);
  const depthImgsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const furnitureImgsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [pracaImgLoaded, setPracaImgLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: 960, h: 620 });
  const [dpr, setDpr] = useState(() =>
    typeof window !== 'undefined' ? Math.min(2.5, window.devicePixelRatio || 1) : 1
  );
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  zoomRef.current = zoom;
  const camRef = useRef({ x: 480, y: 310, zoom: 1 });
  const pinchRef = useRef<{ dist: number; startZoom: number; active: boolean }>({
    dist: 0,
    startZoom: 1,
    active: false,
  });
  const suppressClickRef = useRef(false);

  const baseRoomId = (roomKey.startsWith('espaco') ? 'espaco' : roomKey) as RoomId;
  const isOwnSpace = roomKey === `espaco:${currentPlayerId}`;
  const roomMeta = ROOMS_META[baseRoomId] || ROOMS_META.praca;

  const [editMode, setEditMode] = useState(false);
  const [buildTab, setBuildTab] = useState<'mobiliar' | 'terreno'>('terreno');
  const [placingInstanceId, setPlacingInstanceId] = useState<string | null>(null);
  const [selectedFurnId, setSelectedFurnId] = useState<string | null>(null);
  const [hoverTile, setHoverTile] = useState<{ x: number; y: number } | null>(null);
  const [hoveredHotspot, setHoveredHotspot] = useState<PracaHotspot | null>(null);
  const [mouseCanvasPos, setMouseCanvasPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<WorldPlayer | null>(null);

  const visualPosRef = useRef<Record<string, { vx: number; vy: number }>>({});
  const lastVisualViewRef = useRef<Record<string, TurnaroundView>>({});
  const wasdStopTimerRef = useRef<number | null>(null);
  const lastWasdStepRef = useRef<{ x: number; y: number; dir: Direction } | null>(null);
  const walkQueueRef = useRef<WalkStep[]>([]);
  const activeWalkTargetRef = useRef<WalkStep | null>(null);
  const pendingPostWalkRef = useRef<(() => void) | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const lastStepSoundAtRef = useRef<number>(0);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const playersRef = useRef<WorldPlayer[]>(players);
  playersRef.current = players;

  const hoverTileRef = useRef(hoverTile);
  hoverTileRef.current = hoverTile;

  const hoveredHotspotRef = useRef<PracaHotspot | null>(hoveredHotspot);
  hoveredHotspotRef.current = hoveredHotspot;

  const spaceInfoRef = useRef(spaceInfo);
  spaceInfoRef.current = spaceInfo;

  const buildTabRef = useRef(buildTab);
  buildTabRef.current = buildTab;

  // Preload exact Praça artwork and foreground depth-occlusion cutouts
  useEffect(() => {
    const img = new Image();
    img.src = PRACA_MAP_URL;
    img.onload = () => {
      pracaImgRef.current = img;
      setPracaImgLoaded(true);
    };
    for (const dp of PRACA_DEPTH_PROPS) {
      if (!depthImgsRef.current.has(dp.id)) {
        const dImg = new Image();
        dImg.src = dp.url;
        depthImgsRef.current.set(dp.id, dImg);
      }
    }
  }, []);

  useEffect(() => {
    walkQueueRef.current = [];
    activeWalkTargetRef.current = null;
    pendingPostWalkRef.current = null;
    visualPosRef.current = {};
    lastVisualViewRef.current = {};
    if (!isOwnSpace) {
      setEditMode(false);
      setPlacingInstanceId(null);
      setSelectedFurnId(null);
    }
  }, [isOwnSpace, roomKey]);

  useEffect(() => {
    if (baseRoomId !== 'praca') return;
    const v = pracaVideoRef.current;
    if (!v) return;
    v.muted = true;
    v.loop = true;
    v.play().catch(() => {});
  }, [baseRoomId]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const syncSizeAndDpr = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.max(240, Math.floor(rect.width));
      const h = Math.max(200, Math.floor(rect.height));
      setCanvasSize({ w, h });
      setDpr(Math.min(2.5, window.devicePixelRatio || 1));
    };
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(240, Math.floor(entry.contentRect.width));
        const h = Math.max(200, Math.floor(entry.contentRect.height));
        setCanvasSize({ w, h });
        setDpr(Math.min(2.5, window.devicePixelRatio || 1));
      }
    });
    ro.observe(el);
    window.addEventListener('resize', syncSizeAndDpr);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', syncSizeAndDpr);
    };
  }, []);

  // Compute exact Praça base transform (aspect-fit centered cleanly so every building/hotspot aligns)
  const getPracaTransform = (cw: number, ch: number) => {
    const scale = Math.min(cw / PRACA_W, ch / PRACA_H);
    const drawW = PRACA_W * scale;
    const drawH = PRACA_H * scale;
    const ox = (cw - drawW) / 2;
    const oy = (ch - drawH) / 2;
    return { scale, drawW, drawH, ox, oy };
  };

  // Compute proportional indoor metrics (NO independent clamps so browser zoom keeps ratios locked)
  const getIndoorMetrics = (cw: number, ch: number) => {
    const fitScale = Math.min(cw / INDOOR_REF_W, ch / INDOOR_REF_H);
    const tileW = BASE_TILE_W * fitScale;
    const tileH = BASE_TILE_H * fitScale;
    const wallH = BASE_WALL_H * fitScale;
    const originX = cw / 2;
    const totalRoomH = wallH + GRID_SIZE * tileH;
    const originY = (ch - totalRoomH) / 2 + wallH;
    return { fitScale, tileW, tileH, wallH, originX, originY };
  };

  const screenToBase = (sx: number, sy: number) => {
    const cam = camRef.current;
    const cx = canvasSize.w / 2;
    const cy = canvasSize.h / 2;
    return {
      bx: cam.x + (sx - cx) / cam.zoom,
      by: cam.y + (sy - cy) / cam.zoom,
    };
  };

  // Keyboard WASD / Arrow movement (cancels queued click-walk and transitions cleanly to 'parado' facing the stopped side)
  useEffect(() => {
    const scheduleWasdIdle = (x: number, y: number, dir: Direction, delayMs = 200) => {
      lastWasdStepRef.current = { x, y, dir };
      if (wasdStopTimerRef.current !== null) {
        window.clearTimeout(wasdStopTimerRef.current);
      }
      wasdStopTimerRef.current = window.setTimeout(() => {
        wasdStopTimerRef.current = null;
        if (activeWalkTargetRef.current || walkQueueRef.current.length > 0) return;
        const last = lastWasdStepRef.current;
        if (!last) return;
        lastWasdStepRef.current = null;
        onMoveRef.current(last.x, last.y, last.dir, 'parado', 0);
      }, delayMs);
    };

    const handleKey = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      const me = playersRef.current.find((p) => p.id === currentPlayerId);
      if (!me) return;

      let dx = 0;
      let dy = 0;
      let dir: Direction = me.direction;

      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        dy = -1;
        dir = 'costas';
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        dy = 1;
        dir = 'frente';
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        dx = -1;
        dir = 'esquerda';
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        dx = 1;
        dir = 'direita';
      } else {
        return;
      }

      e.preventDefault();

      // Cancel any click-to-walk queue when player steers manually
      walkQueueRef.current = [];
      activeWalkTargetRef.current = null;
      pendingPostWalkRef.current = null;

      const vis = visualPosRef.current[currentPlayerId] || { vx: me.x, vy: me.y };
      // Wait until previous step is nearly complete so holding a key walks cleanly square-by-square
      if (Math.hypot(me.x - vis.vx, me.y - vis.vy) > 0.35) {
        return;
      }

      if (baseRoomId === 'praca') {
        const cur = gridToPracaPx(me.x, me.y);
        const stepPx = PRACA_STEP_PX;
        let targetPx = cur.px + dx * stepPx;
        let targetPy = cur.py + dy * stepPx;
        if (isPointInsidePracaObstacle(targetPx, targetPy)) {
          // Try half-step or wall-sliding along diagonal curbs
          const halfPx = cur.px + dx * (stepPx * 0.6);
          const halfPy = cur.py + dy * (stepPx * 0.6);
          if (!isPointInsidePracaObstacle(halfPx, halfPy)) {
            targetPx = halfPx;
            targetPy = halfPy;
          } else {
            lastVisualViewRef.current[currentPlayerId] = turnaroundViewFromDelta(dx, dy, dir);
            scheduleWasdIdle(me.x, me.y, dir, 60);
            return;
          }
        }
        const g = pracaPxToGrid(targetPx, targetPy);
        lastVisualViewRef.current[currentPlayerId] = turnaroundViewFromDelta(dx, dy, dir);
        soundFX.playStep();
        onMove(g.x, g.y, dir, 'andando', 1);
        scheduleWasdIdle(g.x, g.y, dir, 190);
        return;
      }

      if (baseRoomId === 'espaco') {
        const plotTiles = spaceInfoRef.current?.plotTiles || createStarterPlotTiles();
        const nx = Math.max(0, Math.min(11, Math.round(me.x) + dx));
        const ny = Math.max(0, Math.min(11, Math.round(me.y) + dy));
        const blockedByFurn = spaceInfoRef.current?.furniture.some((f) => {
          if (f.x !== nx || f.y !== ny) return false;
          const cat = getCatalogItem(f.itemId);
          return Boolean(cat && cat.shape !== 'rug');
        });
        if (plotTiles.includes(`${nx},${ny}`) && !blockedByFurn) {
          lastVisualViewRef.current[currentPlayerId] = indoorDeltaToView(dx, dy, dir);
          soundFX.playStep();
          onMove(nx, ny, dir, 'andando', 1);
          scheduleWasdIdle(nx, ny, dir, 220);
        } else {
          lastVisualViewRef.current[currentPlayerId] = indoorDeltaToView(dx, dy, dir);
          scheduleWasdIdle(me.x, me.y, dir, 60);
        }
        return;
      }

      const nx = Math.max(1, Math.min(10, Math.round(me.x) + dx));
      const ny = Math.max(1, Math.min(10, Math.round(me.y) + dy));
      const blockedByProp = getRoomProps(baseRoomId).some(
        (p) => p.x === nx && p.y === ny && p.kind !== 'portal'
      );
      if (!isBlockedTile(baseRoomId, nx, ny) && !blockedByProp) {
        lastVisualViewRef.current[currentPlayerId] = indoorDeltaToView(dx, dy, dir);
        soundFX.playStep();
        onMove(nx, ny, dir, 'andando', 1);
        scheduleWasdIdle(nx, ny, dir, 220);
      } else {
        lastVisualViewRef.current[currentPlayerId] = indoorDeltaToView(dx, dy, dir);
        scheduleWasdIdle(me.x, me.y, dir, 60);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 'a', 'A', 's', 'S', 'd', 'D'].includes(e.key)) {
        const last = lastWasdStepRef.current;
        if (last) {
          scheduleWasdIdle(last.x, last.y, last.dir, 140);
        }
      }
    };

    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKeyUp);
      if (wasdStopTimerRef.current !== null) {
        window.clearTimeout(wasdStopTimerRef.current);
      }
    };
  }, [currentPlayerId, baseRoomId, onMove]);

  // Isometric math for indoor rooms (proportional across PC, Mobile, and Browser Zoom)
  const indoor = getIndoorMetrics(canvasSize.w, canvasSize.h);
  const { fitScale: indoorFitScale, tileW, tileH, wallH, originX, originY } = indoor;

  const gridToScreen = (gx: number, gy: number) => ({
    sx: originX + (gx - gy) * (tileW / 2),
    sy: originY + (gx + gy) * (tileH / 2),
  });

  const screenToGrid = (sx: number, sy: number) => {
    const rx = sx - originX;
    const ry = sy - originY;
    const gx = Math.floor((rx / (tileW / 2) + ry / (tileH / 2)) / 2);
    const gy = Math.floor((ry / (tileH / 2) - rx / (tileW / 2)) / 2);
    return { x: gx, y: gy };
  };

  // Main Render Loop
  useEffect(() => {
    let rafId = 0;
    let tick = 0;

    const drawIsoTile = (
      ctx: CanvasRenderingContext2D,
      gx: number,
      gy: number,
      fill: string,
      stroke = 'rgba(15,23,42,0.28)',
      elevation = 0
    ) => {
      const { sx, sy } = gridToScreen(gx, gy);
      const y = sy - elevation;
      ctx.beginPath();
      ctx.moveTo(sx, y);
      ctx.lineTo(sx + tileW / 2, y + tileH / 2);
      ctx.lineTo(sx, y + tileH);
      ctx.lineTo(sx - tileW / 2, y + tileH / 2);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    const drawIsoBox = (
      ctx: CanvasRenderingContext2D,
      gx: number,
      gy: number,
      height: number,
      topColor: string,
      leftColor: string,
      rightColor: string
    ) => {
      const { sx, sy } = gridToScreen(gx, gy);
      const hw = tileW / 2;
      const hh = tileH / 2;

      ctx.beginPath();
      ctx.moveTo(sx, sy - height);
      ctx.lineTo(sx + hw, sy + hh - height);
      ctx.lineTo(sx, sy + tileH - height);
      ctx.lineTo(sx - hw, sy + hh - height);
      ctx.closePath();
      ctx.fillStyle = topColor;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(sx - hw, sy + hh - height);
      ctx.lineTo(sx, sy + tileH - height);
      ctx.lineTo(sx, sy + tileH);
      ctx.lineTo(sx - hw, sy + hh);
      ctx.closePath();
      ctx.fillStyle = leftColor;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(sx, sy + tileH - height);
      ctx.lineTo(sx + hw, sy + hh - height);
      ctx.lineTo(sx + hw, sy + hh);
      ctx.lineTo(sx, sy + tileH);
      ctx.closePath();
      ctx.fillStyle = rightColor;
      ctx.fill();
    };

    const getFurnSprite = (url: string): HTMLImageElement | null => {
      const cache = furnitureImgsRef.current;
      let img = cache.get(url);
      if (!img) {
        img = new Image();
        img.src = url;
        cache.set(url, img);
      }
      return img.complete && img.naturalWidth > 0 ? img : null;
    };

    const drawFurniturePiece = (
      ctx: CanvasRenderingContext2D,
      furn: PlacedFurniture,
      isSelected: boolean
    ) => {
      const item = getCatalogItem(furn.itemId);
      if (!item) return;
      const { sx, sy } = gridToScreen(furn.x, furn.y);

      if (isSelected) {
        drawIsoTile(ctx, furn.x, furn.y, 'rgba(251, 191, 36, 0.28)', '#fbbf24', 1);
      }

      if (item.spriteUrl) {
        const sprite = getFurnSprite(item.spriteUrl);
        if (sprite) {
          // Subtle shadow for non-rug items
          if (item.shape !== 'rug') {
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
            ctx.beginPath();
            ctx.ellipse(sx, sy + tileH * 0.56, tileW * 0.28, tileH * 0.28, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          // Scale sprite proportionally to indoorFitScale (NO independent clamping)
          const unitScale = FURN_BASE_SCALE * indoorFitScale;
          const maxBox = tileW * 1.62;
          let drawW = sprite.naturalWidth * unitScale;
          let drawH = sprite.naturalHeight * unitScale;
          if (drawW > maxBox) {
            const ratio = maxBox / drawW;
            drawW *= ratio;
            drawH *= ratio;
          }

          const anchorY = item.shape === 'rug' ? sy + tileH * 0.5 + drawH * 0.45 : sy + tileH * 0.68;
          const flipX = furn.rotation === 90 || furn.rotation === 270;

          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.translate(sx, anchorY);
          if (flipX) ctx.scale(-1, 1);
          ctx.drawImage(sprite, -drawW / 2, -drawH, drawW, drawH);
          ctx.restore();
          return;
        }
      }

      // Minimal fallback while PNG loads
      drawIsoBox(ctx, furn.x, furn.y, 14 * indoorFitScale, item.primaryColor, item.secondaryColor, '#1e1b4b');
    };

    const drawSignLabel = (
      ctx: CanvasRenderingContext2D,
      sx: number,
      sy: number,
      text: string,
      bg: string,
      border: string,
      textColor = '#ffffff',
      yOffset = -34
    ) => {
      ctx.font = 'bold 11px Silkscreen, monospace';
      const w = ctx.measureText(text).width + 16;
      const x = Math.round(sx - w / 2);
      const y = Math.round(sy + yOffset);
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, w, 20);
      ctx.strokeStyle = border;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, 20);
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.fillText(text, sx, y + 14);
    };

    const drawPlayerNameAndBubble = (
      ctx: CanvasRenderingContext2D,
      sx: number,
      topY: number,
      pl: WorldPlayer,
      now: number
    ) => {
      const labelY = topY - 8;
      ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
      const nameW = ctx.measureText(pl.name).width + 14;
      ctx.fillStyle =
        pl.id === currentPlayerId
          ? 'rgba(245, 158, 11, 0.94)'
          : pl.isNpc
          ? 'rgba(20, 26, 54, 0.88)'
          : 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(Math.round(sx - nameW / 2), labelY - 15, nameW, 17);
      ctx.strokeStyle =
        pl.id === currentPlayerId ? '#fef08a' : pl.isNpc ? 'rgba(168,85,247,0.55)' : 'rgba(148,163,184,0.45)';
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(sx - nameW / 2), labelY - 15, nameW, 17);
      ctx.fillStyle = pl.id === currentPlayerId ? '#0f172a' : '#f8fafc';
      ctx.textAlign = 'center';
      ctx.fillText(pl.name, sx, labelY - 2);

      const showBubble = pl.bubbleText && (!pl.bubbleExpiresAt || pl.bubbleExpiresAt > now);
      if (showBubble && pl.bubbleText) {
        ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
        const text = pl.bubbleText.slice(0, 42);
        const bw = Math.max(64, ctx.measureText(text).width + 18);
        const bx = Math.round(sx - bw / 2);
        const by = labelY - 43;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bx, by, bw, 22);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, bw, 22);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx - 3, by + 21, 6, 4);

        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';
        ctx.fillText(text, sx, by + 15);
      }
    };

    const renderFrame = (frameNow: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const prevNow = lastFrameTimeRef.current || frameNow;
      const dt = Math.min(0.05, Math.max(0.001, (frameNow - prevNow) / 1000));
      lastFrameTimeRef.current = frameNow;

      tick += dt * 8.4;
      const now = Date.now();
      const cw = canvasSize.w;
      const ch = canvasSize.h;
      const centerX = cw / 2;
      const centerY = ch / 2;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Clear deep twilight canvas background
      ctx.fillStyle = '#0d1022';
      ctx.fillRect(0, 0, cw, ch);

      const moveLinear = (
        cur: { vx: number; vy: number },
        tx: number,
        ty: number,
        isPraca: boolean
      ) => {
        if (isPraca) {
          const curPx = gridToPracaPx(cur.vx, cur.vy);
          const tgtPx = gridToPracaPx(tx, ty);
          const dpx = tgtPx.px - curPx.px;
          const dpy = tgtPx.py - curPx.py;
          const distPx = Math.hypot(dpx, dpy);
          if (distPx > 460) {
            cur.vx = tx;
            cur.vy = ty;
            return true;
          }
          const maxStepPx = 165 * dt;
          if (distPx <= maxStepPx) {
            cur.vx = tx;
            cur.vy = ty;
            return true;
          }
          const nextPx = curPx.px + (dpx / distPx) * maxStepPx;
          const nextPy = curPx.py + (dpy / distPx) * maxStepPx;
          const g = pracaPxToGrid(nextPx, nextPy);
          cur.vx = g.x;
          cur.vy = g.y;
          return false;
        }

        const dx = tx - cur.vx;
        const dy = ty - cur.vy;
        const dist = Math.hypot(dx, dy);
        if (dist > 6) {
          cur.vx = tx;
          cur.vy = ty;
          return true;
        }
        const maxStep = 4.2 * dt;
        if (dist <= maxStep) {
          cur.vx = tx;
          cur.vy = ty;
          return true;
        }
        cur.vx += (dx / dist) * maxStep;
        cur.vy += (dy / dist) * maxStep;
        return false;
      };

      // Advance active local walk queue square-by-square, and linearly animate remote players
      for (const pl of playersRef.current) {
        const cur = visualPosRef.current[pl.id] || { vx: pl.x, vy: pl.y };

        if (pl.id === currentPlayerId && (activeWalkTargetRef.current || walkQueueRef.current.length > 0)) {
          if (!activeWalkTargetRef.current && walkQueueRef.current.length > 0) {
            activeWalkTargetRef.current = walkQueueRef.current.shift()!;
          }
          const target = activeWalkTargetRef.current;
          if (target) {
            lastVisualViewRef.current[pl.id] = target.view || target.dir;
            const arrived = moveLinear(cur, target.x, target.y, baseRoomId === 'praca');
            if (arrived) {
              const hasMore = walkQueueRef.current.length > 0;
              const emitAction: ActionId = hasMore ? 'andando' : target.action || 'parado';
              lastVisualViewRef.current[pl.id] = target.view || target.dir;
              onMoveRef.current(target.x, target.y, target.dir, emitAction, 1);

              if (now - lastStepSoundAtRef.current >= 140) {
                soundFX.playStep();
                lastStepSoundAtRef.current = now;
              }

              if (hasMore) {
                activeWalkTargetRef.current = walkQueueRef.current.shift()!;
              } else {
                activeWalkTargetRef.current = null;
                const postCb = pendingPostWalkRef.current;
                pendingPostWalkRef.current = null;
                if (postCb) postCb();
              }
            }
          }
        } else {
          const prevVx = cur.vx;
          const prevVy = cur.vy;
          moveLinear(cur, pl.x, pl.y, baseRoomId === 'praca');
          const mdx = cur.vx - prevVx;
          const mdy = cur.vy - prevVy;
          if (Math.hypot(mdx, mdy) > 0.002) {
            if (baseRoomId === 'praca') {
              const p0 = gridToPracaPx(prevVx, prevVy);
              const p1 = gridToPracaPx(cur.vx, cur.vy);
              lastVisualViewRef.current[pl.id] = turnaroundViewFromDelta(
                p1.px - p0.px,
                p1.py - p0.py,
                pl.direction
              );
            } else {
              lastVisualViewRef.current[pl.id] = indoorDeltaToView(mdx, mdy, pl.direction);
            }
          }
        }

        visualPosRef.current[pl.id] = cur;
      }

      // Compute camera target (centers smoothly on current player as user zooms in)
      const targetZoom = zoomRef.current;
      const follow = targetZoom > 1 ? Math.min(1, (targetZoom - 1) / 0.45) : 0;
      let meBaseX = centerX;
      let meBaseY = centerY;
      const mePlayer = playersRef.current.find((p) => p.id === currentPlayerId);
      if (mePlayer) {
        const meCur = visualPosRef.current[mePlayer.id] || { vx: mePlayer.x, vy: mePlayer.y };
        if (baseRoomId === 'praca') {
          const tf = getPracaTransform(cw, ch);
          const pxy = gridToPracaPx(meCur.vx, meCur.vy);
          const avScale = PRACA_AVATAR_SCALE * tf.scale;
          meBaseX = tf.ox + pxy.px * tf.scale;
          meBaseY = tf.oy + pxy.py * tf.scale - 22 * avScale;
        } else {
          const pos = gridToScreen(meCur.vx, meCur.vy);
          const cScale = CHAR_BASE_SCALE * indoorFitScale;
          meBaseX = pos.sx;
          meBaseY = pos.sy - 16 * cScale;
        }
      }

      const targetCamX = centerX + (meBaseX - centerX) * follow;
      const targetCamY = centerY + (meBaseY - centerY) * follow;
      const cam = camRef.current;
      cam.zoom += (targetZoom - cam.zoom) * 0.22;
      if (Math.abs(targetCamX - cam.x) > cw * 0.45 || Math.abs(targetCamY - cam.y) > ch * 0.45) {
        cam.x = targetCamX;
        cam.y = targetCamY;
      } else {
        cam.x += (targetCamX - cam.x) * 0.18;
        cam.y += (targetCamY - cam.y) * 0.18;
      }

      const baseToScreen = (bx: number, by: number) => ({
        sx: centerX + (bx - cam.x) * cam.zoom,
        sy: centerY + (by - cam.y) * cam.zoom,
      });

      // ============================================================
      // 1) PRAÇA CENTRAL — EXACT USER MOCKUP WORLD
      // ============================================================
      if (baseRoomId === 'praca') {
        const tf = getPracaTransform(cw, ch);
        const mapImg = pracaImgRef.current;

        const humanPlayers = playersRef.current.filter((p) => !p.isNpc);
        const renderHumans: Array<{ pl: WorldPlayer; vx: number; vy: number; sx: number; sy: number }> = [];
        for (const pl of humanPlayers) {
          const cur = visualPosRef.current[pl.id] || { vx: pl.x, vy: pl.y };
          const pxy = gridToPracaPx(cur.vx, cur.vy);
          const sx = tf.ox + pxy.px * tf.scale;
          const sy = tf.oy + pxy.py * tf.scale;
          renderHumans.push({ pl, vx: cur.vx, vy: cur.vy, sx, sy });
        }
        renderHumans.sort((a, b) => a.sy - b.sy);

        const avatarScale = PRACA_AVATAR_SCALE * tf.scale;
        const labelQueue: Array<{ pl: WorldPlayer; bx: number; by: number }> = [];

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(cam.zoom, cam.zoom);
        ctx.translate(-cam.x, -cam.y);

        const mapVideo = pracaVideoRef.current;
        const videoReady = Boolean(mapVideo && mapVideo.readyState >= 2 && mapVideo.videoWidth > 0);

        if (videoReady && mapVideo) {
          ctx.save();
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          const srcX = mapVideo.videoWidth === 1280 ? 100 : 0;
          const srcW = mapVideo.videoWidth === 1280 ? 1080 : mapVideo.videoWidth;
          ctx.drawImage(
            mapVideo,
            srcX,
            0,
            srcW,
            mapVideo.videoHeight,
            tf.ox,
            tf.oy,
            tf.drawW,
            tf.drawH
          );
          ctx.restore();
        } else if (mapImg && mapImg.complete) {
          ctx.save();
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(mapImg, tf.ox, tf.oy, tf.drawW, tf.drawH);
          ctx.restore();
        } else {
          ctx.fillStyle = '#151a36';
          ctx.fillRect(0, 0, cw, ch);
          ctx.fillStyle = '#fbbf24';
          ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Carregando Praça Central...', cw / 2, ch / 2);
        }

        // Hover highlight on interactive mockup landmarks / benches / city NPCs
        const hs = hoveredHotspotRef.current;
        if (hs) {
          const hx = tf.ox + hs.x0 * tf.scale;
          const hy = tf.oy + hs.y0 * tf.scale;
          const hw = (hs.x1 - hs.x0) * tf.scale;
          const hh = (hs.y1 - hs.y0) * tf.scale;
          ctx.save();
          ctx.strokeStyle =
            hs.kind === 'portal'
              ? 'rgba(251, 191, 36, 0.9)'
              : hs.kind === 'bench'
              ? 'rgba(56, 189, 248, 0.9)'
              : 'rgba(192, 132, 252, 0.9)';
          ctx.lineWidth = 2.5 / cam.zoom;
          ctx.setLineDash([6 / cam.zoom, 4 / cam.zoom]);
          ctx.strokeRect(hx, hy, hw, hh);
          ctx.fillStyle =
            hs.kind === 'portal'
              ? 'rgba(251, 191, 36, 0.08)'
              : hs.kind === 'bench'
              ? 'rgba(56, 189, 248, 0.12)'
              : 'rgba(192, 132, 252, 0.12)';
          ctx.fillRect(hx, hy, hw, hh);
          ctx.restore();
        }

        // Subtle pulsing footprint marker on final destination while walking
        if (activeWalkTargetRef.current) {
          const finalStep =
            walkQueueRef.current.length > 0
              ? walkQueueRef.current[walkQueueRef.current.length - 1]
              : activeWalkTargetRef.current;
          const destPxy = gridToPracaPx(finalStep.x, finalStep.y);
          const dx = tf.ox + destPxy.px * tf.scale;
          const dy = tf.oy + destPxy.py * tf.scale;
          const ringPulse = 1 + Math.sin(tick * 0.8) * 0.18;
          ctx.save();
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
          ctx.fillStyle = 'rgba(251, 191, 36, 0.18)';
          ctx.lineWidth = 2 / cam.zoom;
          ctx.beginPath();
          ctx.ellipse(dx, dy, 14 * tf.scale * ringPulse, 7 * tf.scale * ringPulse, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

        type PracaDrawItem =
          | { kind: 'human'; sortY: number; item: (typeof renderHumans)[number] }
          | { kind: 'prop'; sortY: number; prop: PracaDepthProp; img: HTMLImageElement };

        const pracaDrawList: PracaDrawItem[] = renderHumans.map((item) => ({
          kind: 'human',
          sortY: gridToPracaPx(item.vx, item.vy).py,
          item,
        }));

        // Interleave foreground prop cutouts whenever any human overlaps behind that prop
        for (const dp of PRACA_DEPTH_PROPS) {
          const dImg = depthImgsRef.current.get(dp.id);
          if (!dImg || !dImg.complete || dImg.naturalWidth === 0) continue;
          const occludedHuman = renderHumans.some((h) => {
            const pxy = gridToPracaPx(h.vx, h.vy);
            return (
              pxy.py < dp.baseY &&
              pxy.px >= dp.x - 24 &&
              pxy.px <= dp.x + dp.w + 24 &&
              pxy.py >= dp.y - 12 &&
              pxy.py <= dp.baseY
            );
          });
          if (occludedHuman) {
            pracaDrawList.push({ kind: 'prop', sortY: dp.baseY, prop: dp, img: dImg });
          }
        }

        pracaDrawList.sort((a, b) => a.sortY - b.sortY);

        for (const entry of pracaDrawList) {
          if (entry.kind === 'prop') {
            const { prop, img } = entry;
            ctx.save();
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(
              img,
              tf.ox + prop.x * tf.scale,
              tf.oy + prop.y * tf.scale,
              prop.w * tf.scale,
              prop.h * tf.scale
            );
            ctx.restore();
            continue;
          }

          const { pl, vx, vy, sx, sy } = entry.item;
          const localWalking =
            pl.id === currentPlayerId && Boolean(activeWalkTargetRef.current);
          const remoteMoving = Math.abs(pl.x - vx) > 0.04 || Math.abs(pl.y - vy) > 0.04;
          const isMoving = localWalking || remoteMoving;
          const pxy = gridToPracaPx(vx, vy);
          const satHotspot =
            !isMoving && pl.action === 'sentado'
              ? PRACA_HOTSPOTS.find(
                  (h) =>
                    h.kind === 'bench' &&
                    h.sitPos &&
                    Math.hypot(pxy.px - h.sitPos.px, pxy.py - h.sitPos.py) < 24
                )
              : undefined;
          const onBench = Boolean(satHotspot);
          const activeView: TurnaroundView =
            localWalking && activeWalkTargetRef.current
              ? activeWalkTargetRef.current.view || activeWalkTargetRef.current.dir
              : satHotspot?.sitPos?.view
              ? satHotspot.sitPos.view
              : lastVisualViewRef.current[pl.id] || pl.direction;
          const settledAction: ActionId = isMoving
            ? 'andando'
            : pl.action === 'andando' || pl.action === 'correndo'
            ? 'parado'
            : pl.action;
          const drawW = 32 * avatarScale;
          const drawH = 48 * avatarScale;
          const drawX = sx - drawW / 2;
          const drawY = sy - drawH + 2 * avatarScale;

          drawPixelAvatar(ctx, drawX, drawY, {
            avatar: pl.avatar,
            view: activeView,
            expression: pl.expression,
            action: settledAction,
            frame: tick,
            scale: avatarScale,
            hideShadow: onBench,
          });

          labelQueue.push({ pl, bx: sx, by: drawY });
        }

        ctx.restore();

        // Draw crisp screen-space player nameplates & chat bubbles
        for (const lbl of labelQueue) {
          const sp = baseToScreen(lbl.bx, lbl.by);
          drawPlayerNameAndBubble(ctx, sp.sx, sp.sy, lbl.pl, now);
        }

        rafId = requestAnimationFrame(renderFrame);
        return;
      }

      // ============================================================
      // 2) INDOOR ROOMS (Shopping, Balada, Cafeteria, Mercado, Nosso Espaço)
      // ============================================================
      ctx.imageSmoothingEnabled = false;
      const bgGrad = ctx.createLinearGradient(0, 0, 0, ch);
      bgGrad.addColorStop(0, '#0f0b24');
      bgGrad.addColorStop(1, '#191438');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, cw, ch);

      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      for (let i = 0; i < 24; i++) {
        const starX = (i * 137) % cw;
        const starY = (i * 73) % Math.max(40, Math.floor(ch * 0.45));
        ctx.fillRect(starX, starY, 2, 2);
      }

      let floorA = roomMeta.floorPrimary;
      let floorB = roomMeta.floorSecondary;
      let wallCol = roomMeta.wallColor;
      if (baseRoomId === 'espaco' && spaceInfoRef.current) {
        const th = ROOM_THEMES.find((t) => t.id === spaceInfoRef.current?.theme);
        if (th) {
          floorA = th.floorA;
          floorB = th.floorB;
          wallCol = th.wall;
        }
      }

      const indoorLabelQueue: Array<{ pl: WorldPlayer; bx: number; by: number }> = [];

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-cam.x, -cam.y);

      // Back walls (scaled cleanly with wallH)
      const topCorner = gridToScreen(0, 0);
      const leftCorner = gridToScreen(0, GRID_SIZE);
      const rightCorner = gridToScreen(GRID_SIZE, 0);

      ctx.beginPath();
      ctx.moveTo(topCorner.sx, topCorner.sy - wallH);
      ctx.lineTo(leftCorner.sx, leftCorner.sy - wallH);
      ctx.lineTo(leftCorner.sx, leftCorner.sy);
      ctx.lineTo(topCorner.sx, topCorner.sy);
      ctx.closePath();
      ctx.fillStyle = wallCol;
      ctx.fill();
      ctx.strokeStyle = 'rgba(168,85,247,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(topCorner.sx, topCorner.sy - wallH);
      ctx.lineTo(rightCorner.sx, rightCorner.sy - wallH);
      ctx.lineTo(rightCorner.sx, rightCorner.sy);
      ctx.lineTo(topCorner.sx, topCorner.sy);
      ctx.closePath();
      ctx.fillStyle = wallCol;
      ctx.fill();
      ctx.stroke();

      const espacoPlotTiles =
        baseRoomId === 'espaco'
          ? new Set(spaceInfoRef.current?.plotTiles || createStarterPlotTiles())
          : null;

      for (let gx = 0; gx < GRID_SIZE; gx++) {
        for (let gy = 0; gy < GRID_SIZE; gy++) {
          const tileKey = `${gx},${gy}`;
          const isBuilt = espacoPlotTiles ? espacoPlotTiles.has(tileKey) : true;
          const h = hoverTileRef.current;
          const isHover = Boolean(h && h.x === gx && h.y === gy);

          if (!isBuilt) {
            if (editMode && buildTabRef.current === 'terreno') {
              drawIsoTile(
                ctx,
                gx,
                gy,
                isHover ? 'rgba(52, 211, 153, 0.28)' : 'rgba(148, 163, 184, 0.06)',
                isHover ? '#34d399' : 'rgba(148, 163, 184, 0.22)'
              );
            }
            continue;
          }

          let fill = (gx + gy) % 2 === 0 ? floorA : floorB;
          if (baseRoomId === 'balada' && gx >= 3 && gx <= 8 && gy >= 4 && gy <= 8) {
            const pulse = Math.floor(tick * 0.4 + gx + gy) % 4;
            const colors = ['#6d28d9', '#db2777', '#0284c7', '#4338ca'];
            fill = colors[pulse];
          }
          drawIsoTile(ctx, gx, gy, fill);

          if (isHover) {
            const isTerrainEdit = editMode && baseRoomId === 'espaco' && buildTabRef.current === 'terreno';
            drawIsoTile(
              ctx,
              gx,
              gy,
              isTerrainEdit
                ? 'rgba(244, 63, 94, 0.35)'
                : editMode
                ? 'rgba(251,191,36,0.35)'
                : 'rgba(255,255,255,0.16)',
              isTerrainEdit
                ? '#f43f5e'
                : editMode
                ? '#fbbf24'
                : 'rgba(255,255,255,0.45)'
            );
          }

          if (activeWalkTargetRef.current) {
            const finalStep =
              walkQueueRef.current.length > 0
                ? walkQueueRef.current[walkQueueRef.current.length - 1]
                : activeWalkTargetRef.current;
            if (Math.round(finalStep.x) === gx && Math.round(finalStep.y) === gy) {
              drawIsoTile(
                ctx,
                gx,
                gy,
                'rgba(251, 191, 36, 0.24)',
                'rgba(251, 191, 36, 0.9)'
              );
            }
          }
        }
      }

      const props = getRoomProps(baseRoomId);

      for (const prop of props) {
        if (prop.kind === 'portal') {
          if (baseRoomId === 'espaco') continue;
          drawIsoTile(ctx, prop.x, prop.y, 'rgba(245, 158, 11, 0.35)', '#fbbf24', 1);
        } else if (prop.kind === 'bench') {
          drawIsoBox(ctx, prop.x, prop.y, 11 * indoorFitScale, '#b45309', '#92400e', '#78350f');
        } else if (prop.kind === 'shop_kiosk') {
          drawIsoBox(ctx, prop.x, prop.y, 26 * indoorFitScale, '#ec4899', '#9d174d', '#831843');
        } else if (prop.kind === 'job_kiosk') {
          drawIsoBox(ctx, prop.x, prop.y, 24 * indoorFitScale, '#22c55e', '#15803d', '#14532d');
        } else if (prop.kind === 'food_kiosk') {
          drawIsoBox(ctx, prop.x, prop.y, 22 * indoorFitScale, '#f59e0b', '#d97706', '#92400e');
        }
      }

      type RenderEntity =
        | { kind: 'furn'; depth: number; furn: PlacedFurniture }
        | { kind: 'player'; depth: number; player: WorldPlayer; vx: number; vy: number };

      const entities: RenderEntity[] = [];

      if (baseRoomId === 'espaco' && spaceInfoRef.current) {
        for (const f of spaceInfoRef.current.furniture) {
          const item = getCatalogItem(f.itemId);
          const depthOffset = item?.shape === 'rug' ? -20 : 0;
          entities.push({ kind: 'furn', depth: f.x + f.y + depthOffset, furn: f });
        }
      }

      for (const pl of playersRef.current) {
        const cur = visualPosRef.current[pl.id] || { vx: pl.x, vy: pl.y };
        entities.push({
          kind: 'player',
          depth: cur.vx + cur.vy + 0.1,
          player: pl,
          vx: cur.vx,
          vy: cur.vy,
        });
      }

      entities.sort((a, b) => a.depth - b.depth);

      const charScale = CHAR_BASE_SCALE * indoorFitScale;

      const getFurnMetrics = (furn: PlacedFurniture) => {
        const item = getCatalogItem(furn.itemId);
        if (!item) return null;
        const sprite = item.spriteUrl ? getFurnSprite(item.spriteUrl) : null;
        const unitScale = FURN_BASE_SCALE * indoorFitScale;
        const maxBox = tileW * 1.62;
        let drawW = (sprite ? sprite.naturalWidth : 160) * unitScale;
        let drawH = (sprite ? sprite.naturalHeight : 140) * unitScale;
        if (drawW > maxBox) {
          const ratio = maxBox / drawW;
          drawW *= ratio;
          drawH *= ratio;
        }
        return { item, drawW, drawH };
      };

      for (const ent of entities) {
        if (ent.kind === 'furn') {
          drawFurniturePiece(ctx, ent.furn, ent.furn.instanceId === selectedFurnId);
        } else {
          const pl = ent.player;
          const { sx, sy } = gridToScreen(ent.vx, ent.vy);
          let drawX = sx - 16 * charScale;
          let drawY = sy + tileH / 2 - 44 * charScale;
          let hideShadow = false;
          let flipX = false;

          const localWalking =
            pl.id === currentPlayerId && Boolean(activeWalkTargetRef.current);
          const remoteMoving = Math.abs(pl.x - ent.vx) > 0.04 || Math.abs(pl.y - ent.vy) > 0.04;
          const isMoving = localWalking || remoteMoving;
          let activeView: TurnaroundView =
            localWalking && activeWalkTargetRef.current
              ? activeWalkTargetRef.current.view || activeWalkTargetRef.current.dir
              : lastVisualViewRef.current[pl.id] || pl.direction;
          const settledAction: ActionId = isMoving
            ? 'andando'
            : pl.action === 'andando' || pl.action === 'correndo'
            ? 'parado'
            : pl.action;

          // Align players onto bed mattress / sofa cushion / indoor bench when interacting
          if (!isMoving && baseRoomId === 'espaco' && spaceInfoRef.current && (settledAction === 'deitado' || settledAction === 'sentado')) {
            const onFurn = spaceInfoRef.current.furniture.find(
              (f) => Math.hypot(ent.vx - f.x, ent.vy - f.y) < 0.45
            );
            if (onFurn) {
              const fm = getFurnMetrics(onFurn);
              if (fm) {
                const dist = Math.hypot(ent.vx - onFurn.x, ent.vy - onFurn.y);
                const blend = Math.max(0, Math.min(1, 1 - dist / 0.45));
                const fPos = gridToScreen(onFurn.x, onFurn.y);
                const anchorY = fPos.sy + tileH * 0.68;
                const furnFlipped = onFurn.rotation === 90 || onFurn.rotation === 270;

                if (fm.item.shape === 'bed') {
                  activeView = '3/4';
                  const targetBottomY = anchorY - fm.drawH * 0.355;
                  const targetCenterX = fPos.sx + (furnFlipped ? 0.068 : -0.068) * fm.drawW;
                  const targetDrawX = targetCenterX - 16 * charScale;
                  const targetDrawY = targetBottomY - 46 * charScale;
                  drawX += (targetDrawX - drawX) * blend;
                  drawY += (targetDrawY - drawY) * blend;
                  hideShadow = blend > 0.4;
                  flipX = furnFlipped;
                } else if (fm.item.shape === 'sofa' && settledAction === 'sentado') {
                  activeView = furnFlipped ? '3/4_esquerda' : '3/4';
                  const targetBottomY = anchorY - fm.drawH * 0.16;
                  const targetCenterX = fPos.sx + (furnFlipped ? -0.02 : 0.02) * fm.drawW;
                  const targetDrawX = targetCenterX - 16 * charScale;
                  const targetDrawY = targetBottomY - 46 * charScale;
                  drawX += (targetDrawX - drawX) * blend;
                  drawY += (targetDrawY - drawY) * blend;
                  hideShadow = blend > 0.4;
                }
              }
            }
          } else if (!isMoving && settledAction === 'sentado') {
            const onBenchProp = props.find(
              (p) => p.kind === 'bench' && Math.hypot(ent.vx - p.x, ent.vy - p.y) < 0.45
            );
            if (onBenchProp) {
              const dist = Math.hypot(ent.vx - onBenchProp.x, ent.vy - onBenchProp.y);
              const blend = Math.max(0, Math.min(1, 1 - dist / 0.45));
              drawY -= 11 * indoorFitScale * blend;
              hideShadow = blend > 0.4;
              activeView = onBenchProp.x <= 4 ? '3/4' : '3/4_esquerda';
            }
          }

          drawPixelAvatar(ctx, drawX, drawY, {
            avatar: pl.avatar,
            view: activeView,
            expression: pl.expression,
            action: settledAction,
            frame: tick,
            scale: charScale,
            hideShadow,
            flipX,
          });

          indoorLabelQueue.push({ pl, bx: drawX + 16 * charScale, by: drawY });
        }
      }

      ctx.restore();

      // Screen-space signs & nameplates (always crisp at any zoom)
      if (baseRoomId !== 'espaco') {
        const p = gridToScreen(5, 10);
        const sp = baseToScreen(p.sx, p.sy - 14 * indoorFitScale);
        drawSignLabel(ctx, sp.sx, sp.sy, 'SAIR P/ PRAÇA', '#1e293b', '#fbbf24', '#fde047', -16);
      }
      if (baseRoomId === 'balada') {
        const p = gridToScreen(5, 3);
        const sp = baseToScreen(p.sx, p.sy - 26 * indoorFitScale);
        drawSignLabel(ctx, sp.sx, sp.sy, 'TRABALHAR DE DJ', '#3b0764', '#a855f7', '#f0abfc', -18);
      } else if (baseRoomId === 'cafeteria') {
        const p1 = gridToScreen(5, 3);
        const sp1 = baseToScreen(p1.sx, p1.sy - 26 * indoorFitScale);
        drawSignLabel(ctx, sp1.sx, sp1.sy, 'BALCÃO BARISTA', '#451a03', '#fb923c', '#ffedd5', -18);
        const p2 = gridToScreen(7, 3);
        const sp2 = baseToScreen(p2.sx, p2.sy - 26 * indoorFitScale);
        drawSignLabel(ctx, sp2.sx, sp2.sy, 'TOMAR CAFÉ (-8M)', '#78350f', '#fbbf24', '#fef3c7', -18);
      } else if (baseRoomId === 'mercado') {
        const p1 = gridToScreen(5, 3);
        const sp1 = baseToScreen(p1.sx, p1.sy - 26 * indoorFitScale);
        drawSignLabel(ctx, sp1.sx, sp1.sy, 'ENTREGAS F2P', '#14532d', '#22c55e', '#dcfce7', -18);
        const p2 = gridToScreen(7, 3);
        const sp2 = baseToScreen(p2.sx, p2.sy - 26 * indoorFitScale);
        drawSignLabel(ctx, sp2.sx, sp2.sy, 'FRUTAS (-8M)', '#3f2314', '#4ade80', '#dcfce7', -18);
      }

      for (const lbl of indoorLabelQueue) {
        const sp = baseToScreen(lbl.bx, lbl.by);
        drawPlayerNameAndBubble(ctx, sp.sx, sp.sy, lbl.pl, now);
      }

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, [baseRoomId, canvasSize, dpr, currentPlayerId, editMode, selectedFurnId, roomMeta, pracaImgLoaded]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const { bx: sx, by: sy } = screenToBase(screenX, screenY);

    if (baseRoomId === 'praca') {
      if (pracaVideoRef.current?.paused) {
        pracaVideoRef.current.play().catch(() => {});
      }
      const tf = getPracaTransform(canvasSize.w, canvasSize.h);
      const px = (sx - tf.ox) / tf.scale;
      const py = (sy - tf.oy) / tf.scale;
      if (px < 0 || py < 0 || px > PRACA_W || py > PRACA_H) return;

      // 1. Check real online players (non-NPC) click
      const avatarScale = PRACA_AVATAR_SCALE * tf.scale;
      const halfW = Math.max(14 / camRef.current.zoom, 18 * avatarScale);
      const fullH = Math.max(28 / camRef.current.zoom, 48 * avatarScale);
      for (const pl of players) {
        if (pl.id === currentPlayerId || pl.isNpc) continue;
        const vp = visualPosRef.current[pl.id] || { vx: pl.x, vy: pl.y };
        const pxy = gridToPracaPx(vp.vx, vp.vy);
        const psx = tf.ox + pxy.px * tf.scale;
        const psy = tf.oy + pxy.py * tf.scale;
        if (Math.abs(sx - psx) < halfW && sy >= psy - fullH && sy <= psy + 8) {
          soundFX.playClick();
          setSelectedPlayer(pl);
          return;
        }
      }

      const startPracaWalk = (
        destPx: number,
        destPy: number,
        finalDir?: Direction,
        finalAction: ActionId = 'parado',
        onArrive?: () => void,
        finalView?: TurnaroundView
      ) => {
        const me = players.find((p) => p.id === currentPlayerId);
        const curVis = visualPosRef.current[currentPlayerId];
        const curPx = curVis
          ? gridToPracaPx(curVis.vx, curVis.vy)
          : me
          ? gridToPracaPx(me.x, me.y)
          : { px: destPx, py: destPy };

        const steps = findPracaPath(curPx.px, curPx.py, destPx, destPy, finalDir, finalAction, finalView);
        if (steps.length === 0) return;

        // If already essentially at destination, perform final pose immediately
        if (Math.hypot(destPx - curPx.px, destPy - curPx.py) < 8) {
          walkQueueRef.current = [];
          activeWalkTargetRef.current = null;
          pendingPostWalkRef.current = null;
          if (finalView || finalDir) {
            lastVisualViewRef.current[currentPlayerId] = finalView || finalDir || 'frente';
          }
          const g = pracaPxToGrid(destPx, destPy);
          onMove(g.x, g.y, finalDir || me?.direction || 'frente', finalAction, 1);
          onArrive?.();
          return;
        }

        walkQueueRef.current = steps.slice(1);
        activeWalkTargetRef.current = steps[0];
        pendingPostWalkRef.current = onArrive || null;
        soundFX.playStep();
        lastStepSoundAtRef.current = Date.now();
      };

      // 2. Check Mockup Landmarks & Benches
      const hit = PRACA_HOTSPOTS.find(
        (h) => px >= h.x0 && px <= h.x1 && py >= h.y0 && py <= h.y1
      );
      if (hit) {
        if (hit.kind === 'catalog') {
          soundFX.playClick();
          onOpenShop();
          return;
        }
        if (hit.kind === 'portal' && hit.targetRoom) {
          soundFX.playClick();
          onChangeRoom(hit.targetRoom);
          return;
        }
        if (hit.kind === 'bench' && hit.sitPos) {
          setSelectedPlayer(null);
          startPracaWalk(hit.sitPos.px, hit.sitPos.py, hit.sitPos.dir, 'sentado', undefined, hit.sitPos.view);
          return;
        }
      }

      setSelectedPlayer(null);

      // 3. Walk square-by-square along the Praça cobblestones
      const dest = findNearestWalkablePraca(px, py);
      startPracaWalk(dest.px, dest.py, undefined, 'parado');
      return;
    }

    // INDOOR ROOMS CLICK LOGIC
    const charScale = CHAR_BASE_SCALE * indoorFitScale;
    const hitHalfW = Math.max(14 / camRef.current.zoom, 18 * charScale);
    const hitTopH = Math.max(32 / camRef.current.zoom, 48 * charScale);
    for (const pl of players) {
      if (pl.id === currentPlayerId) continue;
      const vp = visualPosRef.current[pl.id] || { vx: pl.x, vy: pl.y };
      const { sx: px, sy: py } = gridToScreen(vp.vx, vp.vy);
      if (Math.abs(sx - px) < hitHalfW && sy >= py - hitTopH && sy <= py + tileH * 0.6) {
        soundFX.playClick();
        setSelectedPlayer(pl);
        return;
      }
    }
    setSelectedPlayer(null);

    const { x, y } = screenToGrid(sx, sy);
    if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) return;

    if (isOwnSpace && editMode) {
      if (buildTab === 'terreno') {
        soundFX.playClick();
        onBuildTile(x, y);
        return;
      }
      if (placingInstanceId) {
        soundFX.playClick();
        onFurnish('place', { instanceId: placingInstanceId, x, y, rotation: 0 });
        setPlacingInstanceId(null);
        return;
      }
      const existing = spaceInfo?.furniture.find((f) => f.x === x && f.y === y);
      if (existing) {
        soundFX.playClick();
        setSelectedFurnId(existing.instanceId);
        return;
      }
      setSelectedFurnId(null);
      return;
    }

    const props = getRoomProps(baseRoomId);
    const plotSet =
      baseRoomId === 'espaco'
        ? new Set(spaceInfo?.plotTiles || createStarterPlotTiles())
        : null;

    const isIntermediateWalkable = (tx: number, ty: number) => {
      if (baseRoomId === 'espaco') {
        if (!plotSet?.has(`${tx},${ty}`)) return false;
        const blocker = spaceInfo?.furniture.find((f) => f.x === tx && f.y === ty);
        if (blocker) {
          const cat = getCatalogItem(blocker.itemId);
          if (cat && cat.shape !== 'rug') return false;
        }
        return true;
      }
      if (isBlockedTile(baseRoomId, tx, ty)) return false;
      const blockerProp = props.find((p) => p.x === tx && p.y === ty);
      if (blockerProp && blockerProp.kind !== 'portal') return false;
      return true;
    };

    const startIndoorWalk = (
      goalX: number,
      goalY: number,
      finalDir?: Direction,
      finalAction: ActionId = 'parado',
      onArrive?: () => void,
      finalView?: TurnaroundView
    ) => {
      const me = players.find((p) => p.id === currentPlayerId);
      const curVis = visualPosRef.current[currentPlayerId];
      const startX = Math.round(curVis ? curVis.vx : me?.x ?? goalX);
      const startY = Math.round(curVis ? curVis.vy : me?.y ?? goalY);

      if (startX === goalX && startY === goalY) {
        walkQueueRef.current = [];
        activeWalkTargetRef.current = null;
        pendingPostWalkRef.current = null;
        if (finalView) lastVisualViewRef.current[currentPlayerId] = finalView;
        onMove(goalX, goalY, finalDir || me?.direction || 'frente', finalAction, 0);
        onArrive?.();
        return;
      }

      const path = findIndoorPath(
        startX,
        startY,
        goalX,
        goalY,
        isIntermediateWalkable,
        finalDir,
        finalAction,
        finalView
      );
      if (path.length === 0) return;

      walkQueueRef.current = path.slice(1);
      activeWalkTargetRef.current = path[0];
      pendingPostWalkRef.current = onArrive || null;
      soundFX.playStep();
      lastStepSoundAtRef.current = Date.now();
    };

    const findClosestAdjacentWalkable = (tx: number, ty: number) => {
      const me = players.find((p) => p.id === currentPlayerId);
      const curVis = visualPosRef.current[currentPlayerId];
      const sx0 = Math.round(curVis ? curVis.vx : me?.x ?? tx);
      const sy0 = Math.round(curVis ? curVis.vy : me?.y ?? ty);
      const candidates = [
        { x: tx, y: ty + 1, faceDir: 'costas' as Direction, faceView: 'costas_direita' as TurnaroundView },
        { x: tx, y: ty - 1, faceDir: 'frente' as Direction, faceView: '3/4_esquerda' as TurnaroundView },
        { x: tx + 1, y: ty, faceDir: 'esquerda' as Direction, faceView: 'costas_esquerda' as TurnaroundView },
        { x: tx - 1, y: ty, faceDir: 'direita' as Direction, faceView: '3/4' as TurnaroundView },
      ].filter((c) => isIntermediateWalkable(c.x, c.y));
      if (candidates.length === 0) return null;
      candidates.sort((a, b) => Math.hypot(a.x - sx0, a.y - sy0) - Math.hypot(b.x - sx0, b.y - sy0));
      return candidates[0];
    };

    const walkAdjacentToTarget = (tx: number, ty: number, onArrive?: () => void) => {
      const adj = findClosestAdjacentWalkable(tx, ty);
      if (!adj) return;
      startIndoorWalk(adj.x, adj.y, adj.faceDir, 'parado', onArrive, adj.faceView);
    };

    // Cozy Home Furniture Interactions in Nosso Espaço (walk square-by-square along walkable floor tiles)
    if (baseRoomId === 'espaco' && spaceInfo) {
      const furn = spaceInfo.furniture.find((f) => f.x === x && f.y === y);
      if (furn) {
        const cat = getCatalogItem(furn.itemId);
        if (cat) {
          const furnFlipped = furn.rotation === 90 || furn.rotation === 270;
          if (cat.shape === 'bed') {
            startIndoorWalk(x, y, furnFlipped ? 'esquerda' : 'direita', 'deitado', () => onRoutineAction('dormir_cama'), '3/4');
            return;
          }
          if (cat.shape === 'sofa') {
            startIndoorWalk(x, y, furnFlipped ? 'esquerda' : 'direita', 'sentado', () => onRoutineAction('relaxar_sofa'), furnFlipped ? '3/4_esquerda' : '3/4');
            return;
          }
          if (cat.shape === 'table') {
            startIndoorWalk(x, y, 'direita', 'sentado', () => onRoutineAction('sentar_mesa'), '3/4');
            return;
          }
          if (cat.shape === 'chest') {
            walkAdjacentToTarget(x, y, () => onRoutineAction('abrir_bau'));
            return;
          }
          if (cat.shape === 'plant') {
            walkAdjacentToTarget(x, y, () => onRoutineAction('regar_planta'));
            return;
          }
          if (cat.shape === 'arcade' || cat.shape === 'dj') {
            walkAdjacentToTarget(x, y, () => onRoutineAction('jogar_arcade'));
            return;
          }
        }
      }
    }

    const prop = props.find((p) => p.x === x && p.y === y);
    if (prop) {
      if (prop.kind === 'portal' && prop.targetRoom && baseRoomId !== 'espaco') {
        const targetRoom = prop.targetRoom;
        startIndoorWalk(x, y, 'frente', 'parado', () => {
          soundFX.playClick();
          onChangeRoom(targetRoom);
        });
        return;
      }
      if (prop.kind === 'shop_kiosk') {
        walkAdjacentToTarget(x, y, () => {
          soundFX.playClick();
          onOpenShop();
        });
        return;
      }
      if (prop.kind === 'job_kiosk') {
        walkAdjacentToTarget(x, y, () => {
          soundFX.playClick();
          onOpenMinigames();
        });
        return;
      }
      if (prop.kind === 'food_kiosk' && prop.routineAction) {
        const routineAction = prop.routineAction;
        walkAdjacentToTarget(x, y, () => {
          soundFX.playCoin();
          onRoutineAction(routineAction);
        });
        return;
      }
      if (prop.kind === 'bench') {
        const benchView: TurnaroundView = prop.x <= 4 ? '3/4' : '3/4_esquerda';
        const benchDir: Direction = prop.x <= 4 ? 'direita' : 'esquerda';
        startIndoorWalk(x, y, benchDir, 'sentado', undefined, benchView);
        return;
      }
    }

    if (isIntermediateWalkable(x, y)) {
      startIndoorWalk(x, y, undefined, 'parado');
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    setMouseCanvasPos({ x: screenX, y: screenY });
    const { bx: sx, by: sy } = screenToBase(screenX, screenY);

    if (baseRoomId === 'praca') {
      const tf = getPracaTransform(canvasSize.w, canvasSize.h);
      const px = (sx - tf.ox) / tf.scale;
      const py = (sy - tf.oy) / tf.scale;
      const hit =
        PRACA_HOTSPOTS.find((h) => px >= h.x0 && px <= h.x1 && py >= h.y0 && py <= h.y1) ||
        null;
      setHoveredHotspot(hit);
      setHoverTile(null);
      return;
    }

    setHoveredHotspot(null);
    const { x, y } = screenToGrid(sx, sy);
    if (x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE) {
      setHoverTile({ x, y });
    } else {
      setHoverTile(null);
    }
  };

  const handleZoomIn = () => {
    soundFX.playClick();
    setZoom((z) => Math.min(MAX_ZOOM, Number((z + 0.35).toFixed(2))));
  };

  const handleZoomOut = () => {
    soundFX.playClick();
    setZoom((z) => Math.max(MIN_ZOOM, Number((z - 0.35).toFixed(2))));
  };

  const handleZoomReset = () => {
    soundFX.playClick();
    setZoom(1);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const delta = e.deltaY < 0 ? 0.18 : -0.18;
    setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number((z + delta).toFixed(2)))));
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = {
        dist: Math.hypot(dx, dy),
        startZoom: zoomRef.current,
        active: true,
      };
      suppressClickRef.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2 && pinchRef.current.active && pinchRef.current.dist > 0) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.hypot(dx, dy);
      const next = pinchRef.current.startZoom * (newDist / pinchRef.current.dist);
      setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(next.toFixed(2)))));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length < 2 && pinchRef.current.active) {
      pinchRef.current.active = false;
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 150);
    }
  };

  const ownedFurniture = myInventory.filter((inv) => {
    const cat = getCatalogItem(inv.itemId);
    return cat?.category === 'movel';
  });

  const isAlreadyFriend = (id: string) => myFriends.some((f) => f.id === id);

  return (
    <div className="w-full h-full flex flex-col md:flex-row overflow-hidden bg-[#0d1022]">
      {/* Canvas Stage (auto-resizes cleanly around the right-side builder panel!) */}
      <div
        ref={containerRef}
        className="relative flex-1 min-w-0 min-h-0 h-full bg-[#0d1022] overflow-hidden select-none"
      >
        {baseRoomId === 'praca' && (
          <video
            ref={pracaVideoRef}
            src={PRACA_VIDEO_URL}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            className="absolute top-0 left-0 w-px h-px opacity-0 pointer-events-none"
          />
        )}
        <canvas
          ref={canvasRef}
          width={Math.round(canvasSize.w * dpr)}
          height={Math.round(canvasSize.h * dpr)}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseLeave={() => {
            setHoveredHotspot(null);
            setMouseCanvasPos(null);
          }}
          className="w-full h-full block cursor-pointer touch-none"
        />

        {/* Camera Zoom Controls (Aproximar / Distanciar do personagem) */}
        <div
          className={`absolute right-3 z-20 flex flex-col items-center gap-1 p-1 rounded-2xl bg-[#11162b]/90 border border-[#323d6e] shadow-xl backdrop-blur-md ${
            baseRoomId === 'praca' ? 'top-3' : 'top-14 sm:top-16'
          }`}
        >
          <button
            type="button"
            title="Aproximar do personagem"
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="w-8 h-8 rounded-xl bg-[#1a2247] hover:bg-purple-600/50 disabled:opacity-40 text-amber-300 flex items-center justify-center cursor-pointer transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Resetar zoom (1x)"
            onClick={handleZoomReset}
            className="w-8 h-6 rounded-lg bg-[#0b0f21] hover:bg-[#1e264a] text-[10px] font-mono-nums font-bold text-slate-200 flex items-center justify-center cursor-pointer"
          >
            {zoom.toFixed(1)}x
          </button>
          <button
            type="button"
            title="Distanciar câmera"
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="w-8 h-8 rounded-xl bg-[#1a2247] hover:bg-purple-600/50 disabled:opacity-40 text-sky-300 flex items-center justify-center cursor-pointer transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>

        {/* Interactive Hotspot Tooltip on Praça Central */}
        {baseRoomId === 'praca' && hoveredHotspot && mouseCanvasPos && (
          <div
            style={{
              left: Math.min(canvasSize.w - 190, Math.max(12, mouseCanvasPos.x + 12)),
              top: Math.max(12, mouseCanvasPos.y - 34),
            }}
            className="absolute z-20 pointer-events-none px-2.5 py-1 rounded-lg bg-[#11162b]/95 border border-amber-400/70 text-[11px] font-bold text-amber-200 shadow-lg whitespace-nowrap"
          >
            {hoveredHotspot.label}
          </div>
        )}

        {/* Top-Left Location Card for Indoor Rooms */}
        {baseRoomId !== 'praca' && (
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#11162b]/92 border border-[#323d6e] shadow-lg backdrop-blur-sm">
            <div className="w-7 h-7 rounded-lg bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-amber-300">
              {baseRoomId === 'espaco' ? <Home className="w-4 h-4" /> : <Compass className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-sm font-bold text-white leading-tight">
                {baseRoomId === 'espaco' && spaceInfo
                  ? `Canto de ${spaceInfo.ownerName}`
                  : roomMeta.name}
              </div>
              <div className="text-[11px] text-slate-300 leading-tight mt-0.5 hidden sm:block">
                {roomMeta.subtitle}
              </div>
            </div>
          </div>
        )}

        {/* Top-Right Room Controls */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          {baseRoomId !== 'praca' && (
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                onChangeRoom('praca');
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#11162b]/92 hover:bg-[#1e2647] border border-[#323d6e] text-xs font-bold text-amber-300 cursor-pointer whitespace-nowrap"
            >
              <DoorOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Voltar p/ Praça</span>
              <span className="sm:hidden">Praça</span>
            </button>
          )}

          {isOwnSpace && (
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                setEditMode((v) => !v);
                setPlacingInstanceId(null);
                setSelectedFurnId(null);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold cursor-pointer whitespace-nowrap transition-colors ${
                editMode
                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                  : 'bg-[#11162b]/92 text-white border-purple-500 hover:bg-[#1f1742]'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{editMode ? 'Concluir Obra' : 'Construir & Mobiliar'}</span>
            </button>
          )}
        </div>

        {/* Nosso Espaço Cozy Routine Strip when NOT editing */}
        {isOwnSpace && !editMode && (
          <div className="absolute bottom-2 left-2 right-2 sm:right-auto sm:bottom-3 sm:left-3 z-10 flex flex-wrap items-center gap-1.5 sm:gap-2 rounded-xl bg-[#11162b]/92 border border-[#323d6e] px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-xl backdrop-blur-sm">
            <span className="text-[11px] font-bold text-amber-300 mr-1 hidden sm:inline">
              Rotina da Casa:
            </span>
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                onRoutineAction('arrumar_casa');
              }}
              className="px-2 py-1 rounded-lg bg-[#1a2247] hover:bg-emerald-600/30 border border-emerald-500/40 text-[11px] font-semibold text-emerald-200 flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
              <span>Arrumar Casa</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                onRoutineAction('regar_planta');
              }}
              className="px-2 py-1 rounded-lg bg-[#1a2247] hover:bg-sky-600/30 border border-sky-500/40 text-[11px] font-semibold text-sky-200 flex items-center gap-1 cursor-pointer"
            >
              <Droplets className="w-3 h-3" />
              <span>Regar Plantas</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                onRoutineAction('tomar_banho');
              }}
              className="px-2 py-1 rounded-lg bg-[#1a2247] hover:bg-purple-600/30 border border-purple-500/40 text-[11px] font-semibold text-purple-200 flex items-center gap-1 cursor-pointer"
            >
              <Coffee className="w-3 h-3" />
              <span>Renovar Visual</span>
            </button>
          </div>
        )}

        {/* Selected Online Player Interaction Card */}
        {selectedPlayer && (
          <div className="absolute bottom-3 left-3 z-20 w-72 rounded-xl bg-[#11162b]/95 border-2 border-[#6d28d9] p-3.5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-[#1b0c38] border border-purple-700/60 p-1 shrink-0">
                <PixelAvatarPreview
                  avatar={selectedPlayer.avatar}
                  expression={selectedPlayer.expression}
                  scale={2}
                  width={56}
                  height={78}
                  animate={false}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-white truncate">
                    {selectedPlayer.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedPlayer(null)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                  {selectedPlayer.bio}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                type="button"
                disabled={isAlreadyFriend(selectedPlayer.id)}
                onClick={() => {
                  soundFX.playClick();
                  onAddFriend(selectedPlayer.id, selectedPlayer.name);
                }}
                className="px-2.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{isAlreadyFriend(selectedPlayer.id) ? 'Amigo' : 'Add Amigo'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  onStartTrade(selectedPlayer);
                  setSelectedPlayer(null);
                }}
                className="px-2.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <HeartHandshake className="w-3.5 h-3.5" />
                <span>Trocar</span>
              </button>
            </div>
          </div>
        )}

        {/* Subtle walk hint bottom-right */}
        {!editMode && (
          <div className="hidden sm:block absolute bottom-2.5 right-3 pointer-events-none px-2.5 py-1 rounded-md bg-black/55 text-[11px] text-slate-200">
            {baseRoomId === 'praca'
              ? 'Clique na calçada ou use WASD para andar · Clique nas lojas ou bancos'
              : 'Clique no chão para andar · Clique em bancos/portas para interagir'}
          </div>
        )}
      </div>

      {/* RIGHT-CORNER DOCKED MENU FOR NOSSO CANTO CONSTRUCTION (Never covers the room tiles!) */}
      {isOwnSpace && editMode && (
        <aside className="w-full md:w-80 shrink-0 max-h-[45%] md:max-h-full md:h-full bg-[#10152b] border-t-2 md:border-t-0 md:border-l-2 border-amber-400/75 p-3 flex flex-col gap-3 overflow-y-auto shadow-2xl z-20">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#252e59]">
            <div className="flex items-center gap-2">
              <Blocks className="w-4 h-4 text-amber-300" />
              <span className="font-pixel text-xs text-white">Construir Nosso Canto</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditMode(false);
                setPlacingInstanceId(null);
                setSelectedFurnId(null);
              }}
              className="text-xs font-bold text-slate-300 hover:text-white px-2 py-1 rounded bg-[#1b2345] cursor-pointer"
            >
              Fechar
            </button>
          </div>

          {/* Sub-mode tabs */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                setBuildTab('terreno');
                setPlacingInstanceId(null);
                setSelectedFurnId(null);
              }}
              className={`px-2.5 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                buildTab === 'terreno'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-[#1a2042] text-slate-300 hover:text-white'
              }`}
            >
              <Blocks className="w-3.5 h-3.5" />
              <span>Terreno</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                setBuildTab('mobiliar');
              }}
              className={`px-2.5 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                buildTab === 'mobiliar'
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-[#1a2042] text-slate-300 hover:text-white'
              }`}
            >
              <Armchair className="w-3.5 h-3.5" />
              <span>Móveis</span>
            </button>
          </div>

          {/* Floor Theme Selector */}
          <div>
            <div className="text-[11px] font-bold text-slate-300 mb-1.5">Tema do Piso</div>
            <div className="grid grid-cols-2 gap-1.5">
              {ROOM_THEMES.map((th) => (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => {
                    soundFX.playClick();
                    onFurnish('theme', { theme: th.id });
                  }}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold border cursor-pointer truncate ${
                    spaceInfo?.theme === th.id
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-[#18203f] text-slate-300 border-[#2b3668]'
                  }`}
                >
                  {th.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {buildTab === 'terreno' ? (
            <div className="rounded-xl bg-[#0b0f21] border border-emerald-500/35 p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-emerald-300">Blocos do Terreno</span>
                <span className="font-mono-nums text-amber-300">
                  {spaceInfo?.plotTiles?.length ?? 36}/{spaceInfo?.plotMaxBlocks ?? STARTER_PLOT_MAX_BLOCKS}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Clique nos quadrados tracejados no mapa ao lado para <strong>adicionar</strong> blocos ou clique sobre um piso existente para <strong>remover</strong> e esculpir seu terreno livremente!
              </p>
              <div className="text-[10px] text-amber-300/90 font-semibold pt-1 border-t border-[#1e2647]">
                Expansões futuras poderão ampliar o limite de blocos.
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 flex-1 min-h-0">
              <div className="text-[11px] text-slate-200 bg-[#0b0f21] border border-[#252e59] rounded-lg px-2.5 py-2">
                {placingInstanceId
                  ? 'Clique em qualquer bloco construído no mapa para posicionar o móvel!'
                  : 'Selecione um móvel abaixo para colocar ou clique em um já colocado para girar/guardar.'}
              </div>

              {selectedFurnId && (
                <div className="flex flex-col gap-1.5 bg-amber-500/15 border border-amber-400/40 rounded-lg p-2.5">
                  <span className="text-[11px] font-bold text-amber-200">Móvel selecionado:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onFurnish('rotate', { instanceId: selectedFurnId })}
                      className="flex-1 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <RotateCw className="w-3 h-3" />
                      <span>Girar 90°</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onFurnish('remove', { instanceId: selectedFurnId });
                        setSelectedFurnId(null);
                      }}
                      className="flex-1 px-2.5 py-1.5 rounded bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Guardar</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1.5 overflow-y-auto pr-1">
                {ownedFurniture.length === 0 ? (
                  <div className="text-xs text-slate-400 py-2">
                    Você ainda não possui móveis extras. Visite o Catálogo ou o Bazar!
                  </div>
                ) : (
                  ownedFurniture.map((inv) => {
                    const cat = getCatalogItem(inv.itemId);
                    if (!cat) return null;
                    const isPlaced = spaceInfo?.furniture.some((f) => f.instanceId === inv.instanceId);
                    const isActive = placingInstanceId === inv.instanceId;
                    return (
                      <button
                        key={inv.instanceId}
                        type="button"
                        onClick={() => {
                          soundFX.playClick();
                          setPlacingInstanceId(isActive ? null : inv.instanceId);
                        }}
                        className={`w-full px-2.5 py-2 rounded-lg border text-left transition-colors cursor-pointer flex items-center gap-2.5 ${
                          isActive
                            ? 'bg-amber-400 text-slate-950 border-amber-200'
                            : isPlaced
                            ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                            : 'bg-[#1a203d] border-slate-700 text-slate-200 hover:border-purple-400'
                        }`}
                      >
                        <ItemThumbnail item={cat} className="w-10 h-10" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold truncate">{cat.name}</div>
                          <div className="text-[10px] opacity-80">
                            {isPlaced ? 'No quarto (clique p/ mover)' : 'Pronto p/ colocar'}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  );
};
