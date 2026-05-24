export function sortEvents<T extends { startDate: Date }>(events: T[]) {
  return [...events].sort((left, right) => left.startDate.getTime() - right.startDate.getTime())
}

export function formatPlacemark(placemark: Record<string, unknown> | undefined) {
  if (!placemark) {
    return "当前位置"
  }

  const keys = [
    "name",
    "locality",
    "subLocality",
    "administrativeArea",
  ]

  const parts = keys
    .map((key) => placemark[key])
    .filter((value): value is string => typeof value === "string" && value.length > 0)

  return parts.length > 0 ? parts.join(" ") : "当前位置"
}

