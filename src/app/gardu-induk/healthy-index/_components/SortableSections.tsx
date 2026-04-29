/**
 * SortableSections — drag-to-reorder wrapper for dashboard sections.
 * Uses @dnd-kit to let users rearrange section order.
 * Order persists in localStorage.
 */
"use client";

import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import {
    type ReactNode,
    useCallback,
    useState,
    useEffect,
} from "react";

const STORAGE_KEY = "hi-mtu-section-order";

export interface SectionDef {
    id: string;
    label: string;
    node: ReactNode;
}

/* ── Single sortable item ── */
function SortableItem({ id, children }: { id: string; children: ReactNode }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.7 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="relative group">
            {/* drag handle */}
            <button
                type="button"
                className="absolute -left-1 top-1/2 -translate-y-1/2 -translate-x-full 
                           opacity-0 group-hover:opacity-60 hover:!opacity-100
                           transition-opacity cursor-grab active:cursor-grabbing
                           p-0.5 rounded-sm text-muted-foreground"
                {...attributes}
                {...listeners}
            >
                <GripVertical className="h-4 w-4" />
            </button>
            {children}
        </div>
    );
}

/* ── Main export ── */
export function SortableSections({ sections }: { sections: SectionDef[] }) {
    const defaultOrder = sections.map((s) => s.id);

    const [order, setOrder] = useState<string[]>(defaultOrder);

    /* hydrate from localStorage */
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved) as string[];
                /* only use saved order if it contains exactly the same IDs */
                const valid =
                    parsed.length === defaultOrder.length &&
                    defaultOrder.every((id) => parsed.includes(id));
                if (valid) setOrder(parsed);
            }
        } catch {
            /* ignore */
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;
            if (!over || active.id === over.id) return;
            setOrder((prev) => {
                const oldIdx = prev.indexOf(String(active.id));
                const newIdx = prev.indexOf(String(over.id));
                const next = [...prev];
                next.splice(oldIdx, 1);
                next.splice(newIdx, 0, String(active.id));
                localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
                return next;
            });
        },
        [],
    );

    const sectionMap = new Map(sections.map((s) => [s.id, s]));
    const sorted = order.map((id) => sectionMap.get(id)).filter(Boolean) as SectionDef[];

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={order} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                    {sorted.map((s, i) => (
                        <SortableItem key={s.id} id={s.id}>
                            <div className={`section-reveal section-reveal-${i + 1}`}>
                                {s.node}
                            </div>
                        </SortableItem>
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    );
}
