import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { getFolderChildren, getFacturasRootId } from '$lib/server/drive';

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

/**
 * Recursively builds a folder tree structure.
 */
async function buildTree(
    drive: any,
    folderId: string,
    maxDepth: number,
    currentDepth: number
): Promise<TreeNode> {
    // Get folder info
    let folderName = 'Root';
    let folderMime = 'application/vnd.google-apps.folder';

    if (folderId !== 'root') {
        try {
            const info = await drive.files.get({
                fileId: folderId,
                fields: 'id, name, mimeType'
            });
            folderName = info.data.name || 'Unknown';
            folderMime = info.data.mimeType || folderMime;
        } catch (e) {
            console.error(`Error getting folder info for ${folderId}:`, e);
            folderName = 'Unknown Folder';
        }
    }

    const node: TreeNode = {
        id: folderId,
        name: folderName,
        mimeType: folderMime,
        isFolder: true,
        children: []
    };

    // Stop recursion if max depth reached
    if (currentDepth >= maxDepth) {
        return node;
    }

    try {
        const children = await getFolderChildren(drive, folderId);

        // Separate folders and files
        const folders = children.filter(c => c.isFolder);
        const files = children.filter(c => !c.isFolder);

        // Recursively build tree for subfolders in parallel
        const childNodes = await Promise.all(
            folders.map(async (folder) => {
                try {
                    return await buildTree(drive, folder.id, maxDepth, currentDepth + 1);
                } catch (e) {
                    console.error(`Error building tree for folder ${folder.id}:`, e);
                    // Add folder without children on error
                    return {
                        id: folder.id,
                        name: folder.name,
                        mimeType: folder.mimeType,
                        isFolder: true,
                        children: []
                    };
                }
            })
        );
        node.children!.push(...childNodes);

        // Add files as leaf nodes
        node.children!.push(...files);
    } catch (e) {
        console.error(`Error getting children for folder ${folderId}:`, e);
    }

    return node;
}

export async function GET({ url, locals }: RequestEvent) {
    if (!locals.userAuthenticated || !locals.drive) {
        throw error(401, 'Unauthorized');
    }

    try {
        // Get the 'facturas' folder as root
        const facturasId = await getFacturasRootId(locals.drive);

        // Build tree with max depth of 4 levels
        const tree = await buildTree(locals.drive, facturasId, 4, 0);

        return json(tree);
    } catch (e: any) {
        console.error("Error building folder tree:", e);
        throw error(500, `Failed to build folder tree: ${e.message}`);
    }
}