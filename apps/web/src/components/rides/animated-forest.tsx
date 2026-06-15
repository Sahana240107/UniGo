"use client";

// FILE LOCATION: apps/web/src/components/rides/animated-forest.tsx
//
// Renders 1 tree per ride (capped at MAX_TREES). Trees are real animated SVGs:
//  - New trees (count increases) grow up from the ground with a staggered delay
//  - Removed trees (count decreases, e.g. a completed ride gets disputed/reversed)
//    shrink + fade out before being removed from the DOM
//
// Driven entirely by `count`, which the parent page derives from live
// Supabase data (impact_summary.total_rides). No mock data.

import { useEffect, useRef, useState } from "react";

export const MAX_TREES = 15;

const TREE_CONFIGS = [
  { h: 56, color: "#2E7D32" }, { h: 70, color: "#388E3C" },
  { h: 48, color: "#1B5E20" }, { h: 64, color: "#43A047" },
  { h: 76, color: "#2E7D32" }, { h: 52, color: "#33691E" },
  { h: 60, color: "#388E3C" }, { h: 44, color: "#1B5E20" },
  { h: 80, color: "#43A047" }, { h: 56, color: "#2E7D32" },
  { h: 68, color: "#33691E" }, { h: 50, color: "#388E3C" },
  { h: 58, color: "#1B5E20" }, { h: 72, color: "#43A047" },
  { h: 54, color: "#2E7D32" },
];

type TreeState = "growing" | "settled" | "leaving";

interface TreeEntry {
  id: number;       // stable identity = slot index (0..count-1 at creation time)
  cfg: { h: number; color: string };
  state: TreeState;
}

function Tree({ height, color, state, delay }: { height: number; color: string; state: TreeState; delay: number }) {
  const trunkH = Math.round(height * 0.28);
  const canopyH = height - trunkH;
  const canopyW = Math.round(height * 0.78);

  // 'growing' -> animate scaleY/opacity in. 'leaving' -> animate out. 'settled' -> at rest.
  const animClass =
    state === "growing" ? "tree-grow" : state === "leaving" ? "tree-leave" : "";

  return (
    <div
      className={`flex flex-col items-center justify-end ${animClass}`}
      style={{
        width: canopyW,
        height,
        animationDelay: state === "growing" ? `${delay}ms` : "0ms",
        transformOrigin: "bottom center",
      }}
    >
      <svg width={canopyW} height={canopyH + 4} viewBox={`0 0 ${canopyW} ${canopyH + 4}`} className="block">
        {/* upper canopy */}
        <polygon
          points={`${canopyW / 2},0 ${canopyW * 0.81},${canopyH * 0.55} ${canopyW * 0.19},${canopyH * 0.55}`}
          fill={color}
        />
        {/* lower canopy */}
        <polygon
          points={`${canopyW / 2},${canopyH * 0.32} ${canopyW},${canopyH} 0,${canopyH}`}
          fill={color}
          opacity={0.8}
        />
      </svg>
      <div style={{ width: 6, height: trunkH, backgroundColor: "#5D4037", borderRadius: 2 }} />
    </div>
  );
}

export default function AnimatedForest({ count }: { count: number }) {
  const capped = Math.max(0, Math.min(count, MAX_TREES));
  const [trees, setTrees] = useState<TreeEntry[]>([]);
  const nextIdRef = useRef(0);
  const prevCountRef = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevCountRef.current;

    if (prev === null) {
      // Initial mount: render all trees as "growing" with stagger
      const initial: TreeEntry[] = Array.from({ length: capped }).map((_, i) => ({
        id: nextIdRef.current++,
        cfg: TREE_CONFIGS[i % TREE_CONFIGS.length],
        state: "growing" as TreeState,
      }));
      setTrees(initial);
      const t = setTimeout(() => {
        setTrees((cur) => cur.map((tr) => ({ ...tr, state: "settled" })));
      }, capped * 90 + 500);
      prevCountRef.current = capped;
      return () => clearTimeout(t);
    }

    if (capped > prev) {
      // Grow new trees on top
      const additions: TreeEntry[] = Array.from({ length: capped - prev }).map((_, i) => ({
        id: nextIdRef.current++,
        cfg: TREE_CONFIGS[(prev + i) % TREE_CONFIGS.length],
        state: "growing" as TreeState,
      }));
      setTrees((cur) => [...cur, ...additions]);
      const t = setTimeout(() => {
        setTrees((cur) => cur.map((tr) => (tr.state === "growing" ? { ...tr, state: "settled" } : tr)));
      }, additions.length * 90 + 500);
      prevCountRef.current = capped;
      return () => clearTimeout(t);
    }

    if (capped < prev) {
      // Mark the trailing trees as leaving, then remove after animation
      setTrees((cur) =>
        cur.map((tr, i) => (i >= capped ? { ...tr, state: "leaving" as TreeState } : tr))
      );
      const t = setTimeout(() => {
        setTrees((cur) => cur.slice(0, capped));
      }, 450);
      prevCountRef.current = capped;
      return () => clearTimeout(t);
    }

    prevCountRef.current = capped;
  }, [capped]);

  return (
    <>
      <style>{`
        @keyframes treeGrow {
          from { transform: scaleY(0) scaleX(0.6); opacity: 0; }
          to   { transform: scaleY(1) scaleX(1);    opacity: 1; }
        }
        @keyframes treeLeave {
          from { transform: scaleY(1) scaleX(1);    opacity: 1; }
          to   { transform: scaleY(0) scaleX(0.6);  opacity: 0; }
        }
        .tree-grow  { animation: treeGrow 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
        .tree-leave { animation: treeLeave 0.45s cubic-bezier(0.4, 0, 0.6, 1) both; }
      `}</style>

      {trees.length === 0 ? (
        <p className="flex h-20 items-center justify-center text-3xl">🌱</p>
      ) : (
        <div className="flex min-h-[80px] flex-wrap items-end justify-center gap-1">
          {trees.map((tr) => (
            <Tree key={tr.id} height={tr.cfg.h} color={tr.cfg.color} state={tr.state} delay={tr.id * 90} />
          ))}
        </div>
      )}
    </>
  );
}