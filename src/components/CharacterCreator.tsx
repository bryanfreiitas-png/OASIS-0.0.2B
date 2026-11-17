import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Palette,
  RotateCw,
  Shirt,
  Sparkles,
  User,
} from 'lucide-react';
import { CATALOG_ITEMS, HAIR_COLORS, SKIN_TONES } from '../shared/catalog.ts';
import type { AvatarConfig, Gender } from '../shared/types.ts';
import { type TurnaroundView } from '../utils/pixelAvatarRenderer.ts';
import { OasisLogo } from './OasisLogo.tsx';
import { PixelAvatarPreview } from './PixelAvatarPreview.tsx';
import { soundFX } from '../utils/sound.ts';

interface CharacterCreatorProps {
  initialName?: string;
  initialBio?: string;
  initialAvatar?: AvatarConfig;
  isEditing?: boolean;
  onCancel?: () => void;
  onComplete: (data: { name: string; bio: string; avatar: AvatarConfig }) => void;
}

const MALE_ROTATE_VIEWS: TurnaroundView[] = [
  'frente',
  '3/4',
  'costas',
  '3/4_esquerda',
];
const FEMALE_ROTATE_VIEWS: TurnaroundView[] = ['frente', '3/4', 'direita', 'costas', 'esquerda'];

export const CharacterCreator: React.FC<CharacterCreatorProps> = ({
  initialName = '',
  initialBio = 'Pronto para curtir a Praça Central!',
  initialAvatar,
  isEditing = false,
  onCancel,
  onComplete,
}) => {
  const [name, setName] = useState(initialName || 'Morador_Oasis');
  const [bio, setBio] = useState(initialBio);
  const [avatar, setAvatar] = useState<AvatarConfig>(
    initialAvatar || {
      gender: 'masculino',
      skinTone: '#e09664',
      hairStyle: 'topete_fade',
      hairColor: '#1e1b26',
      eyeColor: '#1a1523',
      tattoo: true,
      shirtId: 'shirt_sem',
      pantsId: 'pants_shorts_branco',
      shoesId: 'shoes_chinelo',
      accessoryId: null,
    }
  );

  // Two dedicated screens/steps so options never crowd a single view on PC or mobile
  const [step, setStep] = useState<'aparencia' | 'roupas'>('aparencia');
  const [clothCategory, setClothCategory] = useState<'cima' | 'baixo' | 'calcado'>('cima');
  const [viewIndex, setViewIndex] = useState(1); // default 3/4
  const [errorMsg, setErrorMsg] = useState('');

  const switchGender = (gender: Gender) => {
    soundFX.playClick();
    setViewIndex(1);
    setAvatar((prev) => ({
      ...prev,
      gender,
      hairStyle: gender === 'feminino' ? 'coque_alto' : 'topete_fade',
      hairColor: gender === 'feminino' ? '#4a2c20' : '#1e1b26',
      tattoo: gender === 'masculino',
      shirtId: gender === 'feminino' ? 'shirt_top_branco' : 'shirt_sem',
      pantsId: 'pants_shorts_branco',
      shoesId: gender === 'feminino' ? null : 'shoes_chinelo',
    }));
  };

  const rotateViews = avatar.gender === 'feminino' ? FEMALE_ROTATE_VIEWS : MALE_ROTATE_VIEWS;
  const activeRotateView = rotateViews[viewIndex % rotateViews.length];

  const starterShirts = CATALOG_ITEMS.filter(
    (i) => i.category === 'roupa_cima' && i.priceCoins <= 150
  );
  const starterPants = CATALOG_ITEMS.filter(
    (i) => i.category === 'roupa_baixo' && i.priceCoins <= 120
  );
  const starterShoes = CATALOG_ITEMS.filter(
    (i) => i.category === 'calcado' && i.priceCoins <= 140
  );

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setErrorMsg('Escolha um nome com pelo menos 2 caracteres.');
      setStep('aparencia');
      return;
    }
    soundFX.playQuest();
    onComplete({ name: cleanName, bio: bio.trim() || 'Explorando OASIS!', avatar });
  };

  return (
    <div className="min-h-dvh w-full bg-[#130826] text-slate-100 flex flex-col justify-between overflow-y-auto">
      <div
        className="fixed inset-0 pointer-events-none opacity-25"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(168,85,247,0.35), transparent 45%), radial-gradient(circle at 80% 75%, rgba(236,72,153,0.22), transparent 45%)',
        }}
      />

      <div className="relative z-10 w-full max-w-4xl mx-auto px-3 sm:px-5 py-3 sm:py-5 flex flex-col gap-3 sm:gap-4 my-auto">
        {/* Compact Header */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-3">
            <OasisLogo compact />
            <div>
              <h1 className="font-pixel text-sm sm:text-lg text-white leading-tight">
                {isEditing ? 'Editar Personagem' : 'Criar Personagem'}
              </h1>
              <p className="text-[11px] sm:text-xs text-purple-200/80">
                Passo {step === 'aparencia' ? '1 de 2 · Modelo & Cores' : '2 de 2 · Roupas Iniciais'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Step Tabs */}
            <div className="flex items-center p-1 rounded-xl bg-[#1b0c38] border border-[#5b21b6]">
              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  setStep('aparencia');
                }}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  step === 'aparencia'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-purple-200 hover:text-white'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Aparência</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  setStep('roupas');
                }}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  step === 'roupas'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-purple-200 hover:text-white'
                }`}
              >
                <Shirt className="w-3.5 h-3.5" />
                <span>Roupas</span>
              </button>
            </div>

            {isEditing && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-600 cursor-pointer"
              >
                Voltar
              </button>
            )}
          </div>
        </div>

        {/* Main Card: Balanced 2-col on Desktop, Clean Stacked on Mobile */}
        <div className="rounded-2xl bg-[#1b0c38]/92 border-2 border-[#6d28d9] p-3.5 sm:p-5 shadow-[0_0_32px_rgba(109,40,217,0.28)] grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 items-center">
          {/* LEFT: Compact Character Pedestal */}
          <div className="md:col-span-5 flex flex-col items-center justify-center bg-[#120726]/85 rounded-xl border border-purple-800/70 p-3 sm:p-4 relative">
            <button
              type="button"
              title="Girar personagem"
              onClick={() => {
                soundFX.playClick();
                setViewIndex((v) => (v + 1) % rotateViews.length);
              }}
              className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-[#231048] hover:bg-purple-700/70 border border-purple-500/50 text-[11px] font-semibold text-purple-100 flex items-center gap-1 cursor-pointer"
            >
              <RotateCw className="w-3 h-3" />
              <span>Girar</span>
            </button>

            <PixelAvatarPreview
              avatar={avatar}
              view={activeRotateView}
              expression="normal"
              action="parado"
              scale={3}
              width={136}
              height={176}
              pedestal
            />

            <div className="mt-1 text-center">
              <div className="font-pixel text-sm text-white truncate max-w-[200px]">
                {name || 'Seu Nome'}
              </div>
              <div className="text-[11px] text-purple-300/80 capitalize mt-0.5">
                {avatar.gender} · Bônus inicial: 450 moedas
              </div>
            </div>
          </div>

          {/* RIGHT: Step 1 (Gender + Colors + Name) OR Step 2 (Starter Clothes) */}
          <div className="md:col-span-7 flex flex-col gap-3.5">
            {step === 'aparencia' ? (
              <>
                {/* Gender Selector */}
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-purple-300 mb-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    <span>Modelo do Personagem</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => switchGender('masculino')}
                      className={`py-2.5 px-3 rounded-xl border-2 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                        avatar.gender === 'masculino'
                          ? 'bg-amber-400 text-slate-950 border-amber-200 shadow-md'
                          : 'bg-[#120726] text-purple-200 border-purple-900 hover:border-purple-500'
                      }`}
                    >
                      Masculino
                    </button>
                    <button
                      type="button"
                      onClick={() => switchGender('feminino')}
                      className={`py-2.5 px-3 rounded-xl border-2 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                        avatar.gender === 'feminino'
                          ? 'bg-pink-500 text-white border-pink-300 shadow-md'
                          : 'bg-[#120726] text-purple-200 border-purple-900 hover:border-purple-500'
                      }`}
                    >
                      Feminino
                    </button>
                  </div>
                </div>

                {/* Skin Tone */}
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-purple-300 mb-1.5">
                    Cor de Pele
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {SKIN_TONES.map((tone) => (
                      <button
                        key={tone.id}
                        type="button"
                        onClick={() => {
                          soundFX.playClick();
                          setAvatar((p) => ({ ...p, skinTone: tone.hex }));
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                          avatar.skinTone === tone.hex
                            ? 'border-amber-400 bg-[#2e1065] text-white'
                            : 'border-purple-900 bg-[#120726] text-purple-200 hover:border-purple-500'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full border border-black/40 shrink-0"
                          style={{ backgroundColor: tone.hex }}
                        />
                        <span>{tone.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hair Color */}
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-purple-300 mb-1.5">
                    Cor do Cabelo
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {HAIR_COLORS.map((hc) => (
                      <button
                        key={hc.id}
                        type="button"
                        onClick={() => {
                          soundFX.playClick();
                          setAvatar((p) => ({ ...p, hairColor: hc.hex }));
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                          avatar.hairColor === hc.hex
                            ? 'border-amber-400 bg-[#2e1065] text-white'
                            : 'border-purple-900 bg-[#120726] text-purple-200 hover:border-purple-500'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                          style={{ backgroundColor: hc.hex }}
                        />
                        <span>{hc.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name & Bio */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-purple-200 mb-1">
                      Nome no OASIS
                    </label>
                    <input
                      type="text"
                      maxLength={18}
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setErrorMsg('');
                      }}
                      placeholder="Ex: MagnuS"
                      className="w-full px-3 py-2 rounded-xl bg-[#100622] border border-[#5b21b6] text-white text-xs sm:text-sm focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-purple-200 mb-1">
                      Frase de Perfil
                    </label>
                    <input
                      type="text"
                      maxLength={70}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Ex: Bora trocar móveis!"
                      className="w-full px-3 py-2 rounded-xl bg-[#100622] border border-[#5b21b6] text-slate-200 text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {errorMsg && <p className="text-xs text-rose-400 font-semibold">{errorMsg}</p>}

                {/* Step 1 Actions */}
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playClick();
                      setStep('roupas');
                    }}
                    className="px-4 py-2.5 rounded-xl bg-[#2a1454] hover:bg-[#3a1d73] border border-purple-400/50 text-purple-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Shirt className="w-4 h-4 text-amber-300" />
                    <span>Escolher Roupas</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSubmit()}
                    className="flex-1 min-w-[160px] py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-pixel text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 shadow-[0_3px_0_#92400e] cursor-pointer"
                  >
                    <span>{isEditing ? 'Salvar Aparência' : 'Entrar no OASIS'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* STEP 2: Dedicated Clothes Screen */}
                <div className="flex items-center gap-2 border-b border-purple-800/60 pb-2.5">
                  {([
                    { id: 'cima', label: 'Parte de Cima' },
                    { id: 'baixo', label: 'Parte de Baixo' },
                    { id: 'calcado', label: 'Calçados' },
                  ] as const).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        soundFX.playClick();
                        setClothCategory(cat.id);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                        clothCategory === cat.id
                          ? 'bg-purple-600 text-white'
                          : 'bg-[#120726] text-purple-300 hover:text-white'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                  {clothCategory === 'cima' &&
                    starterShirts.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          soundFX.playClick();
                          setAvatar((p) => ({ ...p, shirtId: item.id }));
                        }}
                        className={`px-3 py-2.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between cursor-pointer ${
                          avatar.shirtId === item.id
                            ? 'border-amber-400 bg-[#2e1065] text-white'
                            : 'border-purple-900 bg-[#120726] text-purple-200 hover:border-purple-500'
                        }`}
                      >
                        <span className="truncate">{item.name}</span>
                        {item.shape !== 'none' && (
                          <span
                            className="w-4 h-4 rounded border border-white/20 shrink-0"
                            style={{ backgroundColor: item.primaryColor }}
                          />
                        )}
                      </button>
                    ))}

                  {clothCategory === 'baixo' &&
                    starterPants.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          soundFX.playClick();
                          setAvatar((p) => ({ ...p, pantsId: item.id }));
                        }}
                        className={`px-3 py-2.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between cursor-pointer ${
                          avatar.pantsId === item.id
                            ? 'border-amber-400 bg-[#2e1065] text-white'
                            : 'border-purple-900 bg-[#120726] text-purple-200 hover:border-purple-500'
                        }`}
                      >
                        <span className="truncate">{item.name}</span>
                        <span
                          className="w-4 h-4 rounded border border-white/20 shrink-0"
                          style={{ backgroundColor: item.primaryColor }}
                        />
                      </button>
                    ))}

                  {clothCategory === 'calcado' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          soundFX.playClick();
                          setAvatar((p) => ({ ...p, shoesId: null }));
                        }}
                        className={`px-3 py-2.5 rounded-xl border text-left text-xs font-semibold cursor-pointer ${
                          avatar.shoesId === null
                            ? 'border-amber-400 bg-[#2e1065] text-white'
                            : 'border-purple-900 bg-[#120726] text-purple-200 hover:border-purple-500'
                        }`}
                      >
                        Descalço
                      </button>
                      {starterShoes.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            soundFX.playClick();
                            setAvatar((p) => ({ ...p, shoesId: item.id }));
                          }}
                          className={`px-3 py-2.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between cursor-pointer ${
                            avatar.shoesId === item.id
                              ? 'border-amber-400 bg-[#2e1065] text-white'
                              : 'border-purple-900 bg-[#120726] text-purple-200 hover:border-purple-500'
                          }`}
                        >
                          <span className="truncate">{item.name}</span>
                          <span
                            className="w-4 h-4 rounded border border-white/20 shrink-0"
                            style={{ backgroundColor: item.primaryColor }}
                          />
                        </button>
                      ))}
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-purple-300/90 bg-[#120726]/70 border border-purple-900/60 rounded-lg px-3 py-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    Você começa com 450 moedas, 15 gemas e móveis iniciais para personalizar seu
                    espaço.
                  </span>
                </div>

                {/* Step 2 Actions */}
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playClick();
                      setStep('aparencia');
                    }}
                    className="px-3.5 py-2.5 rounded-xl bg-[#120726] hover:bg-[#231048] border border-purple-700 text-purple-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Voltar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSubmit()}
                    className="flex-1 min-w-[160px] py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-pixel text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 shadow-[0_3px_0_#92400e] cursor-pointer"
                  >
                    <span>{isEditing ? 'Salvar Aparência' : 'Entrar no OASIS'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
