import React from 'react';
import { Edit, Home, UserPlus, Users, X } from 'lucide-react';
import type { PlayerProfile } from '../shared/types.ts';
import { PixelAvatarPreview } from './PixelAvatarPreview.tsx';
import { soundFX } from '../utils/sound.ts';

interface FriendsAndProfileModalProps {
  profile: PlayerProfile;
  onlinePlayers: Array<{ id: string; name: string; roomKey: string }>;
  onClose: () => void;
  onAddFriend: (id: string, name: string) => void;
  onVisitSpace: (ownerId: string) => void;
  onEditCharacter: () => void;
}

export const FriendsAndProfileModal: React.FC<FriendsAndProfileModalProps> = ({
  profile,
  onlinePlayers,
  onClose,
  onAddFriend,
  onVisitSpace,
  onEditCharacter,
}) => {
  const otherOnline = onlinePlayers.filter((p) => p.id !== profile.id);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-[#11162b] border-2 border-[#6d28d9] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-5 py-4 bg-[#161c38] border-b border-[#2a3363] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-purple-300" />
            <h2 className="font-pixel text-base text-white">Perfil & Amigos em OASIS</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* My Profile Card */}
          <div className="md:col-span-5 rounded-xl bg-[#0c1021] border border-[#2a3363] p-4 flex flex-col items-center text-center gap-3">
            <PixelAvatarPreview
              avatar={profile.avatar}
              scale={3}
              width={130}
              height={170}
              pedestal
            />
            <div>
              <div className="font-pixel text-base text-white">{profile.name}</div>
              <p className="text-xs text-slate-300 mt-1">{profile.bio}</p>
              <div className="text-xs text-amber-300 font-mono-nums mt-2">
                {profile.stepsWalked} passos caminhados · {profile.inventory.length} itens
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                onEditCharacter();
              }}
              className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>Editar Personagem</span>
            </button>
          </div>

          {/* Friends & Online Citizens */}
          <div className="md:col-span-7 flex flex-col gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-300 mb-2">
                Meus Amigos ({profile.friends.length})
              </div>
              <div className="flex flex-col gap-2">
                {profile.friends.map((f) => (
                  <div
                    key={f.id}
                    className="px-3.5 py-2.5 rounded-xl bg-[#0c1021] border border-[#252e59] flex items-center justify-between"
                  >
                    <span className="text-sm font-bold text-white">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        soundFX.playClick();
                        onVisitSpace(f.id);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#1c244d] hover:bg-[#2a3673] text-xs font-bold text-sky-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Home className="w-3.5 h-3.5" />
                      <span>Visitar Espaço</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-300 mb-2">
                Jogadores Online Agora ({otherOnline.length})
              </div>
              {otherOnline.length === 0 ? (
                <div className="rounded-xl bg-[#0c1021] border border-[#252e59] p-3 text-xs text-slate-400">
                  Outros jogadores reais aparecerão aqui assim que entrarem na cidade!
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {otherOnline.map((op) => {
                    const already = profile.friends.some((f) => f.id === op.id);
                    return (
                      <div
                        key={op.id}
                        className="px-3.5 py-2.5 rounded-xl bg-[#0c1021] border border-[#252e59] flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="text-sm font-bold text-white">{op.name}</div>
                          <div className="text-[11px] text-slate-400">Em: {op.roomKey}</div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {!already && (
                            <button
                              type="button"
                              onClick={() => onAddFriend(op.id, op.name)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>Add</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              onVisitSpace(op.id);
                              onClose();
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-[#1c244d] text-sky-300 text-xs font-bold cursor-pointer"
                          >
                            Espaço
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
      </div>
    </div>
  );
};
