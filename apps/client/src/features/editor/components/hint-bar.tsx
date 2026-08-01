import { findPanel } from "@/lib/drafting/draft"
import type { Editor } from "../use-editor"

/**
 * What can be done, right now, to whatever is selected.
 *
 * Every verb in this editor lives on a right-click menu or on a gesture, which
 * keeps the chrome quiet but leaves nothing on screen saying they exist. This is
 * the line that says so, and it is the difference between a drawing you can look
 * at and a tool you can pick up.
 */
function hintFor(editor: Editor): string {
	const { selection, draft } = editor

	if (editor.mode === "cutting") {
		return "生地の幅を変えると、置き方と買う長さが変わります。"
	}

	if (editor.mode === "finished") {
		return "「たたむ」は台に置いた形、「開く」は折りをほどいた形です。"
	}

	if (editor.mode === "assemble") {
		if (editor.pending !== undefined) {
			const panel = findPanel(draft, editor.pending.panelId)

			return `${panel?.name ?? "部品"}の辺を選びました。合わせたい辺をクリックしてください。`
		}

		if (selection.seamId !== undefined) {
			return "縫いを右クリックすると、ほどく・向きを反転・折る／開く ができます。"
		}

		return "赤いふちはまだ縫われていないところです。辺を2つクリックすると縫い合わせます。"
	}

	if (editor.tool === "pen") {
		return "クリックで点を置きます。最初の点まで戻ると閉じて、1枚の部品になります。"
	}

	if (selection.vertexId !== undefined) {
		return "点はドラッグで動かせます。右クリックで 角を丸める・点を消す ができます。"
	}

	if (selection.edgeVertexId !== undefined) {
		return "辺を右クリックすると、ふくらませる・わにする・点を足す ができます。"
	}

	if (selection.panelId !== undefined) {
		return "角の点をドラッグすると形が変わります。部品を右クリックで 複製・削除。"
	}

	if (draft.panels.length === 0) {
		return "右クリックか、上の□ボタンで最初の部品を置きます。"
	}

	return "部品をクリックすると選べます。そのまま角の点をドラッグすると形が変わります。"
}

interface HintBarProps {
	editor: Editor
}

export function HintBar(props: HintBarProps) {
	return (
		<div className="shrink-0 border-b bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
			{hintFor(props.editor)}
		</div>
	)
}
