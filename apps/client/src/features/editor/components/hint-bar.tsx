import { Button } from "@/features/shared/ui/button"
import { findPanel } from "@/lib/drafting/draft"
import { selectionActions } from "../actions"
import type { Editor } from "../use-editor"

/**
 * What can be done, right now, to whatever is selected.
 *
 * Every verb in this editor also lives on a right-click menu, which keeps the
 * canvas quiet but leaves nothing on screen saying they exist. This is the line
 * that says so, and it is the difference between a drawing you can look at and
 * a tool you can pick up.
 */
function hintFor(editor: Editor): string {
	const { selection, draft } = editor

	if (editor.mode === "cutting") {
		return "生地の幅を変えると、置き方と買う長さが変わります。"
	}

	if (editor.mode === "finished") {
		return "「たたむ」は台に置いた形、「開く」は折りをほどいた形です。"
	}

	if (editor.mode === "wear") {
		return "ドラッグで回して見られます。布は縫い方のとおりに計算で垂れています。"
	}

	if (editor.mode === "assemble") {
		if (editor.pending !== undefined) {
			const panel = findPanel(draft, editor.pending.panelId)

			return `${panel?.name ?? "部品"}の辺を選びました。合わせたい辺をクリックしてください。`
		}

		if (editor.tool === "sew") {
			return "「ぬう」中です。赤いふちを2つクリックすると縫い合わせます。"
		}

		if (selection.seamId !== undefined || selection.edgeVertexId !== undefined) {
			return "この辺にできることが右にあります。"
		}

		return "赤いふち＝まだ縫われていないところ。縫うには上の「ぬう」を選びます。"
	}

	if (editor.tool === "pen") {
		return "クリックで点を置きます。最初の点まで戻ると閉じて、1枚の部品になります。"
	}

	if (selection.vertexId !== undefined) return "点はドラッグでも動かせます。"
	if (selection.edgeVertexId !== undefined) return "辺の長さと ふくらみ は右の欄で変えられます。"
	if (selection.panelId !== undefined) return "角の点をドラッグすると形が変わります。"

	if (draft.panels.length === 0) {
		return "何もないところを右クリックするか、上の□ボタンで最初の部品を置きます。"
	}

	return "部品をクリックすると選べます。そのまま角の点をドラッグすると形が変わります。"
}

interface HintBarProps {
	editor: Editor
}

export function HintBar(props: HintBarProps) {
	const { title, actions } = selectionActions(props.editor)

	// The bar carries what you reach for; the right-click menu carries the rest.
	const shown = actions.slice(0, 3)

	return (
		<div className="flex h-8 shrink-0 items-center gap-3 overflow-hidden border-b bg-muted/40 px-3">
			<span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
				{title === "" ? hintFor(props.editor) : title}
			</span>

			<div className="flex shrink-0 items-center gap-1">
				{shown.map((action) => (
					<Button
						key={action.label}
						variant="outline"
						size="sm"
						className={`h-6 px-2 text-xs ${action.danger ? "text-destructive" : ""}`}
						onClick={action.run}
					>
						<action.icon className="size-3" />
						{action.label}
					</Button>
				))}
			</div>
		</div>
	)
}
