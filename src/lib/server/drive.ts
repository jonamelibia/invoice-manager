import type { drive_v3 } from 'googleapis';

export interface DriveNode {
    id: string;
    name: string;
    mimeType: string;
    isFolder: boolean;
    webViewLink?: string;
    thumbnailLink?: string;
    createdTime?: string;
    children?: DriveNode[];
}

/**
 * Helper to find a folder by name within a specific parent folder ID (or root).
 */
export async function findFolderByName(drive: drive_v3.Drive, name: string, parentId: string = 'root'): Promise<string | null> {
    const query = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`;

    const response = await drive.files.list({
        q: query,
        fields: 'files(id, name)',
        spaces: 'drive',
    });

    const files = response.data.files;
    if (files && files.length > 0) {
        return files[0].id!;
    }
    return null;
}

/**
 * Helper to create a folder by name within a specific parent folder ID.
 */
export async function createFolder(drive: drive_v3.Drive, name: string, parentId: string = 'root'): Promise<string> {
    const metadata = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
    };

    const response = await drive.files.create({
        requestBody: metadata,
        fields: 'id'
    });

    return response.data.id!;
}

/**
 * Gets or creates a folder structure like: facturas > year > month > type
 * Returns the ID of the deeply nested folder.
 */
export async function getOrCreateDeepFolder(drive: drive_v3.Drive, year: string, month: string, type: 'facturas_emitidas' | 'facturas_recibidas'): Promise<string> {
    // 1. Root folder 'facturas'
    let rootFacturasId = await findFolderByName(drive, 'facturas');
    if (!rootFacturasId) {
        rootFacturasId = await createFolder(drive, 'facturas');
    }

    // 2. Year folder
    let yearFolderId = await findFolderByName(drive, year, rootFacturasId);
    if (!yearFolderId) {
        yearFolderId = await createFolder(drive, year, rootFacturasId);
    }

    // 3. Month folder
    let monthFolderId = await findFolderByName(drive, month, yearFolderId);
    if (!monthFolderId) {
        monthFolderId = await createFolder(drive, month, yearFolderId);
    }

    // 4. Type folder
    let typeFolderId = await findFolderByName(drive, type, monthFolderId);
    if (!typeFolderId) {
        typeFolderId = await createFolder(drive, type, monthFolderId);
    }

    return typeFolderId;
}

/**
 * Retrieves the contents of a specific folder ID (files only, no subfolders).
 */
export async function getFilesInFolder(drive: drive_v3.Drive, folderId: string) {
    const query = `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`;

    const response = await drive.files.list({
        q: query,
        fields: 'files(id, name, mimeType, webViewLink, thumbnailLink, createdTime)',
        orderBy: 'createdTime desc',
    });

    return response.data.files || [];
}

/**
 * Gets all children (folders and files) of a specific folder.
 */
export async function getFolderChildren(drive: drive_v3.Drive, folderId: string): Promise<DriveNode[]> {
    const query = `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

    const response = await drive.files.list({
        q: query,
        fields: 'files(id, name, mimeType, webViewLink, thumbnailLink, createdTime)',
        orderBy: 'folder, name',
        pageSize: 100,
    });

    const files = response.data.files || [];

    return files.map(file => ({
        id: file.id!,
        name: file.name!,
        mimeType: file.mimeType!,
        isFolder: file.mimeType === 'application/vnd.google-apps.folder',
        webViewLink: file.webViewLink || undefined,
        thumbnailLink: file.thumbnailLink || undefined,
        createdTime: file.createdTime || undefined,
    }));
}

/**
 * Recursively builds a folder tree structure starting from a root folder.
 * @param maxDepth Maximum depth to traverse (default: 4)
 */
export async function buildFolderTree(
    drive: drive_v3.Drive,
    folderId: string = 'root',
    maxDepth: number = 4,
    currentDepth: number = 0
): Promise<DriveNode> {
    // Get folder info
    let folderName = 'Root';
    if (folderId !== 'root') {
        const info = await drive.files.get({
            fileId: folderId,
            fields: 'id, name, mimeType'
        });
        folderName = info.data.name || 'Unknown';
    }

    const node: DriveNode = {
        id: folderId,
        name: folderName,
        mimeType: folderId === 'root' ? 'application/vnd.google-apps.folder' : 'application/vnd.google-apps.folder',
        isFolder: true,
        children: []
    };

    if (currentDepth >= maxDepth) {
        return node;
    }

    const children = await getFolderChildren(drive, folderId);

    // Sort: folders first, then files
    const folders = children.filter(c => c.isFolder);
    const files = children.filter(c => !c.isFolder);

    // Recursively build tree for subfolders (with lazy loading flag) in parallel
    const childNodes = await Promise.all(
        folders.map((folder) => buildFolderTree(drive, folder.id, maxDepth, currentDepth + 1))
    );
    node.children!.push(...childNodes);

    // Add files as leaf nodes
    node.children!.push(...files);

    return node;
}

/**
 * Finds the 'facturas' folder ID, creating it if it doesn't exist.
 */
export async function getFacturasRootId(drive: drive_v3.Drive): Promise<string> {
    let facturasId = await findFolderByName(drive, 'facturas');
    if (!facturasId) {
        facturasId = await createFolder(drive, 'facturas');
    }
    return facturasId;
}
