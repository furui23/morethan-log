import { CONFIG } from "site.config"
import { NotionAPI } from "notion-client"

export const getRecordMap = async (pageId: string) => {
  const api = new NotionAPI({ authToken: CONFIG.notionConfig.api })
  const recordMap = await api.getPage(pageId)
  return recordMap
}
