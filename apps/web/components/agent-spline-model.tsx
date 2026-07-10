"use client"

import dynamic from "next/dynamic"
import { useState } from "react"

const Spline = dynamic(() => import("@splinetool/react-spline"), {
  ssr: false,
})

const AGENT_SCENE_URL =
  "https://prod.spline.design/ULW-5X4laAiO8UFv/scene.splinecode"

export function AgentSplineModel({
  onLoad,
}: {
  onLoad?: () => void
}) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div
      className="absolute left-1/2 top-1/2 h-[420px] w-[220px] -translate-x-1/2 -translate-y-[43%] transition-opacity duration-700"
      style={{ opacity: loaded ? 1 : 0 }}
    >
      <Spline
        scene={AGENT_SCENE_URL}
        className="h-full w-full"
        onLoad={() => {
          setLoaded(true)
          onLoad?.()
        }}
      />
    </div>
  )
}
