import { idToUuid } from "notion-utils"
import { ExtendedRecordMap, ID } from "notion-types"

export default function getAllPageIds(
  response: ExtendedRecordMap,
  viewId?: string
) {
  const collectionQuery = response.collection_query
  const views = Object.values(collectionQuery)[0]

  let pageIds: ID[] = []
  if (viewId) {
    const vId = idToUuid(viewId)
    pageIds = views?.[vId]?.blockIds ?? []
  } else {
    const pageSet = new Set<ID>()

    // First try collection_group_results from collection_query
    if (views) {
      Object.values(views).forEach((view: any) => {
        view?.collection_group_results?.blockIds?.forEach((id: ID) =>
          pageSet.add(id)
        )
      })
    }

    // Fallback: if collection_query is empty (Notion API v3 block nesting issue),
    // extract page IDs from collection_view.page_sort
    if (pageSet.size === 0 && response.collection_view) {
      Object.values(response.collection_view).forEach((cv: any) => {
        const viewValue = (cv?.value as any)?.value ?? cv?.value
        viewValue?.page_sort?.forEach((id: ID) => pageSet.add(id))
      })
    }

    pageIds = [...pageSet]
  }
  return pageIds
}