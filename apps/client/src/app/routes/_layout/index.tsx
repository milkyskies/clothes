import { createFileRoute } from "@tanstack/react-router"
import { EditorPage } from "@/features/editor/components/editor-page"

export const Route = createFileRoute("/_layout/")({
	component: EditorPage,
})
