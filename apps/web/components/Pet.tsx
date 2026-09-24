"use client";

import { cx } from "./ui";

export const PETS = [
  { id: "orbit", name: "Orbit", description: "A quiet signal keeper for focused work.", tone: "bg-[#5b78df]", face: "◕‿◕" },
  { id: "sprout", name: "Sprout", description: "A small green spark for new ideas.", tone: "bg-[#65a966]", face: "•ᴗ•" },
  { id: "ember", name: "Ember", description: "Warm momentum for fast iterations.", tone: "bg-[#e57d4c]", face: "ᵔᴗᵔ" },
  { id: "moss", name: "Moss", description: "A calm companion for deep work.", tone: "bg-[#70836b]", face: "˶ᵔ ᵕ ᵔ˶" },
  { id: "lumen", name: "Lumen", description: "A soft light when work gets complex.", tone: "bg-[#5ba9c9]", face: "⌒‿⌒" },
] as const;

export type PetId = (typeof PETS)[number]["id"] | "none";

export function PetGlyph({ id, className = "h-10 w-10", animated = false }: { id: PetId; className?: string; animated?: boolean }) {
  if (id === "none") return null;
  const pet = PETS.find((item) => item.id === id) || PETS[0];
  return <span className={cx("relative inline-grid shrink-0 place-items-center", className, animated && "delvin-pet-idle")} aria-hidden="true">
    <span className={cx("absolute inset-[14%] rounded-[38%_38%_44%_44%] border-2 border-[#2e2b29]/25 shadow-[inset_0_-5px_0_rgba(0,0,0,0.08)]", pet.tone)} />
    <span className="relative z-10 translate-y-[2%] whitespace-nowrap font-mono text-[0.42em] font-bold tracking-[-0.14em] text-white">{pet.face}</span>
    <span className={cx("absolute -top-[1%] h-[25%] w-[12%] rounded-full", pet.tone)} />
    <span className={cx("absolute bottom-[2%] left-[7%] h-[17%] w-[28%] rounded-full", pet.tone)} />
    <span className={cx("absolute bottom-[2%] right-[7%] h-[17%] w-[28%] rounded-full", pet.tone)} />
  </span>;
}

export function WorkspacePet({ petId }: { petId?: string | null }) {
  if (!petId || petId === "none") return null;
  return <div className="pointer-events-none fixed bottom-[92px] right-4 z-30 hidden select-none sm:block" aria-label="Your Delvin companion">
    <div className="delvin-pet-float relative grid h-16 w-16 place-items-center rounded-[24px] border border-white/65 bg-white/55 shadow-[0_12px_28px_rgba(46,43,41,0.14)] backdrop-blur-xl">
      <PetGlyph id={petId as PetId} className="h-12 w-12" animated />
    </div>
  </div>;
}
