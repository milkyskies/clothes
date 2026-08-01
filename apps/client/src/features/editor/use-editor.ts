import { useCallback, useMemo, useState } from "react"
import type { Draft, EdgeRef } from "@/lib/drafting/draft"

export type Tool = "select" | "pen" | "rectangle" | "sew"

/**
 * 製図 shapes the pieces, 組み立て says how they join, 出来上がり shows what that
 * makes and 裁ち方 says what to cut. One drawing seen four ways: the last two are
 * derived, so nothing in them is edited except the width of the cloth.
 */
export type Mode = "draw" | "assemble" | "finished" | "cutting" | "wear"

export interface Selection {
	readonly panelId?: string
	readonly vertexId?: string
	readonly edgeVertexId?: string
	readonly seamId?: string
}

const HISTORY_LIMIT = 200

export interface Editor {
	readonly draft: Draft
	readonly mode: Mode
	readonly tool: Tool
	readonly selection: Selection
	/** The edge waiting for a partner to be sewn to, while 組み立て is mid-gesture. */
	readonly pending: EdgeRef | undefined
	readonly snap: number
	readonly canUndo: boolean
	readonly canRedo: boolean
	readonly setMode: (mode: Mode) => void
	readonly setTool: (tool: Tool) => void
	readonly select: (selection: Selection) => void
	readonly setPending: (edge: EdgeRef | undefined) => void
	readonly setSnap: (snap: number) => void
	/** `coalesce` keeps a drag as a single history entry by replacing the top of the stack. */
	readonly apply: (next: Draft, coalesce?: boolean) => void
	/** Replaces the draft outright and drops history, for opening a different file. */
	readonly load: (next: Draft) => void
	readonly undo: () => void
	readonly redo: () => void
}

export function snapValue(value: number, snap: number): number {
	if (snap <= 0) return Number(value.toFixed(3))

	return Number((Math.round(value / snap) * snap).toFixed(3))
}

export function useEditor(initial: Draft): Editor {
	const [past, setPast] = useState<Draft[]>([])
	const [present, setPresent] = useState(initial)
	const [future, setFuture] = useState<Draft[]>([])

	const [mode, setModeState] = useState<Mode>("draw")
	const [tool, setTool] = useState<Tool>("select")
	const [selection, setSelection] = useState<Selection>({})
	const [pending, setPending] = useState<EdgeRef | undefined>(undefined)
	const [snap, setSnap] = useState(0.5)

	// Selections do not carry across: a point means nothing while assembling, and
	// a seam means nothing while drawing.
	const setMode = useCallback((next: Mode) => {
		setModeState(next)
		setSelection({})
		setPending(undefined)
		setTool("select")
	}, [])

	const apply = useCallback(
		(next: Draft, coalesce = false) => {
			setPast((entries) => {
				if (coalesce && entries.length > 0) return entries

				return [...entries, present].slice(-HISTORY_LIMIT)
			})
			setPresent(next)
			setFuture([])
		},
		[present],
	)

	const load = useCallback((next: Draft) => {
		setPast([])
		setFuture([])
		setPresent(next)
		setSelection({})
	}, [])

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
			draft: present,
			mode,
			tool,
			selection,
			pending,
			snap,
			canUndo: past.length > 0,
			canRedo: future.length > 0,
			setMode,
			setTool,
			select: setSelection,
			setPending,
			setSnap,
			apply,
			load,
			undo,
			redo,
		}),
		[
			apply,
			future.length,
			load,
			mode,
			past.length,
			pending,
			present,
			redo,
			selection,
			setMode,
			snap,
			tool,
			undo,
		],
	)
}
