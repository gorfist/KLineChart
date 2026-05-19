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

import { formatValue } from '../../common/utils/format'

import type { IndicatorTemplate } from '../../component/Indicator'

interface Macd {
  macd?: number
  signal?: number
  hist?: number
}

interface MacdExtendData {
  oscillatorMaType?: 'EMA' | 'SMA'
  signalMaType?: 'EMA' | 'SMA'
}

/**
 * MACD
 * macd = MA(CLOSE, fastLength) - MA(CLOSE, slowLength)
 * signal = MA(macd, signalLength)
 * hist = macd - signal
 */
const movingAverageConvergenceDivergence: IndicatorTemplate<Macd, number, MacdExtendData> = {
  name: 'MACD',
  shortName: 'MACD',
  calcParams: [12, 26, 9],
  extendData: {},
  figures: [
    {
      key: 'hist',
      title: 'Hist: ',
      type: 'bar',
      baseValue: 0,
      styles: ({ data, indicator, defaultStyles }) => {
        const { prev, current } = data
        const prevHist = prev?.hist
        const currentHist = current?.hist
        let color = formatValue(indicator.styles, 'bars[0].noChangeColor', (defaultStyles!.bars)[0].noChangeColor) as string
        if (currentHist !== undefined) {
          const rising = prevHist !== undefined && currentHist > prevHist
          color = currentHist >= 0
            ? rising ? '#26a69a' : '#b2dfdb'
            : rising ? '#ffcdd2' : '#ff5252'
        }
        return { style: 'fill', color, borderColor: color }
      }
    },
    {
      key: 'macd',
      title: 'MACD: ',
      type: 'line',
      styles: () => ({ color: '#2962FF' })
    },
    {
      key: 'signal',
      title: 'Signal: ',
      type: 'line',
      styles: () => ({ color: '#ff6d00' })
    }
  ],
  calc: (dataList, indicator) => {
    const [fastLength, slowLength, signalLength] = indicator.calcParams
    const { oscillatorMaType = 'EMA', signalMaType = 'EMA' } = indicator.extendData
    const closeList = dataList.map(kLineData => kLineData.close)
    const fastMaList = calcMa(closeList, fastLength, oscillatorMaType)
    const slowMaList = calcMa(closeList, slowLength, oscillatorMaType)
    const macdList = fastMaList.map((fastMa, i) => {
      const slowMa = slowMaList[i]
      return fastMa === undefined || slowMa === undefined ? undefined : fastMa - slowMa
    })
    const signalList = calcMa(macdList, signalLength, signalMaType)
    return macdList.map((macd, i) => {
      const result: Macd = {}
      const signal = signalList[i]
      if (macd !== undefined) {
        result.macd = macd
      }
      if (signal !== undefined) {
        result.signal = signal
      }
      if (macd !== undefined && signal !== undefined) {
        result.hist = macd - signal
      }
      return result
    })
  }
}

function calcMa (sourceList: Array<number | undefined>, length: number, maType: 'EMA' | 'SMA'): Array<number | undefined> {
  return maType === 'SMA' ? calcSma(sourceList, length) : calcEma(sourceList, length)
}

function calcEma (sourceList: Array<number | undefined>, length: number): Array<number | undefined> {
  const result: Array<number | undefined> = []
  const alpha = 2 / (length + 1)
  let prevEma = 0
  let hasPrevEma = false
  sourceList.forEach((source, i) => {
    if (source === undefined) {
      result[i] = undefined
      return
    }
    prevEma = hasPrevEma ? alpha * source + (1 - alpha) * prevEma : source
    hasPrevEma = true
    result[i] = prevEma
  })
  return result
}

function calcSma (sourceList: Array<number | undefined>, length: number): Array<number | undefined> {
  const result: Array<number | undefined> = []
  const values: number[] = []
  let sum = 0
  sourceList.forEach((source, i) => {
    if (source !== undefined) {
      values.push(source)
      sum += source
      if (values.length > length) {
        sum -= values.shift()!
      }
    }
    result[i] = values.length === length ? sum / length : undefined
  })
  return result
}

export default movingAverageConvergenceDivergence
