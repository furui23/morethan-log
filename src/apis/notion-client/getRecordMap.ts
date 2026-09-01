import { CONFIG } from "site.config"
import { NotionAPI } from "notion-client"

export const getRecordMap = async (pageId: string) => {
  const api = new NotionAPI({ authToken: CONFIG.notionConfig.api })
  // Patch headers for Notion API v3
  const origFetch = api.fetch.bind(api)
  api.fetch = function (opts: any) {
    return origFetch({
      ...opts,
      gotOptions: {
        ...opts.gotOptions,
        headers: {
          ...opts.gotOptions?.headers,
          "User-Agent": "notion-agent/1.0",
          "x-notion-version": "2.2.4",
        },
      },
    })
  }
  const recordMap = await api.getPage(pageId)
  return recordMap
}