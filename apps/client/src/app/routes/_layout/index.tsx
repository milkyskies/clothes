import { createFileRoute } from "@tanstack/react-router"
import { DrafterPage } from "@/features/drafter/components/drafter-page"
import { validateDraftSearch } from "@/features/drafter/use-draft-state"

export const Route = createFileRoute("/_layout/")({
	validateSearch: validateDraftSearch,
	component: DrafterPage,
})
