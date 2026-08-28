import { TradeEditor } from "@/components/manager/trade-editor"

export default async function Page({
  params,
}: {
  params: Promise<{ trade: string }>
}) {
  const { trade } = await params
  return <TradeEditor tradeSlug={trade} />
}
