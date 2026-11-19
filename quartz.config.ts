import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "KurtJang",
    pageTitleSuffix: "",
    enableSPA: true,
    enablePopovers: true,
    analytics: {
      provider: "plausible",
    },
    locale: "en-US",
    baseUrl: "jsukjin.github.io",
    ignorePatterns: ["private", "templates", ".obsidian"],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: "Schibsted Grotesk",
        body: "Source Sans Pro",
        code: "IBM Plex Mono",
      },
      // [2026-05-12] colors를 github-theme 팔레트에 맞게 수정
      // quartz.config.ts의 colors는 base.scss의 --light, --dark, --secondary 등
      // Quartz 기본 변수에 매핑됨. github-theme의 _index.scss 색상과 최대한 일치시킴.
      colors: {
        lightMode: {
          light: "#ffffff",
          lightgray: "#e1e4e8",
          gray: "#8b949e",
          darkgray: "#24292f",
          dark: "#24292f",
          secondary: "#0969da",
          tertiary: "#6e7781",
          highlight: "rgba(84, 174, 255, 0.1)",
          textHighlight: "#fff8c5",
        },
        darkMode: {
          light: "#0d1117",
          lightgray: "#21262d",
          gray: "#8b949e",
          darkgray: "#c9d1d9",
          dark: "#7ee787", // github-theme 다크모드 헤딩 녹색
          secondary: "#58a6ff",
          tertiary: "#8b949e",
          highlight: "rgba(56, 139, 253, 0.1)",
          textHighlight: "#bb800026",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.HardLineBreaks(),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
      // Comment out CustomOgImages to speed up build time
      Plugin.CustomOgImages(),
    ],
  },
}

export default config
