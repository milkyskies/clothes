import { type Draft, type Panel, panelBounds } from "./draft"

/**
 * A piece as the scissors meet it: a width across the bolt and a length along
 * it. Cloth has a grain, so a piece is never turned sideways to make it fit.
 */
export interface Piece {
	readonly panelId: string
	readonly name: string
	readonly across: number
	readonly along: number
	readonly quantity: number
	readonly onFold: boolean
}

export interface Placement {
	readonly piece: Piece
	readonly copy: number
	readonly across: number
	readonly along: number
}

export interface CuttingLayout {
	readonly width: number
	readonly placements: readonly Placement[]
	/** Metres of cloth to buy, in centimetres. */
	readonly length: number
	/** Pieces wider than the cloth, which no arrangement can fit. */
	readonly tooWide: readonly Piece[]
	/** How much of the used cloth ends up in a piece. */
	readonly efficiency: number
}

export function pieceOf(panel: Panel): Piece {
	const bounds = panelBounds(panel)

	return {
		panelId: panel.id,
		name: panel.name,
		across: Number(bounds.width.toFixed(1)),
		along: Number(bounds.height.toFixed(1)),
		quantity: Math.max(1, Math.round(panel.quantity)),
		onFold: panel.foldEdge !== undefined,
	}
}

/** The 寸法表: every piece to cut, largest first. */
export function pieces(draft: Draft): Piece[] {
	return draft.panels
		.map(pieceOf)
		.sort((left, right) => right.across * right.along - left.across * left.along)
}

interface Shelf {
	readonly along: number
	readonly height: number
	used: number
}

/**
 * Lays the pieces out on the cloth, filling one row across before starting the
 * next.
 *
 * 裁ち方図 is drawn this way by hand for the same reason: cuts that run straight
 * across the full width are the ones you can make with the cloth still folded,
 * and the leftover ends up in one usable piece at the end rather than as scraps
 * between the parts.
 */
export function cuttingLayout(draft: Draft): CuttingLayout {
	const width = draft.fabric.width
	const all = pieces(draft)
	const tooWide = all.filter((piece) => piece.across > width + 0.01)

	// Longest first, so the piece that opens a row is always the longest in it and
	// no later piece can push the rows below it further down the cloth.
	const instances = all
		.filter((piece) => piece.across <= width + 0.01)
		.flatMap((piece) => Array.from({ length: piece.quantity }, (_, copy) => ({ piece, copy })))
		.sort((left, right) => right.piece.along - left.piece.along)

	const shelves: Shelf[] = []
	const placements: Placement[] = []

	let cursor = 0

	for (const instance of instances) {
		const shelf = shelves.find((entry) => entry.used + instance.piece.across <= width + 0.01)

		if (shelf !== undefined) {
			placements.push({ ...instance, across: shelf.used, along: shelf.along })

			shelf.used = shelf.used + instance.piece.across

			continue
		}

		const opened: Shelf = {
			along: cursor,
			height: instance.piece.along,
			used: instance.piece.across,
		}

		cursor += instance.piece.along
		shelves.push(opened)
		placements.push({ ...instance, across: 0, along: opened.along })
	}

	const used = placements.reduce(
		(total, entry) => total + entry.piece.across * entry.piece.along,
		0,
	)

	return {
		width,
		placements,
		length: Number(cursor.toFixed(1)),
		tooWide,
		efficiency: cursor <= 0 ? 0 : used / (cursor * width),
	}
}
