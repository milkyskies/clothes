import { DeleteIcon } from "@/features/shared/icons/delete-icon"
import { Button } from "@/features/shared/ui/button"
import { Input } from "@/features/shared/ui/input"
import { Label } from "@/features/shared/ui/label"
import type { EdgeRef, Stitch } from "@/lib/drafting/draft"
import { findPanel } from "@/lib/drafting/draft"
import {
	addStitch,
	removeStitch,
	STITCH_KINDS,
	stitchesOnEdge,
	updateStitch,
} from "@/lib/drafting/stitch"
import type { Editor } from "../use-editor"

interface StitchRowProps {
	editor: Editor
	stitch: Stitch
}

function StitchRow(props: StitchRowProps) {
	const { draft } = props.editor

	function set(patch: Partial<Stitch>) {
		props.editor.apply(updateStitch(draft, props.stitch.id, patch))
	}

	return (
		<li className="space-y-1.5 rounded-md border p-2">
			<div className="flex items-center gap-1">
				<Input
					value={props.stitch.name}
					onChange={(event) => set({ name: event.target.value })}
					className="h-7 flex-1 text-sm"
				/>
				<Button
					variant="ghost"
					size="icon"
					className="size-7 shrink-0"
					onClick={() => props.editor.apply(removeStitch(draft, props.stitch.id))}
					title="消す"
				>
					<DeleteIcon className="size-3.5" />
				</Button>
			</div>

			<div className="flex gap-0.5">
				{STITCH_KINDS.map((kind) => (
					<Button
						key={kind.value}
						variant={props.stitch.kind === kind.value ? "default" : "ghost"}
						size="sm"
						className="h-6 flex-1 px-1 text-[11px]"
						onClick={() => set({ kind: kind.value })}
					>
						{kind.label}
					</Button>
				))}
			</div>

			<div className="flex gap-2">
				<Label className="flex flex-1 items-center gap-1 text-xs font-normal text-muted-foreground">
					<span>{"きわから"}</span>
					<Input
						type="number"
						step={0.1}
						min={0}
						value={props.stitch.offset}
						onChange={(event) => set({ offset: Number(event.target.value) })}
						className="tnum h-7 w-full text-right text-xs"
					/>
					<span>{"cm"}</span>
				</Label>

				<Label className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
					<span>{"本数"}</span>
					<Input
						type="number"
						step={1}
						min={1}
						value={props.stitch.rows}
						onChange={(event) => set({ rows: Math.max(1, Math.round(Number(event.target.value))) })}
						className="tnum h-7 w-12 text-right text-xs"
					/>
				</Label>
			</div>
		</li>
	)
}

interface StitchSectionProps {
	editor: Editor
	edge: EdgeRef
}

/**
 * Stitching that decorates or finishes an edge rather than joining two.
 *
 * It shares the 組み立て screen with seams because both answer the same question
 * about a chosen edge — what happens to it — and neither changes its shape.
 */
export function StitchSection(props: StitchSectionProps) {
	const { draft } = props.editor
	const held = stitchesOnEdge(draft, props.edge)
	const panel = findPanel(draft, props.edge.panelId)

	return (
		<section className="space-y-2 border-t p-4">
			<div className="flex items-baseline justify-between">
				<h2 className="text-xs font-medium text-muted-foreground">{"この辺のステッチ"}</h2>
				<span className="text-xs text-muted-foreground">{panel?.name ?? ""}</span>
			</div>

			<ul className="space-y-2">
				{held.map((stitch) => (
					<StitchRow key={stitch.id} editor={props.editor} stitch={stitch} />
				))}
			</ul>

			<div className="flex gap-0.5">
				{STITCH_KINDS.map((kind) => (
					<Button
						key={kind.value}
						variant="outline"
						size="sm"
						className="h-7 flex-1 px-1 text-[11px]"
						onClick={() => props.editor.apply(addStitch(draft, props.edge, kind.value))}
					>
						{kind.label}
					</Button>
				))}
			</div>
		</section>
	)
}
