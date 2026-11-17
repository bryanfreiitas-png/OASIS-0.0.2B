import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Coffee,
  Coins,
  Disc3,
  Map as MapIcon,
  Package,
  Trophy,
  X,
} from 'lucide-react';
import { ROOMS_META } from '../shared/catalog.ts';
import type { DailyQuest, RoomId } from '../shared/types.ts';
import { soundFX } from '../utils/sound.ts';

interface MapAndJobsModalProps {
  initialTab?: 'mapa' | 'trabalhos' | 'missoes';
  myPlayerId: string;
  currentRoomKey: string;
  roomCounts: Record<string, number>;
  quests: DailyQuest[];
  stepsWalked: number;
  onClose: () => void;
  onSelectRoom: (roomKey: string) => void;
  onCompleteMinigame: (rewardCoins: number, jobName: string) => void;
  onClaimQuest: (questId: string) => void;
}

type ActiveGame = null | 'barista' | 'entregas' | 'dj';

const COFFEE_ITEMS = [
  { id: 'espresso', label: 'Espresso', color: '#78350f' },
  { id: 'latte', label: 'Latte', color: '#d97706' },
  { id: 'mocha', label: 'Mocha', color: '#451a03' },
  { id: 'matcha', label: 'Matcha', color: '#16a34a' },
];

const CRATE_TYPES = [
  { id: 'frutas', label: 'Frutas', color: '#ef4444' },
  { id: 'padaria', label: 'Pães', color: '#f59e0b' },
  { id: 'flores', label: 'Flores', color: '#ec4899' },
];

const DJ_LANES = [
  { id: 0, label: 'GRAVE', color: '#8b5cf6' },
  { id: 1, label: 'SYNTH', color: '#ec4899' },
  { id: 2, label: 'BASS', color: '#06b6d4' },
  { id: 3, label: 'DROP', color: '#fbbf24' },
];

export const MapAndJobsModal: React.FC<MapAndJobsModalProps> = ({
  initialTab = 'mapa',
  myPlayerId,
  currentRoomKey,
  roomCounts,
  quests,
  stepsWalked,
  onClose,
  onSelectRoom,
  onCompleteMinigame,
  onClaimQuest,
}) => {
  const [tab, setTab] = useState<'mapa' | 'trabalhos' | 'missoes'>(initialTab);
  const [activeGame, setActiveGame] = useState<ActiveGame>(null);

  // Barista Minigame State
  const [baristaOrder, setBaristaOrder] = useState<string[]>([]);
  const [baristaInput, setBaristaInput] = useState<string[]>([]);
  const [baristaScore, setBaristaScore] = useState(0);
  const [baristaRound, setBaristaRound] = useState(1);

  // Entregas Minigame State
  const [currentCrate, setCurrentCrate] = useState(CRATE_TYPES[0]);
  const [crateCount, setCrateCount] = useState(0);
  const [crateScore, setCrateScore] = useState(0);

  // DJ Minigame State
  const [activeLane, setActiveLane] = useState(0);
  const [djBeatCount, setDjBeatCount] = useState(0);
  const [djScore, setDjScore] = useState(0);

  const startBarista = () => {
    const newOrder = Array.from({ length: 3 }, () => COFFEE_ITEMS[Math.floor(Math.random() * 4)].id);
    setBaristaOrder(newOrder);
    setBaristaInput([]);
    setBaristaScore(0);
    setBaristaRound(1);
    setActiveGame('barista');
  };

  const handleBaristaPick = (id: string) => {
    const nextIdx = baristaInput.length;
    if (id === baristaOrder[nextIdx]) {
      soundFX.playHit();
      const updated = [...baristaInput, id];
      setBaristaInput(updated);
      if (updated.length === baristaOrder.length) {
        const nextScore = baristaScore + 8;
        if (baristaRound >= 3) {
          soundFX.playQuest();
          onCompleteMinigame(14 + nextScore, 'Barista da Cafeteria');
          setActiveGame(null);
        } else {
          setBaristaScore(nextScore);
          setBaristaRound((r) => r + 1);
          setBaristaInput([]);
          setBaristaOrder(
            Array.from({ length: 3 + baristaRound }, () => COFFEE_ITEMS[Math.floor(Math.random() * 4)].id)
          );
        }
      }
    } else {
      soundFX.playMiss();
      setBaristaInput([]);
    }
  };

  const startEntregas = () => {
    setCrateCount(0);
    setCrateScore(0);
    setCurrentCrate(CRATE_TYPES[Math.floor(Math.random() * CRATE_TYPES.length)]);
    setActiveGame('entregas');
  };

  const handleCrateSort = (laneId: string) => {
    const correct = laneId === currentCrate.id;
    if (correct) soundFX.playHit();
    else soundFX.playMiss();

    const newScore = crateScore + (correct ? 3 : 0);
    const nextCount = crateCount + 1;
    if (nextCount >= 8) {
      soundFX.playQuest();
      onCompleteMinigame(12 + newScore, 'Entregador do Mercado');
      setActiveGame(null);
    } else {
      setCrateScore(newScore);
      setCrateCount(nextCount);
      setCurrentCrate(CRATE_TYPES[Math.floor(Math.random() * CRATE_TYPES.length)]);
    }
  };

  const startDj = () => {
    setDjBeatCount(0);
    setDjScore(0);
    setActiveLane(Math.floor(Math.random() * 4));
    setActiveGame('dj');
  };

  useEffect(() => {
    if (activeGame !== 'dj') return;
    const id = setInterval(() => {
      setActiveLane(Math.floor(Math.random() * 4));
    }, 850);
    return () => clearInterval(id);
  }, [activeGame]);

  const handleDjTap = (lane: number) => {
    const hit = lane === activeLane;
    if (hit) soundFX.playHit();
    else soundFX.playMiss();

    const nextScore = djScore + (hit ? 4 : 0);
    const nextBeats = djBeatCount + 1;
    if (nextBeats >= 8) {
      soundFX.playQuest();
      onCompleteMinigame(15 + nextScore, 'DJ da Balada Neon');
      setActiveGame(null);
    } else {
      setDjScore(nextScore);
      setDjBeatCount(nextBeats);
      setActiveLane(Math.floor(Math.random() * 4));
    }
  };

  const roomsList: RoomId[] = ['praca', 'balada', 'cafeteria', 'mercado', 'espaco'];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-[#11162b] border-2 border-purple-500/70 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-[#161c38] border-b border-[#2a3363] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-400/50 flex items-center justify-center text-purple-300">
              <MapIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-pixel text-base text-white">Mapa, Trabalhos F2P & Missões</h2>
              <p className="text-xs text-slate-300">
                Explore Oasis, ganhe moedas trabalhando nos minigames ou resgate missões diárias.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 pb-2 bg-[#131830] border-b border-[#242c52] flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setTab('mapa');
              setActiveGame(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
              tab === 'mapa'
                ? 'bg-purple-500 text-white'
                : 'bg-[#1a2042] text-slate-300 hover:text-white'
            }`}
          >
            <MapIcon className="w-4 h-4" />
            <span>Mapa de OASIS</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('trabalhos')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
              tab === 'trabalhos'
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-[#1a2042] text-slate-300 hover:text-white'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Trabalhar (Farm F2P)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('missoes');
              setActiveGame(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
              tab === 'missoes'
                ? 'bg-amber-400 text-slate-950'
                : 'bg-[#1a2042] text-slate-300 hover:text-white'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Missões Diárias</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'mapa' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {roomsList.map((rId) => {
                const meta = ROOMS_META[rId];
                const targetKey = rId === 'espaco' ? `espaco:${myPlayerId}` : rId;
                const isHere =
                  rId === 'espaco' ? currentRoomKey.startsWith('espaco') : currentRoomKey === rId;
                return (
                  <button
                    key={rId}
                    type="button"
                    onClick={() => {
                      soundFX.playClick();
                      onSelectRoom(targetKey);
                      onClose();
                    }}
                    className={`rounded-xl border-2 p-4 text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                      isHere
                        ? 'bg-[#1d1842] border-amber-400'
                        : 'bg-[#0c1021] border-[#283160] hover:border-purple-400'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-pixel text-sm text-white">{meta.name}</span>
                        <span className="font-mono-nums text-[11px] text-emerald-300 font-bold">
                          {roomCounts[rId] || 0} online
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">{meta.subtitle}</p>
                    </div>
                    <div className="text-xs font-bold text-amber-300">
                      {isHere ? 'Você está aqui' : 'Viajar para este local →'}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {tab === 'trabalhos' && (
            <div className="flex flex-col gap-4">
              {activeGame === null ? (
                <>
                  <div className="rounded-xl bg-[#0c1021] border border-[#283160] p-3.5 text-xs text-slate-300 flex items-center justify-between">
                    <span>
                      Trabalhe em turnos rápidos para conquistar moedas de forma 100% gratuita e evoluir seu inventário!
                    </span>
                    <span className="font-mono-nums font-bold text-amber-300">
                      15–45 moedas / turno
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-xl bg-[#0c1021] border border-amber-500/40 p-4 flex flex-col justify-between gap-4">
                      <div>
                        <Coffee className="w-7 h-7 text-amber-400 mb-2" />
                        <div className="font-pixel text-sm text-white">Barista da Cafeteria</div>
                        <p className="text-xs text-slate-300 mt-1">
                          Monte os pedidos de café na ordem exata para os clientes da praça.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={startBarista}
                        className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold cursor-pointer"
                      >
                        Iniciar Turno (~25–38 moedas)
                      </button>
                    </div>

                    <div className="rounded-xl bg-[#0c1021] border border-emerald-500/40 p-4 flex flex-col justify-between gap-4">
                      <div>
                        <Package className="w-7 h-7 text-emerald-400 mb-2" />
                        <div className="font-pixel text-sm text-white">Entregas do Mercado</div>
                        <p className="text-xs text-slate-300 mt-1">
                          Separe 8 caixas de frutas, pães e flores rapidamente nas esteiras certas.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={startEntregas}
                        className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer"
                      >
                        Iniciar Turno (~20–36 moedas)
                      </button>
                    </div>

                    <div className="rounded-xl bg-[#0c1021] border border-purple-500/40 p-4 flex flex-col justify-between gap-4">
                      <div>
                        <Disc3 className="w-7 h-7 text-purple-400 mb-2" />
                        <div className="font-pixel text-sm text-white">DJ da Balada Neon</div>
                        <p className="text-xs text-slate-300 mt-1">
                          Acerte as batidas neon acesas na mesa de som para animar a pista!
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={startDj}
                        className="w-full py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white text-xs font-bold cursor-pointer"
                      >
                        Iniciar Turno (~25–47 moedas)
                      </button>
                    </div>
                  </div>
                </>
              ) : activeGame === 'barista' ? (
                <div className="rounded-xl bg-[#0c1021] border-2 border-amber-400 p-5 flex flex-col gap-4 items-center">
                  <div className="w-full flex items-center justify-between">
                    <span className="font-pixel text-sm text-amber-300">
                      Pedido {baristaRound}/3
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveGame(null)}
                      className="text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      Cancelar turno
                    </button>
                  </div>
                  <div className="text-xs text-slate-300">
                    Clique nas bebidas na mesma sequência do pedido:
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {baristaOrder.map((ordId, idx) => {
                      const item = COFFEE_ITEMS.find((c) => c.id === ordId);
                      const done = idx < baristaInput.length;
                      return (
                        <div
                          key={`${ordId}_${idx}`}
                          className={`px-3 py-2 rounded-lg border text-xs font-bold ${
                            done
                              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                              : 'bg-[#171d3b] border-slate-600 text-white'
                          }`}
                        >
                          {idx + 1}. {item?.label}
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-lg mt-2">
                    {COFFEE_ITEMS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleBaristaPick(c.id)}
                        className="py-3 px-3 rounded-xl border-2 border-white/20 text-white text-xs font-bold cursor-pointer hover:scale-105 transition-transform"
                        style={{ backgroundColor: c.color }}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : activeGame === 'entregas' ? (
                <div className="rounded-xl bg-[#0c1021] border-2 border-emerald-400 p-5 flex flex-col gap-4 items-center">
                  <div className="w-full flex items-center justify-between">
                    <span className="font-pixel text-sm text-emerald-300">
                      Caixa {crateCount + 1}/8 · Pontos: {crateScore}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveGame(null)}
                      className="text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>

                  <div
                    className="w-40 h-28 rounded-xl border-4 border-white/30 flex flex-col items-center justify-center shadow-lg"
                    style={{ backgroundColor: currentCrate.color }}
                  >
                    <Package className="w-8 h-8 text-white mb-1" />
                    <span className="font-pixel text-sm text-white">{currentCrate.label}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 w-full max-w-md">
                    {CRATE_TYPES.map((ct) => (
                      <button
                        key={ct.id}
                        type="button"
                        onClick={() => handleCrateSort(ct.id)}
                        className="py-3 rounded-xl bg-[#182042] hover:bg-[#243063] border border-slate-600 text-white text-xs font-bold cursor-pointer"
                      >
                        Enviar p/ {ct.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-[#0c1021] border-2 border-purple-400 p-5 flex flex-col gap-4 items-center">
                  <div className="w-full flex items-center justify-between">
                    <span className="font-pixel text-sm text-purple-300">
                      Batida {djBeatCount + 1}/8 · Acertos: {djScore}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveGame(null)}
                      className="text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                  <div className="text-xs text-slate-300">
                    Clique no botão neon que está brilhando!
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-lg">
                    {DJ_LANES.map((lane) => {
                      const lit = activeLane === lane.id;
                      return (
                        <button
                          key={lane.id}
                          type="button"
                          onClick={() => handleDjTap(lane.id)}
                          className={`py-6 rounded-xl border-2 font-pixel text-xs transition-all cursor-pointer ${
                            lit
                              ? 'scale-105 text-slate-950 border-white shadow-[0_0_20px_rgba(255,255,255,0.6)]'
                              : 'bg-[#151b36] border-slate-700 text-slate-400'
                          }`}
                          style={lit ? { backgroundColor: lane.color } : undefined}
                        >
                          {lane.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'missoes' && (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl bg-[#0c1021] border border-[#283160] p-3.5 flex items-center justify-between text-xs">
                <span className="text-slate-300">
                  Passos totais percorridos na cidade hoje:
                </span>
                <span className="font-mono-nums font-bold text-amber-300">
                  {stepsWalked} passos
                </span>
              </div>

              {quests.map((q) => {
                const ready = q.progress >= q.target;
                const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
                return (
                  <div
                    key={q.id}
                    className="rounded-xl bg-[#0c1021] border border-[#283160] p-4 flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="flex-1 min-w-[220px]">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{q.title}</span>
                        {q.claimed && (
                          <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Resgatada
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{q.description}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-[#1a2042] overflow-hidden">
                          <div
                            className="h-full bg-amber-400 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="font-mono-nums text-[11px] text-slate-300">
                          {q.progress}/{q.target}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right font-mono-nums text-xs">
                        <div className="text-amber-300 font-bold flex items-center justify-end gap-1">
                          <Coins className="w-3.5 h-3.5" /> +{q.rewardCoins}
                        </div>
                        <div className="text-purple-300 font-bold">+{q.rewardGems} gemas</div>
                      </div>

                      <button
                        type="button"
                        disabled={!ready || q.claimed}
                        onClick={() => {
                          soundFX.playQuest();
                          onClaimQuest(q.id);
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap ${
                          q.claimed
                            ? 'bg-slate-800 text-slate-500 cursor-default'
                            : ready
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                            : 'bg-[#1a2042] text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {q.claimed ? 'Concluída' : ready ? 'Resgatar' : 'Em progresso'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
