import { edgesLength, pathLength } from "./geometry/measure"
import { boundingBox, offsetPath } from "./geometry/offset"
import { fabricLengthNeeded, type Material, materials, totalCost } from "./materials"
import type { Design, Fabric, Measurements, Panel, SewingStep, Template } from "./model"
import { type Layout, nest } from "./nesting"
import { collarCutWidth } from "./templates/kakeeri-shirt"
import { type Issue, validate } from "./validation"

export interface CutSize {
	readonly name: string
	readonly quantity: number
	readonly onFold: boolean
	readonly width: number
	readonly height: number
}

export interface FitRead {
	readonly chestEase: number
	readonly finishedChest: number
	readonly hemBelowHip: number
	readonly collarFinished: number
}

export interface Draft {
	readonly panels: readonly Panel[]
	readonly cutSizes: readonly CutSize[]
	readonly layout: Layout
	readonly materials: readonly Material[]
	readonly steps: readonly SewingStep[]
	readonly issues: readonly Issue[]
	readonly fit: FitRead
	readonly fabricNeeded: number
	readonly cost: number
}

function cutSizesOf(panels: readonly Panel[]): CutSize[] {
	return panels.map((panel) => {
		const box = boundingBox(offsetPath(panel.outline, panel.allowance))

		return {
			name: panel.name,
			quantity: panel.quantity,
			onFold: panel.onFold,
			width: box.width,
			height: box.height,
		}
	})
}

/**
 * The hip sits roughly at three-eighths of body height below the shoulder; with
 * no hip measurement collected, this reads the hem position off 身丈 instead of
 * inventing a landmark the user never entered.
 */
function fitRead(measurements: Measurements, design: Design): FitRead {
	return {
		chestEase: design.ease,
		finishedChest: measurements.chest + design.ease,
		hemBelowHip: measurements.bodyLength - measurements.chest * 0.55,
		collarFinished: collarCutWidth(design) / 2 - 1,
	}
}

export function draft(
	template: Template,
	measurements: Measurements,
	design: Design,
	fabric: Fabric,
): Draft {
	const panels = template.panels(measurements, design)
	const layout = nest(panels, fabric)

	return {
		panels,
		cutSizes: cutSizesOf(panels),
		layout,
		materials: materials(panels, measurements, design, fabric, layout),
		steps: template.steps(design),
		issues: validate(panels, measurements, design, fabric, layout),
		fit: fitRead(measurements, design),
		fabricNeeded: fabricLengthNeeded(layout, fabric),
		cost: totalCost(fabric, layout),
	}
}

export { boundingBox, edgesLength, offsetPath, pathLength }
