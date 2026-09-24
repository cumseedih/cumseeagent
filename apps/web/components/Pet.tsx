"use client";

import { cx } from "./ui";

export const PETS = [
  { id: "orbit", name: "Orbit", description: "A calm little companion for focused work.", tone: "#536c7a", tint: "#d8e2e2", shape: "round" },
  { id: "sprout", name: "Sprout", description: "A fresh companion for turning ideas into action.", tone: "#6b8160", tint: "#dce8cf", shape: "leaf" },
  { id: "ember", name: "Ember", description: "A bright spark for fast, thoughtful momentum.", tone: "#c56a45", tint: "#f3d1c0", shape: "flare" },
  { id: "moss", name: "Moss", description: "A steady presence for long, deep work.", tone: "#6a7563", tint: "#d9dfd1", shape: "soft" },
  { id: "lumen", name: "Lumen", description: "A curious signal for making the next move clear.", tone: "#537d91", tint: "#d4e5ec", shape: "signal" },
] as const;

export type PetId = (typeof PETS)[number]["id"] | "none";

export function PetGlyph({ id, className = "h-10 w-10", animated = false }: { id: PetId; className?: string; animated?: boolean }) {
  if (id === "none") return null;
  const pet = PETS.find((item) => item.id === id) || PETS[0];
  return <span className={cx("delvin-pet relative inline-grid shrink-0 place-items-center", `delvin-pet--${pet.shape}`, className, animated && "delvin-pet-idle")} style={{ "--pet-tone": pet.tone, "--pet-tint": pet.tint } as React.CSSProperties} aria-hidden="true">
    <span className="delvin-pet__halo" />
    <span className="delvin-pet__body" />
    <span className="delvin-pet__ear delvin-pet__ear--left" />
    <span className="delvin-pet__ear delvin-pet__ear--right" />
    <span className="delvin-pet__face"><i /><i /><b /></span>
  </span>;
}

export function WorkspacePet({ petId }: { petId?: string | null }) {
  if (!petId || petId === "none") return null;
  return <div className="pointer-events-none fixed bottom-[92px] right-4 z-30 hidden select-none sm:block" aria-label="Your Delvin companion">
    <div className="delvin-pet-float relative grid h-[72px] w-[72px] place-items-center rounded-[28px] border border-white/75 bg-white/65 shadow-[0_16px_34px_rgba(46,43,41,0.15)] backdrop-blur-xl">
      <PetGlyph id={petId as PetId} className="h-12 w-12" animated />
    </div>
  </div>;
}
