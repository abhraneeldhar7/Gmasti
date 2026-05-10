import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import type { UsageHistory } from "@/lib/types"
import { authenticatedFetch } from "@/lib/auth"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const chartConfig = {
  posts: {
    label: "Posts",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export function UsageChart() {
  const [timeRange, setTimeRange] = React.useState("24h")
  const [data, setData] = React.useState<UsageHistory | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    setLoading(true)
    authenticatedFetch(`/usage/history?range=${timeRange}`)
      .then((res) => res.json())
      .then((json: UsageHistory) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [timeRange])

  const chartData = React.useMemo(() => {
    if (!data?.buckets) return []

    return data.buckets.map((b) => {
      let label: string
      if (timeRange === "7d") {
        const d = new Date(b.timestamp)
        label = d.toLocaleDateString([], { weekday: "short" })
      } else {
        const d = new Date(b.timestamp)
        label = d.toLocaleTimeString([], { hour: "2-digit" })
      }
      return { label, posts: b.count }
    })
  }, [data, timeRange])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-4 justify-between">
        <div>
          <h2 className="text-lg font-semibold">Usage</h2>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading..." : data ? `${data.total} posts rewritten` : "No data"}
          </p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger
            className="w-[160px] rounded-lg border-none bg-muted shadow-sm"
            aria-label="Select time range"
          >
            <SelectValue placeholder="Last 24 hours" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="24h" className="rounded-lg">
              Last 24 hours
            </SelectItem>
            <SelectItem value="7d" className="rounded-lg">
              Last 7 days
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="relative w-full">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={chartData} margin={{ left: -20, right: -20 }}>
            <defs>
              <linearGradient id="fillPosts" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-posts)" stopOpacity={0.6} />
                <stop offset="95%" stopColor="var(--color-posts)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <Area
              dataKey="posts"
              type="monotone"
              fill="url(#fillPosts)"
              stroke="var(--color-posts)"
            />
          </AreaChart>
        </ChartContainer>
      </div>
    </div>
  )
}


