import type { Vertex } from "./geometry/measure"
import { boundingBox, offsetPath } from "./geometry/offset"
import type { Fabric, Panel } from "./model"

export interface CutPiece {
	readonly panelId: string
	readonly name: string
	readonly copy: number
	readonly outline: readonly Vertex[]
	readonly width: number
	readonly height: number
}

export interface Placement {
	readonly piece: CutPiece
	readonly x: number
	readonly y: number
}

export interface Layout {
	readonly placements: readonly Placement[]
	readonly usedLength: number
	readonly overWidth: readonly string[]
}

export function cutPieces(panels: readonly Panel[]): CutPiece[] {
	const pieces: CutPiece[] = []

	for (const panel of panels) {
		const outline = offsetPath(panel.outline, panel.allowance)
		const box = boundingBox(outline)

		for (let copy = 1; copy <= panel.quantity; copy += 1) {
			pieces.push({
				panelId: panel.id,
				name: panel.name,
				copy,
				outline,
				width: box.width,
				height: box.height,
			})
		}
	}

	return pieces
}

/**
 * Shelf packing across the bolt width, tallest first.
 *
 * Grain runs along the bolt on every piece, so pieces are never rotated — on a
 * visible weave a crosswise piece reads as a different cloth.
 */
export function nest(panels: readonly Panel[], fabric: Fabric): Layout {
	const pieces = [...cutPieces(panels)].sort((a, b) => b.height - a.height)

	const placements: Placement[] = []
	const overWidth: string[] = []

	let shelfY = 0
	let shelfHeight = 0
	let cursorX = 0

	for (const piece of pieces) {
		if (piece.width > fabric.width) {
			overWidth.push(piece.name)
			continue
		}

		if (cursorX + piece.width > fabric.width) {
			shelfY += shelfHeight
			shelfHeight = 0
			cursorX = 0
		}

		placements.push({ piece, x: cursorX, y: shelfY })

		cursorX += piece.width
		shelfHeight = Math.max(shelfHeight, piece.height)
	}

	return { placements, usedLength: shelfY + shelfHeight, overWidth }
}
