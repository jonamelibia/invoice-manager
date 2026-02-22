<script lang="ts">
    import { enhance } from "$app/forms";
    import UploadModal from "$lib/components/UploadModal.svelte";

    let { data } = $props();

    // Estado local copiado de la carga del servidor
    let files = $state(data.files || []);
    let folderId = $state(data.folderId || null);
    let selectedYear = $state(
        data.defaultYear || new Date().getFullYear().toString(),
    );
    let selectedMonth = $state(
        data.defaultMonth ||
            (new Date().getMonth() + 1).toString().padStart(2, "0"),
    );
    let selectedType = $state(data.defaultType || "1 - facturas_emitidas");
    let loading = $state(false);
    let errorMsg = $state(data.error || null);

    let showUploadModal = $state(false);

    // Opciones para los selectores
    const years = Array.from({ length: 5 }, (_, i) =>
        (new Date().getFullYear() - i).toString(),
    );
    const months = [
        { value: "01ENERO", label: "Enero" },
        { value: "02FEBRERO", label: "Febrero" },
        { value: "03MARZO", label: "Marzo" },
        { value: "04ABRIL", label: "Abril" },
        { value: "05MAYO", label: "Mayo" },
        { value: "06JUNIO", label: "Junio" },
        { value: "07JULIO", label: "Julio" },
        { value: "08AGOSTO", label: "Agosto" },
        { value: "09SEPTIEMBRE", label: "Septiembre" },
        { value: "10OCTUBRE", label: "Octubre" },
        { value: "11NOVIEMBRE", label: "Noviembre" },
        { value: "12DICIEMBRE", label: "Diciembre" },
    ];
    const types = [
        { value: "facturas_emitidas", label: "Emitidas" },
        { value: "facturas_recibidas", label: "Recibidas" },
    ];

    async function fetchFiles() {
        loading = true;
        errorMsg = null;
        try {
            const res = await fetch(
                `/api/drive/files?year=${selectedYear}&month=${selectedMonth}&type=${encodeURIComponent(selectedType)}`,
            );
            if (!res.ok) throw new Error("Error al obtener archivos");

            const result = await res.json();
            files = result.files;
            folderId = result.folderId;
        } catch (e: any) {
            errorMsg = e.message;
            files = [];
            folderId = null;
        } finally {
            loading = false;
        }
    }

    // Funciones para formato de fecha
    function formatDate(dateString: string) {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toLocaleDateString("es-ES", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    }
</script>

<UploadModal
    show={showUploadModal}
    targetFolderId={folderId}
    onClose={() => (showUploadModal = false)}
    onUploadSuccess={fetchFiles}
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
    <div class="flex flex-col lg:flex-row gap-6">
        <!-- Barra de filtros izquierda -->
        <aside
            class="glass-panel p-5 w-full lg:w-72 flex flex-col gap-5 h-fit shrink-0"
        >
            <h3
                class="text-lg font-semibold text-white border-b border-surface-glass-border pb-3"
            >
                Explorar Facturas
            </h3>

            <div class="flex flex-col gap-2">
                <label for="year" class="text-sm text-slate-400 font-medium"
                    >Año</label
                >
                <select
                    id="year"
                    class="bg-surface-bg border border-surface-glass-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-500"
                    bind:value={selectedYear}
                    onchange={fetchFiles}
                >
                    {#each years as year}
                        <option value={year}>{year}</option>
                    {/each}
                </select>
            </div>

            <div class="flex flex-col gap-2">
                <label for="month" class="text-sm text-slate-400 font-medium"
                    >Mes</label
                >
                <select
                    id="month"
                    class="bg-surface-bg border border-surface-glass-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-500"
                    bind:value={selectedMonth}
                    onchange={fetchFiles}
                >
                    {#each months as month}
                        <option value={month.value}>{month.label}</option>
                    {/each}
                </select>
            </div>

            <div class="flex flex-col gap-2">
                <label for="type" class="text-sm text-slate-400 font-medium"
                    >Tipo</label
                >
                <select
                    id="type"
                    class="bg-surface-bg border border-surface-glass-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-500"
                    bind:value={selectedType}
                    onchange={fetchFiles}
                >
                    {#each types as type}
                        <option value={type.value}>{type.label}</option>
                    {/each}
                </select>
            </div>

            <div class="mt-4 pt-4 border-t border-surface-glass-border">
                <p class="text-xs text-slate-500 text-center">Ruta en Drive:</p>
                <p
                    class="text-xs text-brand-400 font-mono text-center break-all mt-1 bg-brand-500/10 p-2 rounded"
                >
                    facturas/{selectedYear}/{selectedMonth}/{selectedType}
                </p>
            </div>
        </aside>

        <!-- Contenido principal -->
        <main class="glass-panel p-6 flex-1 flex flex-col min-h-[60vh]">
            <div class="flex justify-between items-center mb-6">
                <h2
                    class="text-xl font-bold text-white flex items-center gap-2"
                >
                    Visualizador
                    {#if loading}
                        <span
                            class="w-4 h-4 rounded-full border-2 border-brand-500 border-t-transparent animate-spin inline-block"
                        ></span>
                    {/if}
                </h2>

                <!-- Botón para subir (Lo implementaremos en el próximo paso) -->
                <button
                    class="btn btn-primary flex items-center gap-2 shadow-brand-500/20 shadow-lg text-sm"
                    disabled={!folderId}
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
                    Subir Factura
                </button>
            </div>

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

            {#if !loading && files.length === 0 && !errorMsg}
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
            {:else}
                <div
                    class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                    {#each files as file}
                        <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="group bg-surface-bg border border-surface-glass-border rounded-xl p-4 hover:border-brand-500/50 transition-all hover:shadow-lg hover:shadow-brand-500/10 flex flex-col gap-3"
                        >
                            <div
                                class="w-full h-32 bg-slate-800 rounded-lg overflow-hidden relative flex items-center justify-center"
                            >
                                {#if file.thumbnailLink}
                                    <img
                                        src={file.thumbnailLink}
                                        alt={file.name}
                                        class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                    />
                                {:else}
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="h-10 w-10 text-slate-500"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        stroke-width="1"
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
            {/if}
        </main>
    </div>
{/if}
