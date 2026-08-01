import { edgeLength } from "../assembly"
import type { Annotation, Draft, EdgeRef, Panel, Seam, Vertex } from "../draft"

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
const FRONT_WIDTH = 43
const BACK_WIDTH = 32

/** How far down the side seam the sleeve reaches, on the front and on the back alike. */
const SLEEVE_REACH = 31
const TIE_WIDTH = 6
const UNDERARM_OPENING = 12

const SLEEVE_LENGTH = 32
const SLEEVE_WIDTH = 62

const COLLAR_WIDTH = 12
const TIE_LENGTH = 38

/**
 * The 製図 prints 0.7 against the 衿ぐり corner: the gap between the sharp corner
 * and the curve. A quarter-round clears its corner by r·(√2−1), so that gap
 * gives a radius of about 1.7cm, and the notch runs flat until the last stretch.
 */
const NECK_CORNER_GAP = 0.7
const NECK_RADIUS = NECK_CORNER_GAP / (Math.SQRT2 - 1)

/** A quarter circle drawn as one cubic sits 1−√2/2 of its radius off the chord. */
const QUARTER_DEPTH = 1 - Math.SQRT1_2

const BACK_CENTRE = BODY_LENGTH - 2

function vertices(points: readonly (readonly [string, number, number])[]): Vertex[] {
	return points.map(([id, x, y]) => ({ id, x, y }))
}

function edge(panel: Panel, vertexId: string): EdgeRef {
	return { panelId: panel.id, vertexId }
}

/**
 * The other one of a pair.
 *
 * Both halves of a body are cut from the same outline; which is the right and
 * which is the left is decided by turning one over, and a seam says that by
 * meeting its ends the other way round rather than by holding a second shape.
 */
function pairOf(panel: Panel, id: string, name: string, x: number): Panel {
	return { ...panel, id, name, x }
}

function rectangle(id: string, name: string, across: number, along: number, x: number): Panel {
	return {
		id,
		name,
		quantity: 1,
		x,
		y: 0,
		vertices: vertices([
			[`${id}-a`, 0, 0],
			[`${id}-b`, across, 0],
			[`${id}-c`, across, along],
			[`${id}-d`, 0, along],
		]),
	}
}

const frontRight: Panel = {
	id: "mae-migoro-migi",
	name: "前身頃 右",
	quantity: 1,
	x: 0,
	y: 0,
	vertices: vertices([
		["mae-kata", 20, 0],
		["mae-katasaki", FRONT_WIDTH, 0],
		["mae-suso-migi", FRONT_WIDTH, BODY_LENGTH],
		["mae-suso-hidari", 0, BODY_LENGTH],
		["mae-maebiraki", 0, 58.5],
		["mae-dan", 2, 58.5],
	]),
}

const backRight: Panel = {
	id: "ushiro-migoro-migi",
	name: "後ろ身頃 右",
	quantity: 1,
	x: 53,
	y: 0,
	vertices: [
		{ id: "ushiro-kubi", x: 9, y: 0 },
		{ id: "ushiro-katasaki", x: BACK_WIDTH, y: 0 },
		{ id: "ushiro-suso-migi", x: BACK_WIDTH, y: BODY_LENGTH },
		{ id: "ushiro-suso-hidari", x: 0, y: BODY_LENGTH },
		// 衿ぐり is a notch, not a scoop: 2cm down the centre back, straight across
		// to the shoulder point, and up — with the inner corner rounded by 0.7cm.
		{ id: "ushiro-eriguri-hidari", x: 0, y: 2 },
		{ id: "ushiro-eriguri-kado", x: 9 - NECK_RADIUS, y: 2, bow: NECK_RADIUS * QUARTER_DEPTH },
		{ id: "ushiro-eriguri-ue", x: 9, y: 2 - NECK_RADIUS },
	],
}

const sleeveRight: Panel = {
	id: "sode-migi",
	name: "そで 右",
	quantity: 1,
	x: 95,
	y: 0,
	vertices: vertices([
		["sode-shita-ushiro", 0, 0],
		["sode-guchi", SLEEVE_LENGTH, 0],
		["sode-shita-mae", SLEEVE_LENGTH, SLEEVE_WIDTH],
		["sode-tsuke", 0, SLEEVE_WIDTH],
	]),
	// The sleeve is cut in one length and doubled over at 袖山, so the fold runs
	// across the middle rather than being a seam anyone sews.
	creases: [
		{
			id: "sode-yama",
			name: "袖山",
			a: { vertexId: "sode-guchi", at: SLEEVE_WIDTH / 2 },
			b: { vertexId: "sode-tsuke", at: SLEEVE_WIDTH / 2 },
		},
	],
}

const frontLeft = pairOf(frontRight, "mae-migoro-hidari", "前身頃 左", 220)
const backLeft = pairOf(backRight, "ushiro-migoro-hidari", "後ろ身頃 左", 273)
const sleeveLeft = pairOf(sleeveRight, "sode-hidari", "そで 左", 315)

const BODY: readonly Panel[] = [frontRight, backRight, sleeveRight, frontLeft, backLeft, sleeveLeft]

/** A draft with nothing joined yet, used only to measure the outlines. */
function ruler(panels: readonly Panel[]): Draft {
	return {
		id: "ruler",
		name: "ruler",
		panels,
		seams: [],
		stitches: [],
		annotations: [],
		body: { chest: 96, height: 170, shoulderWidth: 46, armLength: 58 },
		fabric: { name: "広幅", width: 110 },
	}
}

/**
 * The 衿ぐり, edge by edge, from the shoulder point inwards to the centre back.
 *
 * The collar has to cover exactly this and the 打ち合わせ below it, so its length
 * is measured off the pieces rather than typed in: a neckline that is redrawn
 * takes the collar with it.
 */
function neckEdges(): readonly { vertexId: string; length: number }[] {
	const measure = ruler(BODY)

	return ["ushiro-eriguri-ue", "ushiro-eriguri-kado", "ushiro-eriguri-hidari"].map((vertexId) => ({
		vertexId,
		length: edgeLength(measure, edge(backRight, vertexId)),
	}))
}

function sideSeams(front: Panel, back: Panel, sleeve: Panel, side: "右" | "左"): Seam[] {
	const closedFrom = SLEEVE_REACH + UNDERARM_OPENING

	return [
		{
			id: `kata-nui-${side}`,
			name: `肩縫い ${side}`,
			a: { edge: edge(front, "mae-kata"), from: 0, to: SHOULDER },
			b: { edge: edge(back, "ushiro-kubi"), from: 0, to: SHOULDER },
			lie: "fold",
		},
		{
			id: `waki-nui-${side}`,
			name: `脇縫い ${side}`,
			a: { edge: edge(front, "mae-katasaki"), from: closedFrom, to: BODY_LENGTH },
			b: { edge: edge(back, "ushiro-katasaki"), from: closedFrom, to: BODY_LENGTH },
			lie: "fold",
		},
		// 袖山 sits at the middle of the sleeve's 袖付け edge and meets the shoulder,
		// so the sleeve runs outwards from there onto the front and onto the back.
		{
			id: `sodetsuke-mae-${side}`,
			name: `袖付け 前${side}`,
			a: { edge: edge(sleeve, "sode-tsuke"), from: 0, to: SLEEVE_WIDTH / 2 },
			b: { edge: edge(front, "mae-katasaki"), from: 0, to: SLEEVE_REACH },
			reversed: true,
			lie: "open",
		},
		{
			id: `sodetsuke-ushiro-${side}`,
			name: `袖付け 後${side}`,
			a: { edge: edge(sleeve, "sode-tsuke"), from: SLEEVE_WIDTH / 2, to: SLEEVE_WIDTH },
			b: { edge: edge(back, "ushiro-katasaki"), from: 0, to: SLEEVE_REACH },
			lie: "open",
		},
		{
			id: `sodeshita-${side}`,
			name: `袖下 ${side}`,
			a: { edge: edge(sleeve, "sode-shita-ushiro"), from: 0, to: SLEEVE_LENGTH },
			b: { edge: edge(sleeve, "sode-shita-mae"), from: 0, to: SLEEVE_LENGTH },
			reversed: true,
			lie: "fold",
		},
	]
}

/**
 * The collar, running from the hem end of the 打ち合わせ up and round to the
 * centre back. Its inner edge is covered end to end, in four seams because the
 * 衿ぐり is drawn as a notch of three edges rather than as one.
 */
function collarSeams(collar: Panel, front: Panel, back: Panel, side: "右" | "左"): Seam[] {
	const diagonal = edgeLength(ruler(BODY), edge(front, "mae-dan"))

	const seams: Seam[] = [
		{
			id: `eritsuke-uchiawase-${side}`,
			name: `衿付け 打ち合わせ${side}`,
			a: { edge: edge(collar, `${collar.id}-d`), from: 0, to: diagonal },
			b: { edge: edge(front, "mae-dan"), from: 0, to: diagonal },
			lie: "fold",
		},
	]

	let cursor = diagonal

	for (const neck of neckEdges()) {
		seams.push({
			id: `eritsuke-${neck.vertexId}-${side}`,
			name: `衿付け 衿ぐり${side}`,
			a: { edge: edge(collar, `${collar.id}-d`), from: cursor, to: cursor + neck.length },
			b: { edge: edge(back, neck.vertexId), from: 0, to: neck.length },
			reversed: true,
			lie: "fold",
		})

		cursor += neck.length
	}

	return seams
}

/** A 紐 anchored at the top of an underarm opening, which is where it is threaded through. */
function tieSeam(tie: Panel, host: Panel, hostVertexId: string, name: string): Seam {
	return {
		id: `himotsuke-${tie.id}`,
		name,
		a: { edge: edge(tie, `${tie.id}-a`), from: 0, to: TIE_WIDTH },
		b: { edge: edge(host, hostVertexId), from: SLEEVE_REACH, to: SLEEVE_REACH + TIE_WIDTH },
		lie: "open",
	}
}

function collar(id: string, name: string, length: number, x: number): Panel {
	return {
		...rectangle(id, name, COLLAR_WIDTH, length, x),
		// The strip is doubled lengthwise before it goes on, so 12cm of cloth
		// finishes as a 6cm collar.
		creases: [
			{
				id: `${id}-yama`,
				name: "衿山",
				a: { vertexId: `${id}-a`, at: COLLAR_WIDTH / 2 },
				b: { vertexId: `${id}-c`, at: COLLAR_WIDTH / 2 },
			},
		],
	}
}

export function jinbeiTop(): Draft {
	const diagonal = edgeLength(ruler(BODY), edge(frontRight, "mae-dan"))
	const collarLength = neckEdges().reduce((total, neck) => total + neck.length, diagonal)

	const collarRight = collar("eri-migi", "えり 右", collarLength, 137)
	const collarLeft = collar("eri-hidari", "えり 左", collarLength, 157)

	const ties: readonly { panel: Panel; host: Panel; vertexId: string; name: string }[] = [
		{
			panel: rectangle("himo-mae-migi", "ひも 右前", TIE_WIDTH, TIE_LENGTH, 190),
			host: frontRight,
			vertexId: "mae-katasaki",
			name: "ひも付け 右前",
		},
		{
			panel: rectangle("himo-mae-hidari", "ひも 左前", TIE_WIDTH, TIE_LENGTH, 200),
			host: frontLeft,
			vertexId: "mae-katasaki",
			name: "ひも付け 左前",
		},
		{
			panel: rectangle("himo-ushiro-migi", "ひも 右後", TIE_WIDTH, TIE_LENGTH, 375),
			host: backRight,
			vertexId: "ushiro-katasaki",
			name: "ひも付け 右後",
		},
		{
			panel: rectangle("himo-ushiro-hidari", "ひも 左後", TIE_WIDTH, TIE_LENGTH, 385),
			host: backLeft,
			vertexId: "ushiro-katasaki",
			name: "ひも付け 左後",
		},
	]

	const seams: Seam[] = [
		{
			id: "se-chushin",
			name: "背中心",
			a: { edge: edge(backRight, "ushiro-suso-hidari"), from: 0, to: BACK_CENTRE },
			b: { edge: edge(backLeft, "ushiro-suso-hidari"), from: 0, to: BACK_CENTRE },
			lie: "open",
		},
		...sideSeams(frontRight, backRight, sleeveRight, "右"),
		...sideSeams(frontLeft, backLeft, sleeveLeft, "左"),
		...collarSeams(collarRight, frontRight, backRight, "右"),
		...collarSeams(collarLeft, frontLeft, backLeft, "左"),
		...ties.map((tie) => tieSeam(tie.panel, tie.host, tie.vertexId, tie.name)),
	]

	const annotations: Annotation[] = [
		{
			id: "uchiawase",
			name: "打ち合わせ",
			run: { edge: edge(frontRight, "mae-dan"), from: 0, to: diagonal },
		},
		{
			id: "miyatsukuchi",
			name: "身八つ口",
			run: {
				edge: edge(frontRight, "mae-katasaki"),
				from: SLEEVE_REACH + TIE_WIDTH,
				to: SLEEVE_REACH + UNDERARM_OPENING,
			},
		},
		{
			id: "furi",
			name: "振り",
			run: {
				edge: edge(backRight, "ushiro-katasaki"),
				from: SLEEVE_REACH + TIE_WIDTH,
				to: SLEEVE_REACH + UNDERARM_OPENING,
			},
		},
		{
			id: "sodeguchi-migi",
			name: "袖口 右",
			run: { edge: edge(sleeveRight, "sode-guchi"), from: 0, to: SLEEVE_WIDTH },
		},
		{
			id: "sodeguchi-hidari",
			name: "袖口 左",
			run: { edge: edge(sleeveLeft, "sode-guchi"), from: 0, to: SLEEVE_WIDTH },
		},
		{
			id: "suso",
			name: "裾",
			run: { edge: edge(frontRight, "mae-suso-migi"), from: 0, to: FRONT_WIDTH },
		},
	]

	return {
		id: "jinbei-top-m",
		name: "甚平（上）M",
		panels: [...BODY, collarRight, collarLeft, ...ties.map((tie) => tie.panel)],
		seams,
		stitches: [],
		annotations,
		body: { chest: 96, height: 170, shoulderWidth: 46, armLength: 58 },
		fabric: { name: "広幅", width: 110 },
	}
}
