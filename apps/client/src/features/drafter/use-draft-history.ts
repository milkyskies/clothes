import { useCallback, useEffect, useRef, useState } from "react"
import type { DraftSearch } from "./use-draft-state"

const COALESCE_MS = 450
const MAX_ENTRIES = 100

export interface DraftHistory {
	readonly canUndo: boolean
	readonly canRedo: boolean
	readonly undo: () => void
	readonly redo: () => void
}

function sameSearch(a: DraftSearch, b: DraftSearch): boolean {
	const keys = Object.keys(a)

	for (const key of keys) {
		if (Object.is(Reflect.get(a, key), Reflect.get(b, key))) continue

		return false
	}

	return true
}

/**
 * Snapshot history over the search state.
 *
 * Entries are committed only after the value has been still for a moment, so a
 * drag across the canvas collapses into one undo step instead of sixty.
 */
export function useDraftHistory(
	search: DraftSearch,
	apply: (next: DraftSearch) => void,
): DraftHistory {
	const entries = useRef<DraftSearch[]>([search])
	const index = useRef(0)
	const travelling = useRef(false)
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

	const [, bumpVersion] = useState(0)

	const refresh = useCallback(() => bumpVersion((version) => version + 1), [])

	useEffect(() => {
		if (travelling.current) {
			travelling.current = false
			return
		}

		const current = entries.current[index.current]

		if (current !== undefined && sameSearch(current, search)) return

		clearTimeout(timer.current)

		timer.current = setTimeout(() => {
			entries.current = [...entries.current.slice(0, index.current + 1), search].slice(-MAX_ENTRIES)
			index.current = entries.current.length - 1
			refresh()
		}, COALESCE_MS)

		return () => clearTimeout(timer.current)
	}, [search, refresh])

	const travel = useCallback(
		(delta: number) => {
			clearTimeout(timer.current)

			const target = index.current + delta
			const entry = entries.current[target]

			if (entry === undefined) return

			index.current = target
			travelling.current = true
			apply(entry)
			refresh()
		},
		[apply, refresh],
	)

	return {
		canUndo: index.current > 0,
		canRedo: index.current < entries.current.length - 1,
		undo: useCallback(() => travel(-1), [travel]),
		redo: useCallback(() => travel(1), [travel]),
	}
}
