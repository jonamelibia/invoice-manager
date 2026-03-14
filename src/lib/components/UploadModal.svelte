<script lang="ts">
    import { createEventDispatcher } from "svelte";
    let { show = false, targetFolderId, onClose, onUploadSuccess } = $props();

    let isDragging = $state(false);
    let isUploading = $state(false);
    let selectedFile = $state<File | null>(null);
    let uploadProgress = $state(0);
    let errorMsg = $state<string | null>(null);
    let customFileName = $state("");

    // Camera variables
    let showCamera = $state(false);
    let videoElement = $state<HTMLVideoElement | null>(null);
    let mediaStream = $state<MediaStream | null>(null);

    // Scanner / Perspective Cropper variables
    let showCropper = $state(false);
    let cropImageSrc = $state<string | null>(null);
    let cropperElement = $state<HTMLImageElement | null>(null);
    
    // Corners are relative to image dimensions (0.0 to 1.0)
    let ptTopLeft = $state({x: 0.1, y: 0.1});
    let ptTopRight = $state({x: 0.9, y: 0.1});
    let ptBottomLeft = $state({x: 0.1, y: 0.9});
    let ptBottomRight = $state({x: 0.9, y: 0.9});
    let activePoint = $state<'tl'|'tr'|'bl'|'br'|null>(null);

    // Scanner logic reimplemented locally to avoid jscanify bundling issues
    function getDistance(p1: {x:number, y:number}, p2: {x:number, y:number}) {
        return Math.hypot(p1.x - p2.x, p1.y - p2.y);
    }

    function findPaperContour(cv: any, img: any) {
        const imgGray = new cv.Mat();
        cv.Canny(img, imgGray, 50, 200);
        const imgBlur = new cv.Mat();
        cv.GaussianBlur(imgGray, imgBlur, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT);
        const imgThresh = new cv.Mat();
        cv.threshold(imgBlur, imgThresh, 0, 255, cv.THRESH_OTSU);

        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(imgThresh, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);

        let maxArea = 0;
        let maxContourIndex = -1;
        for (let i = 0; i < contours.size(); ++i) {
            let contourArea = cv.contourArea(contours.get(i));
            if (contourArea > maxArea) {
                maxArea = contourArea;
                maxContourIndex = i;
            }
        }

        const maxContour = maxContourIndex >= 0 ? contours.get(maxContourIndex).clone() : null;

        imgGray.delete(); imgBlur.delete(); imgThresh.delete(); contours.delete(); hierarchy.delete();
        return maxContour;
    }

    function getCornerPoints(cv: any, contour: any) {
        let rect = cv.minAreaRect(contour);
        const center = rect.center;
        let corners: any = { tl: null, tr: null, bl: null, br: null };
        let dists: any = { tl: 0, tr: 0, bl: 0, br: 0 };

        for (let i = 0; i < contour.data32S.length; i += 2) {
            const point = { x: contour.data32S[i], y: contour.data32S[i + 1] };
            const dist = getDistance(point, center);
            if (point.x < center.x && point.y < center.y) {
                if (dist > dists.tl) { corners.tl = point; dists.tl = dist; }
            } else if (point.x > center.x && point.y < center.y) {
                if (dist > dists.tr) { corners.tr = point; dists.tr = dist; }
            } else if (point.x < center.x && point.y > center.y) {
                if (dist > dists.bl) { corners.bl = point; dists.bl = dist; }
            } else if (point.x > center.x && point.y > center.y) {
                if (dist > dists.br) { corners.br = point; dists.br = dist; }
            }
        }
        return corners;
    }

    function extractPaper(cv: any, image: HTMLImageElement, resultWidth: number, resultHeight: number, cornerPoints: any) {
        const canvas = document.createElement("canvas");
        const img = cv.imread(image);
        let warpedDst = new cv.Mat();
        let dsize = new cv.Size(resultWidth, resultHeight);
        
        let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
            cornerPoints.tl.x, cornerPoints.tl.y,
            cornerPoints.tr.x, cornerPoints.tr.y,
            cornerPoints.bl.x, cornerPoints.bl.y,
            cornerPoints.br.x, cornerPoints.br.y,
        ]);

        let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
            0, 0,
            resultWidth, 0,
            0, resultHeight,
            resultWidth, resultHeight,
        ]);

        let M = cv.getPerspectiveTransform(srcTri, dstTri);
        cv.warpPerspective(img, warpedDst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
        cv.imshow(canvas, warpedDst);

        img.delete(); warpedDst.delete(); M.delete(); srcTri.delete(); dstTri.delete();
        return canvas;
    }

    $effect(() => {
        if (
            videoElement &&
            mediaStream &&
            videoElement.srcObject !== mediaStream
        ) {
            videoElement.srcObject = mediaStream;
        }
    });

    async function initScannerOverlay() {
        if (!cropperElement || !(window as any).cvReady || !cropImageSrc) return;
        try {
            // Ensure image is fully loaded
            if (!cropperElement.complete || cropperElement.naturalWidth === 0) {
                setTimeout(initScannerOverlay, 100);
                return;
            }

            const cv = (window as any).cv;
            const img = cv.imread(cropperElement);
            const maxContour = findPaperContour(cv, img);
            
            if (maxContour) {
                const corners = getCornerPoints(cv, maxContour);
                if (corners.tl && corners.tr && corners.bl && corners.br) {
                    ptTopLeft = { x: corners.tl.x / img.cols, y: corners.tl.y / img.rows };
                    ptTopRight = { x: corners.tr.x / img.cols, y: corners.tr.y / img.rows };
                    ptBottomLeft = { x: corners.bl.x / img.cols, y: corners.bl.y / img.rows };
                    ptBottomRight = { x: corners.br.x / img.cols, y: corners.br.y / img.rows };
                }
                maxContour.delete();
            }
            img.delete();
        } catch (e) {
            console.error("Error en autodetectección:", e);
        }
    }

    // Effect to monitor OpenCV ready state and image availability
    $effect(() => {
        if (showCropper && (window as any).cvReady && cropperElement) {
            initScannerOverlay();
        }
    });

    // Pointer events for dragging
    function handlePointerMove(e: PointerEvent) {
        if (!activePoint || !cropperElement) return;
        const rect = cropperElement.getBoundingClientRect();
        
        // Calculate percentages
        let nx = (e.clientX - rect.left) / rect.width;
        let ny = (e.clientY - rect.top) / rect.height;
        nx = Math.max(0, Math.min(1, nx));
        ny = Math.max(0, Math.min(1, ny));

        if (activePoint === 'tl') ptTopLeft = {x: nx, y: ny};
        if (activePoint === 'tr') ptTopRight = {x: nx, y: ny};
        if (activePoint === 'bl') ptBottomLeft = {x: nx, y: ny};
        if (activePoint === 'br') ptBottomRight = {x: nx, y: ny};
    }

    function handlePointerUp() {
        activePoint = null;
    }

    async function startCamera() {
        errorMsg = null;
        showCamera = true;
        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
                audio: false,
            });
        } catch (e: any) {
            errorMsg =
                "Error al iniciar la cámara: comprueba los permisos. (" +
                e.message +
                ")";
            showCamera = false;
        }
    }

    function stopCamera() {
        if (mediaStream) {
            mediaStream.getTracks().forEach((track) => track.stop());
            mediaStream = null;
        }
        showCamera = false;
    }

    function takePhoto() {
        if (!videoElement) return;
        const canvas = document.createElement("canvas");
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.drawImage(videoElement, 0, 0);

            try {
                // Get the image data from canvas
                cropImageSrc = canvas.toDataURL("image/jpeg", 1.0);
                stopCamera();
                showCropper = true;
            } catch (err: any) {
                console.error("Error capturing photo:", err);
                errorMsg =
                    "Ups, hubo un error capturando la foto: " + err.message;
            }
        }
    }

    function cancelCrop() {
        showCropper = false;
        cropImageSrc = null;
        startCamera();
    }

    async function confirmCrop() {
        if (!cropperElement || !cropImageSrc) return;
        
        try {
            const cv = (window as any).cv;
            if (!cv || !(window as any).cvReady) {
                throw new Error("El motor de escaneo (OpenCV) aún no ha cargado. Por favor espera unos segundos.");
            }
            const imgEl = new Image();
            imgEl.src = cropImageSrc!;
            await new Promise(r => imgEl.onload = r);

            const w = imgEl.width;
            const h = imgEl.height;

            const JscanCorners = {
                tl: { x: ptTopLeft.x * w, y: ptTopLeft.y * h },
                tr: { x: ptTopRight.x * w, y: ptTopRight.y * h },
                bl: { x: ptBottomLeft.x * w, y: ptBottomLeft.y * h },
                br: { x: ptBottomRight.x * w, y: ptBottomRight.y * h },
            };

            const w1 = getDistance(JscanCorners.tl, JscanCorners.tr);
            const w2 = getDistance(JscanCorners.bl, JscanCorners.br);
            const resultWidth = Math.max(w1, w2);

            const h1 = getDistance(JscanCorners.tl, JscanCorners.bl);
            const h2 = getDistance(JscanCorners.tr, JscanCorners.br);
            const resultHeight = Math.max(h1, h2);

            const resultCanvas = extractPaper(cv, imgEl, resultWidth, resultHeight, JscanCorners);
            
            if (!resultCanvas) throw new Error("Fallo al recortar, intenta de nuevo ajustando los puntos.");

            const imgData = resultCanvas.toDataURL("image/jpeg", 0.9);

            const { jsPDF } = await import("jspdf");

            const orientation = resultWidth > resultHeight ? "landscape" : "portrait";
            const pdf = new jsPDF({
                orientation: orientation,
                unit: "px",
                format: [resultWidth, resultHeight],
            });

            pdf.addImage(imgData, "JPEG", 0, 0, resultWidth, resultHeight);
            const pdfBlob = pdf.output("blob");

            const file = new File([pdfBlob], `factura-escaneada-${Date.now()}.pdf`, { type: "application/pdf" });

            handleFileSelection(file);
            showCropper = false;
            cropImageSrc = null;
        } catch (err: any) {
            console.error("Error cropping image:", err);
            errorMsg = "Ups, hubo un error procesando el recorte: " + err.message;
        }
    }

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
        customFileName = file.name;
    }

    async function uploadFile() {
        if (!selectedFile || !targetFolderId) return;

        isUploading = true;
        errorMsg = null;

        const formData = new FormData();
        formData.append(
            "file",
            selectedFile,
            customFileName || selectedFile.name,
        );
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
        stopCamera();
        showCropper = false;
        cropImageSrc = null;
        selectedFile = null;
        uploadProgress = 0;
        errorMsg = null;
        onClose?.();
    }
</script>

<svelte:window onpointermove={handlePointerMove} onpointerup={handlePointerUp} />

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

                {#if showCamera}
                    <!-- Visor de cámara in-app -->
                    <div
                        class="relative w-full bg-black rounded-xl overflow-hidden flex flex-col items-center justify-center border border-surface-glass-border shadow-lg min-h-[60vh] sm:min-h-[40vh]"
                    >
                        <!-- svelte-ignore a11y_media_has_caption -->
                        <video
                            bind:this={videoElement}
                            autoplay
                            playsinline
                            class="w-full h-full object-cover"
                        ></video>
                        <div
                            class="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-8"
                        >
                            <button
                                type="button"
                                class="w-12 h-12 rounded-full bg-slate-800/80 backdrop-blur text-white flex items-center justify-center hover:bg-slate-700 transition"
                                onclick={stopCamera}
                                aria-label="Cancelar"
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
                            <button
                                type="button"
                                class="w-16 h-16 rounded-full bg-white border-4 border-slate-300 shadow-xl hover:scale-105 transition"
                                onclick={takePhoto}
                                aria-label="Capturar"
                            ></button>
                            <div class="w-12 h-12"></div>
                            <!-- Spacer for balance -->
                        </div>
                    </div>
                {:else if showCropper && cropImageSrc}
                    <!-- Visor de recorte de la imagen -->
                    <div class="flex flex-col gap-4">
                        <div
                            class="relative w-full bg-black rounded-xl border border-surface-glass-border shadow-lg min-h-[50vh] flex items-center justify-center select-none overflow-hidden"
                            style="touch-action: none;"
                        >
                            <div class="relative w-full max-w-full inline-block leading-none">
                                <img
                                    bind:this={cropperElement}
                                    src={cropImageSrc}
                                    alt="Recortar imagen"
                                    class="w-full h-auto block select-none pointer-events-none"
                                    onload={initScannerOverlay}
                                    crossorigin="anonymous"
                                />
                                
                                <!-- Polygon connecting points -->
                                <svg 
                                    class="absolute inset-0 w-full h-full pointer-events-none" 
                                    viewBox="0 0 100 100"
                                    preserveAspectRatio="none"
                                    aria-hidden="true"
                                >
                                    <polygon 
                                        points="{ptTopLeft.x*100},{ptTopLeft.y*100} {ptTopRight.x*100},{ptTopRight.y*100} {ptBottomRight.x*100},{ptBottomRight.y*100} {ptBottomLeft.x*100},{ptBottomLeft.y*100}"
                                        fill="rgba(14, 165, 233, 0.2)"
                                        stroke="#0ea5e9"
                                        stroke-width="1"
                                    />
                                </svg>
                                
                                <!-- Drag handles -->
                                <button 
                                    type="button"
                                    class="absolute w-8 h-8 -ml-4 -mt-4 bg-brand-500/80 border-2 border-white rounded-full cursor-move z-10 shadow-lg touch-none" 
                                    style="left: {ptTopLeft.x*100}%; top: {ptTopLeft.y*100}%" 
                                    onpointerdown={(e) => { e.preventDefault(); activePoint = 'tl'; }}
                                    aria-label="Ajustar esquina superior izquierda"
                                ></button>
                                <button 
                                    type="button"
                                    class="absolute w-8 h-8 -ml-4 -mt-4 bg-brand-500/80 border-2 border-white rounded-full cursor-move z-10 shadow-lg touch-none" 
                                    style="left: {ptTopRight.x*100}%; top: {ptTopRight.y*100}%" 
                                    onpointerdown={(e) => { e.preventDefault(); activePoint = 'tr'; }}
                                    aria-label="Ajustar esquina superior derecha"
                                ></button>
                                <button 
                                    type="button"
                                    class="absolute w-8 h-8 -ml-4 -mt-4 bg-brand-500/80 border-2 border-white rounded-full cursor-move z-10 shadow-lg touch-none" 
                                    style="left: {ptBottomLeft.x*100}%; top: {ptBottomLeft.y*100}%" 
                                    onpointerdown={(e) => { e.preventDefault(); activePoint = 'bl'; }}
                                    aria-label="Ajustar esquina inferior izquierda"
                                ></button>
                                <button 
                                    type="button"
                                    class="absolute w-8 h-8 -ml-4 -mt-4 bg-brand-500/80 border-2 border-white rounded-full cursor-move z-10 shadow-lg touch-none" 
                                    style="left: {ptBottomRight.x*100}%; top: {ptBottomRight.y*100}%" 
                                    onpointerdown={(e) => { e.preventDefault(); activePoint = 'br'; }}
                                    aria-label="Ajustar esquina inferior derecha"
                                ></button>
                            </div>
                        </div>
                        <div class="flex items-center justify-between gap-4">
                            <p class="text-sm text-slate-400">Ajusta los 4 bordes del documento</p>
                            <button 
                                type="button"
                                class="text-brand-400 hover:text-brand-300 text-xs font-medium flex items-center gap-1"
                                onclick={initScannerOverlay}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                Redetectar bordes
                            </button>
                        </div>
                        <div class="flex gap-3 justify-end mt-2">
                            <button
                                type="button"
                                class="btn btn-secondary text-sm px-6"
                                onclick={cancelCrop}>Reintentar</button
                            >
                            <button
                                type="button"
                                class="btn btn-primary text-sm px-6 font-semibold"
                                onclick={confirmCrop}
                                >Confirmar Escáner</button
                            >
                        </div>
                    </div>
                {:else if !selectedFile}
                    <!-- Drop area -->
                    <div
                        role="presentation"
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
                            <!-- Botón escáner in-app -->
                            <button
                                type="button"
                                class="btn btn-secondary flex items-center gap-2 cursor-pointer text-sm"
                                onclick={startCamera}
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
                            </button>

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
                            <div class="flex flex-col flex-1 min-w-0 pr-2">
                                <input
                                    type="text"
                                    bind:value={customFileName}
                                    class="text-white font-medium text-sm bg-transparent border-b border-transparent hover:border-surface-glass-border focus:border-brand-500 focus:outline-none w-full transition-colors pb-0.5"
                                    placeholder="Nombre del archivo"
                                    disabled={isUploading}
                                />
                                <span class="text-slate-400 text-xs mt-1"
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
