<script lang="ts">
    import "../app.css";
    let { data, children } = $props();
</script>

<div
    class="min-h-screen flex flex-col p-4 md:p-8 gap-6 max-w-6xl mx-auto w-full"
>
    <header
        class="glass-panel p-4 flex flex-col sm:flex-row justify-between items-center gap-4"
    >
        <h1
            class="text-2xl font-bold tracking-tight bg-gradient-to-r from-brand-100 to-white bg-clip-text text-transparent"
        >
            Invoice Manager
        </h1>

        <div class="flex items-center gap-4">
            {#if data.userAuthenticated}
                <div
                    class="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-full text-sm font-medium"
                >
                    <div
                        class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
                    ></div>
                    Connected
                </div>
                <a href="/api/auth/logout" class="btn btn-secondary text-sm"
                    >Logout</a
                >
            {:else}
                <div
                    class="flex items-center gap-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-3 py-1.5 rounded-full text-sm font-medium"
                >
                    <div class="w-2 h-2 rounded-full bg-rose-400"></div>
                    Not Connected
                </div>
                <a
                    href="/api/auth/google"
                    class="btn btn-primary text-sm shadow-brand-500/20 shadow-lg"
                >
                    Connect Google Drive
                </a>
            {/if}
        </div>
    </header>

    <main class="flex-1 flex flex-col gap-6">
        {@render children?.()}
    </main>
</div>
