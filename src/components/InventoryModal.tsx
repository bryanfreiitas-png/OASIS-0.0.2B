import React, { useState } from 'react';
import { Armchair, Check, Shirt, Tag, X } from 'lucide-react';
import { getCatalogItem } from '../shared/catalog.ts';
import type { AvatarConfig, InventoryItem, ItemCategory } from '../shared/types.ts';
import { PixelAvatarPreview } from './PixelAvatarPreview.tsx';
import { ItemThumbnail } from './ItemThumbnail.tsx';
import { soundFX } from '../utils/sound.ts';

interface InventoryModalProps {
  avatar: AvatarConfig;
  inventory: InventoryItem[];
  onClose: () => void;
  onEquip: (category: ItemCategory, itemId: string | null) => void;
  onListOnMarket: (instanceId: string, priceCoins: number) => void;
  onGoToSpace: () => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  avatar,
  inventory,
  onClose,
  onEquip,
  onListOnMarket,
  onGoToSpace,
}) => {
  const [tab, setTab] = useState<'roupas' | 'moveis'>('roupas');
  const [listingItem, setListingItem] = useState<InventoryItem | null>(null);
  const [sellPrice, setSellPrice] = useState(120);

  const isEquipped = (itemId: string, category: ItemCategory) => {
    if (category === 'roupa_cima') return avatar.shirtId === itemId;
    if (category === 'roupa_baixo') return avatar.pantsId === itemId;
    if (category === 'calcado') return avatar.shoesId === itemId;
    if (category === 'acessorio') return avatar.accessoryId === itemId;
    return false;
  };

  const filtered = inventory.filter((inv) => {
    const cat = getCatalogItem(inv.itemId);
    if (!cat) return false;
    return tab === 'moveis' ? cat.category === 'movel' : cat.category !== 'movel';
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-[#11162b] border-2 border-emerald-500/60 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-[#161c38] border-b border-[#2a3363] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300">
              <Shirt className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-pixel text-base text-white">Inventário & Guarda-Roupa</h2>
              <p className="text-xs text-slate-300">
                Equipe roupas em tempo real, decore seu espaço ou anuncie itens no Bazar.
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Avatar Live Wardrobe Preview */}
          <div className="md:col-span-4 rounded-xl bg-[#0c1021] border border-[#2a3363] p-4 flex flex-col items-center justify-between">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Visual Equipado
            </div>
            <PixelAvatarPreview
              avatar={avatar}
              scale={4}
              width={160}
              height={210}
              pedestal
            />
            <div className="w-full flex flex-col gap-2 mt-2">
              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  onEquip('roupa_cima', 'shirt_sem');
                }}
                className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
              >
                Tirar Camisa / Top
              </button>
              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  onGoToSpace();
                  onClose();
                }}
                className="w-full py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-xs font-bold text-slate-950 cursor-pointer"
              >
                Ir para Nosso Espaço (Mobiliar)
              </button>
            </div>
          </div>

          {/* Items Grid */}
          <div className="md:col-span-8 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTab('roupas')}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  tab === 'roupas'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-[#182042] text-slate-300 hover:text-white'
                }`}
              >
                <Shirt className="w-4 h-4" />
                <span>Roupas & Acessórios</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('moveis')}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  tab === 'moveis'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-[#182042] text-slate-300 hover:text-white'
                }`}
              >
                <Armchair className="w-4 h-4" />
                <span>Móveis & Decoração</span>
              </button>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-xl bg-[#0c1021] border border-[#242c52] p-8 text-center text-sm text-slate-400">
                Nenhum item nesta categoria ainda. Visite o Catálogo ou o Bazar para adquirir!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filtered.map((inv) => {
                  const cat = getCatalogItem(inv.itemId);
                  if (!cat) return null;
                  const equipped = isEquipped(cat.id, cat.category);
                  return (
                    <div
                      key={inv.instanceId}
                      className={`rounded-xl border p-3.5 flex flex-col justify-between gap-3 ${
                        equipped
                          ? 'bg-emerald-950/35 border-emerald-400/70'
                          : 'bg-[#0c1021] border-[#252e59]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <ItemThumbnail
                          item={cat}
                          className={cat.spriteUrl ? 'w-12 h-12' : 'w-10 h-10'}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-white truncate">
                            {cat.name}
                          </div>
                          <div className="text-[11px] text-slate-400 capitalize">
                            {cat.rarity} · {cat.category.replace('_', ' ')}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {cat.category !== 'movel' ? (
                          <button
                            type="button"
                            onClick={() => {
                              soundFX.playClick();
                              onEquip(
                                cat.category,
                                equipped
                                  ? cat.category === 'roupa_cima'
                                    ? 'shirt_sem'
                                    : null
                                  : cat.id
                              );
                            }}
                            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer ${
                              equipped
                                ? 'bg-emerald-500 text-slate-950'
                                : 'bg-[#1c244d] hover:bg-[#27326b] text-white'
                            }`}
                          >
                            {equipped && <Check className="w-3.5 h-3.5" />}
                            <span>{equipped ? 'Equipado' : 'Equipar'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              soundFX.playClick();
                              onGoToSpace();
                              onClose();
                            }}
                            className="flex-1 py-1.5 px-3 rounded-lg text-xs font-bold bg-[#1c244d] hover:bg-[#27326b] text-amber-300 cursor-pointer"
                          >
                            Colocar no Espaço
                          </button>
                        )}

                        {cat.tradeable && (
                          <button
                            type="button"
                            onClick={() => {
                              setListingItem(inv);
                              setSellPrice(Math.max(20, Math.round(cat.priceCoins * 0.9)));
                            }}
                            className="py-1.5 px-3 rounded-lg text-xs font-bold bg-sky-600/25 hover:bg-sky-600/40 border border-sky-400/40 text-sky-200 flex items-center gap-1 cursor-pointer"
                          >
                            <Tag className="w-3 h-3" />
                            <span>Vender</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quick List Item Sub-Dialog */}
            {listingItem && (
              <div className="rounded-xl bg-[#161c38] border-2 border-sky-400 p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-white">
                    Anunciar {getCatalogItem(listingItem.itemId)?.name} no Bazar
                  </div>
                  <div className="text-xs text-slate-300">
                    Outros jogadores poderão comprar com moedas.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={10}
                    max={99999}
                    value={sellPrice}
                    onChange={(e) => setSellPrice(Number(e.target.value))}
                    className="w-24 px-2.5 py-1.5 rounded-lg bg-[#0c1021] border border-sky-500 text-amber-300 font-mono-nums text-sm font-bold"
                  />
                  <span className="text-xs text-amber-300 font-semibold">moedas</span>
                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playCoin();
                      onListOnMarket(listingItem.instanceId, sellPrice);
                      setListingItem(null);
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold cursor-pointer"
                  >
                    Publicar
                  </button>
                  <button
                    type="button"
                    onClick={() => setListingItem(null)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-700 text-xs text-slate-200 cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
