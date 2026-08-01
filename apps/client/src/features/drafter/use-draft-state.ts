import { getRouteApi } from "@tanstack/react-router"
import { useCallback, useMemo } from "react"
import { type Draft, draft } from "@/lib/drafting/draft"
import type { Design, Fabric, HemFinish, KagariThread, Measurements } from "@/lib/drafting/model"
import { kakeeriShirt } from "@/lib/drafting/templates/kakeeri-shirt"

const routeApi = getRouteApi("/_layout/")

export interface DraftSearch extends Measurements, Design, Fabric {}

const DEFAULT_FABRIC: Fabric = {
	name: "YUWA 綿麻無地",
	width: 140,
	shrinkage: 4,
	pricePerMetre: 1880,
	frayProne: true,
	weight: "medium",
}

function readNumber(source: Record<string, unknown>, key: string, fallback: number): number {
	const raw = source[key]

	if (typeof raw === "number" && Number.isFinite(raw)) return raw

	if (typeof raw === "string") {
		const parsed = Number(raw)

		if (Number.isFinite(parsed)) return parsed
	}

	return fallback
}

function readBoolean(source: Record<string, unknown>, key: string, fallback: boolean): boolean {
	const raw = source[key]

	if (typeof raw === "boolean") return raw
	if (raw === "true") return true
	if (raw === "false") return false

	return fallback
}

function readChoice<T extends string>(
	source: Record<string, unknown>,
	key: string,
	allowed: readonly T[],
	fallback: T,
): T {
	const raw = source[key]

	for (const option of allowed) {
		if (raw === option) return option
	}

	return fallback
}

const HEM_FINISHES: readonly HemFinish[] = ["mitsuori", "zigzag", "fukuronui"]
const KAGARI_THREADS: readonly KagariThread[] = ["white", "ecru", "tonal"]
const FABRIC_WEIGHTS = ["light", "medium", "heavy"] as const

export function validateDraftSearch(search: Record<string, unknown>): DraftSearch {
	const { measurements, design } = kakeeriShirt.defaults

	return {
		chest: readNumber(search, "chest", measurements.chest),
		bodyLength: readNumber(search, "bodyLength", measurements.bodyLength),
		shoulderWidth: readNumber(search, "shoulderWidth", measurements.shoulderWidth),
		sleeveLength: readNumber(search, "sleeveLength", measurements.sleeveLength),
		neck: readNumber(search, "neck", measurements.neck),

		ease: readNumber(search, "ease", design.ease),
		kenzakiDepth: readNumber(search, "kenzakiDepth", design.kenzakiDepth),
		collarWidth: readNumber(search, "collarWidth", design.collarWidth),
		sleeveOpening: readNumber(search, "sleeveOpening", design.sleeveOpening),
		sideVent: readNumber(search, "sideVent", design.sideVent),
		miyatsukuchi: readBoolean(search, "miyatsukuchi", design.miyatsukuchi),
		gusset: readNumber(search, "gusset", design.gusset),
		buttonCount: readNumber(search, "buttonCount", design.buttonCount),
		hemFinish: readChoice(search, "hemFinish", HEM_FINISHES, design.hemFinish),
		kagari: readBoolean(search, "kagari", design.kagari),
		kagariThread: readChoice(search, "kagariThread", KAGARI_THREADS, design.kagariThread),
		sashiko: readBoolean(search, "sashiko", design.sashiko),
		stitchRows: readNumber(search, "stitchRows", design.stitchRows),

		name: typeof search.name === "string" ? search.name : DEFAULT_FABRIC.name,
		width: readNumber(search, "width", DEFAULT_FABRIC.width),
		shrinkage: readNumber(search, "shrinkage", DEFAULT_FABRIC.shrinkage),
		pricePerMetre: readNumber(search, "pricePerMetre", DEFAULT_FABRIC.pricePerMetre),
		frayProne: readBoolean(search, "frayProne", DEFAULT_FABRIC.frayProne),
		weight: readChoice(search, "weight", FABRIC_WEIGHTS, DEFAULT_FABRIC.weight),
	}
}

export interface DraftState {
	readonly search: DraftSearch
	readonly measurements: Measurements
	readonly design: Design
	readonly fabric: Fabric
	readonly result: Draft
	readonly update: (patch: Partial<DraftSearch>) => void
	readonly replaceAll: (next: DraftSearch) => void
	readonly reset: () => void
}

export function useDraftState(): DraftState {
	const search = routeApi.useSearch()
	const navigate = routeApi.useNavigate()

	const measurements = useMemo<Measurements>(
		() => ({
			chest: search.chest,
			bodyLength: search.bodyLength,
			shoulderWidth: search.shoulderWidth,
			sleeveLength: search.sleeveLength,
			neck: search.neck,
		}),
		[search],
	)

	const design = useMemo<Design>(
		() => ({
			ease: search.ease,
			kenzakiDepth: search.kenzakiDepth,
			collarWidth: search.collarWidth,
			sleeveOpening: search.sleeveOpening,
			sideVent: search.sideVent,
			miyatsukuchi: search.miyatsukuchi,
			gusset: search.gusset,
			buttonCount: search.buttonCount,
			hemFinish: search.hemFinish,
			kagari: search.kagari,
			kagariThread: search.kagariThread,
			sashiko: search.sashiko,
			stitchRows: search.stitchRows,
		}),
		[search],
	)

	const fabric = useMemo<Fabric>(
		() => ({
			name: search.name,
			width: search.width,
			shrinkage: search.shrinkage,
			pricePerMetre: search.pricePerMetre,
			frayProne: search.frayProne,
			weight: search.weight,
		}),
		[search],
	)

	const result = useMemo(
		() => draft(kakeeriShirt, measurements, design, fabric),
		[measurements, design, fabric],
	)

	const update = useCallback(
		(patch: Partial<DraftSearch>) => {
			navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true })
		},
		[navigate],
	)

	const replaceAll = useCallback(
		(next: DraftSearch) => {
			navigate({ search: () => next, replace: true })
		},
		[navigate],
	)

	const reset = useCallback(() => {
		navigate({ search: () => validateDraftSearch({}), replace: true })
	}, [navigate])

	return { search, measurements, design, fabric, result, update, replaceAll, reset }
}
