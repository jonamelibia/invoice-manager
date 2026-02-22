import type { PageServerLoad } from './$types';
import { getOrCreateDeepFolder, getFilesInFolder } from '$lib/server/drive';

export const load: PageServerLoad = async ({ locals }) => {
    // Si no está autenticado, devolvemos un estado vacío y el componente mostrará un mensaje
    if (!locals.userAuthenticated || !locals.drive) {
        return {
            files: [],
            folderId: null,
            error: null
        };
    }

    try {
        // Por defecto, cargamos el mes actual y facturas emitidas para que el panel no esté vacío
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear().toString();
        const monthNames = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
        const monthIndex = currentDate.getMonth();
        const currentMonthNumber = (monthIndex + 1).toString().padStart(2, '0');
        const currentMonth = `${currentMonthNumber}${monthNames[monthIndex]}`;
        const defaultType = 'facturas_emitidas';

        // Intentamos encontrar la carpeta. Si no existe, la librería utilitaria la creará.
        const folderId = await getOrCreateDeepFolder(locals.drive, currentYear, currentMonth, defaultType);
        const files = await getFilesInFolder(locals.drive, folderId);

        return {
            files,
            folderId,
            defaultYear: currentYear,
            defaultMonth: currentMonth,
            defaultType,
            error: null
        };
    } catch (e: any) {
        console.error("Error loading default files:", e);
        return {
            files: [],
            folderId: null,
            error: "No se han podido cargar los archivos de Google Drive. Por favor, asegúrate de que has iniciado sesión correctamente."
        };
    }
};
