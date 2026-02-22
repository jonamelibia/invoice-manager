// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
    namespace App {
        // interface Error {}
        interface Locals {
            userAuthenticated: boolean;
            drive?: import('googleapis').drive_v3.Drive;
        }
        // interface PageData {}
        // interface PageState {}
        // interface Platform {}
    }
}

export { };
