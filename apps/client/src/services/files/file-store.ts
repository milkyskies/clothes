import type { Draft, FileRecord, Recovery } from "@/lib/drafting/schema"

export interface FileSummary {
	readonly id: string
	readonly name: string
	readonly updatedAt: number
}

/**
 * Where drafts are kept.
 *
 * Every method is asynchronous even though the local implementation is not, so
 * that a server-backed store can be dropped in without the editor changing.
 */
export interface FileStore {
	list(): Promise<readonly FileSummary[]>
	read(id: string): Promise<FileRecord | undefined>
	write(record: FileRecord): Promise<void>
	remove(id: string): Promise<void>

	/** Unsaved state held against a file, if any survived the last session. */
	readRecovery(fileId: string): Promise<Recovery | undefined>
	writeRecovery(recovery: Recovery): Promise<void>
	clearRecovery(fileId: string): Promise<void>
}

export function newFileId(): string {
	return `file-${Math.random().toString(36).slice(2, 10)}`
}

export function fileFrom(draft: Draft, name: string, at: number): FileRecord {
	return { id: newFileId(), name, updatedAt: at, draft: { ...draft, name } }
}
