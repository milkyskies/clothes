import type { Document, Panel, Seam, Vertex } from "../document"

/**
 * 甚平（上）, M size, taken from a commercial 製図 whose figures are 縫い代込み.
 * The outline is therefore the line the cloth is cut on, as in 「布に直接線を描
 * いて生地をカット」; stitching lines are marked inside the piece afterwards.
 *
 * Nothing here is special to the tool. It is panels, seams and labels, and any
 * of it can be dragged, renamed or deleted.
 */

const BODY_LENGTH = 83.5
const SHOULDER = 23
/**
 * The 製図 prints 0.7 against the 衿ぐり corner: the gap between the sharp corner
 * and the curve. A quarter-round clears its corner by r·(√2−1), so that gap
 * gives a radius of about 1.7cm, and the notch runs flat until the last stretch.
 */
const NECK_CORNER_GAP = 0.7
const NECK_RADIUS = NECK_CORNER_GAP / (Math.SQRT2 - 1)

/** A quarter circle drawn as one cubic sits 1−√2/2 of its radius off the chord. */
const QUARTER_DEPTH = 1 - Math.SQRT1_2

function vertices(points: readonly (readonly [string, number, number])[]): Vertex[] {
	return points.map(([id, x, y]) => ({ id, x, y }))
}

const front: Panel = {
	id: "mae-migoro",
	name: "前身頃",
	quantity: 2,
	x: 0,
	y: 0,
	vertices: vertices([
		["mae-kata", 20, 0],
		["mae-katasaki", 43, 0],
		["mae-suso-migi", 43, BODY_LENGTH],
		["mae-suso-hidari", 0, BODY_LENGTH],
		["mae-maebiraki", 0, 58.5],
		["mae-dan", 2, 58.5],
	]),
}

const back: Panel = {
	id: "ushiro-migoro",
	name: "後ろ身頃",
	quantity: 2,
	x: 53,
	y: 0,
	vertices: [
		{ id: "ushiro-kubi", x: 9, y: 0 },
		{ id: "ushiro-katasaki", x: 32, y: 0 },
		{ id: "ushiro-suso-migi", x: 32, y: BODY_LENGTH },
		{ id: "ushiro-suso-hidari", x: 0, y: BODY_LENGTH },
		// 衿ぐり is a notch, not a scoop: 2cm down the centre back, straight across
		// to the shoulder point, and up — with the inner corner rounded by 0.7cm.
		{ id: "ushiro-eriguri-hidari", x: 0, y: 2 },
		{
			id: "ushiro-eriguri-kado",
			x: 9 - NECK_RADIUS,
			y: 2,
			bow: NECK_RADIUS * QUARTER_DEPTH,
		},
		{ id: "ushiro-eriguri-ue", x: 9, y: 2 - NECK_RADIUS },
	],
}

const sleeve: Panel = {
	id: "sode",
	name: "そで",
	quantity: 2,
	x: 95,
	y: 0,
	foldEdge: "sode-yama",
	vertices: vertices([
		["sode-yama", 0, 0],
		["sode-guchi", 32, 0],
		["sode-guchi-shita", 32, 59],
		["sode-shita", 0, 62],
	]),
}

const collar: Panel = {
	id: "eri",
	name: "えり",
	quantity: 2,
	x: 137,
	y: 0,
	vertices: vertices([
		["eri-a", 0, 0],
		["eri-b", 12, 0],
		["eri-c", 12, 78],
		["eri-d", 0, 78],
	]),
}

const tie: Panel = {
	id: "himo",
	name: "ひも",
	quantity: 4,
	x: 157,
	y: 0,
	vertices: vertices([
		["himo-a", 0, 0],
		["himo-b", 6, 0],
		["himo-c", 6, 38],
		["himo-d", 0, 38],
	]),
}

const seams: Seam[] = [
	{
		id: "kata-nui",
		name: "肩縫い",
		a: { edge: { panelId: front.id, vertexId: "mae-kata" }, from: 0, to: SHOULDER },
		b: { edge: { panelId: back.id, vertexId: "ushiro-kubi" }, from: 0, to: SHOULDER },
	},
	{
		id: "sechushin",
		name: "背中心",
		a: { edge: { panelId: back.id, vertexId: "ushiro-suso-hidari" }, from: 0, to: BODY_LENGTH - 2 },
		b: { edge: { panelId: back.id, vertexId: "ushiro-suso-hidari" }, from: 0, to: BODY_LENGTH - 2 },
	},
]

export function jinbeiTop(): Document {
	return {
		id: "jinbei-top-m",
		name: "甚平（上）M",
		panels: [front, back, sleeve, collar, tie],
		seams,
		stitches: [],
		annotations: [
			{
				id: "uchiawase",
				name: "打ち合わせ",
				run: { edge: { panelId: front.id, vertexId: "mae-dan" }, from: 0, to: 60 },
			},
			{
				id: "sodeguchi",
				name: "袖口",
				run: { edge: { panelId: sleeve.id, vertexId: "sode-guchi" }, from: 0, to: 59 },
			},
		],
		body: { chest: 96, height: 170, shoulderWidth: 46, armLength: 58 },
	}
}
