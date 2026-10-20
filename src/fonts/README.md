# Local fonts

The site's fonts are vendored here and loaded with `next/font/local` (`site.ts`), so neither the build nor a visit
requests Google Fonts. `next/font/google` fetches at build time, and Google can return extensionless font URLs that
break Next's loader ([Next.js #99114](https://github.com/vercel/next.js/issues/99114)) — on 2026-10-15 that failed
a derived product's Preview and local production build. Vendoring removes that external build input; no CSP origin or
runtime request is added. `tests/unit/fonts.unit.spec.ts` fails if `next/font/google` comes back.

Each family's license and copyright notice is in `licenses/`. All are SIL Open Font License 1.1.

| File               | Used by                              | Upstream                                                                                                                                                   | License                     |
| ------------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `geist.woff2`      | `site.ts` (`--font-geist-sans`)      | [google/fonts@954e256c4277](https://github.com/google/fonts/tree/954e256c4277419b5e48bffa51be069b2bd01bde) `ofl/geist/Geist[wght].ttf`, converted to WOFF2 | `licenses/geist.txt`        |
| `geist-mono.woff2` | `site.ts` (`--font-geist-mono`)      | same commit, `ofl/geistmono/GeistMono[wght].ttf`, converted to WOFF2                                                                                       | `licenses/geist-mono.txt`   |
| `geist-400.ttf`    | `src/lib/og-image.tsx` (share image) | npm `geist@1.8.1` (vercel/geist-font) `dist/fonts/geist-sans/Geist-Regular.ttf`, unchanged                                                                 | `licenses/geist-static.txt` |
| `geist-600.ttf`    | `src/lib/og-image.tsx` (share image) | same package, `Geist-SemiBold.ttf`, unchanged                                                                                                              | `licenses/geist-static.txt` |

The WOFF2 files are variable (weight 100–900), not subset: Latin and Cyrillic, including Ё/ё. They were converted
with FontTools 4.67.0 + Brotli 1.2.0, non-weight axes pinned to their defaults (what the Google loader served).
The TTFs are static cuts for the share image only: Satori (`next/og`) reads neither WOFF2 nor the weights of a
variable font.

## Updating

Refresh the files and their licenses together from a pinned upstream commit, update this table, then check
`pnpm build` and the Russian pages. Keep the options literal in each `localFont({...})` call — Next reads them at
compile time.
