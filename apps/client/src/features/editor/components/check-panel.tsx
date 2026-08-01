import { useMemo, useState } from "react"
import { type CheckResult, checkDraft, type Severity } from "@/lib/drafting/check"
import type { Editor } from "../use-editor"

const DOT: Record<Severity, string> = {
	error: "bg-destructive",
	warn: "bg-warning",
	info: "bg-muted-foreground/40",
}

const SHOWN = 6

function summarise(results: readonly CheckResult[]): string {
	const errors = results.filter((entry) => entry.severity === "error").length
	const warnings = results.filter((entry) => entry.severity === "warn").length

	if (errors > 0) return `直すところ ${errors}`
	if (warnings > 0) return `気になるところ ${warnings}`

	return "縫えます"
}

interface CheckRowProps {
	result: CheckResult
	onChoose: () => void
}

function CheckRow(props: CheckRowProps) {
	return (
		<li>
			<button
				type="button"
				onClick={props.onChoose}
				className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-muted"
				title={props.result.detail}
			>
				<span
					className={`mt-1.5 size-1.5 shrink-0 rounded-full ${DOT[props.result.severity]}`}
					aria-hidden
				/>
				<span className="min-w-0 flex-1">
					<span className="block truncate text-xs">{props.result.title}</span>
					{props.result.severity === "info" ? null : (
						<span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
							{props.result.detail}
						</span>
					)}
				</span>
			</button>
		</li>
	)
}

interface CheckPanelProps {
	editor: Editor
}

/**
 * The running answer to the only question the tool exists for: will the pieces
 * I cut go together. It stays on screen in both modes because a draft stops
 * being sound the moment a line moves, not when someone remembers to look.
 */
export function CheckPanel(props: CheckPanelProps) {
	const [expanded, setExpanded] = useState(false)

	const results = useMemo(() => checkDraft(props.editor.draft), [props.editor.draft])
	const shown = expanded ? results : results.slice(0, SHOWN)

	function choose(result: CheckResult) {
		props.editor.setMode(result.fix)
		props.editor.select(result.target)
	}

	return (
		<section className="flex max-h-72 flex-col border-t">
			<header className="flex shrink-0 items-baseline justify-between px-4 pt-3 pb-1">
				<h2 className="text-xs font-medium text-muted-foreground">{"チェック"}</h2>
				<span className="text-xs text-muted-foreground">{summarise(results)}</span>
			</header>

			<ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
				{shown.map((result) => (
					<CheckRow key={result.id} result={result} onChoose={() => choose(result)} />
				))}
			</ul>

			{results.length > SHOWN ? (
				<button
					type="button"
					onClick={() => setExpanded((open) => !open)}
					className="shrink-0 border-t px-4 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
				>
					{expanded ? "とじる" : `ほか ${results.length - SHOWN} 件`}
				</button>
			) : null}
		</section>
	)
}
