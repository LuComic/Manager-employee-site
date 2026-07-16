import { CategoryPageContent } from "@/components/knowledge-base/category-page-content"
import { categories } from "@/lib/knowledge-base"

export function generateStaticParams() {
  return categories.map((category) => ({ category: category.id }))
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category } = await params
  return <CategoryPageContent categoryId={category} />
}
