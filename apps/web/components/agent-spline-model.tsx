"use client"

import dynamic from "next/dynamic"
import { Bot } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

const Spline = dynamic(() => import("@splinetool/react-spline"), {
  ssr: false,
})

const AGENT_SCENE_URL =
  process.env.NEXT_PUBLIC_AGENT_SPLINE_SCENE_URL ??
  "https://prod.spline.design/ULW-5X4laAiO8UFv/scene.splinecode"

function normalizeSplineSceneUrl(url: string) {
  return url.replace(/\/hash\/?$/, "/scene.splinecode")
}

export function AgentSplineModel({
  active,
  blocked,
}: {
  active: boolean
  blocked: boolean
}) {
  const sceneUrl = normalizeSplineSceneUrl(AGENT_SCENE_URL)

  if (!sceneUrl) {
    return <AgentFallback active={active} blocked={blocked} />
  }


  return (
    <div className="absolute left-1/2 top-1/2 h-[300px] w-[200px] -translate-x-1/2 -translate-y-[50%] scale-80">
      <Spline
        scene={sceneUrl}
        className="h-full w-full"
      />
    </div>
  )
}

function AgentFallback({
  active,
  blocked,
}: {
  active: boolean
  blocked: boolean
}) {
  return (
    <div className="relative h-full w-full">
      <div
        className={cn(
          "absolute left-1/2 top-4 h-12 w-16 -translate-x-1/2 rounded-[1.25rem] border bg-[linear-gradient(145deg,#f4f4f4,#b8b8c8)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_18px_rgba(0,0,0,0.25)]",
          active && "border-accent shadow-[0_0_18px_rgba(63,224,208,0.32)]",
          blocked && "border-destructive shadow-[0_0_18px_rgba(239,96,96,0.32)]"
        )}
      >
        <Bot className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 text-background/70" />
      </div>
      <div className="absolute bottom-3 left-1/2 h-20 w-20 -translate-x-1/2 rounded-full border border-white/70 bg-[radial-gradient(circle_at_65%_28%,rgba(255,255,255,0.9),rgba(132,104,255,0.92)_28%,rgba(105,86,228,0.94)_52%,rgba(245,245,245,0.95)_53%)] shadow-[inset_0_0_18px_rgba(255,255,255,0.7),0_16px_24px_rgba(0,0,0,0.24)]">
        <span className="absolute left-7 top-5 size-2 rounded-full border border-white/90" />
        <span className="absolute right-7 top-5 size-2 rounded-full border border-white/90" />
      </div>
    </div>
  )
}
