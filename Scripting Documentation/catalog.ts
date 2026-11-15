import bundledDocs from "./doc.json"
import type { DocItem } from "./types"

// Unreleased protected-script entries are removed from doc.json. Their metadata
// is retained in mydocs/specs/retained/ProtectedScripts_DocumentationEntry.json.
// Restore that entry only after launch approval; source Markdown is preserved.
export const docList: DocItem[] = bundledDocs
