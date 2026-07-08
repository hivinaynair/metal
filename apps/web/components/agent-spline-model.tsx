"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
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
  onLoad,
}: {
  active: boolean
  blocked: boolean
  onLoad?: () => void
}) {
  const sceneUrl = normalizeSplineSceneUrl(AGENT_SCENE_URL)
  const [loaded, setLoaded] = useState(false)

  if (!sceneUrl) {
    return <AgentFallback active={active} blocked={blocked} />
  }

  return (
    <div
      className="absolute left-1/2 top-1/2 h-[300px] w-[200px] -translate-x-1/2 -translate-y-[50%] scale-80 transition-opacity duration-700"
      style={{ opacity: loaded ? 1 : 0 }}
    >
      <Spline
        scene={sceneUrl}
        className="h-full w-full"
        onLoad={() => {
          setLoaded(true)
          onLoad?.()
        }}
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
          "agent-head absolute left-1/2 top-4 h-12 w-16 -translate-x-1/2 rounded-[1.25rem] border",
          active && "border-accent shadow-glow-positive",
          blocked && "border-destructive shadow-glow-negative"
        )}
      >
        <Bot className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 text-background/70" />
      </div>
      <div className="agent-core absolute bottom-3 left-1/2 h-20 w-20 -translate-x-1/2 rounded-full border border-white/70">
        <span className="absolute left-7 top-5 size-2 rounded-full border border-white/90" />
        <span className="absolute right-7 top-5 size-2 rounded-full border border-white/90" />
      </div>
    </div>
  )
}
