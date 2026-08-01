import { Button } from "@/features/shared/ui/button"
import { Input } from "@/features/shared/ui/input"
import { Label } from "@/features/shared/ui/label"
import { Separator } from "@/features/shared/ui/separator"
import type { Control } from "@/lib/drafting/model"
import { kakeeriShirt } from "@/lib/drafting/templates/kakeeri-shirt"
import type { DraftSearch, DraftState } from "../use-draft-state"

const ON_CANVAS: ReadonlySet<string> = new Set([
	"ease",
	"kenzakiDepth",
	"collarWidth",
	"sleeveOpening",
	"sideVent",
])

interface RowProps {
	label: string
	hint?: string
	flagged?: boolean
	children: React.ReactNode
}

function Row(props: RowProps) {
	return (
		<div className="space-y-1.5">
			<Label className="flex items-center justify-between gap-3 text-sm font-normal">
				<span>{props.label}</span>
				{props.children}
			</Label>

			{props.hint === undefined ? null : (
				<p
					className={`text-xs leading-snug ${props.flagged === true ? "text-destructive" : "text-muted-foreground"}`}
				>
					{props.hint}
				</p>
			)}
		</div>
	)
}

interface ChoiceProps {
	options: readonly { value: string; label: string }[]
	value: unknown
	onSelect: (value: string) => void
}

function Choice(props: ChoiceProps) {
	return (
		<div className="flex gap-1">
			{props.options.map((option) => (
				<Button
					key={option.value}
					type="button"
					size="sm"
					variant={props.value === option.value ? "default" : "outline"}
					onClick={() => props.onSelect(option.value)}
					className="h-7 px-2 text-xs"
				>
					{option.label}
				</Button>
			))}
		</div>
	)
}

interface NumberCellProps {
	value: number
	min: number
	max: number
	step: number
	onChange: (next: number) => void
}

function NumberCell(props: NumberCellProps) {
	return (
		<Input
			type="number"
			value={props.value}
			min={props.min}
			max={props.max}
			step={props.step}
			onChange={(event) => {
				const parsed = Number(event.target.value)

				if (Number.isFinite(parsed)) props.onChange(parsed)
			}}
			className="tnum h-7 w-20 text-right text-sm"
		/>
	)
}

interface ControlRailProps {
	state: DraftState
}

export function ControlRail(props: ControlRailProps) {
	const flagged = new Set(
		props.state.result.issues
			.map((issue) => issue.field)
			.filter((field): field is string => field !== undefined),
	)

	const offCanvas = kakeeriShirt.controls.filter((control) => !ON_CANVAS.has(control.key))

	return (
		<div className="flex h-full flex-col">
			<header className="flex items-start justify-between gap-3 border-b p-4">
				<div>
					<h1 className="text-sm font-semibold">{kakeeriShirt.name}</h1>
					<p className="text-xs text-muted-foreground">{`${kakeeriShirt.parent} から派生`}</p>
				</div>

				<Button variant="ghost" size="sm" onClick={props.state.reset} className="h-7 text-xs">
					{"戻す"}
				</Button>
			</header>

			<div className="flex-1 space-y-6 overflow-y-auto p-4">
				<section className="space-y-3">
					<h2 className="text-xs font-medium text-muted-foreground">{"採寸"}</h2>

					{kakeeriShirt.fields.map((field) => (
						<Row key={field.key} label={field.label} hint={field.hint}>
							<NumberCell
								value={props.state.measurements[field.key]}
								min={field.min}
								max={field.max}
								step={1}
								onChange={(next) => props.state.update({ [field.key]: next })}
							/>
						</Row>
					))}
				</section>

				<Separator />

				<section className="space-y-3">
					<h2 className="text-xs font-medium text-muted-foreground">{"意匠"}</h2>
					<p className="text-xs text-muted-foreground">
						{"寸法は図の上でつまむか、数字を押して入力します。"}
					</p>

					{offCanvas.map((control: Control) => {
						const raw = props.state.design[control.key]

						return (
							<Row
								key={control.key}
								label={control.label}
								hint={control.tradeoff}
								flagged={flagged.has(control.key)}
							>
								{control.kind === "length" ? (
									<NumberCell
										value={typeof raw === "number" ? raw : control.min}
										min={control.min}
										max={control.max}
										step={control.step}
										onChange={(next) => props.state.update({ [control.key]: next })}
									/>
								) : null}

								{control.kind === "toggle" ? (
									<Choice
										options={[
											{ value: "on", label: "する" },
											{ value: "off", label: "しない" },
										]}
										value={raw === true ? "on" : "off"}
										onSelect={(value) => props.state.update({ [control.key]: value === "on" })}
									/>
								) : null}

								{control.kind === "choice" ? (
									<Choice
										options={control.options}
										value={raw}
										onSelect={(value) => props.state.update({ [control.key]: value })}
									/>
								) : null}
							</Row>
						)
					})}
				</section>

				<Separator />

				<section className="space-y-3">
					<h2 className="text-xs font-medium text-muted-foreground">{"生地"}</h2>

					<Row label="名前">
						<Input
							value={props.state.fabric.name}
							onChange={(event) => props.state.update({ name: event.target.value })}
							className="h-7 w-40 text-sm"
						/>
					</Row>

					<Row
						label="生地幅"
						hint="広幅のみ対応。反物は次のバージョン"
						flagged={flagged.has("width")}
					>
						<Choice
							options={[
								{ value: "110", label: "110" },
								{ value: "140", label: "140" },
							]}
							value={String(props.state.fabric.width)}
							onSelect={(value) => props.state.update({ width: Number(value) })}
						/>
					</Row>

					<Row label="縮み率" hint="麻は3〜5%。裁つ前に地入れをする">
						<NumberCell
							value={props.state.fabric.shrinkage}
							min={0}
							max={10}
							step={0.5}
							onChange={(next) => props.state.update({ shrinkage: next })}
						/>
					</Row>

					<Row label="1mの値段">
						<NumberCell
							value={props.state.fabric.pricePerMetre}
							min={0}
							max={20000}
							step={10}
							onChange={(next) => props.state.update({ pricePerMetre: next })}
						/>
					</Row>

					<Row label="ほつれやすさ" hint="ほつれやすい生地はジグザグでは足りません">
						<Choice
							options={[
								{ value: "yes", label: "ほつれる" },
								{ value: "no", label: "しにくい" },
							]}
							value={props.state.fabric.frayProne ? "yes" : "no"}
							onSelect={(value) => props.state.update({ frayProne: value === "yes" })}
						/>
					</Row>
				</section>
			</div>
		</div>
	)
}

export type { DraftSearch }
