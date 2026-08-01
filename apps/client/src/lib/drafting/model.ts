import type { SeamAllowance } from "./geometry/offset"
import type { Path } from "./geometry/path"

export interface Measurements {
	readonly chest: number
	readonly bodyLength: number
	readonly shoulderWidth: number
	readonly sleeveLength: number
	readonly neck: number
}

export type HemFinish = "mitsuori" | "zigzag" | "fukuronui"

export type KagariThread = "white" | "ecru" | "tonal"

export interface Design {
	readonly ease: number
	readonly kenzakiDepth: number
	readonly collarWidth: number
	readonly sleeveOpening: number
	readonly sideVent: number
	readonly miyatsukuchi: boolean
	readonly gusset: number
	readonly buttonCount: number
	readonly hemFinish: HemFinish
	readonly kagari: boolean
	readonly kagariThread: KagariThread
	readonly sashiko: boolean
	readonly stitchRows: number
}

export type FabricWeight = "light" | "medium" | "heavy"

export interface Fabric {
	readonly name: string
	readonly width: number
	readonly shrinkage: number
	readonly pricePerMetre: number
	readonly frayProne: boolean
	readonly weight: FabricWeight
}

export type StitchKind = "hotsuredome" | "stitch" | "bartack" | "kagari" | "sashiko"

export interface Stitch {
	readonly id: string
	readonly kind: StitchKind
	readonly label: string
	readonly edgeIds: readonly string[]
	readonly offset: number
	readonly rows: number
	readonly thread: string
}

export interface Notch {
	readonly edgeId: string
	readonly fromStart: number
	readonly label: string
}

export interface Panel {
	readonly id: string
	readonly name: string
	readonly quantity: number
	readonly onFold: boolean
	readonly outline: Path
	readonly allowance: SeamAllowance
	readonly notches: readonly Notch[]
	readonly stitches: readonly Stitch[]
}

export interface SewingStep {
	readonly id: string
	readonly title: string
	readonly detail: string
}

export type ControlKey = keyof Design

interface ControlBase {
	readonly key: ControlKey
	readonly label: string
	readonly tradeoff: string
}

export interface LengthControl extends ControlBase {
	readonly kind: "length"
	readonly min: number
	readonly max: number
	readonly step: number
}

export interface ToggleControl extends ControlBase {
	readonly kind: "toggle"
}

export interface ChoiceControl extends ControlBase {
	readonly kind: "choice"
	readonly options: readonly { readonly value: string; readonly label: string }[]
}

export type Control = LengthControl | ToggleControl | ChoiceControl

export interface MeasurementField {
	readonly key: keyof Measurements
	readonly label: string
	readonly hint: string
	readonly min: number
	readonly max: number
}

export interface Template {
	readonly id: string
	readonly name: string
	readonly parent: string
	readonly fields: readonly MeasurementField[]
	readonly controls: readonly Control[]
	readonly defaults: { readonly measurements: Measurements; readonly design: Design }
	readonly panels: (measurements: Measurements, design: Design) => readonly Panel[]
	readonly steps: (design: Design) => readonly SewingStep[]
}
