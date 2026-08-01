import { AddPointIcon } from "@/features/shared/icons/add-point-icon"
import { CutIcon } from "@/features/shared/icons/cut-icon"
import { DeleteIcon } from "@/features/shared/icons/delete-icon"
import { DuplicateIcon } from "@/features/shared/icons/duplicate-icon"
import { flipSeam, removeSeam, seamsOnEdge, setSeamLie } from "@/lib/drafting/assemble"
import { findPanel, findVertex, nextVertex } from "@/lib/drafting/draft"
import {
	deletePanel,
	deleteVertex,
	duplicatePanel,
	insertVertex,
	isCurvedEdge,
	roundCorner,
	setEdgeBow,
	setFoldEdge,
	sharpenCorner,
} from "@/lib/drafting/edit"
import type { Editor } from "./use-editor"

/**
 * Everything that can be done to a thing, in one place.
 *
 * The right-click menu and the bar above the canvas are two ways into the same
 * list rather than two lists that drift apart, and putting the verbs somewhere
 * visible is what stops the editor being a drawing you can only look at.
 */
export interface Action {
	readonly label: string
	readonly icon: typeof CutIcon
	readonly danger?: boolean
	readonly run: () => void
}

export function panelActions(editor: Editor, panelId: string): Action[] {
	return [
		{
			label: "複製",
			icon: DuplicateIcon,
			run: () => editor.apply(duplicatePanel(editor.draft, panelId)),
		},
		{
			label: "消す",
			icon: DeleteIcon,
			danger: true,
			run: () => {
				editor.apply(deletePanel(editor.draft, panelId))
				editor.select({})
			},
		},
	]
}

export function vertexActions(editor: Editor, panelId: string, vertexId: string): Action[] {
	return [
		{
			label: "丸める",
			icon: CutIcon,
			run: () => {
				editor.apply(roundCorner(editor.draft, panelId, vertexId, 0.7))
				editor.select({ panelId })
			},
		},
		{
			label: "点を消す",
			icon: DeleteIcon,
			danger: true,
			run: () => {
				editor.apply(deleteVertex(editor.draft, panelId, vertexId))
				editor.select({ panelId })
			},
		},
		{
			label: "大きく丸める",
			icon: CutIcon,
			run: () => {
				editor.apply(roundCorner(editor.draft, panelId, vertexId, 2))
				editor.select({ panelId })
			},
		},
	]
}

export function edgeActions(editor: Editor, panelId: string, vertexId: string): Action[] {
	const panel = findPanel(editor.draft, panelId)

	if (panel === undefined) return []

	const onFold = panel.foldEdge === vertexId

	const shape: Action[] = isCurvedEdge(panel, vertexId)
		? [
				{
					label: "まっすぐにする",
					icon: CutIcon,
					run: () => editor.apply(setEdgeBow(editor.draft, panelId, vertexId, 0)),
				},
				{
					label: "角に戻す",
					icon: CutIcon,
					run: () => {
						editor.apply(sharpenCorner(editor.draft, panelId, vertexId))
						editor.select({ panelId })
					},
				},
			]
		: [
				{
					label: "ふくらませる",
					icon: CutIcon,
					run: () => editor.apply(setEdgeBow(editor.draft, panelId, vertexId, 1)),
				},
			]

	return [
		...shape,
		{
			label: "点を足す",
			icon: AddPointIcon,
			run: () => {
				const from = findVertex(panel, vertexId)
				const to = nextVertex(panel, vertexId)

				if (from === undefined || to === undefined) return

				editor.apply(
					insertVertex(editor.draft, panelId, vertexId, (from.x + to.x) / 2, (from.y + to.y) / 2),
				)
			},
		},
		{
			label: onFold ? "わをやめる" : "わにする",
			icon: CutIcon,
			run: () => editor.apply(setFoldEdge(editor.draft, panelId, onFold ? undefined : vertexId)),
		},
	]
}

export function seamActions(editor: Editor, seamId: string): Action[] {
	const seam = editor.draft.seams.find((entry) => entry.id === seamId)

	if (seam === undefined) return []

	return [
		{
			label: "ほどく",
			icon: DeleteIcon,
			danger: true,
			run: () => {
				editor.apply(removeSeam(editor.draft, seamId))
				editor.select({})
			},
		},
		{
			label: "向きを反転",
			icon: CutIcon,
			run: () => editor.apply(flipSeam(editor.draft, seamId)),
		},
		{
			label: seam.lie === "fold" ? "開く" : "折る",
			icon: CutIcon,
			run: () =>
				editor.apply(setSeamLie(editor.draft, seamId, seam.lie === "fold" ? "open" : "fold")),
		},
	]
}

/** What the thing currently selected can have done to it, and what to call it. */
export function selectionActions(editor: Editor): { title: string; actions: Action[] } {
	const { draft, selection } = editor

	if (editor.mode === "assemble") {
		if (selection.seamId !== undefined) {
			const seam = draft.seams.find((entry) => entry.id === selection.seamId)

			return { title: seam?.name ?? "縫い", actions: seamActions(editor, selection.seamId) }
		}

		if (selection.panelId === undefined || selection.edgeVertexId === undefined) {
			return { title: "", actions: [] }
		}

		const edge = { panelId: selection.panelId, vertexId: selection.edgeVertexId }
		const held = seamsOnEdge(draft, edge)
		const name = findPanel(draft, selection.panelId)?.name ?? "辺"

		const first = held[0]

		if (first === undefined) {
			return {
				title: `${name} の辺`,
				actions: [{ label: "ここから縫う", icon: CutIcon, run: () => editor.setPending(edge) }],
			}
		}

		// The verbs act on one seam, never on every seam this edge carries: a
		// collar edge holds four of them, and three buttons each is a wall.
		const more = held.length === 1 ? "" : `・ほか${held.length - 1}本`

		return {
			title: `${first.name}${more}`,
			actions: seamActions(editor, first.id),
		}
	}

	if (selection.panelId === undefined) return { title: "", actions: [] }

	const panel = findPanel(draft, selection.panelId)

	if (panel === undefined) return { title: "", actions: [] }

	if (selection.vertexId !== undefined) {
		return {
			title: `${panel.name} の点`,
			actions: vertexActions(editor, selection.panelId, selection.vertexId),
		}
	}

	if (selection.edgeVertexId !== undefined) {
		return {
			title: `${panel.name} の辺`,
			actions: edgeActions(editor, selection.panelId, selection.edgeVertexId),
		}
	}

	return { title: panel.name, actions: panelActions(editor, selection.panelId) }
}
