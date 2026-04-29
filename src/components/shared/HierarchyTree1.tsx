/**
 * HierarchyTree1 — recursive tree component untuk UPT → ULTG → GI → Bay.
 * Reusable. Konsumsi dari /api/data-sources/ss-v5/hierarchy-tree.
 */
"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Building2, MapPin, Zap, Layers } from "lucide-react";

export interface HierarchyNode {
  id: string;
  name: string;
  level: "upt" | "ultg" | "gi" | "bay";
  meta?: Record<string, unknown>;
  stats?: {
    ultg_count?: number;
    gi_count?: number;
    bay_count?: number;
  };
  children?: HierarchyNode[];
}

interface HierarchyTree1Props {
  data: HierarchyNode[];
  onNodeClick?: (node: HierarchyNode) => void;
  expandedByDefault?: "none" | "first-level" | "all";
  variant?: "compact" | "full";
}

const LEVEL_ICON = {
  upt: Building2,
  ultg: MapPin,
  gi: Zap,
  bay: Layers,
};

const LEVEL_COLOR = {
  upt: "text-blue-400",
  ultg: "text-cyan-400",
  gi: "text-emerald-400",
  bay: "text-amber-400",
};

function TreeNode({
  node,
  depth,
  expandedByDefault,
  onNodeClick,
  variant,
}: {
  node: HierarchyNode;
  depth: number;
  expandedByDefault: "none" | "first-level" | "all";
  onNodeClick?: (n: HierarchyNode) => void;
  variant: "compact" | "full";
}) {
  const shouldExpand =
    expandedByDefault === "all" ||
    (expandedByDefault === "first-level" && depth === 0);
  const [expanded, setExpanded] = useState(shouldExpand);
  const hasChildren = node.children && node.children.length > 0;
  const Icon = LEVEL_ICON[node.level];
  const colorClass = LEVEL_COLOR[node.level];

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (hasChildren) setExpanded((e) => !e);
          onNodeClick?.(node);
        }}
        className={`ds-transition flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/40 ${
          depth > 0 ? "ml-4" : ""
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="w-3.5" />
        )}
        <Icon className={`h-4 w-4 shrink-0 ${colorClass}`} />
        <span className="ds-body flex-1 truncate font-medium">{node.name}</span>
        {variant === "full" && node.stats && (
          <span className="ds-small shrink-0 text-muted-foreground">
            {node.stats.ultg_count !== undefined && `${node.stats.ultg_count} ULTG · `}
            {node.stats.gi_count !== undefined && `${node.stats.gi_count} GI · `}
            {node.stats.bay_count !== undefined && `${node.stats.bay_count} Bay`}
          </span>
        )}
      </button>
      {expanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedByDefault={expandedByDefault}
              onNodeClick={onNodeClick}
              variant={variant}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function HierarchyTree1({
  data,
  onNodeClick,
  expandedByDefault = "first-level",
  variant = "full",
}: HierarchyTree1Props) {
  if (!data || data.length === 0) {
    return (
      <div className="ds-small py-4 text-center text-muted-foreground">
        Belum ada data hierarchy
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {data.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          depth={0}
          expandedByDefault={expandedByDefault}
          onNodeClick={onNodeClick}
          variant={variant}
        />
      ))}
    </div>
  );
}
