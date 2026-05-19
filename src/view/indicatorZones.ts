/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 * http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type Bounding from '../common/Bounding'
import type { Indicator, IndicatorThreshold, IndicatorZone, IndicatorZoneGradient } from '../component/Indicator'
import type { YAxis } from '../component/YAxis'
import type { IndicatorStyle } from '../common/Styles'
import { isNumber } from '../common/utils/typeChecks'

type IndicatorZoneZLevel = 'belowFigures' | 'aboveFigures'

interface IndicatorRenderZone {
  from: number
  to: number
  color?: string
  opacity?: number
  gradient?: IndicatorZoneGradient
}

function clamp (value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max))
}

function createFillStyle (
  ctx: CanvasRenderingContext2D,
  zone: IndicatorRenderZone,
  bounding: Bounding
): string | CanvasGradient {
  const gradient = zone.gradient
  if (gradient !== undefined) {
    const direction = gradient.direction ?? 'vertical'
    const canvasGradient = direction === 'horizontal'
      ? ctx.createLinearGradient(0, 0, bounding.width, 0)
      : ctx.createLinearGradient(0, 0, 0, bounding.height)
    const fromColor = gradient.fromColor ?? zone.color ?? 'transparent'
    const toColor = gradient.toColor ?? zone.color ?? 'transparent'
    canvasGradient.addColorStop(0, fromColor)
    canvasGradient.addColorStop(1, toColor)
    return canvasGradient
  }
  return zone.color ?? 'transparent'
}

function drawRenderZone (
  ctx: CanvasRenderingContext2D,
  yAxis: YAxis,
  bounding: Bounding,
  zone: IndicatorRenderZone
): void {
  const fromY = yAxis.convertToPixel(zone.from)
  const toY = yAxis.convertToPixel(zone.to)
  const top = clamp(Math.min(fromY, toY), 0, bounding.height)
  const bottom = clamp(Math.max(fromY, toY), 0, bounding.height)
  const height = bottom - top
  if (height <= 0) {
    return
  }
  ctx.save()
  ctx.globalAlpha *= zone.opacity ?? 1
  ctx.fillStyle = createFillStyle(ctx, zone, bounding)
  ctx.fillRect(0, top, bounding.width, height)
  ctx.restore()
}

function thresholdToZone (threshold: IndicatorThreshold, yAxis: YAxis): IndicatorRenderZone {
  const range = yAxis.getRange()
  return {
    from: threshold.direction === 'above' ? threshold.value : range.from,
    to: threshold.direction === 'above' ? range.to : threshold.value,
    color: threshold.color,
    opacity: threshold.opacity,
    gradient: threshold.gradient
  }
}

export function drawIndicatorZones (
  ctx: CanvasRenderingContext2D,
  indicator: Indicator,
  defaultStyles: IndicatorStyle,
  yAxis: YAxis,
  bounding: Bounding,
  zLevel: IndicatorZoneZLevel
): void {
  indicator.zones.forEach((zone: IndicatorZone) => {
    if (zone.visible === false || (zone.zLevel ?? 'belowFigures') !== zLevel) {
      return
    }
    const from = zone.from
    const to = zone.to
    if (!isNumber(from) || !isNumber(to)) {
      return
    }
    drawRenderZone(ctx, yAxis, bounding, {
      from,
      to,
      color: zone.color ?? defaultStyles.zones.bandColor,
      opacity: zone.opacity,
      gradient: zone.gradient
    })
  })

  indicator.thresholds.forEach((threshold: IndicatorThreshold) => {
    if (threshold.visible === false || (threshold.zLevel ?? 'belowFigures') !== zLevel || !isNumber(threshold.value)) {
      return
    }
    const zone = thresholdToZone(threshold, yAxis)
    const defaultColor = threshold.direction === 'above'
      ? defaultStyles.zones.upperColor
      : defaultStyles.zones.lowerColor
    drawRenderZone(ctx, yAxis, bounding, {
      ...zone,
      color: zone.color ?? defaultColor
    })
  })
}
