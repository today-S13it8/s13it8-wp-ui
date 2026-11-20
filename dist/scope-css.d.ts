export interface ScopeOptions {
    /** The view root's class, without the dot: "ft-app". */
    scope: string;
    /** Class of server-HTML islands inside a view, which the reset skips. Default: "{scope}-html". */
    island?: string;
}
export declare function scopeCss(css: string, options: ScopeOptions): string;
/** Vite plugin: scope every CSS file in the build. */
export declare function scopeCssPlugin(options: ScopeOptions): {
    name: string;
    enforce: "post";
    generateBundle(_options: unknown, bundle: Record<string, {
        type: string;
        fileName: string;
        source?: string | Uint8Array;
    }>): void;
};
