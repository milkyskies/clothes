import { edgesLength } from "./geometry/measure"
import type { Design, Fabric, Measurements, Panel } from "./model"
import type { Layout } from "./nesting"
import { hemAllowance, hemFinishLabel } from "./templates/kakeeri-shirt"

const MATCH_TOLERANCE_CM = 0.2
const MIN_EASE = 6
const MAX_EASE = 30

export type IssueLevel = "error" | "warning"

export type IssueClass = "寸法" | "縫い代" | "生地" | "着心地" | "地の目"

export interface Issue {
	readonly id: string
	readonly level: IssueLevel
	readonly issueClass: IssueClass
	readonly message: string
	readonly field?: string
}

function panelById(panels: readonly Panel[], id: string): Panel | undefined {
	return panels.find((panel) => panel.id === id)
}

function checkSeamMatching(panels: readonly Panel[]): Issue[] {
	const front = panelById(panels, "front")
	const back = panelById(panels, "back")
	const sleeve = panelById(panels, "sleeve")

	if (front === undefined || back === undefined || sleeve === undefined) return []

	const armhole = edgesLength(front.outline, ["armhole"]) + edgesLength(back.outline, ["armhole"])
	const sleeveHead = edgesLength(sleeve.outline, ["head"])
	const difference = Math.abs(armhole - sleeveHead)

	if (difference <= MATCH_TOLERANCE_CM) return []

	return [
		{
			id: "armhole-sleeve-mismatch",
			level: "error",
			issueClass: "寸法",
			message: `袖山${sleeveHead.toFixed(1)}cmと袖ぐり${armhole.toFixed(1)}cmが${difference.toFixed(1)}cm合っていません。`,
		},
	]
}

function checkAllowance(design: Design, fabric: Fabric): Issue[] {
	const issues: Issue[] = []
	const required = hemAllowance(design.hemFinish)

	if (fabric.frayProne && design.hemFinish === "zigzag") {
		issues.push({
			id: "fray-needs-stronger-finish",
			level: "warning",
			issueClass: "縫い代",
			message: `${fabric.name}はほつれやすいので、ジグザグより三つ折りか袋縫いが向きます。`,
			field: "hemFinish",
		})
	}

	if (required > 3) {
		issues.push({
			id: "allowance-heavy",
			level: "warning",
			issueClass: "縫い代",
			message: `${hemFinishLabel(design.hemFinish)}は縫い代を${required}cm使います。`,
			field: "hemFinish",
		})
	}

	return issues
}

function checkFabric(layout: Layout, fabric: Fabric): Issue[] {
	const issues: Issue[] = []

	for (const name of layout.overWidth) {
		issues.push({
			id: `over-width-${name}`,
			level: "error",
			issueClass: "生地",
			message: `${name}が幅${fabric.width}cmに入りません。`,
			field: "width",
		})
	}

	return issues
}

function checkWearability(measurements: Measurements, design: Design): Issue[] {
	const issues: Issue[] = []

	if (design.ease < MIN_EASE) {
		issues.push({
			id: "ease-too-tight",
			level: "warning",
			issueClass: "着心地",
			message: `ゆとり${design.ease}cmは和服としてはかなり細身です。風が通りません。`,
			field: "ease",
		})
	}

	if (design.ease > MAX_EASE) {
		issues.push({
			id: "ease-too-loose",
			level: "warning",
			issueClass: "着心地",
			message: `ゆとり${design.ease}cmは大きすぎて、肩が落ちます。`,
			field: "ease",
		})
	}

	if (design.kenzakiDepth > measurements.bodyLength / 2) {
		issues.push({
			id: "kenzaki-too-deep",
			level: "error",
			issueClass: "着心地",
			message: `剣先${design.kenzakiDepth}cmが身丈の半分を超えています。前が留まりません。`,
			field: "kenzakiDepth",
		})
	}

	if (design.sideVent + design.kenzakiDepth > measurements.bodyLength) {
		issues.push({
			id: "vent-overlaps-kenzaki",
			level: "error",
			issueClass: "着心地",
			message: "脇あきと剣先が重なって、脇が閉じません。",
			field: "sideVent",
		})
	}

	return issues
}

const NARROW_BOLT_WIDTH = 60

function checkGrain(fabric: Fabric): Issue[] {
	if (fabric.width >= NARROW_BOLT_WIDTH) return []

	return [
		{
			id: "narrow-bolt",
			level: "warning",
			issueClass: "地の目",
			message: "反物幅では後ろ身頃に背縫いが要ります。V1は広幅のみ対応です。",
			field: "width",
		},
	]
}

export function validate(
	panels: readonly Panel[],
	measurements: Measurements,
	design: Design,
	fabric: Fabric,
	layout: Layout,
): Issue[] {
	return [
		...checkSeamMatching(panels),
		...checkAllowance(design, fabric),
		...checkFabric(layout, fabric),
		...checkWearability(measurements, design),
		...checkGrain(fabric),
	]
}
