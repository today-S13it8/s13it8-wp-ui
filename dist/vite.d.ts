import { type UserConfig } from "vite";
export interface WpUiOptions {
    /** The view root's class: "ft-app", "frb-app". One per project, so two projects' styles never meet. */
    scope: string;
    /** Class of server-HTML islands, which the reset skips. Default "{scope}-html". */
    island?: string;
    /** The folder holding main.tsx and styles.css. */
    root: string;
    /** Where the built files go, relative to root. */
    outDir: string;
    /** Entry file, relative to root. Default "src/main.tsx". */
    entry?: string;
    /** More Vite settings, merged on top. */
    extend?: UserConfig;
}
export declare function wpUi(options: WpUiOptions): UserConfig;
