import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LandingPage from "@/app/page";
import { MotionStage, type MotionDirection } from "@/features/landing/motion/motion-stage";

/**
 * Prévia interna das direções de movimento da landing (Epic 16 · S1, Fase 1).
 * Mesma landing da "/", com a direção aplicada por cima. Nunca em produção.
 * Specs: docs/landing-motion/direcao-<nome>.md
 */
const DIRECTIONS: MotionDirection[] = ["navalha", "letreiro", "cinema"];

export const metadata: Metadata = {
  title: "Prévia de movimento — landing",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

// Sempre no servidor, para a guarda de produção valer em todo request.
export const dynamic = "force-dynamic";

export default async function LandingMotionPreview({ params }: { params: Promise<{ nome: string }> }) {
  if (process.env.VERCEL_ENV === "production") notFound();
  const { nome } = await params;
  if (!DIRECTIONS.includes(nome as MotionDirection)) notFound();

  return (
    <MotionStage direction={nome as MotionDirection}>
      <LandingPage />
    </MotionStage>
  );
}
