import React, { useState } from 'react';
import { ArrowLeftRight, Check, Coins, HeartHandshake, Send, Store, Tag, X } from 'lucide-react';
import { getCatalogItem } from '../shared/catalog.ts';
import type { InventoryItem, MarketListing, TradeOffer } from '../shared/types.ts';
import { ItemThumbnail } from './ItemThumbnail.tsx';
import { soundFX } from '../utils/sound.ts';

interface TradeMarketModalProps {
  myPlayerId: string;
  myMoedas: number;
  myInventory: InventoryItem[];
  marketListings: MarketListing[];
  trades: TradeOffer[];
  onlinePlayers: Array<{ id: string; name: string; roomKey: string }>;
  initialTargetPlayerId?: string | null;
  onClose: () => void;
  onBuyListing: (listingId: string) => void;
  onCancelListing: (listingId: string) => void;
  onListItem: (instanceId: string, priceCoins: number) => void;
  onSendTrade: (payload: {
    toId: string;
    offeredInstanceIds: string[];
    offeredCoins: number;
    requestedInstanceIds: string[];
    requestedCoins: number;
  }) => void;
  onRespondTrade: (tradeId: string, accept: boolean) => void;
  onInviteLiveTrade: (targetPlayerId: string) => void;
}

export const TradeMarketModal: React.FC<TradeMarketModalProps> = ({
  myPlayerId,
  myMoedas,
  myInventory,
  marketListings,
  trades,
  onlinePlayers,
  initialTargetPlayerId,
  onClose,
  onBuyListing,
  onCancelListing,
  onListItem,
  onSendTrade,
  onRespondTrade,
  onInviteLiveTrade,
}) => {
  const [tab, setTab] = useState<'bazar' | 'anunciar' | 'troca_direta'>(
    initialTargetPlayerId ? 'troca_direta' : 'bazar'
  );
  const [filter, setFilter] = useState<'todos' | 'roupas' | 'moveis'>('todos');

  // Anunciar state
  const [selectedSellInst, setSelectedSellInst] = useState<string>('');
  const [sellPrice, setSellPrice] = useState<number>(120);

  // Direct Trade state
  const otherOnline = onlinePlayers.filter((p) => p.id !== myPlayerId);
  const [targetId, setTargetId] = useState<string>(
    initialTargetPlayerId || otherOnline[0]?.id || ''
  );
  const [offeredInsts, setOfferedInsts] = useState<string[]>([]);
  const [offeredCoins, setOfferedCoins] = useState<number>(0);
  const [requestedCoins, setRequestedCoins] = useState<number>(50);

  const filteredListings = marketListings.filter((l) => {
    const cat = getCatalogItem(l.itemId);
    if (!cat) return false;
    if (filter === 'moveis') return cat.category === 'movel';
    if (filter === 'roupas') return cat.category !== 'movel';
    return true;
  });

  const tradeableInventory = myInventory.filter((inv) => {
    const cat = getCatalogItem(inv.itemId);
    return cat?.tradeable;
  });

  const incomingTrades = trades.filter((t) => t.toId === myPlayerId && t.status === 'pendente');
  const outgoingTrades = trades.filter((t) => t.fromId === myPlayerId && t.status === 'pendente');

  const toggleOfferedInst = (instId: string) => {
    setOfferedInsts((prev) =>
      prev.includes(instId) ? prev.filter((id) => id !== instId) : [...prev, instId]
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-5xl rounded-2xl bg-[#11162b] border-2 border-sky-400/60 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-[#161c38] border-b border-[#2a3363] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/50 flex items-center justify-center text-sky-300">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-pixel text-base text-white">Bazar & Trocas entre Jogadores</h2>
              <p className="text-xs text-slate-300">
                Compre, venda ou negocie roupas e móveis diretamente com moradores de OASIS.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0c1021] border border-[#2b3467] text-amber-300 font-mono-nums text-xs font-bold">
              <Coins className="w-4 h-4" />
              {myMoedas.toLocaleString('pt-BR')} moedas
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 pb-2 bg-[#131830] border-b border-[#242c52] flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('bazar')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
              tab === 'bazar'
                ? 'bg-sky-500 text-slate-950'
                : 'bg-[#1a2042] text-slate-300 hover:text-white'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Bazar de Itens ({marketListings.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('anunciar')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
              tab === 'anunciar'
                ? 'bg-amber-400 text-slate-950'
                : 'bg-[#1a2042] text-slate-300 hover:text-white'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Vender Meu Item</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('troca_direta')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
              tab === 'troca_direta'
                ? 'bg-purple-500 text-white'
                : 'bg-[#1a2042] text-slate-300 hover:text-white'
            }`}
          >
            <HeartHandshake className="w-4 h-4" />
            <span>
              Troca Direta P2P
              {incomingTrades.length > 0 ? ` (${incomingTrades.length} nova)` : ''}
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'bazar' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                {(['todos', 'roupas', 'moveis'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
                      filter === f
                        ? 'bg-white text-slate-950'
                        : 'bg-[#1a2042] text-slate-300 hover:text-white'
                    }`}
                  >
                    {f === 'todos' ? 'Todos' : f === 'roupas' ? 'Roupas & Acessórios' : 'Móveis'}
                  </button>
                ))}
              </div>

              {filteredListings.length === 0 ? (
                <div className="rounded-xl bg-[#0c1021] border border-[#242c52] p-8 text-center text-sm text-slate-400">
                  Nenhum item anunciado nesta categoria no momento.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredListings.map((lst) => {
                    const cat = getCatalogItem(lst.itemId);
                    if (!cat) return null;
                    const isMine = lst.sellerId === myPlayerId;
                    return (
                      <div
                        key={lst.listingId}
                        className="rounded-xl bg-[#0c1021] border border-[#283160] p-3.5 flex flex-col justify-between gap-3"
                      >
                        <div className="flex items-start gap-3">
                          <ItemThumbnail
                            item={cat}
                            className={cat.spriteUrl ? 'w-12 h-12' : 'w-11 h-11'}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-bold text-white truncate">
                              {cat.name}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Vendedor: <span className="text-sky-300 font-semibold">{lst.sellerName}</span>
                            </div>
                            <div className="text-[11px] text-amber-300/90 capitalize mt-0.5">
                              {cat.rarity} · {cat.category === 'movel' ? 'Móvel' : 'Vestuário'}
                            </div>
                          </div>
                        </div>

                        {isMine ? (
                          <button
                            type="button"
                            onClick={() => onCancelListing(lst.listingId)}
                            className="w-full py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-bold text-white cursor-pointer"
                          >
                            Remover Anúncio ({lst.priceCoins} moedas)
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              soundFX.playCoin();
                              onBuyListing(lst.listingId);
                            }}
                            className="w-full py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold font-mono-nums cursor-pointer"
                          >
                            Comprar por {lst.priceCoins} moedas
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'anunciar' && (
            <div className="max-w-2xl mx-auto rounded-xl bg-[#0c1021] border border-[#283160] p-5 flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-bold text-white">Anunciar Roupa ou Móvel do Inventário</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Escolha o item e defina o valor em moedas para outros jogadores comprarem.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                {tradeableInventory.map((inv) => {
                  const cat = getCatalogItem(inv.itemId);
                  if (!cat) return null;
                  const active = selectedSellInst === inv.instanceId;
                  return (
                    <button
                      key={inv.instanceId}
                      type="button"
                      onClick={() => {
                        setSelectedSellInst(inv.instanceId);
                        setSellPrice(Math.max(20, Math.round(cat.priceCoins * 0.9)));
                      }}
                      className={`p-3 rounded-xl border text-left flex items-center gap-2.5 cursor-pointer ${
                        active
                          ? 'bg-amber-400/15 border-amber-400 text-white'
                          : 'bg-[#131830] border-[#252e59] text-slate-300 hover:border-sky-400'
                      }`}
                    >
                      <ItemThumbnail item={cat} className="w-9 h-9" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">{cat.name}</div>
                        <div className="text-[11px] text-slate-400">
                          Ref. catálogo: {cat.priceCoins} moedas
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#242c52]">
                <label className="text-xs font-bold text-slate-200">Preço de venda:</label>
                <input
                  type="number"
                  min={10}
                  max={99999}
                  value={sellPrice}
                  onChange={(e) => setSellPrice(Number(e.target.value))}
                  className="w-28 px-3 py-2 rounded-lg bg-[#151b36] border border-sky-500 text-amber-300 font-mono-nums text-sm font-bold"
                />
                <span className="text-xs text-amber-300 font-semibold">moedas</span>
                <button
                  type="button"
                  disabled={!selectedSellInst}
                  onClick={() => {
                    if (!selectedSellInst) return;
                    soundFX.playCoin();
                    onListItem(selectedSellInst, sellPrice);
                    setSelectedSellInst('');
                    setTab('bazar');
                  }}
                  className="ml-auto px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 text-xs font-bold cursor-pointer"
                >
                  Publicar no Bazar
                </button>
              </div>
            </div>
          )}

          {tab === 'troca_direta' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Incoming & Outgoing Trades */}
              <div className="lg:col-span-5 flex flex-col gap-3">
                <div className="text-xs font-bold uppercase tracking-wider text-purple-300">
                  Propostas Recebidas ({incomingTrades.length})
                </div>
                {incomingTrades.length === 0 ? (
                  <div className="rounded-xl bg-[#0c1021] border border-[#242c52] p-4 text-xs text-slate-400">
                    Nenhuma proposta recebida no momento.
                  </div>
                ) : (
                  incomingTrades.map((tr) => (
                    <div
                      key={tr.tradeId}
                      className="rounded-xl bg-[#161c38] border-2 border-purple-500 p-3.5 flex flex-col gap-2.5"
                    >
                      <div className="text-xs font-bold text-white">
                        De: <span className="text-amber-300">{tr.fromName}</span>
                      </div>
                      <div className="text-xs text-slate-300">
                        Oferece:{' '}
                        {tr.offeredItemIds.map((id) => getCatalogItem(id)?.name).join(', ') || 'Nenhum item'}
                        {tr.offeredCoins > 0 ? ` + ${tr.offeredCoins} moedas` : ''}
                      </div>
                      <div className="text-xs text-slate-300">
                        Pede em troca: {tr.requestedCoins} moedas
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            soundFX.playQuest();
                            onRespondTrade(tr.tradeId, true);
                          }}
                          className="flex-1 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Aceitar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onRespondTrade(tr.tradeId, false)}
                          className="flex-1 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                        >
                          Recusar
                        </button>
                      </div>
                    </div>
                  ))
                )}

                {outgoingTrades.length > 0 && (
                  <>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-2">
                      Enviadas ({outgoingTrades.length})
                    </div>
                    {outgoingTrades.map((tr) => (
                      <div
                        key={tr.tradeId}
                        className="rounded-xl bg-[#0c1021] border border-[#242c52] p-3 text-xs text-slate-300"
                      >
                        Aguardando resposta de <span className="font-bold text-white">{tr.toName}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Send New Direct Trade */}
              <div className="lg:col-span-7 rounded-xl bg-[#0c1021] border border-[#283160] p-4 flex flex-col gap-3.5">
                <div className="text-sm font-bold text-white">Enviar Proposta de Troca Direta</div>

                {otherOnline.length === 0 ? (
                  <div className="rounded-lg bg-[#151b36] border border-[#2b3467] p-4 text-xs text-slate-300">
                    Nenhum outro jogador real conectado neste instante. Dica: abra uma segunda aba do navegador para testar trocas P2P ao vivo ou use a aba <strong>Bazar de Itens</strong> para negociar com todos!
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs text-slate-300 mb-1 font-semibold">
                        Jogador online destinatário:
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={targetId}
                          onChange={(e) => setTargetId(e.target.value)}
                          className="flex-1 min-w-[180px] px-3 py-2 rounded-lg bg-[#151b36] border border-[#34407a] text-white text-xs font-semibold"
                        >
                          {otherOnline.map((op) => (
                            <option key={op.id} value={op.id}>
                              {op.name} ({op.roomKey})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!targetId}
                          onClick={() => {
                            if (!targetId) return;
                            soundFX.playClick();
                            onInviteLiveTrade(targetId);
                            onClose();
                          }}
                          className="px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                          <span>Abrir Mesa ao Vivo (6 Slots)</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-300 mb-1.5 font-semibold">
                        Seus itens na oferta:
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                        {tradeableInventory.map((inv) => {
                          const cat = getCatalogItem(inv.itemId);
                          if (!cat) return null;
                          const picked = offeredInsts.includes(inv.instanceId);
                          return (
                            <button
                              key={inv.instanceId}
                              type="button"
                              onClick={() => toggleOfferedInst(inv.instanceId)}
                              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                                picked
                                  ? 'bg-purple-600 border-purple-300 text-white'
                                  : 'bg-[#151b36] border-[#293366] text-slate-300'
                              }`}
                            >
                              {cat.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-300 mb-1">
                          Moedas que você oferece:
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={myMoedas}
                          value={offeredCoins}
                          onChange={(e) => setOfferedCoins(Math.max(0, Number(e.target.value)))}
                          className="w-full px-3 py-1.5 rounded-lg bg-[#151b36] border border-[#34407a] text-amber-300 font-mono-nums text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-300 mb-1">
                          Moedas que você pede:
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={requestedCoins}
                          onChange={(e) => setRequestedCoins(Math.max(0, Number(e.target.value)))}
                          className="w-full px-3 py-1.5 rounded-lg bg-[#151b36] border border-[#34407a] text-amber-300 font-mono-nums text-xs font-bold"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!targetId || (offeredInsts.length === 0 && offeredCoins <= 0)}
                      onClick={() => {
                        soundFX.playClick();
                        onSendTrade({
                          toId: targetId,
                          offeredInstanceIds: offeredInsts,
                          offeredCoins,
                          requestedInstanceIds: [],
                          requestedCoins,
                        });
                        setOfferedInsts([]);
                        setOfferedCoins(0);
                      }}
                      className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Enviar Proposta de Troca</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
