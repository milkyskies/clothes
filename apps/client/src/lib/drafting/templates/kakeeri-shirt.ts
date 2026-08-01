import { edgesLength } from "../geometry/measure"
import { curve, fillet, line, type Path, point } from "../geometry/path"
import type {
	Design,
	HemFinish,
	Measurements,
	Notch,
	Panel,
	SewingStep,
	Stitch,
	Template,
} from "../model"

const SEAM_ALLOWANCE = 1.5
const SHOULDER_DROP = 2.5
const BACK_NECK_SCOOP = 1.5
const PLACKET_OVERLAP = 2
const KENZAKI_RADIUS = 8
const COLLAR_TURN_UNDER = 1
const COLLAR_TRIM = 5

export function hemAllowance(finish: HemFinish): number {
	switch (finish) {
		case "mitsuori":
			return 3
		case "zigzag":
			return 1.5
		case "fukuronui":
			return 2
		default: {
			const exhaustive: never = finish
			return exhaustive
		}
	}
}

export function hemFinishLabel(finish: HemFinish): string {
	switch (finish) {
		case "mitsuori":
			return "三つ折り"
		case "zigzag":
			return "ジグザグ"
		case "fukuronui":
			return "袋縫い"
		default: {
			const exhaustive: never = finish
			return exhaustive
		}
	}
}

export function kagariThreadLabel(thread: Design["kagariThread"]): string {
	switch (thread) {
		case "white":
			return "白"
		case "ecru":
			return "生成"
		case "tonal":
			return "共色"
		default: {
			const exhaustive: never = thread
			return exhaustive
		}
	}
}

interface Geometry {
	readonly halfChest: number
	readonly backHalfWidth: number
	readonly frontWidth: number
	readonly armholeDepth: number
	readonly backNeckHalfWidth: number
	readonly frontNeckAcross: number
	readonly sleeveCircumference: number
}

function geometryOf(measurements: Measurements, design: Design): Geometry {
	const halfChest = (measurements.chest + design.ease) / 2

	return {
		halfChest,
		backHalfWidth: halfChest / 2,
		frontWidth: halfChest / 2 + PLACKET_OVERLAP,
		armholeDepth: measurements.chest / 4,
		backNeckHalfWidth: measurements.neck / 4,
		frontNeckAcross: measurements.neck / 5,
		sleeveCircumference: measurements.chest / 2,
	}
}

function backOutline(measurements: Measurements, geometry: Geometry): Path {
	const shoulderEnd = point(geometry.backHalfWidth, SHOULDER_DROP)

	return {
		start: point(0, BACK_NECK_SCOOP),
		segments: [
			curve(
				"neck",
				point(geometry.backNeckHalfWidth, 0),
				point(geometry.backNeckHalfWidth * 0.55, BACK_NECK_SCOOP),
				point(geometry.backNeckHalfWidth * 0.85, 0),
			),
			line("shoulder", shoulderEnd),
			line("armhole", point(geometry.backHalfWidth, SHOULDER_DROP + geometry.armholeDepth)),
			line("side", point(geometry.backHalfWidth, measurements.bodyLength)),
			line("hem", point(0, measurements.bodyLength)),
			line("fold", point(0, BACK_NECK_SCOOP)),
		],
	}
}

function frontOutline(measurements: Measurements, design: Design, geometry: Geometry): Path {
	const hem = point(0, measurements.bodyLength)
	const neckPoint = point(geometry.frontNeckAcross, 0)
	const rounded = fillet("kenzaki", hem, point(0, design.kenzakiDepth), neckPoint, KENZAKI_RADIUS)

	return {
		start: hem,
		segments: [
			line("cf-vertical", rounded.from),
			rounded.segment,
			line("cf-diagonal", neckPoint),
			line("shoulder", point(geometry.frontWidth, SHOULDER_DROP)),
			line("armhole", point(geometry.frontWidth, SHOULDER_DROP + geometry.armholeDepth)),
			line("side", point(geometry.frontWidth, measurements.bodyLength)),
			line("hem", hem),
		],
	}
}

/**
 * X runs across the bolt and Y runs along it, on every panel. Authoring a piece
 * the other way round is what puts a 170 cm collar band across a 140 cm width.
 */
function rectangle(
	acrossBolt: number,
	alongBolt: number,
	ids: readonly [string, string, string, string],
): Path {
	const [top, right, bottom, left] = ids

	return {
		start: point(0, 0),
		segments: [
			line(top, point(acrossBolt, 0)),
			line(right, point(acrossBolt, alongBolt)),
			line(bottom, point(0, alongBolt)),
			line(left, point(0, 0)),
		],
	}
}

/**
 * The band is a straight strip, so its cut length is the arc length of the edge
 * it is sewn to. Deriving it here is what stops the band and the front edge
 * disagreeing.
 */
export function collarLength(measurements: Measurements, design: Design): number {
	const geometry = geometryOf(measurements, design)
	const front = frontOutline(measurements, design, geometry)
	const back = backOutline(measurements, geometry)

	const frontRun = edgesLength(front, ["cf-vertical", "kenzaki", "cf-diagonal"])
	const backNeckRun = edgesLength(back, ["neck"]) * 2

	return frontRun * 2 + backNeckRun + COLLAR_TRIM
}

export function collarCutWidth(design: Design): number {
	return 2 * (design.collarWidth + COLLAR_TURN_UNDER)
}

function bodyStitches(design: Design, prefix: string): Stitch[] {
	const stitches: Stitch[] = [
		{
			id: `${prefix}-hem`,
			kind: "hotsuredome",
			label: `裾を${hemFinishLabel(design.hemFinish)}にする`,
			edgeIds: ["hem"],
			offset: 0.2,
			rows: 1,
			thread: "共色",
		},
	]

	if (design.sideVent > 0) {
		stitches.push({
			id: `${prefix}-vent`,
			kind: "bartack",
			label: "脇あきの上をかんぬき止めする",
			edgeIds: ["side"],
			offset: 0,
			rows: 1,
			thread: "共色",
		})
	}

	return stitches
}

function frontStitches(design: Design): Stitch[] {
	const stitches = bodyStitches(design, "front")

	stitches.push({
		id: "front-band",
		kind: "stitch",
		label: "掛襟のきわにコバステッチをかける",
		edgeIds: ["cf-vertical", "kenzaki", "cf-diagonal"],
		offset: 0.2,
		rows: design.stitchRows,
		thread: "共色",
	})

	return stitches
}

function backStitches(design: Design): Stitch[] {
	const stitches = bodyStitches(design, "back")

	if (design.sashiko) {
		stitches.push({
			id: "back-sashiko",
			kind: "sashiko",
			label: "背に刺し子を一本入れる",
			edgeIds: ["fold"],
			offset: 8,
			rows: 1,
			thread: "刺し子糸",
		})
	}

	return stitches
}

function sleeveStitches(design: Design): Stitch[] {
	const stitches: Stitch[] = [
		{
			id: "sleeve-cuff",
			kind: "hotsuredome",
			label: "袖口を三つ折りにする",
			edgeIds: ["cuff"],
			offset: 0.2,
			rows: 1,
			thread: "共色",
		},
	]

	if (design.sleeveOpening > 0) {
		stitches.push({
			id: "sleeve-vent-bartack",
			kind: "bartack",
			label: "袖付けどまりをかんぬき止めする",
			edgeIds: ["head"],
			offset: 0,
			rows: 1,
			thread: "共色",
		})
	}

	if (design.kagari) {
		stitches.push({
			id: "sleeve-kagari",
			kind: "kagari",
			label: `袖付けあきに千鳥かがりをする（${kagariThreadLabel(design.kagariThread)}）`,
			edgeIds: ["head"],
			offset: 0.5,
			rows: 1,
			thread: "レース糸 #20",
		})
	}

	return stitches
}

function bodyNotches(measurements: Measurements, design: Design, geometry: Geometry): Notch[] {
	return [
		{
			edgeId: "armhole",
			fromStart: geometry.armholeDepth - design.sleeveOpening,
			label: "袖付けどまり",
		},
		{
			edgeId: "side",
			fromStart: measurements.bodyLength - SHOULDER_DROP - geometry.armholeDepth - design.sideVent,
			label: "脇あきどまり",
		},
	]
}

function panels(measurements: Measurements, design: Design): readonly Panel[] {
	const geometry = geometryOf(measurements, design)
	const hem = hemAllowance(design.hemFinish)
	const allowance = { perEdge: { hem, fold: 0 }, fallback: SEAM_ALLOWANCE }

	return [
		{
			id: "back",
			name: "後ろ身頃",
			quantity: 1,
			onFold: true,
			outline: backOutline(measurements, geometry),
			allowance,
			notches: bodyNotches(measurements, design, geometry),
			stitches: backStitches(design),
		},
		{
			id: "front",
			name: "前身頃",
			quantity: 2,
			onFold: false,
			outline: frontOutline(measurements, design, geometry),
			allowance: { perEdge: { hem }, fallback: SEAM_ALLOWANCE },
			notches: bodyNotches(measurements, design, geometry),
			stitches: frontStitches(design),
		},
		{
			id: "sleeve",
			name: "そで",
			quantity: 2,
			onFold: false,
			outline: rectangle(geometry.armholeDepth * 2, measurements.sleeveLength, [
				"head",
				"underseam-a",
				"cuff",
				"underseam-b",
			]),
			allowance: { perEdge: { cuff: 4.5 }, fallback: SEAM_ALLOWANCE },
			notches: [],
			stitches: sleeveStitches(design),
		},
		{
			id: "collar",
			name: "掛襟",
			quantity: 1,
			onFold: false,
			outline: rectangle(collarCutWidth(design), collarLength(measurements, design), [
				"end-a",
				"length-a",
				"end-b",
				"length-b",
			]),
			allowance: { perEdge: {}, fallback: 0 },
			notches: [],
			stitches: [],
		},
		{
			id: "gusset",
			name: "まち",
			quantity: 2,
			onFold: false,
			outline: rectangle(design.gusset, design.gusset, ["a", "b", "c", "d"]),
			allowance: { perEdge: {}, fallback: SEAM_ALLOWANCE },
			notches: [],
			stitches: [],
		},
	]
}

function steps(design: Design): readonly SewingStep[] {
	const finish = hemFinishLabel(design.hemFinish)
	const sequence: SewingStep[] = [
		{ id: "mizutooshi", title: "水通しをする", detail: "裁つ前に地入れをして、地の目を通す。" },
		{ id: "hotsuredome", title: "ほつれどめをする", detail: `裁ち端を${finish}で始末する。` },
	]

	if (design.sashiko) {
		sequence.push({
			id: "sashiko",
			title: "背に刺し子をする",
			detail: "後ろ身頃が平らなうちに、衿ぐりから8cm下に一本通す。",
		})
	}

	sequence.push(
		{
			id: "machi",
			title: "まちを付ける",
			detail: `${design.gusset}cm角のまちを対角に折り、袖下の交点に入れる。`,
		},
		{
			id: "sode",
			title: "そでを身頃に縫う",
			detail: `肩から縫い下ろし、袖付けどまりの${design.sleeveOpening}cm手前で止める。`,
		},
	)

	if (design.sleeveOpening > 0) {
		sequence.push({
			id: "sodeaki",
			title: "袖付けあきを始末する",
			detail: "あき止まりをかんぬき止めして、あき口の縫い代を折って押さえる。",
		})
	}

	sequence.push({
		id: "waki",
		title: "脇を縫う",
		detail:
			design.sideVent > 0
				? `まちから裾の${design.sideVent}cm上まで縫う。`
				: "まちから裾まで通して縫う。",
	})

	if (design.sideVent > 0) {
		sequence.push({
			id: "wakiaki",
			title: "脇あきを始末する",
			detail: "あき口を折って押さえ、上をかんぬき止めする。",
		})
	}

	sequence.push(
		{ id: "suso", title: "すそを縫う", detail: `裾と袖口を${finish}で始末する。` },
		{
			id: "eri",
			title: "掛襟を付ける",
			detail: `幅${design.collarWidth}cmに折った襟を、しつけをしてから縫い付ける。`,
		},
		{
			id: "botan",
			title: "ボタンホールとボタンを付ける",
			detail: `${design.buttonCount}個分の位置を先に全部しるしてから開ける。`,
		},
	)

	if (design.kagari) {
		sequence.push({
			id: "kagari",
			title: "千鳥かがりをする",
			detail: `袖付けあきに${kagariThreadLabel(design.kagariThread)}のレース糸でかがる。`,
		})
	}

	sequence.push({
		id: "shiage",
		title: "仕上げにアイロンをかける",
		detail: "当て布をして、冷めるまで動かさない。",
	})

	return sequence
}

export const kakeeriShirt: Template = {
	id: "kakeeri-shirt",
	name: "掛襟シャツ",
	parent: "甚平",
	fields: [
		{ key: "chest", label: "胸囲", hint: "いちばん太いところを一周", min: 70, max: 130 },
		{ key: "bodyLength", label: "身丈", hint: "肩から裾まで", min: 50, max: 95 },
		{ key: "shoulderWidth", label: "肩幅", hint: "肩先から肩先まで", min: 35, max: 60 },
		{ key: "sleeveLength", label: "袖丈", hint: "肩先から袖口まで", min: 20, max: 70 },
		{ key: "neck", label: "首回り", hint: "首の付け根を一周", min: 30, max: 50 },
	],
	controls: [
		{
			kind: "length",
			key: "ease",
			label: "ゆとり",
			tradeoff: "多いほど風が通る。少ないと洋服寄りの見え方になる",
			min: 0,
			max: 30,
			step: 1,
		},
		{
			kind: "length",
			key: "kenzakiDepth",
			label: "剣先の深さ",
			tradeoff: "深いほど排気が効く。深すぎると甚平に寄る",
			min: 10,
			max: 30,
			step: 1,
		},
		{
			kind: "length",
			key: "collarWidth",
			label: "掛襟の幅",
			tradeoff: "広いほど半纏の印象が強くなる",
			min: 3,
			max: 8,
			step: 0.5,
		},
		{
			kind: "length",
			key: "sleeveOpening",
			label: "袖付けあき",
			tradeoff: "いちばん効く冷却。開けるほど涼しい",
			min: 0,
			max: 12,
			step: 1,
		},
		{
			kind: "length",
			key: "sideVent",
			label: "脇あき",
			tradeoff: "裾からの吸気口。長いほど風が入る",
			min: 0,
			max: 30,
			step: 1,
		},
		{
			kind: "toggle",
			key: "miyatsukuchi",
			label: "身八つ口",
			tradeoff: "涼しいが、祭の印象がはっきり出る",
		},
		{
			kind: "length",
			key: "gusset",
			label: "まちの大きさ",
			tradeoff: "大きいほど袖下が丈夫になる",
			min: 6,
			max: 12,
			step: 1,
		},
		{
			kind: "length",
			key: "buttonCount",
			label: "ボタンの数",
			tradeoff: "多いほど前が安定する",
			min: 2,
			max: 8,
			step: 1,
		},
		{
			kind: "choice",
			key: "hemFinish",
			label: "裾の始末",
			tradeoff: "三つ折りは丈夫だが縫い代を多く食う",
			options: [
				{ value: "mitsuori", label: "三つ折り" },
				{ value: "zigzag", label: "ジグザグ" },
				{ value: "fukuronui", label: "袋縫い" },
			],
		},
		{
			kind: "toggle",
			key: "kagari",
			label: "千鳥かがり",
			tradeoff: "通気になるが、和の印象が上がる",
		},
		{
			kind: "choice",
			key: "kagariThread",
			label: "かがり糸の色",
			tradeoff: "白がいちばん祭に寄る。共色なら質感だけ残る",
			options: [
				{ value: "white", label: "白" },
				{ value: "ecru", label: "生成" },
				{ value: "tonal", label: "共色" },
			],
		},
		{ kind: "toggle", key: "sashiko", label: "背の刺し子", tradeoff: "無地の背に横線が入る" },
		{
			kind: "length",
			key: "stitchRows",
			label: "ステッチの本数",
			tradeoff: "黒無地ではステッチが唯一の意匠になる",
			min: 1,
			max: 2,
			step: 1,
		},
	],
	defaults: {
		measurements: { chest: 96, bodyLength: 70, shoulderWidth: 46, sleeveLength: 58, neck: 40 },
		design: {
			ease: 14,
			kenzakiDepth: 18,
			collarWidth: 4,
			sleeveOpening: 6,
			sideVent: 18,
			miyatsukuchi: false,
			gusset: 8,
			buttonCount: 4,
			hemFinish: "mitsuori",
			kagari: true,
			kagariThread: "tonal",
			sashiko: false,
			stitchRows: 1,
		},
	},
	panels,
	steps,
}
