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

import type { IndicatorTemplate } from '../../component/Indicator'

interface StochasticRsi {
  k?: number
  d?: number
}

/**
 * Stochastic RSI
 * k = SMA(STOCH(RSI(CLOSE, rsiLength), RSI, RSI, stochLength), smoothK)
 * d = SMA(k, smoothD)
 */
const stochasticRsi: IndicatorTemplate<StochasticRsi, number> = {
  name: 'StochRSI',
  shortName: 'Stoch RSI',
  calcParams: [3, 3, 14, 14],
  precision: 2,
  minValue: 0,
  maxValue: 100,
  figures: [
    {
      key: 'k',
      title: 'K: ',
      type: 'line',
      styles: () => ({ color: '#2962FF' })
    },
    {
      key: 'd',
      title: 'D: ',
      type: 'line',
      styles: () => ({ color: '#FF6D00' })
    }
  ],
  calc: (dataList, indicator) => {
    const [smoothK, smoothD, rsiLength, stochLength] = indicator.calcParams
    const closeList = dataList.map(kLineData => kLineData.close)
    const rsiList = calcRsi(closeList, rsiLength)
    const stochList = calcStoch(rsiList, stochLength)
    const kList = calcSma(stochList, smoothK)
    const dList = calcSma(kList, smoothD)
    return kList.map((k, i) => {
      const result: StochasticRsi = {}
      const d = dList[i]
      if (k !== undefined) {
        result.k = k
      }
      if (d !== undefined) {
        result.d = d
      }
      return result
    })
  }
}

function calcRsi (sourceList: number[], length: number): Array<number | undefined> {
  const result: Array<number | undefined> = []
  let gainSum = 0
  let lossSum = 0
  let avgGain = 0
  let avgLoss = 0
  let hasAvg = false
  sourceList.forEach((source, i) => {
    const change = i === 0 ? 0 : source - sourceList[i - 1]
    const gain = Math.max(change, 0)
    const loss = Math.max(-change, 0)
    gainSum += gain
    lossSum += loss
    if (i < length) {
      result[i] = undefined
      return
    }
    if (!hasAvg) {
      avgGain = gainSum / length
      avgLoss = lossSum / length
      hasAvg = true
    } else {
      avgGain = (avgGain * (length - 1) + gain) / length
      avgLoss = (avgLoss * (length - 1) + loss) / length
    }
    if (avgLoss === 0) {
      result[i] = 100
    } else if (avgGain === 0) {
      result[i] = 0
    } else {
      result[i] = 100 - (100 / (1 + avgGain / avgLoss))
    }
  })
  return result
}

function calcStoch (sourceList: Array<number | undefined>, length: number): Array<number | undefined> {
  const result: Array<number | undefined> = []
  const values: number[] = []
  sourceList.forEach((source, i) => {
    if (source !== undefined) {
      values.push(source)
      if (values.length > length) {
        values.shift()
      }
    }
    if (values.length === length) {
      const lowest = Math.min(...values)
      const highest = Math.max(...values)
      const range = highest - lowest
      result[i] = range === 0 || source === undefined ? undefined : 100 * (source - lowest) / range
    } else {
      result[i] = undefined
    }
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
        const firstValue = values.shift()
        if (firstValue !== undefined) {
          sum -= firstValue
        }
      }
    }
    result[i] = values.length === length ? sum / length : undefined
  })
  return result
}

export default stochasticRsi
