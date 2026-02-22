<script lang="ts">
    import UploadModal from "$lib/components/UploadModal.svelte";
    import FolderTree from "$lib/components/FolderTree.svelte";

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

    let { data } = $props();

    // State
    let tree = $state<TreeNode | null>(null);
    let selectedFolderId = $state<string | null>(null);
    let selectedFolderPath = $state<string>("");
    let files = $state<any[]>([]);
    let loading = $state(false);
    let treeLoading = $state(false);
    let errorMsg = $state(data.error || null);
    let expandedFolders = $state<Set<string>>(new Set());
    let filePreviewUrl = $state<string | null>(null);
    let actionLoading = $state(false);

    let renameModalState = $state<{
        show: boolean;
        fileId: string | null;
        currentName: string;
        newName: string;
    }>({
        show: false,
        fileId: null,
        currentName: "",
        newName: "",
    });
    let deleteModalState = $state<{
        show: boolean;
        fileId: string | null;
        name: string;
    }>({
        show: false,
        fileId: null,
        name: "",
    });

    let showUploadModal = $state(false);

    // Load tree on mount
    $effect(() => {
        if (data.userAuthenticated) {
            loadTree();
        }
    });

    async function loadTree() {
        treeLoading = true;
        errorMsg = null;
        try {
            const res = await fetch("/api/drive/tree");
            if (!res.ok) throw new Error("Error al cargar carpetas");

            tree = await res.json();
        } catch (e: any) {
            errorMsg = e.message;
            tree = null;
        } finally {
            treeLoading = false;
        }
    }

    async function loadFiles(folderId: string) {
        loading = true;
        errorMsg = null;
        try {
            const res = await fetch(`/api/drive/files?folderId=${folderId}`);
            if (!res.ok) throw new Error("Error al obtener archivos");

            const result = await res.json();
            files = result.files || [];
        } catch (e: any) {
            errorMsg = e.message;
            files = [];
        } finally {
            loading = false;
        }
    }

    function handleFolderSelect(detail: {
        id: string;
        name: string;
        path: string;
    }) {
        selectedFolderId = detail.id;
        selectedFolderPath = detail.path;
        loadFiles(detail.id);
    }

    function formatDate(dateString: string) {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toLocaleDateString("es-ES", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    }

    // Count all files recursively
    function countFiles(node: TreeNode | null): number {
        if (!node) return 0;
        let count = node.isFolder ? 0 : 1;
        if (node.children) {
            count += node.children.reduce(
                (sum, child) => sum + countFiles(child),
                0,
            );
        }
        return count;
    }

    function openRenameModal(e: Event, fileId: string, currentName: string) {
        e.preventDefault();
        e.stopPropagation();
        renameModalState = {
            show: true,
            fileId,
            currentName,
            newName: currentName,
        };
    }

    function openDeleteModal(e: Event, fileId: string, name: string) {
        e.preventDefault();
        e.stopPropagation();
        deleteModalState = { show: true, fileId, name };
    }

    async function submitRename() {
        if (
            !renameModalState.fileId ||
            renameModalState.newName === renameModalState.currentName ||
            !renameModalState.newName.trim()
        ) {
            renameModalState.show = false;
            return;
        }

        actionLoading = true;
        try {
            const res = await fetch(
                `/api/drive/files/${renameModalState.fileId}`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: renameModalState.newName.trim(),
                    }),
                },
            );

            if (!res.ok) throw new Error("No se pudo renombrar el archivo");

            files = files.map((f) =>
                f.id === renameModalState.fileId
                    ? { ...f, name: renameModalState.newName.trim() }
                    : f,
            );
        } catch (e: any) {
            errorMsg = e.message;
        } finally {
            actionLoading = false;
            renameModalState.show = false;
        }
    }

    async function submitDelete() {
        if (!deleteModalState.fileId) return;

        actionLoading = true;
        try {
            const res = await fetch(
                `/api/drive/files/${deleteModalState.fileId}`,
                {
                    method: "DELETE",
                },
            );
            if (!res.ok) throw new Error("No se pudo eliminar el archivo");

            files = files.filter((f) => f.id !== deleteModalState.fileId);
        } catch (e: any) {
            errorMsg = e.message;
        } finally {
            actionLoading = false;
            deleteModalState.show = false;
        }
    }
</script>

<UploadModal
    show={showUploadModal}
    targetFolderId={selectedFolderId}
    onClose={() => (showUploadModal = false)}
    onUploadSuccess={() => selectedFolderId && loadFiles(selectedFolderId)}
/>

{#if !data.userAuthenticated}
    <section
        class="glass-panel p-8 text-center flex flex-col items-center justify-center min-h-[40vh]"
    >
        <div
            class="w-16 h-16 bg-brand-500/20 rounded-2xl flex items-center justify-center mb-6 border border-brand-500/30 text-brand-400"
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
            </svg>
        </div>
        <h2 class="text-3xl font-bold text-white mb-3">
            Autenticación Requerida
        </h2>
        <p class="text-slate-400 max-w-md mx-auto mb-6">
            Conecta tu cuenta de Google Drive arriba para empezar a gestionar
            tus facturas automáticamente en la nube.
        </p>
    </section>
{:else}
    <div class="flex flex-col lg:flex-row gap-4 lg:gap-6">
        <!-- Tree panel - left side -->
        <aside
            class="glass-panel p-4 lg:p-5 w-full lg:w-80 flex flex-col gap-3 lg:gap-4 max-h-[50vh] lg:h-fit lg:max-h-[80vh] shrink-0"
        >
            <div
                class="flex items-center justify-between border-b border-surface-glass-border pb-3"
            >
                <h3
                    class="text-lg font-semibold text-white flex items-center gap-2"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-5 w-5 text-brand-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                        />
                    </svg>
                    Explorador
                </h3>
                <button
                    class="text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-white/5"
                    onclick={loadTree}
                    disabled={treeLoading}
                    aria-label="Recargar carpetas"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4 {treeLoading ? 'animate-spin' : ''}"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                    </svg>
                </button>
            </div>

            {#if errorMsg}
                <div
                    class="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-lg text-sm flex items-start gap-2"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4 shrink-0 mt-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                    {errorMsg}
                </div>
            {/if}

            <div class="flex-1 overflow-y-auto -mx-2 px-2">
                {#if treeLoading}
                    <div
                        class="flex flex-col items-center justify-center py-8 text-slate-400"
                    >
                        <div
                            class="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-3"
                        ></div>
                        <p class="text-sm">Cargando carpetas...</p>
                    </div>
                {:else if tree}
                    <FolderTree
                        node={tree}
                        bind:selectedFolderId
                        bind:expandedFolders
                        onfolderSelect={handleFolderSelect}
                    />
                {:else}
                    <div
                        class="flex flex-col items-center justify-center py-8 text-slate-500"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-12 w-12 mb-3 opacity-50"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            stroke-width="1"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                            />
                        </svg>
                        <p class="text-sm">No hay carpetas</p>
                    </div>
                {/if}
            </div>

            {#if tree}
                <div
                    class="pt-3 border-t border-surface-glass-border text-xs text-slate-500"
                >
                    <div class="flex justify-between">
                        <span>Total archivos:</span>
                        <span class="text-slate-400">{countFiles(tree)}</span>
                    </div>
                </div>
            {/if}
        </aside>

        <!-- Content panel - right side -->
        <main
            class="glass-panel p-4 lg:p-6 flex-1 flex flex-col min-h-[50vh] lg:min-h-[60vh]"
        >
            <div class="flex justify-between items-center mb-6">
                <div class="flex items-center gap-3">
                    <h2
                        class="text-xl font-bold text-white flex items-center gap-2"
                    >
                        Archivos
                        {#if loading}
                            <span
                                class="w-4 h-4 rounded-full border-2 border-brand-500 border-t-transparent animate-spin inline-block"
                            ></span>
                        {/if}
                    </h2>
                    {#if selectedFolderPath}
                        <span
                            class="text-xs text-brand-400 font-mono bg-brand-500/10 px-2 py-1 rounded"
                        >
                            {selectedFolderPath}
                        </span>
                    {/if}
                </div>

                <button
                    class="btn btn-primary flex items-center gap-2 shadow-brand-500/20 shadow-lg text-sm"
                    disabled={!selectedFolderId}
                    onclick={() => (showUploadModal = true)}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                        />
                    </svg>
                    Subir Archivo
                </button>
            </div>

            {#if !selectedFolderId}
                <div
                    class="flex-1 flex flex-col items-center justify-center text-slate-400"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-16 w-16 mb-4 opacity-50"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="1"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                        />
                    </svg>
                    <p class="text-lg">Selecciona una carpeta</p>
                    <p class="text-sm text-slate-500 mt-1">
                        Haz clic en una carpeta del árbol para ver sus archivos
                    </p>
                </div>
            {:else if !loading && files.length === 0}
                <div
                    class="flex-1 flex flex-col items-center justify-center text-slate-400"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-16 w-16 mb-4 opacity-50"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="1"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                    </svg>
                    <p class="text-lg">Carpeta vacía</p>
                    <p class="text-sm text-slate-500 mt-1">
                        Sube archivos pulsando el botón superior
                    </p>
                </div>
            {:else if files.length > 0}
                <div
                    class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                    {#each files as file}
                        <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onclick={(e) => {
                                if (file.webViewLink) {
                                    e.preventDefault();
                                    filePreviewUrl = file.webViewLink.replace(
                                        "/view",
                                        "/preview",
                                    );
                                }
                            }}
                            class="group bg-surface-bg border border-surface-glass-border rounded-xl p-4 hover:border-brand-500/50 transition-all hover:shadow-lg hover:shadow-brand-500/10 flex flex-col gap-3 relative"
                        >
                            <div
                                class="absolute top-2 right-2 transition-opacity bg-surface-bg/90 backdrop-blur rounded p-1 flex gap-1 z-10 border border-surface-glass-border"
                            >
                                <button
                                    class="p-1.5 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
                                    onclick={(e) =>
                                        openRenameModal(e, file.id, file.name)}
                                    title="Renombrar"
                                    aria-label="Renombrar"
                                    disabled={actionLoading}
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="h-4 w-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="2"
                                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                        />
                                    </svg>
                                </button>
                                <button
                                    class="p-1.5 hover:bg-rose-500/20 rounded text-slate-400 hover:text-rose-400 transition-colors"
                                    onclick={(e) =>
                                        openDeleteModal(e, file.id, file.name)}
                                    title="Eliminar"
                                    aria-label="Eliminar"
                                    disabled={actionLoading}
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="h-4 w-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="2"
                                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                        />
                                    </svg>
                                </button>
                            </div>

                            <div
                                class="w-full h-32 bg-slate-800 rounded-lg overflow-hidden relative flex items-center justify-center"
                            >
                                {#if file.thumbnailLink}
                                    <img
                                        src={file.thumbnailLink}
                                        alt={file.name}
                                        class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                    />
                                {:else if file.mimeType === "application/pdf"}
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="h-12 w-12 text-red-500 drop-shadow-lg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        stroke-width="1.5"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                        />
                                    </svg>
                                {:else if file.mimeType?.includes("spreadsheet") || file.mimeType?.includes("excel") || file.mimeType?.includes("csv")}
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="h-12 w-12 text-green-500 drop-shadow-lg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        stroke-width="1.5"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                        />
                                    </svg>
                                {:else if file.mimeType?.includes("word") || file.mimeType?.includes("document")}
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="h-12 w-12 text-blue-500 drop-shadow-lg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        stroke-width="1.5"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                        />
                                    </svg>
                                {:else}
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="h-12 w-12 text-slate-500 drop-shadow-lg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        stroke-width="1.5"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                        />
                                    </svg>
                                {/if}
                                <div
                                    class="absolute inset-0 bg-gradient-to-t from-surface-bg via-transparent to-transparent opacity-80"
                                ></div>
                            </div>

                            <div class="flex flex-col">
                                <span
                                    class="text-sm font-medium text-white truncate"
                                    title={file.name}>{file.name}</span
                                >
                                <span
                                    class="text-xs text-slate-500 mt-1 flex items-center gap-1"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="h-3 w-3"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        stroke-width="2"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                    {formatDate(file.createdTime)}
                                </span>
                            </div>
                        </a>
                    {/each}
                </div>
            {:else}
                <div
                    class="flex-1 flex items-center justify-center text-slate-400"
                >
                    <div
                        class="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"
                    ></div>
                </div>
            {/if}
        </main>
    </div>

    {#if filePreviewUrl}
        <div
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
            <div
                class="glass-panel w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden relative border border-surface-glass-border shadow-2xl"
            >
                <div
                    class="flex justify-between items-center p-3 lg:p-4 border-b border-surface-glass-border bg-surface-bg"
                >
                    <h3
                        class="text-white font-medium flex items-center gap-2 text-sm lg:text-base"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-5 w-5 text-brand-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                        </svg>
                        Vista Previa
                    </h3>
                    <button
                        class="text-slate-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-lg"
                        onclick={() => (filePreviewUrl = null)}
                        aria-label="Cerrar vista previa"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>
                <div class="flex-1 w-full bg-slate-200">
                    <iframe
                        src={filePreviewUrl}
                        class="w-full h-full border-0"
                        title="File Preview"
                    ></iframe>
                </div>
            </div>
        </div>
    {/if}

    <!-- Modal de Renombrar -->
    {#if renameModalState.show}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
            onclick={() => (renameModalState.show = false)}
        >
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="bg-surface-bg border border-surface-glass-border w-full max-w-sm rounded-2xl shadow-2xl p-6"
                onclick={(e) => e.stopPropagation()}
            >
                <h3 class="text-lg font-bold text-white mb-4">
                    Renombrar archivo
                </h3>
                <input
                    type="text"
                    bind:value={renameModalState.newName}
                    class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 mb-6"
                    placeholder="Nuevo nombre"
                    autofocus
                />
                <div class="flex justify-end gap-3">
                    <button
                        class="btn btn-secondary text-sm px-4"
                        onclick={() => (renameModalState.show = false)}
                        disabled={actionLoading}>Cancelar</button
                    >
                    <button
                        class="btn btn-primary text-sm px-4 flex items-center gap-2"
                        onclick={submitRename}
                        disabled={actionLoading}
                    >
                        {#if actionLoading}<span
                                class="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"
                            ></span>{/if}
                        Guardar
                    </button>
                </div>
            </div>
        </div>
    {/if}

    <!-- Modal de Eliminar -->
    {#if deleteModalState.show}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
            onclick={() => (deleteModalState.show = false)}
        >
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="bg-surface-bg border border-surface-glass-border w-full max-w-sm rounded-2xl shadow-2xl p-6"
                onclick={(e) => e.stopPropagation()}
            >
                <div
                    class="w-12 h-12 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center mb-4"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                    </svg>
                </div>
                <h3 class="text-lg font-bold text-white mb-2">
                    Eliminar archivo
                </h3>
                <p class="text-slate-400 text-sm mb-6">
                    ¿Estás seguro de que deseas eliminar <strong
                        >{deleteModalState.name}</strong
                    >? Este archivo se moverá a la papelera de Google Drive.
                </p>
                <div class="flex justify-end gap-3">
                    <button
                        class="btn btn-secondary text-sm px-4"
                        onclick={() => (deleteModalState.show = false)}
                        disabled={actionLoading}>Cancelar</button
                    >
                    <button
                        class="btn flex flex-row items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white font-medium py-2 px-4 rounded-xl transition-all disabled:opacity-50 text-sm"
                        onclick={submitDelete}
                        disabled={actionLoading}
                    >
                        {#if actionLoading}<span
                                class="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"
                            ></span>{/if}
                        Eliminar
                    </button>
                </div>
            </div>
        </div>
    {/if}
{/if}
