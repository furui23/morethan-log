import { CONFIG } from "site.config"
import { NotionAPI } from "notion-client"
import { idToUuid } from "notion-utils"

import getPageProperties from "src/libs/utils/notion/getPageProperties"
import { TPosts } from "src/types"

/** Convert to UUID format only if not already UUID */
function ensureUuid(id: string): string {
  if (id.length > 32) return id // already UUID format (36 chars)
  return idToUuid(id)
}

/**
 * Notion API v3 requires specific headers. notion-client@6.x uses got
 * which sends a default User-Agent that Notion rejects with 403.
 * We patch NotionAPI.fetch to add the required headers.
 */
function createNotionAPI() {
  const api = new NotionAPI({ authToken: CONFIG.notionConfig.api })
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
  return api
}

export const getPosts = async () => {
  let id = CONFIG.notionConfig.pageId as string
  const api = createNotionAPI()

  // Step 1: Get page metadata to find collection info
  const pageResponse = await api.getPage(id)
  id = ensureUuid(id)

  const collectionValue = Object.values(pageResponse.collection)[0]?.value as any
  const collection = collectionValue?.value ?? collectionValue
  const schema = collection?.schema

  const blockValue = (pageResponse.block[id]?.value as any)?.value ?? pageResponse.block[id]?.value
  const rawMetadata = blockValue

  // Check Type
  if (
    rawMetadata?.type !== "collection_view_page" &&
    rawMetadata?.type !== "collection_view"
  ) {
    return []
  }

  const viewIds = rawMetadata?.view_ids
  if (!viewIds || viewIds.length === 0) {
    return []
  }

  const collectionId = collection?.id ?? rawMetadata?.collection_id
  if (!collectionId) {
    return []
  }

  // Step 2: Fetch all page data via queryCollection
  const collectionData = await api.getCollectionData(
    ensureUuid(collectionId),
    ensureUuid(viewIds[0]),
    {},
    {}
  )

  // Step 3: Merge blocks and collect page IDs
  const mergedBlock = {
    ...pageResponse.block,
    ...collectionData.recordMap.block,
  }

  // Page IDs are all block keys except the main collection_view_page
  const allBlockIds = Object.keys(mergedBlock)
  const pageIds = allBlockIds.filter((key) => key !== id)

  if (pageIds.length === 0) {
    return []
  }

  // Step 4: Build posts from page data
  const data = []
  for (const pageId of pageIds) {
    const properties = (await getPageProperties(pageId, mergedBlock, schema)) || null
    if (!properties) continue

    const pageBlockValue = (mergedBlock[pageId]?.value as any)?.value ?? mergedBlock[pageId]?.value
    properties.createdTime = new Date(
      pageBlockValue?.created_time
    ).toString()
    properties.fullWidth =
      (pageBlockValue?.format as any)?.page_full_width ?? false

    data.push(properties)
  }

  // Sort by date
  data.sort((a: any, b: any) => {
    const dateA: any = new Date(a?.date?.start_date || a.createdTime)
    const dateB: any = new Date(b?.date?.start_date || b.createdTime)
    return dateB - dateA
  })

  return data as TPosts
}