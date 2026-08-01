import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/_layout")({
	component: LayoutComponent,
})

function LayoutComponent() {
	return (
		<div className="min-h-screen bg-background text-foreground">
			<Outlet />
		</div>
	)
}
