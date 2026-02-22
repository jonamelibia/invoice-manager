<script lang="ts">
    import { createEventDispatcher } from "svelte";

    let { show = false, targetFolderId, onClose, onUploadSuccess } = $props();

    let isDragging = $state(false);
    let isUploading = $state(false);
    let selectedFile = $state<File | null>(null);
    let uploadProgress = $state(0);
    let errorMsg = $state<string | null>(null);

    function handleDragOver(e: DragEvent) {
        e.preventDefault();
        isDragging = true;
    }

    function handleDragLeave(e: DragEvent) {
        e.preventDefault();
        isDragging = false;
    }

    function handleDrop(e: DragEvent) {
        e.preventDefault();
        isDragging = false;
        errorMsg = null;

        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
            handleFileSelection(e.dataTransfer.files[0]);
        }
    }

    function handleFileInput(e: Event) {
        errorMsg = null;
        const target = e.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
            handleFileSelection(target.files[0]);
        }
    }

    function handleFileSelection(file: File) {
        // Validación básica
        const validTypes = [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp",
        ];
        if (!validTypes.includes(file.type)) {
            errorMsg =
                "Solo se permiten archivos PDF o imágenes (JPG, PNG, WEBP).";
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            // 10MB limit
            errorMsg = "El archivo es demasiado grande. Máximo 10MB.";
            return;
        }

        selectedFile = file;
    }

    async function uploadFile() {
        if (!selectedFile || !targetFolderId) return;

        isUploading = true;
        errorMsg = null;

        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("folderId", targetFolderId);

        try {
            // Se asume XMLHttpRequest para simular progreso (fetch envia todo de golpe en front)
            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.upload.addEventListener("progress", (e) => {
                    if (e.lengthComputable) {
                        uploadProgress = Math.round((e.loaded / e.total) * 100);
                    }
                });

                xhr.addEventListener("load", () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(JSON.parse(xhr.responseText));
                    } else {
                        try {
                            const err = JSON.parse(xhr.responseText);
                            reject(
                                new Error(err.message || "Error en la subida"),
                            );
                        } catch {
                            reject(
                                new Error(`Error del servidor: ${xhr.status}`),
                            );
                        }
                    }
                });

                xhr.addEventListener("error", () =>
                    reject(new Error("Error de red al subir")),
                );

                xhr.open("POST", "/api/drive/upload");
                xhr.send(formData);
            });

            onUploadSuccess?.();
            handleClose();
        } catch (e: any) {
            errorMsg = e.message || "Error al subir el archivo.";
        } finally {
            isUploading = false;
        }
    }

    function handleClose() {
        selectedFile = null;
        uploadProgress = 0;
        errorMsg = null;
        onClose?.();
    }
</script>

{#if show}
    <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onclick={handleClose}
    >
        <div
            class="bg-surface-bg border border-surface-glass-border w-full max-w-md rounded-2xl shadow-2xl shadow-brand-500/10 overflow-hidden flex flex-col"
            onclick={(e) => e.stopPropagation()}
        >
            <div
                class="p-5 border-b border-surface-glass-border flex justify-between items-center bg-white/5"
            >
                <h3 class="text-lg font-bold text-white">Subir Factura</h3>
                <button
                    class="text-slate-400 hover:text-white transition-colors"
                    onclick={handleClose}
                    disabled={isUploading}
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
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            </div>

            <div class="p-6">
                {#if errorMsg}
                    <div
                        class="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-lg mb-6 text-sm flex items-start gap-3"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-5 w-5 shrink-0"
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

                {#if !selectedFile}
                    <!-- Drop area -->
                    <div
                        class="border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center transition-colors {isDragging
                            ? 'border-brand-500 bg-brand-500/10'
                            : 'border-surface-glass-border hover:border-brand-500/50 hover:bg-white/5'}"
                        ondragover={handleDragOver}
                        ondragleave={handleDragLeave}
                        ondrop={handleDrop}
                    >
                        <div
                            class="w-16 h-16 bg-brand-500/20 text-brand-400 rounded-full flex items-center justify-center mb-4"
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
                                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                />
                            </svg>
                        </div>
                        <p class="text-white font-medium mb-1">
                            Arrastra tu archivo aquí
                        </p>
                        <p class="text-sm text-slate-400 mb-6">
                            PDF, PNG, JPG hasta 10MB
                        </p>

                        <div class="flex gap-3">
                            <!-- Botón escáner (móvil) -->
                            <label
                                class="btn btn-secondary flex items-center gap-2 cursor-pointer text-sm"
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
                                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                                    />
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                </svg>
                                Escanear
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    class="hidden"
                                    onchange={handleFileInput}
                                />
                            </label>

                            <!-- Botón seleccionar normal -->
                            <label
                                class="btn btn-primary flex items-center gap-2 cursor-pointer text-sm"
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
                                        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                                    />
                                </svg>
                                Archivo
                                <input
                                    type="file"
                                    accept=".pdf,image/jpeg,image/png,image/webp"
                                    class="hidden"
                                    onchange={handleFileInput}
                                />
                            </label>
                        </div>
                    </div>
                {:else}
                    <!-- Vista previa del archivo seleccionado -->
                    <div
                        class="border border-brand-500/30 bg-brand-500/5 rounded-xl p-5 flex items-center justify-between"
                    >
                        <div class="flex items-center gap-4 overflow-hidden">
                            <div
                                class="w-12 h-12 shrink-0 bg-brand-500/20 text-brand-400 rounded-lg flex items-center justify-center"
                            >
                                {#if selectedFile.type === "application/pdf"}
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="h-6 w-6"
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
                                {:else}
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="h-6 w-6"
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
                                {/if}
                            </div>
                            <div class="flex flex-col flex-1 min-w-0">
                                <span
                                    class="text-white font-medium truncate text-sm"
                                    >{selectedFile.name}</span
                                >
                                <span class="text-slate-400 text-xs mt-0.5"
                                    >{(selectedFile.size / 1024 / 1024).toFixed(
                                        2,
                                    )} MB</span
                                >
                            </div>
                        </div>

                        {#if !isUploading}
                            <button
                                class="text-slate-400 hover:text-rose-400 shrink-0 p-2 transition-colors"
                                onclick={() => (selectedFile = null)}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    class="h-5 w-5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    stroke-width="2"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                </svg>
                            </button>
                        {/if}
                    </div>

                    <!-- Botón de acción uploader -->
                    <div class="mt-6 flex flex-col gap-3">
                        {#if isUploading}
                            <div
                                class="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden"
                            >
                                <div
                                    class="bg-brand-500 h-2.5 rounded-full transition-all duration-300 ease-out"
                                    style="width: {uploadProgress}%"
                                ></div>
                            </div>
                            <p class="text-xs text-center text-slate-400">
                                Subiendo... {uploadProgress}%
                            </p>
                        {:else}
                            <div class="flex gap-3 justify-end">
                                <button
                                    class="btn btn-secondary text-sm px-6"
                                    onclick={handleClose}>Cancelar</button
                                >
                                <button
                                    class="btn btn-primary text-sm px-6 font-semibold"
                                    onclick={uploadFile}
                                    >Confirmar y Subir</button
                                >
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}
