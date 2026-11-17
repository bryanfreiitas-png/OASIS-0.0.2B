import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Backpack,
  BookOpen,
  CheckCircle2,
  Circle,
  Coffee,
  Coins,
  Disc3,
  Gem,
  HeartPulse,
  Map as MapIcon,
  Maximize2,
  MessageCircle,
  MessageSquareText,
  Minimize2,
  Send,
  Settings,
  Smile,
  Star,
  Store,
  Trees,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  ACTIONS,
  EXPRESSIONS,
  createInitialNeeds,
  createInitialRoutineTasks,
} from './shared/catalog.ts';
import type {
  ActionId,
  AvatarConfig,
  ChatMessage,
  Direction,
  ExpressionId,
  ItemCategory,
  LiveTradeSession,
  MarketListing,
  PlayerProfile,
  RoomId,
  SpaceInfoPayload,
  TradeOffer,
  WorldPlayer,
} from './shared/types.ts';
import { OasisLogo } from './components/OasisLogo.tsx';
import { CharacterCreator } from './components/CharacterCreator.tsx';
import { IsometricWorld } from './components/IsometricWorld.tsx';
import { InventoryModal } from './components/InventoryModal.tsx';
import { ShopModal } from './components/ShopModal.tsx';
import { TradeMarketModal } from './components/TradeMarketModal.tsx';
import { LiveTradeModal } from './components/LiveTradeModal.tsx';
import { MapAndJobsModal } from './components/MapAndJobsModal.tsx';
import { FriendsAndProfileModal } from './components/FriendsAndProfileModal.tsx';
import { soundFX } from './utils/sound.ts';

type ScreenMode = 'creator' | 'world' | 'edit_avatar';
type ActiveModal = null | 'inventory' | 'shop' | 'trades' | 'map' | 'quests' | 'friends';

interface ToastItem {
  id: string;
  message: string;
  kind: 'success' | 'error' | 'info';
}

const STORAGE_PLAYER_ID_KEY = 'oasis_player_id_v1';
const STORAGE_CHAR_KEY = 'oasis_saved_char_v1';

export default function App() {
  const [screen, setScreen] = useState<ScreenMode>('creator');
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [tradeTargetId, setTradeTargetId] = useState<string | null>(null);
  const [emojiMenuOpen, setEmojiMenuOpen] = useState(false);
  const [routineOpen, setRoutineOpen] = useState(false);
  const [chatLogOpen, setChatLogOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [immersiveHud, setImmersiveHud] = useState(false);

  // Authoritative server-synced state
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [roomKey, setRoomKey] = useState<string>('praca');
  const [roomPlayers, setRoomPlayers] = useState<WorldPlayer[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [roomCounts, setRoomCounts] = useState<Record<string, number>>({
    praca: 0,
    balada: 0,
    cafeteria: 0,
    mercado: 0,
    espaco: 0,
  });
  const [marketListings, setMarketListings] = useState<MarketListing[]>([]);
  const [trades, setTrades] = useState<TradeOffer[]>([]);
  const [liveTradeSession, setLiveTradeSession] = useState<LiveTradeSession | null>(null);
  const [liveTradeModalOpen, setLiveTradeModalOpen] = useState(false);
  const [onlinePlayers, setOnlinePlayers] = useState<
    Array<{ id: string; name: string; roomKey: string }>
  >([]);
  const [spaceInfo, setSpaceInfo] = useState<SpaceInfoPayload | null>(null);

  const [chatInput, setChatInput] = useState('');
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const joinPayloadRef = useRef<{
    playerId: string;
    name: string;
    bio: string;
    avatar: AvatarConfig;
  } | null>(null);

  // Load saved character preset from localStorage if present
  const [savedChar] = useState<{
    playerId: string;
    name: string;
    bio: string;
    avatar: AvatarConfig;
  } | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_CHAR_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const pushToast = useCallback((message: string, kind: 'success' | 'error' | 'info' = 'info') => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    setToasts((prev) => [...prev.slice(-3), { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const sendWs = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }));
    }
  }, []);

  const connectAndJoin = useCallback(
    (joinData: { playerId: string; name: string; bio: string; avatar: AvatarConfig }) => {
      joinPayloadRef.current = joinData;
      if (wsRef.current) {
        wsRef.current.close();
      }

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'auth:join', payload: joinData }));
      };

      ws.onmessage = (ev) => {
        let msg: { type: string; payload?: Record<string, unknown> };
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        const p = msg.payload || {};

        if (msg.type === 'init:sync') {
          setProfile(p.profile as PlayerProfile);
          setRoomKey(String(p.roomKey || 'praca'));
          setRoomPlayers((p.players as WorldPlayer[]) || []);
          setChatMessages((p.chatHistory as ChatMessage[]) || []);
          setRoomCounts((p.roomCounts as Record<string, number>) || {});
          setMarketListings((p.marketListings as MarketListing[]) || []);
          setTrades((p.trades as TradeOffer[]) || []);
          const initLive = (p.liveTradeSession as LiveTradeSession) || null;
          setLiveTradeSession(initLive);
          if (initLive && initLive.status === 'negociando') {
            setLiveTradeModalOpen(true);
          }
          setOnlinePlayers(
            (p.onlinePlayers as Array<{ id: string; name: string; roomKey: string }>) || []
          );
          setScreen('world');
        } else if (msg.type === 'profile:update') {
          setProfile(p.profile as PlayerProfile);
        } else if (msg.type === 'room:entered') {
          setRoomKey(String(p.roomKey));
          setRoomPlayers((p.players as WorldPlayer[]) || []);
          setChatMessages((p.chatHistory as ChatMessage[]) || []);
          setSpaceInfo((p.spaceInfo as SpaceInfoPayload) || null);
        } else if (msg.type === 'room:players') {
          const targetRoom = String(p.roomKey || '');
          setRoomKey((curr) => {
            if (curr === targetRoom) {
              setRoomPlayers((p.players as WorldPlayer[]) || []);
            }
            return curr;
          });
        } else if (msg.type === 'player:updated') {
          const updated = p.player as WorldPlayer;
          setRoomPlayers((prev) => {
            const exists = prev.some((pl) => pl.id === updated.id);
            if (!exists) return [...prev, updated];
            return prev.map((pl) => (pl.id === updated.id ? updated : pl));
          });
        } else if (msg.type === 'chat:message') {
          const chatMsg = p.message as ChatMessage;
          soundFX.playChat();
          setChatMessages((prev) => [...prev.slice(-60), chatMsg]);
        } else if (msg.type === 'city:counts') {
          setRoomCounts((p.roomCounts as Record<string, number>) || {});
          if (p.onlinePlayers) {
            setOnlinePlayers(
              p.onlinePlayers as Array<{ id: string; name: string; roomKey: string }>
            );
          }
        } else if (msg.type === 'space:updated') {
          setSpaceInfo((p.spaceInfo as SpaceInfoPayload) || null);
        } else if (msg.type === 'market:updated') {
          setMarketListings((p.marketListings as MarketListing[]) || []);
        } else if (msg.type === 'trade:updated') {
          const tr = p.trade as TradeOffer;
          setTrades((prev) => {
            const rest = prev.filter((x) => x.tradeId !== tr.tradeId);
            return [tr, ...rest];
          });
        } else if (msg.type === 'liveTrade:updated') {
          const session = p.session as LiveTradeSession;
          setLiveTradeSession(session);
          if (session.status === 'negociando') {
            setLiveTradeModalOpen(true);
          } else if (session.status === 'convite') {
            setLiveTradeModalOpen(true);
          }
        } else if (msg.type === 'toast') {
          pushToast(
            String(p.message || ''),
            (p.kind as 'success' | 'error' | 'info') || 'info'
          );
        }
      };

      ws.onclose = () => {
        // Attempt gentle reconnect if still in world
        setTimeout(() => {
          if (joinPayloadRef.current && wsRef.current === ws) {
            connectAndJoin(joinPayloadRef.current);
          }
        }, 2500);
      };
    },
    [pushToast]
  );

  useEffect(() => {
    const onFsChange = () => {
      const active = Boolean(
        document.fullscreenElement ||
          (document as unknown as { webkitFullscreenElement?: Element | null }).webkitFullscreenElement
      );
      setIsFullscreen(active);
      if (!active) {
        setImmersiveHud(false);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      if (wsRef.current) {
        const ws = wsRef.current;
        wsRef.current = null;
        ws.close();
      }
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    soundFX.playClick();
    const docEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    const doc = document as Document & {
      webkitExitFullscreen?: () => Promise<void> | void;
      webkitFullscreenElement?: Element | null;
    };
    const currentlyNativeFs = Boolean(document.fullscreenElement || doc.webkitFullscreenElement);

    if (currentlyNativeFs || immersiveHud) {
      setImmersiveHud(false);
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
      } catch {
        // Ignore if browser/iframe denies exit
      }
      setIsFullscreen(false);
      return;
    }

    let enteredNative = false;
    try {
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
        enteredNative = true;
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
        enteredNative = true;
      }
    } catch {
      enteredNative = false;
    }

    // Activate immersive edge-to-edge canvas mode (always on mobile or when native fullscreen is unsupported/blocked)
    const isSmallViewport = window.innerWidth < 1024;
    if (!enteredNative || isSmallViewport) {
      setImmersiveHud(true);
    }
    setIsFullscreen(true);
  }, [immersiveHud]);

  const handleCreatorComplete = (data: { name: string; bio: string; avatar: AvatarConfig }) => {
    let playerId = localStorage.getItem(STORAGE_PLAYER_ID_KEY);
    if (!playerId) {
      playerId = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      localStorage.setItem(STORAGE_PLAYER_ID_KEY, playerId);
    }

    const charBundle = { playerId, ...data };
    localStorage.setItem(STORAGE_CHAR_KEY, JSON.stringify(charBundle));

    if (screen === 'edit_avatar' && profile) {
      sendWs('avatar:update', { name: data.name, bio: data.bio, avatar: data.avatar });
      setScreen('world');
    } else {
      connectAndJoin(charBundle);
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    sendWs('chat:send', { text });
    setChatInput('');
  };

  const handleSelectRoom = (targetKey: string) => {
    sendWs('room:change', { roomKey: targetKey });
  };

  if (screen === 'creator' || screen === 'edit_avatar' || !profile) {
    return (
      <CharacterCreator
        initialName={profile?.name || savedChar?.name}
        initialBio={profile?.bio || savedChar?.bio}
        initialAvatar={profile?.avatar || savedChar?.avatar}
        isEditing={screen === 'edit_avatar'}
        onCancel={() => setScreen('world')}
        onComplete={handleCreatorComplete}
      />
    );
  }

  const activeBaseRoom = (roomKey.startsWith('espaco') ? 'espaco' : roomKey) as RoomId;
  const topNavRooms: Array<{ id: RoomId; label: string; icon: React.ReactNode }> = [
    { id: 'praca', label: 'Praça', icon: <Trees className="w-4 h-4" /> },
    { id: 'balada', label: 'Balada', icon: <Disc3 className="w-4 h-4 text-purple-400" /> },
    { id: 'cafeteria', label: 'Cafeteria', icon: <Coffee className="w-4 h-4 text-amber-300" /> },
    { id: 'mercado', label: 'Mercado', icon: <Store className="w-4 h-4 text-emerald-400" /> },
    { id: 'espaco', label: 'Nosso espaço', icon: <Star className="w-4 h-4 text-amber-400" /> },
  ];

  const pendingIncomingTradesCount = trades.filter(
    (t) => t.toId === profile.id && t.status === 'pendente'
  ).length;
  const claimableQuestsCount = profile.quests.filter(
    (q) => !q.claimed && q.progress >= q.target
  ).length;
  const playerNeeds = profile.needs || createInitialNeeds();
  const routineTasks = profile.routineTasks || createInitialRoutineTasks();
  const doneRoutineCount = routineTasks.filter((t) => t.done).length;
  const needBars = [
    { key: 'energia', label: 'Energia', value: playerNeeds.energia, color: 'bg-sky-400' },
    { key: 'fome', label: 'Fome', value: playerNeeds.fome, color: 'bg-amber-400' },
    { key: 'diversao', label: 'Diversão', value: playerNeeds.diversao, color: 'bg-pink-400' },
    { key: 'higiene', label: 'Higiene', value: playerNeeds.higiene, color: 'bg-emerald-400' },
  ];

  return (
    <div className="fixed inset-0 w-full h-dvh flex flex-col bg-[#0a0d1c] text-slate-100 overflow-hidden select-none pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      {/* TOP BAR (Responsive for PC & Mobile; hidden in immersive mobile fullscreen) */}
      {!immersiveHud && (
      <header className="h-12 sm:h-16 shrink-0 px-2 sm:px-4 bg-[#0d1124] border-b border-[#242c54] flex items-center justify-between gap-1.5 sm:gap-4">
        {/* Left: Brand Logo */}
        <OasisLogo compact />

        {/* Center: Room Navigation Tabs (Desktop) */}
        <nav className="hidden lg:flex items-center gap-2">
          {topNavRooms.map((item) => {
            const isActive = activeBaseRoom === item.id;
            const target = item.id === 'espaco' ? `espaco:${profile.id}` : item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  handleSelectRoom(target);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
                  isActive
                    ? 'bg-gradient-to-b from-amber-400 to-amber-500 text-slate-950 border-amber-300 shadow-[0_2px_0_#92400e]'
                    : 'bg-[#171d3a] hover:bg-[#202952] text-slate-200 border-[#2d3769]'
                }`}
              >
                <span className={isActive ? 'text-slate-950' : ''}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Currency Counters + Utility Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-[#151a36] border border-[#2c3669]">
            <button
              type="button"
              onClick={() => setActiveModal('map')}
              title="Trabalhar para ganhar moedas"
              className="flex items-center gap-1 text-amber-300 font-mono-nums text-[11px] sm:text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
              <span>{profile.moedas.toLocaleString('pt-BR')}</span>
              <span className="hidden sm:inline">moedas</span>
            </button>
            <span className="text-slate-600">·</span>
            <button
              type="button"
              onClick={() => setActiveModal('shop')}
              title="Adquirir gemas"
              className="flex items-center gap-1 text-purple-300 font-mono-nums text-[11px] sm:text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              <Gem className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" />
              <span>{profile.gemas.toLocaleString('pt-BR')}</span>
              <span className="hidden sm:inline">gemas</span>
            </button>
          </div>

          <button
            type="button"
            title="Rotina & Bem-estar"
            onClick={() => {
              soundFX.playClick();
              setRoutineOpen((v) => !v);
            }}
            className={`px-2.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
              routineOpen
                ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                : 'bg-[#171d3a] hover:bg-[#222b54] border-[#2d3769] text-emerald-300'
            }`}
          >
            <HeartPulse className="w-4 h-4" />
            <span className="hidden sm:inline">Rotina</span>
            <span className="font-mono-nums text-[11px] opacity-90">
              {doneRoutineCount}/{routineTasks.length}
            </span>
          </button>

          <button
            type="button"
            title="Missões Diárias"
            onClick={() => {
              soundFX.playClick();
              setActiveModal('quests');
            }}
            className="relative p-2 sm:p-2.5 rounded-xl bg-[#171d3a] hover:bg-[#222b54] border border-[#2d3769] text-amber-300 cursor-pointer"
          >
            <Trophy className="w-4 h-4" />
            {claimableQuestsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                {claimableQuestsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            title="Perfil, Amigos & Editar Personagem"
            onClick={() => {
              soundFX.playClick();
              setActiveModal('friends');
            }}
            className="p-2 sm:p-2.5 rounded-xl bg-[#171d3a] hover:bg-[#222b54] border border-[#2d3769] text-slate-200 cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            type="button"
            title={muted ? 'Ativar som' : 'Silenciar som'}
            onClick={() => {
              soundFX.muted = !muted;
              setMuted(!muted);
            }}
            className="hidden sm:flex p-2.5 rounded-xl bg-[#171d3a] hover:bg-[#222b54] border border-[#2d3769] text-slate-300 cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
            onClick={toggleFullscreen}
            className={`p-2 sm:p-2.5 rounded-xl border cursor-pointer transition-colors ${
              isFullscreen
                ? 'bg-amber-400 text-slate-950 border-amber-300'
                : 'bg-[#171d3a] hover:bg-[#222b54] border-[#2d3769] text-amber-300'
            }`}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>
      )}

      {/* Floating Exit-Fullscreen / Menu Pill when in Immersive Mobile Fullscreen */}
      {immersiveHud && (
        <div className="fixed top-2.5 left-2.5 z-50 flex items-center gap-1.5 pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)]">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="px-2.5 py-1.5 rounded-xl bg-[#0d1124]/85 hover:bg-[#171d3a] border border-amber-400/70 text-amber-300 text-xs font-bold flex items-center gap-1.5 shadow-lg backdrop-blur-md cursor-pointer"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span>Menus</span>
          </button>
        </div>
      )}

      {/* MAIN VIEWPORT: Full-screen World Canvas (maximized on PC & Mobile!) */}
      <main className="flex-1 min-h-0 flex flex-row overflow-hidden relative">
        <div className="flex-1 min-w-0 min-h-0 relative">
          <IsometricWorld
            roomKey={roomKey}
            currentPlayerId={profile.id}
            players={roomPlayers}
            spaceInfo={spaceInfo}
            myInventory={profile.inventory}
            myFriends={profile.friends}
            onMove={(x, y, direction, action, steps) =>
              sendWs('player:move', { x, y, direction, action, steps })
            }
            onChangeRoom={handleSelectRoom}
            onFurnish={(op, data) => sendWs('room:furnish', { op, ...data })}
            onBuildTile={(x, y) => sendWs('room:build_tile', { x, y })}
            onRoutineAction={(actionType) => sendWs('routine:action', { actionType })}
            onAddFriend={(friendId, friendName) =>
              sendWs('friend:add', { friendId, friendName })
            }
            onStartTrade={(target) => {
              sendWs('liveTrade:invite', { toId: target.id });
            }}
            onOpenShop={() => setActiveModal('shop')}
            onOpenMinigames={() => setActiveModal('map')}
          />
        </div>

        {/* Optional Floating Rotina & Bem-estar Popover */}
        {routineOpen && (
          <div className="absolute top-3 right-3 z-40 w-72 max-w-[calc(100%-24px)] rounded-2xl bg-[#11162c]/96 border-2 border-emerald-500/60 p-3.5 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-[#252e59]">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                <HeartPulse className="w-4 h-4" />
                <span>Rotina & Bem-estar</span>
              </div>
              <button
                type="button"
                onClick={() => setRoutineOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              {needBars.map((bar) => (
                <div key={bar.key} className="bg-[#0b0f21] rounded-lg px-2.5 py-1.5 border border-[#232c54]">
                  <div className="flex justify-between text-[11px] font-semibold mb-1">
                    <span className="text-slate-200">{bar.label}</span>
                    <span className="text-slate-300 font-mono-nums">{bar.value}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${bar.color} transition-all`}
                      style={{ width: `${Math.max(0, Math.min(100, bar.value))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="text-[11px] font-bold text-amber-300 mb-1.5">
              Afazeres de Hoje ({doneRoutineCount}/{routineTasks.length})
            </div>
            <div className="flex flex-col gap-1.5">
              {routineTasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[11px] border ${
                    task.done
                      ? 'bg-emerald-950/40 border-emerald-500/35 text-emerald-200'
                      : 'bg-[#0b0f21] border-[#222a50] text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {task.done ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    )}
                    <span className="truncate">{task.title}</span>
                  </div>
                  <span className="font-mono-nums text-[10px] text-amber-300 shrink-0">
                    +{task.rewardCoins}m
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM ACTION & CHAT BAR (Responsive 2-row on mobile, 1-row on PC; hidden in immersive fullscreen) */}
      {!immersiveHud && (
      <footer className="shrink-0 px-2 sm:px-4 py-1.5 sm:py-2 lg:py-0 lg:h-16 bg-[#0d1124] border-t border-[#242c54] flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-1.5 sm:gap-2 lg:gap-3 relative">
        {/* Chat Input Bar */}
        <form onSubmit={handleSendChat} className="flex-1 flex items-center gap-2 lg:max-w-3xl">
          <button
            type="button"
            onClick={() => {
              soundFX.playClick();
              setChatLogOpen((v) => !v);
            }}
            title="Histórico do Chat Local"
            className={`h-9 sm:h-10 px-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold cursor-pointer shrink-0 transition-colors ${
              chatLogOpen
                ? 'bg-purple-600 text-white border-purple-400'
                : 'bg-[#161c38] hover:bg-[#1e264a] text-slate-200 border-[#2d3769]'
            }`}
          >
            <MessageSquareText className="w-4 h-4 text-amber-300" />
            <span className="hidden sm:inline">Histórico</span>
          </button>

          <div className="flex-1 flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-xl bg-[#161c38] border border-[#2d3769] focus-within:border-purple-400">
            <MessageCircle className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              maxLength={140}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="w-full bg-transparent text-xs sm:text-sm text-white placeholder:text-slate-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setEmojiMenuOpen((v) => !v)}
              title="Expressões e Ações"
              className="text-amber-300 hover:text-amber-200 cursor-pointer shrink-0"
            >
              <Smile className="w-5 h-5" />
            </button>
          </div>
          <button
            type="submit"
            className="w-10 h-9 sm:w-11 sm:h-10 rounded-xl bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center shadow-sm cursor-pointer shrink-0"
            title="Enviar mensagem"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 overflow-x-auto pb-0.5 lg:pb-0">

          <button
            type="button"
            onClick={() => {
              soundFX.playClick();
              setEmojiMenuOpen((v) => !v);
            }}
            className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-pink-500 hover:bg-pink-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-[0_2px_0_#9d174d] cursor-pointer whitespace-nowrap shrink-0"
          >
            <Smile className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Emoji</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundFX.playClick();
              setActiveModal('inventory');
            }}
            className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-[0_2px_0_#065f46] cursor-pointer whitespace-nowrap shrink-0"
          >
            <Backpack className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Inventário</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundFX.playClick();
              setActiveModal('shop');
            }}
            className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-[0_2px_0_#92400e] cursor-pointer whitespace-nowrap shrink-0"
          >
            <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Catálogo</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundFX.playClick();
              setTradeTargetId(null);
              setActiveModal('trades');
            }}
            className="relative px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-[0_2px_0_#075985] cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Trocas</span>
            {pendingIncomingTradesCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px]">
                {pendingIncomingTradesCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              soundFX.playClick();
              setActiveModal('map');
            }}
            className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-[0_2px_0_#4c1d95] cursor-pointer whitespace-nowrap shrink-0"
          >
            <MapIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Mapa</span>
          </button>
        </div>

        {/* Floating Chat History Popover */}
        {chatLogOpen && (
          <div className="absolute bottom-24 lg:bottom-20 left-3 right-3 sm:right-auto sm:w-96 z-40 rounded-2xl bg-[#131833]/96 border-2 border-purple-500/70 p-3.5 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#262f5a]">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <MessageSquareText className="w-4 h-4" />
                <span>Histórico do Chat Local</span>
              </div>
              <button
                type="button"
                onClick={() => setChatLogOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-56 overflow-y-auto flex flex-col gap-1.5 pr-1">
              {chatMessages.length === 0 ? (
                <div className="text-xs text-slate-400 py-2">
                  Nenhuma mensagem ainda neste local.
                </div>
              ) : (
                chatMessages.slice(-25).map((m) => (
                  <div
                    key={m.id}
                    className={`text-xs leading-snug rounded-lg px-2.5 py-1.5 ${
                      m.type === 'system'
                        ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-500/25'
                        : 'bg-[#0b0f21] text-slate-100'
                    }`}
                  >
                    <span
                      className={`font-bold mr-1.5 ${
                        m.type === 'system'
                          ? 'text-emerald-400'
                          : m.senderId === profile.id
                          ? 'text-amber-300'
                          : 'text-sky-300'
                      }`}
                    >
                      {m.senderName}:
                    </span>
                    <span className="break-words">{m.text}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Floating Expressions & Actions Picker */}
        {emojiMenuOpen && (
          <div className="absolute bottom-24 lg:bottom-20 left-3 right-3 sm:left-auto sm:right-4 sm:w-80 z-40 rounded-2xl bg-[#131833] border-2 border-pink-500/70 p-4 shadow-2xl">
            <div className="text-xs font-bold text-pink-300 uppercase tracking-wider mb-2">
              Expressões do Rosto
            </div>
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {EXPRESSIONS.map((exp) => (
                <button
                  key={exp.id}
                  type="button"
                  onClick={() => {
                    soundFX.playClick();
                    sendWs('player:state', { expression: exp.id as ExpressionId });
                    setEmojiMenuOpen(false);
                  }}
                  className="px-2 py-1.5 rounded-lg bg-[#1a2042] hover:bg-pink-600/40 text-xs text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{exp.emoji}</span>
                  <span className="truncate">{exp.label}</span>
                </button>
              ))}
            </div>

            <div className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-2">
              Ações & Poses
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {ACTIONS.filter((a) =>
                ['parado', 'dancando', 'sentado', 'deitado', 'acenando', 'pensando', 'comemorando', 'pulando', 'agachado'].includes(
                  a.id
                )
              ).map((act) => (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => {
                    soundFX.playClick();
                    sendWs('player:state', { action: act.id as ActionId });
                    setEmojiMenuOpen(false);
                  }}
                  className="px-2 py-1.5 rounded-lg bg-[#1a2042] hover:bg-amber-500/30 text-xs font-semibold text-slate-100 cursor-pointer truncate"
                >
                  {act.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </footer>
      )}

      {/* MODALS */}
      {activeModal === 'inventory' && (
        <InventoryModal
          avatar={profile.avatar}
          inventory={profile.inventory}
          onClose={() => setActiveModal(null)}
          onEquip={(category: ItemCategory, itemId: string | null) =>
            sendWs('inventory:equip', { category, itemId })
          }
          onListOnMarket={(instanceId, priceCoins) =>
            sendWs('market:list', { instanceId, priceCoins })
          }
          onGoToSpace={() => handleSelectRoom(`espaco:${profile.id}`)}
        />
      )}

      {activeModal === 'shop' && (
        <ShopModal
          moedas={profile.moedas}
          gemas={profile.gemas}
          avatar={profile.avatar}
          onClose={() => setActiveModal(null)}
          onBuyItem={(itemId, payWith) => sendWs('shop:buy', { itemId, payWith })}
          onBuyGems={(packId) => sendWs('gems:buy', { packId })}
          onExchangeGems={(gems) => sendWs('gems:exchange', { gems })}
        />
      )}

      {activeModal === 'trades' && (
        <TradeMarketModal
          myPlayerId={profile.id}
          myMoedas={profile.moedas}
          myInventory={profile.inventory}
          marketListings={marketListings}
          trades={trades}
          onlinePlayers={onlinePlayers}
          initialTargetPlayerId={tradeTargetId}
          onClose={() => setActiveModal(null)}
          onBuyListing={(listingId) => sendWs('market:buy', { listingId })}
          onCancelListing={(listingId) => sendWs('market:cancel', { listingId })}
          onListItem={(instanceId, priceCoins) =>
            sendWs('market:list', { instanceId, priceCoins })
          }
          onSendTrade={(payload) => sendWs('trade:send', payload)}
          onRespondTrade={(tradeId, accept) => sendWs('trade:respond', { tradeId, accept })}
          onInviteLiveTrade={(targetPlayerId) =>
            sendWs('liveTrade:invite', { toId: targetPlayerId })
          }
        />
      )}

      {liveTradeSession && liveTradeModalOpen && (
        <LiveTradeModal
          session={liveTradeSession}
          myPlayerId={profile.id}
          myMoedas={profile.moedas}
          myInventory={profile.inventory}
          onAcceptInvite={(sessionId) => sendWs('liveTrade:accept_invite', { sessionId })}
          onToggleItem={(sessionId, instanceId) =>
            sendWs('liveTrade:toggle_item', { sessionId, instanceId })
          }
          onSetCoins={(sessionId, coins) => sendWs('liveTrade:set_coins', { sessionId, coins })}
          onToggleLock={(sessionId) => sendWs('liveTrade:lock', { sessionId })}
          onConfirm={(sessionId) => sendWs('liveTrade:confirm', { sessionId })}
          onCancel={(sessionId) => sendWs('liveTrade:cancel', { sessionId })}
          onCloseFinished={() => {
            setLiveTradeModalOpen(false);
            setLiveTradeSession(null);
          }}
        />
      )}

      {(activeModal === 'map' || activeModal === 'quests') && (
        <MapAndJobsModal
          initialTab={activeModal === 'quests' ? 'missoes' : 'trabalhos'}
          myPlayerId={profile.id}
          currentRoomKey={roomKey}
          roomCounts={roomCounts}
          quests={profile.quests}
          stepsWalked={profile.stepsWalked}
          onClose={() => setActiveModal(null)}
          onSelectRoom={handleSelectRoom}
          onCompleteMinigame={(rewardCoins, jobName) =>
            sendWs('minigame:complete', { rewardCoins, jobName })
          }
          onClaimQuest={(questId) => sendWs('quest:claim', { questId })}
        />
      )}

      {activeModal === 'friends' && (
        <FriendsAndProfileModal
          profile={profile}
          onlinePlayers={onlinePlayers}
          onClose={() => setActiveModal(null)}
          onAddFriend={(friendId, friendName) =>
            sendWs('friend:add', { friendId, friendName })
          }
          onVisitSpace={(ownerId) => handleSelectRoom(`espaco:${ownerId}`)}
          onEditCharacter={() => {
            setActiveModal(null);
            setScreen('edit_avatar');
          }}
        />
      )}

      {/* Toast Notifications */}
      <div className="fixed top-20 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2.5 rounded-xl border text-xs font-bold shadow-xl backdrop-blur-md ${
              t.kind === 'error'
                ? 'bg-rose-950/90 border-rose-500 text-rose-100'
                : t.kind === 'success'
                ? 'bg-emerald-950/90 border-emerald-400 text-emerald-100'
                : 'bg-[#161c38]/95 border-amber-400 text-white'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
