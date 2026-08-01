import { pathLength } from "./geometry/measure"
import type { Design, Fabric, Measurements, Panel } from "./model"
import type { Layout } from "./nesting"
import { collarCutWidth, collarLength } from "./templates/kakeeri-shirt"

const THREAD_PER_SEAM = 3
const SPOOL_METRES = 200
const KAGARI_STITCHES_PER_CM = 2
const KAGARI_THREAD_PER_STITCH = 3

export interface Material {
	readonly id: string
	readonly name: string
	readonly amount: string
	readonly note: string
}

export function totalSeamLength(panels: readonly Panel[]): number {
	return panels.reduce((total, panel) => total + pathLength(panel.outline) * panel.quantity, 0)
}

export function fabricLengthNeeded(layout: Layout, fabric: Fabric): number {
	return layout.usedLength * (1 + fabric.shrinkage / 100)
}

function buttonDiameter(design: Design): number {
	return Math.round(design.collarWidth * 2.75)
}

export function materials(
	panels: readonly Panel[],
	measurements: Measurements,
	design: Design,
	fabric: Fabric,
	layout: Layout,
): Material[] {
	const needed = fabricLengthNeeded(layout, fabric)
	const threadMetres = (totalSeamLength(panels) * THREAD_PER_SEAM) / 100
	const collarArea = (collarLength(measurements, design) * collarCutWidth(design)) / 10000

	const list: Material[] = [
		{
			id: "fabric",
			name: "生地",
			amount: `${(needed / 100).toFixed(2)} m`,
			note: `幅${fabric.width}cm・水通しの縮み${fabric.shrinkage}%込み`,
		},
		{
			id: "thread",
			name: "ミシン糸",
			amount: `${Math.ceil(threadMetres / SPOOL_METRES)} 個`,
			note: `縫い線の合計から約${Math.round(threadMetres)}m・シャッペスパン #60`,
		},
		{
			id: "interfacing",
			name: "接着芯",
			amount: `${collarArea.toFixed(2)} m²`,
			note: "織物タイプ。掛襟の芯に使う",
		},
		{
			id: "buttons",
			name: "ボタン",
			amount: `${design.buttonCount} 個`,
			note: `${buttonDiameter(design)}mm。幅${design.collarWidth}cmの襟に合う大きさ`,
		},
		{
			id: "needle",
			name: "ミシン針",
			amount: fabric.weight === "heavy" ? "#14" : "#11",
			note: `${fabric.name}の厚みに合わせる`,
		},
	]

	if (design.kagari) {
		const ventLength = design.sleeveOpening * 2 * 2
		const kagariMetres = (ventLength * KAGARI_STITCHES_PER_CM * KAGARI_THREAD_PER_STITCH) / 100

		list.push({
			id: "lace-thread",
			name: "レース糸 #20",
			amount: `${Math.max(1, Math.ceil(kagariMetres))} m`,
			note: "千鳥かがり用。強撚糸なので目が立つ",
		})
	}

	if (design.sashiko) {
		list.push({
			id: "sashiko-thread",
			name: "刺し子糸",
			amount: `${Math.ceil((measurements.chest / 2) * 1.5) / 100} m`,
			note: "背の一本通し用",
		})
	}

	return list
}

export function totalCost(fabric: Fabric, layout: Layout): number {
	return Math.round((fabricLengthNeeded(layout, fabric) / 100) * fabric.pricePerMetre)
}
