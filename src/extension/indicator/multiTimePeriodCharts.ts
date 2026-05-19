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

import type { KLineData } from '../../common/Data'
import { hexToRgb } from '../../common/utils/color'
import { drawRect } from '../figure/rect'

import type { IndicatorTemplate } from '../../component/Indicator'

type MtpcCalcType = 'hl' | 'oc' | 'ohlc' | 'tr'

interface MtpcExtendData {
  timeframe?: string
  calcType?: MtpcCalcType
  useHeikinAshi?: boolean
  upBorderColor?: string
  upBodyColor?: string
  downBorderColor?: string
  downBodyColor?: string
}

interface Mtpc {
  open?: number
  close?: number
  top?: number
  bottom?: number
  startIndex?: number
  endIndex?: number
}

interface MtpcPeriod {
  key: string
  startIndex: number
  endIndex: number
  open: number
  high: number
  low: number
  close: number
  prevClose?: number
}

const DEFAULT_UP_BORDER_COLOR = '#009688'
const DEFAULT_DOWN_BORDER_COLOR = '#F44336'
const DEFAULT_UP_BODY_COLOR = hexToRgb(DEFAULT_UP_BORDER_COLOR, 0.3)
const DEFAULT_DOWN_BODY_COLOR = hexToRgb(DEFAULT_DOWN_BORDER_COLOR, 0.3)

function getPeriodKey (timestamp: number, timeframe: string): string {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = date.getMonth()
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()
  const tf = timeframe.trim().toUpperCase()
  const value = Number.parseInt(tf, 10)
  if (tf.endsWith('S')) {
    const seconds = Number.isNaN(value) ? 1 : value
    return `${year}-${month}-${day}-${hour}-${minute}-${Math.floor(second / seconds)}`
  }
  if (tf.endsWith('W')) {
    const monday = new Date(year, month, day)
    const weekDay = monday.getDay()
    monday.setDate(day - (weekDay === 0 ? 6 : weekDay - 1))
    const weeks = Number.isNaN(value) ? 1 : value
    const weekIndex = Math.floor(monday.getTime() / (weeks * 7 * 24 * 60 * 60 * 1000))
    return `W-${weekIndex}`
  }
  if (tf.endsWith('M')) {
    const months = Number.isNaN(value) ? 1 : value
    return `${year}-${Math.floor(month / months)}`
  }
  if (tf.endsWith('D')) {
    const days = Number.isNaN(value) ? 1 : value
    return `D-${Math.floor(new Date(year, month, day).getTime() / (days * 24 * 60 * 60 * 1000))}`
  }
  const minutes = Number.isNaN(value) ? 1440 : value
  return `m-${Math.floor(timestamp / (minutes * 60 * 1000))}`
}

function inferAutoTimeframe (dataList: KLineData[]): string {
  if (dataList.length < 2) {
    return '1M'
  }
  const secondsInTF = Math.max(1, Math.round((dataList[1].timestamp - dataList[0].timestamp) / 1000))
  if (secondsInTF < 60) {
    return '120'
  }
  if (secondsInTF < 86400) {
    return '1440'
  }
  if (secondsInTF < 604800) {
    return '1W'
  }
  if (secondsInTF < 2628003) {
    return '1M'
  }
  if (secondsInTF < 7884009) {
    return '3M'
  }
  return '12M'
}

function getTimeframe (dataList: KLineData[], indicator: { extendData: MtpcExtendData }): string {
  const timeframe = indicator.extendData.timeframe ?? 'auto'
  return timeframe === 'auto' ? inferAutoTimeframe(dataList) : timeframe
}

function toHeikinAshiPeriods (periods: MtpcPeriod[]): MtpcPeriod[] {
  let prevOpen: number | null = null
  let prevClose: number | null = null
  return periods.map(period => {
    const close = (period.open + period.high + period.low + period.close) / 4
    const open = prevOpen === null || prevClose === null ? (period.open + period.close) / 2 : (prevOpen + prevClose) / 2
    const high = Math.max(period.high, open, close)
    const low = Math.min(period.low, open, close)
    const result = { ...period, open, high, low, close, prevClose: prevClose ?? undefined }
    prevOpen = open
    prevClose = close
    return result
  })
}

function calcTopBottom (period: MtpcPeriod, calcType: MtpcCalcType): [number, number] {
  switch (calcType) {
    case 'oc': {
      return [Math.max(period.open, period.close), Math.min(period.open, period.close)]
    }
    case 'tr': {
      const prevClose = period.prevClose ?? period.close
      return [Math.max(period.high, prevClose), Math.min(period.low, prevClose)]
    }
    default: {
      return [period.high, period.low]
    }
  }
}

function drawBox (
  ctx: CanvasRenderingContext2D,
  left: number,
  right: number,
  top: number,
  bottom: number,
  bodyColor: string,
  borderColor: string
): void {
  const x = Math.min(left, right)
  const y = Math.min(top, bottom)
  drawRect(
    ctx,
    {
      x,
      y,
      width: Math.max(1, Math.abs(right - left)),
      height: Math.max(1, Math.abs(bottom - top))
    },
    {
      style: 'stroke_fill',
      color: bodyColor,
      borderColor,
      borderSize: 1
    }
  )
}

const multiTimePeriodCharts: IndicatorTemplate<Mtpc, never, MtpcExtendData> = {
  name: 'MTPC',
  shortName: 'MTPC',
  series: 'price',
  precision: 2,
  shouldOhlc: true,
  zLevel: -1,
  extendData: {
    timeframe: 'auto',
    calcType: 'hl',
    useHeikinAshi: false,
    upBorderColor: DEFAULT_UP_BORDER_COLOR,
    upBodyColor: DEFAULT_UP_BODY_COLOR,
    downBorderColor: DEFAULT_DOWN_BORDER_COLOR,
    downBodyColor: DEFAULT_DOWN_BODY_COLOR
  },
  figures: [],
  calc: (dataList, indicator) => {
    const timeframe = getTimeframe(dataList, indicator)
    const periods: MtpcPeriod[] = []
    let currentPeriod: MtpcPeriod | null = null
    dataList.forEach((data, index) => {
      const key = getPeriodKey(data.timestamp, timeframe)
      if (currentPeriod === null || currentPeriod.key !== key) {
        currentPeriod = {
          key,
          startIndex: index,
          endIndex: index,
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
          prevClose: periods[periods.length - 1]?.close
        }
        periods.push(currentPeriod)
      } else {
        currentPeriod.endIndex = index
        currentPeriod.high = Math.max(currentPeriod.high, data.high)
        currentPeriod.low = Math.min(currentPeriod.low, data.low)
        currentPeriod.close = data.close
      }
    })

    const calcType = indicator.extendData.calcType ?? 'hl'
    const displayPeriods = indicator.extendData.useHeikinAshi === true ? toHeikinAshiPeriods(periods) : periods
    const result: Mtpc[] = dataList.map(() => ({}))
    displayPeriods.forEach(period => {
      const [top, bottom] = calcTopBottom(period, calcType)
      result[period.startIndex] = {
        open: period.open,
        close: period.close,
        top,
        bottom,
        startIndex: period.startIndex,
        endIndex: period.endIndex
      }
    })
    return result
  },
  draw: ({ ctx, chart, indicator, xAxis, yAxis }) => {
    const { realFrom, realTo } = chart.getVisibleRange()
    const { bar } = chart.getBarSpace()
    const { result, extendData } = indicator
    const calcType = extendData.calcType ?? 'hl'
    const upBorderColor = extendData.upBorderColor ?? DEFAULT_UP_BORDER_COLOR
    const upBodyColor = extendData.upBodyColor ?? DEFAULT_UP_BODY_COLOR
    const downBorderColor = extendData.downBorderColor ?? DEFAULT_DOWN_BORDER_COLOR
    const downBodyColor = extendData.downBodyColor ?? DEFAULT_DOWN_BODY_COLOR
    for (const data of result) {
      if (data.startIndex === undefined || data.endIndex === undefined || data.top === undefined || data.bottom === undefined) {
        continue
      }
      if (data.endIndex < realFrom - 1 || data.startIndex > realTo + 1) {
        continue
      }
      const diff = (data.close ?? 0) - (data.open ?? 0)
      const bodyColor = diff < 0 ? downBodyColor : upBodyColor
      const borderColor = diff < 0 ? downBorderColor : upBorderColor
      const left = xAxis.convertToPixel(data.startIndex) - bar / 2
      const right = xAxis.convertToPixel(data.endIndex) + bar / 2
      drawBox(ctx, left, right, yAxis.convertToPixel(data.top), yAxis.convertToPixel(data.bottom), bodyColor, borderColor)
      if (calcType === 'ohlc' && data.open !== undefined && data.close !== undefined) {
        drawBox(ctx, left, right, yAxis.convertToPixel(data.open), yAxis.convertToPixel(data.close), bodyColor, borderColor)
      }
    }
    return true
  }
}

export default multiTimePeriodCharts
