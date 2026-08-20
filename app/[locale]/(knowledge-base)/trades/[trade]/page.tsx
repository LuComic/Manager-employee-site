import { TradeDetail } from "@/components/trades/trade-detail"

export default async function Page({
  params,
}: {
  params: Promise<{ trade: string }>
}) {
  const { trade } = await params
  return <TradeDetail tradeSlug={trade} />
}
