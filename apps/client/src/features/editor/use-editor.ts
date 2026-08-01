import { useCallback, useMemo, useState } from "react"
import type { Document } from "@/lib/drafting/document"

export type Tool = "select" | "pen" | "rectangle" | "seam"

export interface Selection {
	readonly panelId?: string
	readonly vertexId?: string
	readonly edgeVertexId?: string
	readonly seamId?: string
}

const HISTORY_LIMIT = 200

export interface Editor {
	readonly document: Document
	readonly tool: Tool
	readonly selection: Selection
	readonly snap: number
	readonly canUndo: boolean
	readonly canRedo: boolean
	readonly setTool: (tool: Tool) => void
	readonly select: (selection: Selection) => void
	readonly setSnap: (snap: number) => void
	/** `coalesce` keeps a drag as a single history entry by replacing the top of the stack. */
	readonly apply: (next: Document, coalesce?: boolean) => void
	readonly undo: () => void
	readonly redo: () => void
}

export function snapValue(value: number, snap: number): number {
	if (snap <= 0) return Number(value.toFixed(3))

	return Number((Math.round(value / snap) * snap).toFixed(3))
}

export function useEditor(initial: Document): Editor {
	const [past, setPast] = useState<Document[]>([])
	const [present, setPresent] = useState(initial)
	const [future, setFuture] = useState<Document[]>([])

	const [tool, setTool] = useState<Tool>("select")
	const [selection, setSelection] = useState<Selection>({})
	const [snap, setSnap] = useState(0.5)

	const apply = useCallback(
		(next: Document, coalesce = false) => {
			setPast((entries) => {
				if (coalesce && entries.length > 0) return entries

				return [...entries, present].slice(-HISTORY_LIMIT)
			})
			setPresent(next)
			setFuture([])
		},
		[present],
	)

	const undo = useCallback(() => {
		setPast((entries) => {
			const previous = entries[entries.length - 1]

			if (previous === undefined) return entries

			setFuture((ahead) => [present, ...ahead])
			setPresent(previous)

			return entries.slice(0, -1)
		})
	}, [present])

	const redo = useCallback(() => {
		setFuture((entries) => {
			const [next, ...rest] = entries

			if (next === undefined) return entries

			setPast((behind) => [...behind, present])
			setPresent(next)

			return rest
		})
	}, [present])

	return useMemo(
		() => ({
			document: present,
			tool,
			selection,
			snap,
			canUndo: past.length > 0,
			canRedo: future.length > 0,
			setTool,
			select: setSelection,
			setSnap,
			apply,
			undo,
			redo,
		}),
		[apply, future.length, past.length, present, redo, selection, snap, tool, undo],
	)
}
