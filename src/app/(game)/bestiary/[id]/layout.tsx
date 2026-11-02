import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ELEMENT_NAMES } from "@/lib/game/elements";
import { getSpecies } from "@/lib/game/species";

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const species = getSpecies(Number(id));
  if (!species) return { title: "Species not found" };

  const title = `${species.name} — bestiary`;
  const description = `${species.name} · Lv ${species.level} · ${ELEMENT_NAMES[species.element]} ${species.elementLevel} · ${species.raceName}. Stats, skill kit and spawn maps.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [
        `https://static.divine-pride.net/images/mobs/png/${species.id}.png`,
      ],
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function SpeciesLayout({ params, children }: Props) {
  const { id } = await params;
  const species = getSpecies(Number(id));
  if (!species || !species.playable) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Thing",
    name: species.name,
    identifier: species.id,
    description: `${species.name}, a ${species.raceName} monster from Ragnarok Online.`,
    additionalType: "https://schema.org/VideoGame",
  };

  return (
    <>
      {children}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
