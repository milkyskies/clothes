import type { Draft } from "../draft"
import { jinbeiTop } from "./jinbei"

export interface TemplateEntry {
	readonly id: string
	readonly name: string
	readonly note: string
	readonly build: () => Draft
}

function blank(): Draft {
	return {
		id: "blank",
		name: "名前のない型",
		panels: [],
		seams: [],
		stitches: [],
		annotations: [],
		body: { chest: 96, height: 170, shoulderWidth: 46, armLength: 58 },
		fabric: { name: "広幅", width: 110 },
	}
}

/**
 * The named garments live here, as saved drawings.
 *
 * 身八つ口, 剣先 and 掛襟 are words a template's author typed onto its edges, so
 * adding a garment to this list is authoring a document rather than teaching the
 * editor a new kind of thing.
 */
export const TEMPLATES: readonly TemplateEntry[] = [
	{ id: "blank", name: "白紙", note: "なにもないところから", build: blank },
	{
		id: "jinbei-top-m",
		name: "甚平（上）M",
		note: "身頃・そで・えり・ひも",
		build: jinbeiTop,
	},
]
