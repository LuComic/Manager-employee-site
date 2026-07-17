import { CategoryPageContent } from "@/components/knowledge-base/category-page-content"

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category } = await params
  return <CategoryPageContent categoryId={category} />
}
