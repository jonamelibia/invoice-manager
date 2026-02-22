<script lang="ts">
    interface TreeNode {
        id: string;
        name: string;
        mimeType: string;
        isFolder: boolean;
        webViewLink?: string;
        thumbnailLink?: string;
        createdTime?: string;
        children?: TreeNode[];
    }

    interface FlatNode {
        id: string;
        name: string;
        mimeType: string;
        isFolder: boolean;
        webViewLink?: string;
        thumbnailLink?: string;
        createdTime?: string;
        level: number;
        hasChildren: boolean;
    }

    let {
        node,
        selectedFolderId = $bindable(null),
        expandedFolders = $bindable(new Set<string>()),
        onfolderSelect,
    }: {
        node: TreeNode;
        selectedFolderId?: string | null;
        expandedFolders?: Set<string>;
        onfolderSelect?: (data: {
            id: string;
            name: string;
            path: string;
        }) => void;
    } = $props();

    // Convert tree to flat list with levels
    function flattenTree(node: TreeNode, level: number = 0): FlatNode[] {
        const result: FlatNode[] = [];

        if (!node.children) return result;

        // Sort: folders first, then files
        const sorted = [...node.children].sort((a, b) => {
            if (a.isFolder && !b.isFolder) return -1;
            if (!a.isFolder && b.isFolder) return 1;
            return a.name.localeCompare(b.name);
        });

        for (const child of sorted) {
            result.push({
                id: child.id,
                name: child.name,
                mimeType: child.mimeType,
                isFolder: child.isFolder,
                webViewLink: child.webViewLink,
                thumbnailLink: child.thumbnailLink,
                createdTime: child.createdTime,
                level,
                hasChildren:
                    child.isFolder && (child.children?.length ?? 0) > 0,
            });

            // If folder is expanded, add its children
            if (
                child.isFolder &&
                expandedFolders.has(child.id) &&
                child.children
            ) {
                result.push(...flattenTree(child, level + 1));
            }
        }

        return result;
    }

    let flatNodes = $derived(flattenTree(node));

    function toggleFolder(folderId: string) {
        const newExpanded = new Set(expandedFolders);
        if (newExpanded.has(folderId)) {
            newExpanded.delete(folderId);
        } else {
            newExpanded.add(folderId);
        }
        expandedFolders = newExpanded;
    }

    function selectFolder(folderNode: FlatNode) {
        selectedFolderId = folderNode.id;
        if (onfolderSelect) {
            onfolderSelect({
                id: folderNode.id,
                name: folderNode.name,
                path: folderNode.name,
            });
        }
    }

    function formatDate(dateString?: string) {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "short",
        });
    }
</script>

<div class="select-none">
    {#each flatNodes as flatNode (flatNode.id + "-" + flatNode.level)}
        {#if flatNode.isFolder}
            <!-- Folder row -->
            <div
                class="flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-all duration-150 group
                    {selectedFolderId === flatNode.id
                    ? 'bg-brand-500/20 text-brand-400'
                    : 'hover:bg-white/5 text-slate-300 hover:text-white'}"
                style="padding-left: {flatNode.level * 16 + 8}px"
                onclick={() => selectFolder(flatNode)}
                ondblclick={() => toggleFolder(flatNode.id)}
                role="button"
                tabindex="0"
                onkeydown={(e) => e.key === "Enter" && selectFolder(flatNode)}
            >
                <!-- Expand/collapse arrow -->
                {#if flatNode.hasChildren}
                    <button
                        class="shrink-0 w-4 h-4 flex items-center justify-center text-slate-500 hover:text-white transition-transform duration-200 {expandedFolders.has(
                            flatNode.id,
                        )
                            ? 'rotate-90'
                            : ''}"
                        onclick={(e) => {
                            e.stopPropagation();
                            toggleFolder(flatNode.id);
                        }}
                        type="button"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-3 w-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            stroke-width="3"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M9 5l7 7-7 7"
                            />
                        </svg>
                    </button>
                {:else}
                    <span class="w-4 h-4 shrink-0"></span>
                {/if}

                <!-- Folder icon -->
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4 shrink-0 {selectedFolderId === flatNode.id
                        ? 'text-brand-400'
                        : 'text-yellow-500'}"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        d="M3 7V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V9C21 7.89543 20.1046 7 19 7H13L11 5H5C3.89543 5 3 5.89543 3 7Z"
                    />
                </svg>

                <!-- Folder name -->
                <span class="truncate text-sm font-medium flex-1"
                    >{flatNode.name}</span
                >
            </div>
        {:else}
            <!-- File row -->
            <a
                href={flatNode.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white cursor-pointer transition-all"
                style="padding-left: {flatNode.level * 16 + 8}px"
            >
                <span class="w-4 h-4 shrink-0"></span>

                <!-- File icon -->
                {#if flatNode.thumbnailLink}
                    <img
                        src={flatNode.thumbnailLink}
                        alt={flatNode.name}
                        class="h-4 w-4 rounded object-cover shrink-0"
                    />
                {:else if flatNode.mimeType === "application/pdf"}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4 shrink-0 text-red-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                    </svg>
                {:else if flatNode.mimeType?.startsWith("image/")}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4 shrink-0 text-blue-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                    </svg>
                {:else}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4 shrink-0 text-slate-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                        />
                    </svg>
                {/if}

                <!-- File name -->
                <span class="truncate text-sm flex-1">
                    {flatNode.name}
                </span>

                <!-- Date -->
                <span class="text-xs text-slate-600 shrink-0">
                    {formatDate(flatNode.createdTime)}
                </span>
            </a>
        {/if}
    {/each}
</div>
